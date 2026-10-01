import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AXEL_URL = 'https://axeladlerjr.com/charts/bitcoin-etf-flow-monitor/';

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function moneyToMillions(raw) {
  const text = String(raw || '').replace(/,/g, '').trim();
  const match = text.match(/^([+-]?\$?)(-?\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;
  let value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  const unit = (match[3] || 'M').toUpperCase();
  if (unit === 'B') value *= 1000;
  if (unit === 'K') value /= 1000;
  return value;
}

function extractAfter(text, label, pattern) {
  const index = text.indexOf(label);
  if (index < 0) return null;
  const slice = text.slice(index + label.length, index + label.length + 220);
  return slice.match(pattern)?.[1] || null;
}

async function fetchLiveDemand() {
  const response = await fetch(AXEL_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`ETF monitor HTTP ${response.status}`);

  const text = stripHtml(await response.text());

  const asOf = text.match(/Data as of\s+(\d{4}-\d{2}-\d{2})/i)?.[1] || null;
  const lastDayRaw = extractAfter(text, 'Last Day Netflow', /([+-]?\$?[\d,.]+\s*[KMB])/i);
  const weekRaw = extractAfter(text, 'Last Week Netflow', /([+-]?\$?[\d,.]+\s*[KMB])/i);
  const allTimeRaw = extractAfter(text, 'All-Time Netflow', /([+-]?\$?[\d,.]+\s*[KMB])/i);
  const btcPriceRaw = extractAfter(text, 'BTC Price', /(\$[\d,]+)/i);
  const realizedRaw = extractAfter(text, 'ETF Realized Price', /(\$[\d,]+)/i);
  const basisDistance = text.match(/ETF Realized Price\s+\$[\d,]+\s+([+-]?\d+(?:\.\d+)?)%/i)?.[1];

  const latestDailyFlowUSDm = moneyToMillions(lastDayRaw);
  const flow5dUSDm = moneyToMillions(weekRaw);

  if (!Number.isFinite(latestDailyFlowUSDm)) {
    throw new Error('ETF monitor no devolvió flujo diario parseable');
  }

  return {
    asOf,
    latestDailyFlowUSDm,
    flow5dUSDm,
    allTimeFlowUSDm: moneyToMillions(allTimeRaw),
    btcPriceUSD: btcPriceRaw ? Number(btcPriceRaw.replace(/[$,]/g, '')) : null,
    etfRealizedPriceUSD: realizedRaw ? Number(realizedRaw.replace(/[$,]/g, '')) : null,
    btcVsEtfBasisPct: basisDistance !== undefined ? Number(basisDistance) : null,
  };
}

// Event study documentado con Farside alrededor del ATH 2025.
// El objetivo es saber si ETF anticipó o confirmó; no optimizar umbrales.
const STUDY_2025 = {
  peak: { date: '2025-10-06', priceUSD: 124824 },
  atPeak: {
    dailyFlowUSDm: 1205.2,
    reading: 'Demanda ETF muy fuerte en el máximo; no anticipó el techo.',
  },
  afterPeak: [
    { date: '2025-10-10', flowUSDm: -4.5 },
    { date: '2025-10-13', flowUSDm: -326.4 },
    { date: '2025-10-15', flowUSDm: -104.1 },
    { date: '2025-10-16', flowUSDm: -530.9 },
    { date: '2025-10-17', flowUSDm: -366.6 },
  ],
  conclusion: 'En 2025 la demanda ETF fue fuerte hasta el máximo y se deterioró después. Funciona mejor como confirmación de régimen que como señal anticipada.',
};

export async function GET() {
  try {
    const current = await fetchLiveDemand();

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'live-etf-demand',
      methodology: {
        family: 'Demanda spot/ETF',
        liveSource: 'Axel Adler Jr. BTC US ETF Flow Monitor',
        eventStudySource: 'Farside Investors',
        historyStarts: '2024-01-11',
        limitation: 'No existe esta familia para 2017/2021; no puede ser gatillo universal de ciclo.',
        gateImpact: 'Investigación solamente. No modifica BTC Health Gate.',
      },
      current,
      study2025: STUDY_2025,
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible cargar demanda ETF',
      methodology: null,
      current: null,
      study2025: STUDY_2025,
    });
  }
}
