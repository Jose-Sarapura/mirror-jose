import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const CYCLES = [
  { key: '2017', start: '2016-01-01', end: '2018-12-31' },
  { key: '2021', start: '2020-01-01', end: '2022-12-31' },
  { key: '2025', start: '2024-01-01', end: '2026-01-31' },
];

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function diff(current, previous) {
  if (!(Number.isFinite(current) && Number.isFinite(previous))) return null;
  return current - previous;
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function deriveActivePct(row) {
  const direct = num(row.SplyActPct1yr);
  if (Number.isFinite(direct)) return direct;

  const active = num(row.SplyAct1Yr);
  const supply = num(row.SplyCur);
  if (Number.isFinite(active) && Number.isFinite(supply) && supply > 0) {
    return (active / supply) * 100;
  }
  return null;
}

async function fetchHistory() {
  const params = new URLSearchParams({
    assets: 'btc',
    metrics: 'PriceUSD,SplyActPct1yr,SplyAct1Yr,SplyCur',
    frequency: '1d',
    start_time: '2016-01-01',
    end_time: '2026-01-31',
    paging_from: 'start',
    page_size: '10000',
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
    .map((row) => ({
      date: row.time?.slice(0, 10),
      price: num(row.PriceUSD),
      active1yPct: deriveActivePct(row),
    }))
    .filter((row) => row.date && Number.isFinite(row.price))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function enrich(rows) {
  return rows.map((row, index) => {
    const active = row.active1yPct;
    const active30 = index >= 30 ? rows[index - 30]?.active1yPct : null;
    const active90 = index >= 90 ? rows[index - 90]?.active1yPct : null;

    return {
      ...row,
      inactive1yPct: Number.isFinite(active) ? 100 - active : null,
      active30dDeltaPp: diff(active, active30),
      active90dDeltaPp: diff(active, active90),
    };
  });
}

function analyzeCycle(allRows, cycle) {
  const rows = enrich(allRows.filter((row) => row.date >= cycle.start && row.date <= cycle.end));
  if (!rows.length) return null;

  const validHolderRows = rows.filter((row) => Number.isFinite(row.active1yPct));
  if (!validHolderRows.length) {
    return {
      cycle: cycle.key,
      status: 'no-holder-data',
      peak: null,
      holderAtPeak: null,
      strongestPrePeakReactivation: null,
    };
  }

  const peak = rows.reduce((best, row) => row.price > best.price ? row : best, rows[0]);
  const peakIndex = rows.findIndex((row) => row.date === peak.date);
  const holderAtPeak = peakIndex >= 0 ? rows[peakIndex] : null;

  const preStart = new Date(`${peak.date}T00:00:00Z`);
  preStart.setUTCDate(preStart.getUTCDate() - 180);

  const prePeak = rows.filter((row) => {
    const d = new Date(`${row.date}T00:00:00Z`);
    return d >= preStart
      && row.date <= peak.date
      && Number.isFinite(row.active90dDeltaPp);
  });

  const strongest = prePeak.length
    ? prePeak.reduce((best, row) => (
        !best || row.active90dDeltaPp > best.active90dDeltaPp ? row : best
      ), null)
    : null;

  return {
    cycle: cycle.key,
    status: 'ok',
    peak: {
      date: peak.date,
      price: peak.price,
    },
    holderAtPeak: holderAtPeak ? {
      active1yPct: holderAtPeak.active1yPct,
      inactive1yPct: holderAtPeak.inactive1yPct,
      active30dDeltaPp: holderAtPeak.active30dDeltaPp,
      active90dDeltaPp: holderAtPeak.active90dDeltaPp,
    } : null,
    strongestPrePeakReactivation: strongest ? {
      date: strongest.date,
      active1yPct: strongest.active1yPct,
      inactive1yPct: strongest.inactive1yPct,
      active90dDeltaPp: strongest.active90dDeltaPp,
      daysBeforePeak: daysBetween(strongest.date, peak.date),
      price: strongest.price,
    } : null,
  };
}

function buildCurrent(allRows) {
  const rows = enrich(allRows);
  const valid = rows.filter((row) => Number.isFinite(row.active1yPct));
  if (!valid.length) return null;

  const latest = valid[valid.length - 1];
  return {
    asOf: latest.date,
    active1yPct: latest.active1yPct,
    inactive1yPct: latest.inactive1yPct,
    active30dDeltaPp: latest.active30dDeltaPp,
    active90dDeltaPp: latest.active90dDeltaPp,
    direction90d: !Number.isFinite(latest.active90dDeltaPp)
      ? 'Sin referencia'
      : latest.active90dDeltaPp > 0
        ? 'Más oferta antigua volvió a moverse'
        : latest.active90dDeltaPp < 0
          ? 'Mayor dormancia relativa'
          : 'Estable',
  };
}

export async function GET() {
  try {
    const rows = await fetchHistory();
    const validHolderRows = rows.filter((row) => Number.isFinite(row.active1yPct));
    const cycles = CYCLES.map((cycle) => analyzeCycle(rows, cycle)).filter(Boolean);
    const usableCycles = cycles.filter((cycle) => cycle.status === 'ok');

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: validHolderRows.length ? 'live-holder-proxy' : 'holder-data-unavailable',
      methodology: {
        family: 'Comportamiento de holders',
        metric: '1 Year Active Supply %',
        interpretation: 'Mide qué porcentaje de la oferta se movió al menos una vez durante el último año. Un aumento puede reflejar reactivación de monedas previamente dormidas.',
        independence: 'Familia de edad/movimiento de oferta; no es una métrica de valoración ni de precio.',
        limitation: 'Es un proxy por edad de monedas, no identifica personas ni equivale exactamente a LTH Supply de 155 días.',
        gateImpact: 'Investigación solamente. No modifica BTC Health Gate.',
      },
      diagnostics: {
        priceRows: rows.length,
        holderRows: validHolderRows.length,
        usableCycles: usableCycles.length,
      },
      current: buildCurrent(rows),
      cycles,
      summary: {
        usableCycles: usableCycles.length,
        cyclesWithPositive90dAtPeak: usableCycles.filter((cycle) => (
          Number.isFinite(cycle.holderAtPeak?.active90dDeltaPp)
          && cycle.holderAtPeak.active90dDeltaPp > 0
        )).length,
        cyclesWithPrePeakReactivation: usableCycles.filter((cycle) => (
          Number.isFinite(cycle.strongestPrePeakReactivation?.active90dDeltaPp)
          && cycle.strongestPrePeakReactivation.active90dDeltaPp > 0
        )).length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible validar comportamiento de holders',
      methodology: null,
      diagnostics: null,
      current: null,
      cycles: [],
      summary: null,
    });
  }
}
