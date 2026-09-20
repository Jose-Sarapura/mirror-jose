import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FARSIDE_URL = 'https://farside.co.uk/bitcoin-etf-flow-all-data/';
const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFlow(value) {
  const raw = cleanText(value);
  if (!raw || raw === '-' || raw === '–' || raw === '—') return 0;
  const negative = /^\(.*\)$/.test(raw);
  const numeric = Number(raw.replace(/[(),$]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return negative ? -numeric : numeric;
}

function parseDate(value) {
  const raw = cleanText(value);
  const match = raw.match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const month = months[match[2]];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]))).toISOString().slice(0, 10);
}

function sumLast(rows, n, endIndex = rows.length - 1) {
  if (!rows.length || endIndex < 0) return null;
  const start = Math.max(0, endIndex - n + 1);
  return rows.slice(start, endIndex + 1).reduce((sum, row) => sum + row.total, 0);
}

function findRowAtOrBefore(rows, date) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].date <= date) return { row: rows[i], index: i };
  }
  return { row: null, index: -1 };
}

async function fetchFarside() {
  const response = await fetch(FARSIDE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Farside HTTP ${response.status}`);

  const html = await response.text();
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows = [];

  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1]);
    if (cells.length < 2) continue;
    const date = parseDate(cells[0]);
    if (!date) continue;
    const total = parseFlow(cells[cells.length - 1]);
    if (!Number.isFinite(total)) continue;
    rows.push({ date, total });
  }

  return rows
    .filter((row, index, array) => index === array.findIndex((item) => item.date === row.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchBtcPrices() {
  const params = new URLSearchParams({
    assets: 'btc',
    metrics: 'PriceUSD',
    frequency: '1d',
    start_time: '2024-01-01',
    end_time: '2026-01-31',
    paging_from: 'start',
    page_size: '2000',
    ignore_forbidden_errors: 'true',
    ignore_unsupported_errors: 'true',
  });

  const response = await fetch(`${COIN_METRICS}?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`Coin Metrics HTTP ${response.status}`);
  const payload = await response.json();

  return (Array.isArray(payload?.data) ? payload.data : [])
    .map((row) => ({ date: row.time?.slice(0, 10), price: num(row.PriceUSD) }))
    .filter((row) => row.date && Number.isFinite(row.price))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildSnapshot(rows) {
  if (!rows.length) return null;
  const latest = rows[rows.length - 1];
  const last20 = rows.slice(-20);
  const previous5Start = Math.max(0, rows.length - 10);
  const previous5End = Math.max(0, rows.length - 6);

  return {
    asOf: latest.date,
    latestDailyFlowUSDm: latest.total,
    flow5dUSDm: sumLast(rows, 5),
    flow20dUSDm: sumLast(rows, 20),
    flow60dUSDm: sumLast(rows, 60),
    negativeDays20: last20.filter((row) => row.total < 0).length,
    positiveDays20: last20.filter((row) => row.total > 0).length,
    previous5dUSDm: rows.slice(previous5Start, previous5End + 1).reduce((sum, row) => sum + row.total, 0),
  };
}

function build2025Study(flowRows, priceRows) {
  const rows2025 = priceRows.filter((row) => row.date >= '2025-01-01' && row.date <= '2025-12-31');
  if (!rows2025.length) return null;

  const peak = rows2025.reduce((best, row) => row.price > best.price ? row : best, rows2025[0]);
  const { row: flowAtPeak, index } = findRowAtOrBefore(flowRows, peak.date);
  if (!flowAtPeak) return { peak, flowAtPeak: null };

  return {
    peak,
    flowAtPeak: {
      date: flowAtPeak.date,
      dailyUSDm: flowAtPeak.total,
      rolling5USDm: sumLast(flowRows, 5, index),
      rolling20USDm: sumLast(flowRows, 20, index),
      rolling60USDm: sumLast(flowRows, 60, index),
      negativeDays20: flowRows.slice(Math.max(0, index - 19), index + 1).filter((row) => row.total < 0).length,
    },
  };
}

export async function GET() {
  try {
    const [flows, prices] = await Promise.all([fetchFarside(), fetchBtcPrices()]);
    if (!flows.length) throw new Error('Farside no devolvió filas ETF parseables');

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'live-etf-demand',
      methodology: {
        family: 'Demanda spot/ETF',
        source: 'Farside Investors · Bitcoin ETF Flow All Data',
        historyStarts: flows[0]?.date || '2024-01-11',
        limitation: 'Los ETF spot de EE.UU. comenzaron en 2024; esta familia no puede validarse contra 2017 o 2021.',
        gateImpact: 'Investigación solamente. No modifica BTC Health Gate.',
      },
      diagnostics: {
        etfRows: flows.length,
        priceRows: prices.length,
      },
      current: buildSnapshot(flows),
      study2025: build2025Study(flows, prices),
      recent: flows.slice(-20),
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible cargar demanda ETF',
      methodology: null,
      diagnostics: null,
      current: null,
      study2025: null,
      recent: [],
    });
  }
}
