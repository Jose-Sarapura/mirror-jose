import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const CYCLES = [
  { key: '2017', start: '2016-01-01', end: '2018-12-31' },
  { key: '2021', start: '2020-01-01', end: '2022-12-31' },
  { key: '2025', start: '2024-01-01', end: '2026-01-31' },
];

const DRAWDOWNS = [-8, -10, -12];
const CONTEXT_WINDOWS = [30, 60];
const CONFIRM_WINDOWS = [7, 14, 21];
const FAST_CONFIRMATION_FAMILIES = ['capital_relative', 'price_structure'];

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

function dateAdd(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
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
    const compare7 = index >= 7 ? rows[index - 7]?.realizedCap : null;
    const capital30dPct = pctChange(row.realizedCap, compare);
    const capital7dPct = pctChange(row.realizedCap, compare7);
    const drawdownPct = high > 0 ? ((row.price / high) - 1) * 100 : 0;

    return {
      ...row,
      index,
      highWater: high,
      drawdownPct,
      capital30dPct,
      capital7dPct,
      mvrvElevated: Number.isFinite(row.mvrv) && row.mvrv >= 2.4,
      capitalWeak: Number.isFinite(capital30dPct) && capital30dPct < 0.5,
      capitalNegative: Number.isFinite(capital30dPct) && capital30dPct < 0,
    };
  });
}

function hadPriorContext(rows, eventIndex, windowDays) {
  const start = Math.max(0, eventIndex - windowDays);
  const slice = rows.slice(start, eventIndex + 1);
  const mvrvDays = slice.filter((row) => row.mvrvElevated).length;
  const capitalWeakDays = slice.filter((row) => row.capitalWeak).length;

  return {
    ok: mvrvDays > 0 || capitalWeakDays >= 7,
    mvrvDays,
    capitalWeakDays,
    firstDate: slice.find((row) => row.mvrvElevated || row.capitalWeak)?.date || null,
  };
}

function findConfirmation(rows, eventIndex, confirmWindowDays) {
  const end = Math.min(rows.length - 1, eventIndex + confirmWindowDays);

  for (let i = eventIndex; i <= end; i += 1) {
    const row = rows[i];

    // Confirmation V2: realized cap 30d turns negative OR remains weak for 7 consecutive days.
    if (row.capitalNegative) {
      return {
        found: true,
        date: row.date,
        index: i,
        type: 'capital_negative',
        capital30dPct: row.capital30dPct,
        price: row.price,
      };
    }

    if (i >= eventIndex + 6) {
      const last7 = rows.slice(i - 6, i + 1);
      if (last7.length === 7 && last7.every((item) => item.capitalWeak)) {
        return {
          found: true,
          date: row.date,
          index: i,
          type: 'capital_weak_7d',
          capital30dPct: row.capital30dPct,
          price: row.price,
        };
      }
    }
  }

  return { found: false };
}

function extractSequenceEpisodes(rows, rule) {
  const episodes = [];
  let inDrawdown = false;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const prev = rows[i - 1];
    const crossed = prev.drawdownPct > rule.drawdown && row.drawdownPct <= rule.drawdown;

    if (crossed && !inDrawdown) {
      const context = hadPriorContext(rows, i, rule.contextWindow);
      if (context.ok) {
        const confirmation = findConfirmation(rows, i, rule.confirmWindow);
        if (confirmation.found) {
          episodes.push({
            eventDate: row.date,
            eventIndex: i,
            eventPrice: row.price,
            eventDrawdownPct: row.drawdownPct,
            highWater: row.highWater,
            context,
            confirmation,
          });
        }
      }
      inDrawdown = true;
    }

    if (row.drawdownPct > rule.drawdown / 2) inDrawdown = false;
  }

  return episodes;
}

function findFastConfirmation(rows, eventIndex, rule) {
  const end = Math.min(rows.length - 1, eventIndex + rule.confirmWindow);
  const event = rows[eventIndex];

  for (let i = eventIndex; i <= end; i += 1) {
    const row = rows[i];

    if (rule.confirmationFamily === 'capital_relative') {
      const contraction = Number.isFinite(row.capital7dPct) && row.capital7dPct <= 0;
      const deterioration = Number.isFinite(row.capital7dPct)
        && Number.isFinite(event.capital7dPct)
        && row.capital7dPct <= event.capital7dPct - 0.35;

      if (contraction || deterioration) {
        return {
          found: true,
          date: row.date,
          index: i,
          type: contraction ? 'capital_7d_negative' : 'capital_7d_deterioration',
          capital7dPct: row.capital7dPct,
          eventCapital7dPct: event.capital7dPct,
          price: row.price,
        };
      }
    }

    if (rule.confirmationFamily === 'price_structure') {
      const deeper = row.drawdownPct <= rule.drawdown - 4;
      let persistent = false;

      if (i >= eventIndex + 2) {
        const last3 = rows.slice(i - 2, i + 1);
        persistent = last3.length === 3 && last3.every((item) => item.drawdownPct <= rule.drawdown);
      }

      if (deeper || persistent) {
        return {
          found: true,
          date: row.date,
          index: i,
          type: deeper ? 'price_deeper_4pp' : 'price_below_3d',
          drawdownPct: row.drawdownPct,
          price: row.price,
        };
      }
    }
  }

  return { found: false };
}

function extractFastSequenceEpisodes(rows, rule) {
  const episodes = [];
  let inDrawdown = false;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const prev = rows[i - 1];
    const crossed = prev.drawdownPct > rule.drawdown && row.drawdownPct <= rule.drawdown;

    if (crossed && !inDrawdown) {
      const context = hadPriorContext(rows, i, rule.contextWindow);
      if (context.ok) {
        const confirmation = findFastConfirmation(rows, i, rule);
        if (confirmation.found) {
          episodes.push({
            eventDate: row.date,
            eventIndex: i,
            eventPrice: row.price,
            eventDrawdownPct: row.drawdownPct,
            highWater: row.highWater,
            context,
            confirmation,
          });
        }
      }
      inDrawdown = true;
    }

    if (row.drawdownPct > rule.drawdown / 2) inDrawdown = false;
  }

  return episodes;
}

function futureNewHigh(rows, index, highWater, days = 270) {
  const end = Math.min(rows.length - 1, index + days);
  for (let i = index + 1; i <= end; i += 1) {
    if (rows[i].price > highWater) {
      return {
        recovered: true,
        date: rows[i].date,
        days: daysBetween(rows[index].date, rows[i].date),
      };
    }
  }
  return { recovered: false, date: null, days: null };
}

function futureWorstDrawdown(rows, index, days = 120) {
  const end = Math.min(rows.length - 1, index + days);
  const startPrice = rows[index]?.price;
  let minPrice = startPrice;
  let minRow = rows[index];

  for (let i = index; i <= end; i += 1) {
    if (rows[i].price < minPrice) {
      minPrice = rows[i].price;
      minRow = rows[i];
    }
  }

  return {
    worstFromConfirmationPct: ((minPrice / startPrice) - 1) * 100,
    date: minRow.date,
  };
}

function buildRules() {
  const rules = [];
  for (const drawdown of DRAWDOWNS) {
    for (const contextWindow of CONTEXT_WINDOWS) {
      for (const confirmWindow of CONFIRM_WINDOWS) {
        rules.push({
          key: `dd${Math.abs(drawdown)}_ctx${contextWindow}_cf${confirmWindow}`,
          label: `DD ${drawdown}% · ctx ${contextWindow}d · confirma ≤${confirmWindow}d`,
          drawdown,
          contextWindow,
          confirmWindow,
        });
      }
    }
  }
  return rules;
}

const RULES = buildRules();

function buildFastRules() {
  const rules = [];
  for (const drawdown of DRAWDOWNS) {
    for (const contextWindow of CONTEXT_WINDOWS) {
      for (const confirmWindow of CONFIRM_WINDOWS) {
        for (const confirmationFamily of FAST_CONFIRMATION_FAMILIES) {
          const familyLabel = confirmationFamily === 'capital_relative'
            ? 'capital relativo'
            : 'estructura precio';
          rules.push({
            key: `v21_dd${Math.abs(drawdown)}_ctx${contextWindow}_cf${confirmWindow}_${confirmationFamily}`,
            label: `DD ${drawdown}% · ctx ${contextWindow}d · ${familyLabel} ≤${confirmWindow}d`,
            drawdown,
            contextWindow,
            confirmWindow,
            confirmationFamily,
          });
        }
      }
    }
  }
  return rules;
}

const FAST_RULES = buildFastRules();

function analyzeRule(rows, peak, rule) {
  const episodes = extractSequenceEpisodes(rows, rule);

  const falsePositives = episodes.filter((episode) => {
    const confirmationRow = rows[episode.confirmation.index];
    const moreThan60BeforeFinalPeak = daysBetween(episode.confirmation.date, peak.date) > 60;
    if (!moreThan60BeforeFinalPeak) return false;
    return futureNewHigh(rows, episode.confirmation.index, episode.highWater, 270).recovered;
  });

  const topStart = dateAdd(peak.date, -60);
  const topEnd = dateAdd(peak.date, 90);

  const topTrigger = episodes.find((episode) => {
    const d = new Date(`${episode.confirmation.date}T00:00:00Z`);
    return d >= topStart && d <= topEnd;
  }) || null;

  let detail = null;
  if (topTrigger) {
    const confirmationRow = rows[topTrigger.confirmation.index];
    detail = {
      contextDate: topTrigger.context.firstDate,
      eventDate: topTrigger.eventDate,
      confirmDate: topTrigger.confirmation.date,
      confirmationType: topTrigger.confirmation.type,
      daysFromPeak: daysBetween(peak.date, topTrigger.confirmation.date),
      eventDrawdownPct: topTrigger.eventDrawdownPct,
      damageAtConfirmationPct: ((confirmationRow.price / peak.price) - 1) * 100,
      priceAtConfirmation: confirmationRow.price,
      capital30dPct: confirmationRow.capital30dPct,
      recoveredNewHigh: futureNewHigh(rows, topTrigger.confirmation.index, topTrigger.highWater, 270),
      futureRisk: futureWorstDrawdown(rows, topTrigger.confirmation.index, 120),
    };
  }

  return {
    ...rule,
    totalEpisodes: episodes.length,
    falsePositives: falsePositives.length,
    topTrigger: detail,
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
      .map((cycle) => cycle.rules.find((item) => item.key === rule.key))
      .filter(Boolean);

    const triggers = perCycle.filter((item) => item.topTrigger);
    const falsePositives = perCycle.reduce((sum, item) => sum + item.falsePositives, 0);
    const recovered = triggers.filter((item) => item.topTrigger?.recoveredNewHigh?.recovered).length;

    const avgDamage = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.damageAtConfirmationPct, 0) / triggers.length
      : null;

    const avgDays = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.daysFromPeak, 0) / triggers.length
      : null;

    const worstDamage = triggers.length
      ? Math.min(...triggers.map((item) => item.topTrigger.damageAtConfirmationPct))
      : null;

    let classification = 'Cobertura insuficiente';
    if (triggers.length >= 2) {
      if (falsePositives >= 3) classification = 'Demasiado sensible';
      else if (Number.isFinite(avgDamage) && avgDamage <= -15) classification = 'Demasiado tardía';
      else if (falsePositives <= 1 && Number.isFinite(avgDamage) && avgDamage > -12) classification = 'Candidata a estudiar';
      else classification = 'Trade-off intermedio';
    }

    return {
      ...rule,
      cyclesTriggered: triggers.length,
      falsePositives,
      recoveriesAfterTrigger: recovered,
      averageDamageAtConfirmationPct: avgDamage,
      worstDamageAtConfirmationPct: worstDamage,
      averageDaysFromPeak: avgDays,
      classification,
    };
  });
}


function analyzeFastRule(rows, peak, rule) {
  const episodes = extractFastSequenceEpisodes(rows, rule);

  const falsePositives = episodes.filter((episode) => {
    const moreThan60BeforeFinalPeak = daysBetween(episode.confirmation.date, peak.date) > 60;
    if (!moreThan60BeforeFinalPeak) return false;
    return futureNewHigh(rows, episode.confirmation.index, episode.highWater, 270).recovered;
  });

  const topStart = dateAdd(peak.date, -60);
  const topEnd = dateAdd(peak.date, 90);

  const topTrigger = episodes.find((episode) => {
    const d = new Date(`${episode.confirmation.date}T00:00:00Z`);
    return d >= topStart && d <= topEnd;
  }) || null;

  let detail = null;
  if (topTrigger) {
    const confirmationRow = rows[topTrigger.confirmation.index];
    detail = {
      contextDate: topTrigger.context.firstDate,
      eventDate: topTrigger.eventDate,
      confirmDate: topTrigger.confirmation.date,
      confirmationType: topTrigger.confirmation.type,
      daysFromPeak: daysBetween(peak.date, topTrigger.confirmation.date),
      eventDrawdownPct: topTrigger.eventDrawdownPct,
      damageAtConfirmationPct: ((confirmationRow.price / peak.price) - 1) * 100,
      priceAtConfirmation: confirmationRow.price,
      capital7dPct: confirmationRow.capital7dPct,
      recoveredNewHigh: futureNewHigh(rows, topTrigger.confirmation.index, topTrigger.highWater, 270),
      futureRisk: futureWorstDrawdown(rows, topTrigger.confirmation.index, 120),
    };
  }

  return {
    ...rule,
    totalEpisodes: episodes.length,
    falsePositives: falsePositives.length,
    topTrigger: detail,
  };
}

function analyzeFastCycle(allRows, cycle) {
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
    rules: FAST_RULES.map((rule) => analyzeFastRule(rows, peak, rule)),
  };
}

function summarizeFast(cycles) {
  return FAST_RULES.map((rule) => {
    const perCycle = cycles
      .map((cycle) => cycle.rules.find((item) => item.key === rule.key))
      .filter(Boolean);

    const triggers = perCycle.filter((item) => item.topTrigger);
    const falsePositives = perCycle.reduce((sum, item) => sum + item.falsePositives, 0);
    const recovered = triggers.filter((item) => item.topTrigger?.recoveredNewHigh?.recovered).length;

    const avgDamage = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.damageAtConfirmationPct, 0) / triggers.length
      : null;

    const avgDays = triggers.length
      ? triggers.reduce((sum, item) => sum + item.topTrigger.daysFromPeak, 0) / triggers.length
      : null;

    const worstDamage = triggers.length
      ? Math.min(...triggers.map((item) => item.topTrigger.damageAtConfirmationPct))
      : null;

    let classification = 'Cobertura insuficiente';
    if (triggers.length >= 2) {
      if (falsePositives >= 3) classification = 'Demasiado sensible';
      else if (Number.isFinite(avgDamage) && avgDamage <= -15) classification = 'Demasiado tardía';
      else if (falsePositives <= 1 && Number.isFinite(avgDamage) && avgDamage > -12) classification = 'Candidata a estudiar';
      else classification = 'Trade-off intermedio';
    }

    return {
      ...rule,
      cyclesTriggered: triggers.length,
      falsePositives,
      recoveriesAfterTrigger: recovered,
      averageDamageAtConfirmationPct: avgDamage,
      worstDamageAtConfirmationPct: worstDamage,
      averageDaysFromPeak: avgDays,
      classification,
    };
  });
}

export async function GET() {
  try {
    const rows = await fetchHistory();

    const legacyCycles = CYCLES.map((cycle) => analyzeCycle(rows, cycle)).filter(Boolean);
    const legacySummary = summarize(legacyCycles);

    const cycles = CYCLES.map((cycle) => analyzeFastCycle(rows, cycle)).filter(Boolean);
    const summary = summarizeFast(cycles);

    const diagnostics = {
      rowCount: rows.length,
      validMvrvRows: rows.filter((row) => Number.isFinite(row.mvrv)).length,
      validRealizedCapRows: rows.filter((row) => Number.isFinite(row.realizedCap)).length,
      cycleRows: Object.fromEntries(
        CYCLES.map((cycle) => [
          cycle.key,
          rows.filter((row) => row.date >= cycle.start && row.date <= cycle.end).length,
        ]),
      ),
      combinationsTested: summary.length,
      combinationsWithAnyCycle: summary.filter((item) => item.cyclesTriggered > 0).length,
      combinationsWithTwoOrMoreCycles: summary.filter((item) => item.cyclesTriggered >= 2).length,
      legacyV2Combinations: legacySummary.length,
      legacyV2WithTwoOrMoreCycles: legacySummary.filter((item) => item.cyclesTriggered >= 2).length,
    };

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'live-backtest-v2-1',
      diagnostics,
      methodology: {
        version: 'V2.1',
        sequence: 'Contexto previo → cruce de drawdown → confirmación rápida posterior',
        context: 'MVRV >= 2.4 en la ventana previa O capital débil (< +0.5% a 30d) al menos 7 días',
        event: 'Primer cruce del drawdown desde el máximo conocido hasta ese día',
        confirmationFamilies: {
          capital_relative: 'Realized Cap 7d entra en contracción o deteriora al menos 0.35 pp frente al nivel del evento',
          price_structure: 'BTC permanece 3 cierres bajo el umbral o profundiza otros 4 puntos porcentuales de drawdown',
        },
        confirmationWindow: '7, 14 o 21 días posteriores al evento',
        falsePositive: 'Confirmación >60 días antes del máximo final que luego recupera un nuevo máximo dentro de 270 días',
        caveat: 'Los umbrales V2.1 son pruebas gruesas predefinidas, no parámetros optimizados. Tres ciclos no permiten ajuste fino.',
      },
      legacyV2: {
        methodology: 'Capital 30d negativo o 7 días consecutivos débil',
        cycles: legacyCycles,
        summary: legacySummary,
      },
      cycles,
      summary,
    });
  } catch (error) {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sourceStatus: 'error',
      error: error?.message || 'No fue posible ejecutar el backtest secuencial',
      methodology: null,
      cycles: [],
      summary: [],
    });
  }
}
