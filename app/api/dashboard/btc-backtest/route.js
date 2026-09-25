import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const CYCLES = [
  { key: '2017', label: '2017', start: '2016-01-01', end: '2018-12-31' },
  { key: '2021', label: '2021', start: '2020-01-01', end: '2022-12-31' },
  { key: '2025', label: '2025', start: '2024-01-01', end: '2026-01-31' },
];

const STH_EVENT_STUDY = [
  {
    cycle: '2021',
    peakDate: '2021-11-10',
    finding: 'El STH Realized Price (~US$53K) fue retesteado cerca de US$53.5K y actuó como soporte.',
    implication: 'Una pérdida o retesteo aislado del STH cost basis no era suficiente para asumir fin de ciclo.',
    source: 'Glassnode Week 48, 2021',
    sourceUrl: 'https://research.glassnode.com/the-week-onchain-week-48-2021/',
    verdict: 'Evita salida prematura',
  },
  {
    cycle: '2025',
    peakDate: '2025-10-06',
    finding: 'A inicios de noviembre BTC ya había perdido el STH cost basis (~US$112.5K) y cotizaba cerca de US$100K, ~21% bajo el ATH.',
    implication: 'Esperar únicamente una confirmación larga bajo STH puede llegar tarde para proteger ganancias.',
    source: 'Glassnode Week 44, 2025',
    sourceUrl: 'https://research.glassnode.com/the-week-onchain-week-44-2025/',
    verdict: 'STH debe confirmar, no iniciar',
  },
  {
    cycle: '2025',
    peakDate: '2025-10-06',
    finding: 'Dos semanas después, BTC seguía bajo STH cost basis y la zona US$95K–97K actuaba como resistencia, con demanda spot/ETF débil.',
    implication: 'La persistencia bajo STH junto a demanda débil sí aportó evidencia de cambio de régimen.',
    source: 'Glassnode Week 46, 2025',
    sourceUrl: 'https://research.glassnode.com/the-week-onchain-week-46-2025/',
    verdict: 'Confluencia sí confirma',
  },
];

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pctChange(current, previous) {
  if (!(Number.isFinite(current) && Number.isFinite(previous)) || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

async function fetchHistory() {
  const params = new URLSearchParams({
    assets: 'btc',
    metrics: 'PriceUSD,CapMrktCurUSD,CapMVRVCur',
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
    .map((row) => {
      const price = num(row.PriceUSD);
      const marketCap = num(row.CapMrktCurUSD);
      const mvrv = num(row.CapMVRVCur);
      return {
        date: row.time?.slice(0, 10),
        price,
        mvrv,
        realizedCap: Number.isFinite(marketCap) && Number.isFinite(mvrv) && mvrv > 0
          ? marketCap / mvrv
          : null,
      };
    })
    .filter((row) => row.date && Number.isFinite(row.price))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function enrichCapital(rows) {
  return rows.map((row, index) => {
    const compare = index >= 30 ? rows[index - 30]?.realizedCap : null;
    return {
      ...row,
      capital30dPct: pctChange(row.realizedCap, compare),
    };
  });
}

function consecutiveStart(rows, predicate, minDays, peakDate) {
  let streak = 0;
  let start = null;

  for (const row of rows) {
    if (predicate(row)) {
      if (streak === 0) start = row;
      streak += 1;
      if (streak >= minDays) {
        const confirmation = row;
        const beforePeak = new Date(confirmation.date) <= new Date(peakDate);
        return {
          startDate: start.date,
          confirmDate: confirmation.date,
          daysToPeak: daysBetween(confirmation.date, peakDate),
          beforePeak,
          priceAtSignal: confirmation.price,
        };
      }
    } else {
      streak = 0;
      start = null;
    }
  }
  return null;
}

function firstCrossBeforePeak(rows, field, threshold, peakDate) {
  const filtered = rows.filter((row) =>
    row.date <= peakDate
    && Number.isFinite(row[field])
    && row[field] >= threshold
  );
  const hit = filtered[0];
  if (!hit) return null;
  return {
    date: hit.date,
    value: hit[field],
    leadDays: daysBetween(hit.date, peakDate),
    price: hit.price,
  };
}

function maxDrawdownFromPeak(peakPrice, signalPrice) {
  if (!(Number.isFinite(peakPrice) && Number.isFinite(signalPrice) && peakPrice > 0)) return null;
  return ((signalPrice / peakPrice) - 1) * 100;
}

function analyzeCycle(allRows, cycle) {
  const rows = enrichCapital(allRows.filter((row) => row.date >= cycle.start && row.date <= cycle.end));
  if (!rows.length) return null;

  const peak = rows.reduce((best, row) => row.price > best.price ? row : best, rows[0]);
  const peakDate = peak.date;

  const mvrv24 = firstCrossBeforePeak(rows, 'mvrv', 2.4, peakDate);
  const mvrv30 = firstCrossBeforePeak(rows, 'mvrv', 3.0, peakDate);

  const searchStart = new Date(peakDate);
  searchStart.setUTCDate(searchStart.getUTCDate() - 180);
  const searchEnd = new Date(peakDate);
  searchEnd.setUTCDate(searchEnd.getUTCDate() + 120);

  const aroundPeak = rows.filter((row) => {
    const t = new Date(row.date);
    return t >= searchStart && t <= searchEnd;
  });

  const capital7 = consecutiveStart(
    aroundPeak,
    (row) => Number.isFinite(row.capital30dPct) && row.capital30dPct < 0,
    7,
    peakDate,
  );
  const capital14 = consecutiveStart(
    aroundPeak,
    (row) => Number.isFinite(row.capital30dPct) && row.capital30dPct < 0,
    14,
    peakDate,
  );
  const capital21 = consecutiveStart(
    aroundPeak,
    (row) => Number.isFinite(row.capital30dPct) && row.capital30dPct < 0,
    21,
    peakDate,
  );

  const attachDrawdown = (signal) => signal ? {
    ...signal,
    drawdownFromPeakPct: maxDrawdownFromPeak(peak.price, signal.priceAtSignal),
  } : null;

  return {
    cycle: cycle.label,
    peak: {
      date: peakDate,
      price: peak.price,
      mvrv: peak.mvrv,
    },
    mvrv: {
      attention24: mvrv24,
      overheated30: mvrv30,
    },
    capital: {
      negative7d: attachDrawdown(capital7),
      negative14d: attachDrawdown(capital14),
      negative21d: attachDrawdown(capital21),
    },
  };
}

function summarizeCalibration(cycles) {
  const usable = cycles.filter(Boolean);
  const capitalSignals = usable.flatMap((cycle) => [
    { cycle: cycle.cycle, days: 7, signal: cycle.capital.negative7d },
    { cycle: cycle.cycle, days: 14, signal: cycle.capital.negative14d },
    { cycle: cycle.cycle, days: 21, signal: cycle.capital.negative21d },
  ]).filter((item) => item.signal);

  const byDays = [7, 14, 21].map((days) => {
    const matches = capitalSignals.filter((item) => item.days === days);
    return {
      days,
      observations: matches.length,
      beforePeak: matches.filter((item) => item.signal.beforePeak).length,
      afterPeak: matches.filter((item) => !item.signal.beforePeak).length,
      averageDrawdownPct: matches.length
        ? matches.reduce((sum, item) => sum + Number(item.signal.drawdownFromPeakPct || 0), 0) / matches.length
        : null,
    };
  });

  return {
    capitalPersistence: byDays,
    provisionalConclusion: 'Usar persistencia corta para preparar y persistencia mayor solo para confirmar. La salida no debe esperar 21 días si otras familias ya se deterioraron.',
  };
}

export async function GET() {
  try {
    const rows = await fetchHistory();
    const cycles = CYCLES.map((cycle) => analyzeCycle(rows, cycle)).filter(Boolean);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'live-backtest',
      methodology: {
        exactBacktest: ['MVRV', 'Realized Cap 30d'],
        eventStudy: ['STH cost basis'],
        notBacktested: ['LTH exacto'],
      },
      cycles,
      calibration: summarizeCalibration(cycles),
      sthEventStudy: STH_EVENT_STUDY,
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible ejecutar el backtest',
      methodology: {
        exactBacktest: [],
        eventStudy: STH_EVENT_STUDY,
        notBacktested: ['LTH exacto'],
      },
      cycles: [],
      calibration: null,
      sthEventStudy: STH_EVENT_STUDY,
    }, { status: 200 });
  }
}
