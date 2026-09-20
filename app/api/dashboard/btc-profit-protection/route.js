import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const CYCLES = [
  { key: '2017', start: '2016-01-01', end: '2018-12-31' },
  { key: '2021', start: '2020-01-01', end: '2022-12-31' },
  { key: '2025', start: '2024-01-01', end: '2026-01-31' },
];

const RULES = [
  { key: 'dd5_any', label: 'DD -5% + contexto', drawdown: -5, context: 'any' },
  { key: 'dd8_any', label: 'DD -8% + contexto', drawdown: -8, context: 'any' },
  { key: 'dd10_any', label: 'DD -10% + contexto', drawdown: -10, context: 'any' },
  { key: 'dd12_any', label: 'DD -12% + contexto', drawdown: -12, context: 'any' },
  { key: 'dd15_any', label: 'DD -15% + contexto', drawdown: -15, context: 'any' },
  { key: 'dd8_both', label: 'DD -8% + 2 contextos', drawdown: -8, context: 'both' },
  { key: 'dd10_both', label: 'DD -10% + 2 contextos', drawdown: -10, context: 'both' },
  { key: 'dd12_both', label: 'DD -12% + 2 contextos', drawdown: -12, context: 'both' },
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

function enrichCycle(rows) {
  let high = 0;

  return rows.map((row, index) => {
    high = Math.max(high, row.price);
    const compare = index >= 30 ? rows[index - 30]?.realizedCap : null;
    const capital30dPct = pctChange(row.realizedCap, compare);
    const drawdownPct = high > 0 ? ((row.price / high) - 1) * 100 : 0;

    return {
      ...row,
      highWater: high,
      drawdownPct,
      capital30dPct,
      mvrvContext: Number.isFinite(row.mvrv) && row.mvrv >= 2.4,
      capitalContext: Number.isFinite(capital30dPct) && capital30dPct < 0.5,
    };
  });
}

function qualifies(row, rule) {
  const contextCount = [row.mvrvContext, row.capitalContext].filter(Boolean).length;
  const contextOk = rule.context === 'both' ? contextCount >= 2 : contextCount >= 1;
  return row.drawdownPct <= rule.drawdown && contextOk;
}

function extractEpisodes(rows, rule) {
  const episodes = [];
  let active = false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const yes = qualifies(row, rule);

    if (yes && !active) {
      episodes.push({ ...row, index: i });
      active = true;
    } else if (!yes) {
      active = false;
    }
  }

  return episodes;
}

function futureNewHigh(rows, episode, days = 120) {
  const end = Math.min(rows.length - 1, episode.index + days);
  for (let i = episode.index + 1; i <= end; i += 1) {
    if (rows[i].price > episode.highWater) {
      return {
        recovered: true,
        date: rows[i].date,
        days: daysBetween(episode.date, rows[i].date),
      };
    }
  }
  return { recovered: false, date: null, days: null };
}

function futureWorstDrawdown(rows, episode, days = 120) {
  const end = Math.min(rows.length - 1, episode.index + days);
  let minPrice = episode.price;
  let minRow = episode;

  for (let i = episode.index; i <= end; i += 1) {
    if (rows[i].price < minPrice) {
      minPrice = rows[i].price;
      minRow = rows[i];
    }
  }

  return {
    worstFromSignalPct: ((minPrice / episode.price) - 1) * 100,
    date: minRow.date,
  };
}

function analyzeRule(rows, peak, rule) {
  const episodes = extractEpisodes(rows, rule);
  const prePeakCutoff = new Date(peak.date);
  prePeakCutoff.setUTCDate(prePeakCutoff.getUTCDate() - 60);

  const falsePositives = episodes
    .filter((episode) => new Date(episode.date) < prePeakCutoff)
    .map((episode) => ({
      ...episode,
      recovery: futureNewHigh(rows, episode, 120),
    }))
    .filter((episode) => episode.recovery.recovered);

  const topWindowStart = new Date(peak.date);
  topWindowStart.setUTCDate(topWindowStart.getUTCDate() - 60);
  const topWindowEnd = new Date(peak.date);
  topWindowEnd.setUTCDate(topWindowEnd.getUTCDate() + 90);

  const topTrigger = episodes.find((episode) => {
    const d = new Date(episode.date);
    return d >= topWindowStart && d <= topWindowEnd;
  }) || null;

  const triggerDetail = topTrigger ? {
    date: topTrigger.date,
    daysFromPeak: daysBetween(peak.date, topTrigger.date),
    drawdownPct: ((topTrigger.price / peak.price) - 1) * 100,
    price: topTrigger.price,
    mvrv: topTrigger.mvrv,
    capital30dPct: topTrigger.capital30dPct,
    recovery: futureNewHigh(rows, topTrigger, 120),
    futureRisk: futureWorstDrawdown(rows, topTrigger, 120),
  } : null;

  return {
    rule: rule.key,
    label: rule.label,
    drawdownThreshold: rule.drawdown,
    context: rule.context,
    totalEpisodes: episodes.length,
    falsePositives: falsePositives.length,
    topTrigger: triggerDetail,
  };
}

function analyzeCycle(allRows, cycle) {
  const rows = enrichCycle(allRows.filter((row) => row.date >= cycle.start && row.date <= cycle.end));
  if (!rows.length) return null;

  const peak = rows.reduce((best, row) => row.price > best.price ? row : best, rows[0]);

  return {
    cycle: cycle.key,
    peak: {
      date: peak.date,
      price: peak.price,
      mvrv: peak.mvrv,
    },
    rules: RULES.map((rule) => analyzeRule(rows, peak, rule)),
  };
}

function summarize(cycles) {
  return RULES.map((rule) => {
    const perCycle = cycles
      .map((cycle) => cycle.rules.find((item) => item.rule === rule.key))
      .filter(Boolean);

    const triggers = perCycle.filter((item) => item.topTrigger);
    const falsePositives = perCycle.reduce((sum, item) => sum + item.falsePositives, 0);
    const avgDamage = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.drawdownPct, 0) / triggers.length
      : null;
    const avgDays = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.daysFromPeak, 0) / triggers.length
      : null;
    const recoveries = triggers.filter((item) => item.topTrigger.recovery?.recovered).length;

    return {
      rule: rule.key,
      label: rule.label,
      drawdownThreshold: rule.drawdown,
      context: rule.context,
      cyclesTriggered: triggers.length,
      falsePositives,
      recoveriesAfterTopTrigger: recoveries,
      averageDamageAtTriggerPct: avgDamage,
      averageDaysFromPeak: avgDays,
    };
  });
}

export async function GET() {
  try {
    const rows = await fetchHistory();
    const cycles = CYCLES.map((cycle) => analyzeCycle(rows, cycle)).filter(Boolean);
    const summary = summarize(cycles);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'live-backtest',
      methodology: {
        highWater: 'Máximo observado hasta cada día; sin look-ahead',
        contexts: ['MVRV >= 2.4', 'Realized Cap 30d < +0.5%'],
        falsePositive: 'Alerta >60 días antes del máximo final que recupera un nuevo máximo dentro de 120 días',
        topWindow: 'Primera alerta entre 60 días antes y 90 días después del máximo final',
        caveat: 'Solo tres ciclos; sirve para descartar reglas frágiles, no para optimizar un porcentaje perfecto',
      },
      cycles,
      summary,
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible ejecutar el backtest de protección',
      methodology: null,
      cycles: [],
      summary: [],
    });
  }
}
