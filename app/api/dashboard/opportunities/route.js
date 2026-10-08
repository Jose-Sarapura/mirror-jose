import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CANDIDATES = [
  {
    ticker: 'VST',
    name: 'Vistra Corp.',
    type: 'stock',
    role: 'Generación eléctrica / demanda de data centers',
    thesis: 'Captura de forma directa la necesidad creciente de electricidad firme asociada a centros de datos e IA.',
    compareWith: 'CEG',
    fit: 'Complementa SMH desde la capa de energía; no reemplaza el núcleo VOO.',
    snapshot: {
      date: '2026-09-17',
      price: 140.67,
      forwardPE: 13.83,
      evEbitda: 10.71,
      fundamentals: 82,
      riskResilience: 60,
      portfolioFit: 85,
      thesisStrength: 90,
      facts: [
        'EBITDA ajustado Q2 2026 creció más de 30% interanual.',
        'Guía 2026 de EBITDA ajustado: USD 6,8–7,6 mil millones.',
        'Deuda neta / EBITDA ajustado: aproximadamente 2,4x–2,6x.',
        'Contratos/PPAs de largo plazo ligados a grandes centros de datos y energía nuclear.',
      ],
      positives: ['Crecimiento operativo fuerte', 'Visibilidad contractual', 'Valoración moderada frente a su propio crecimiento'],
      risks: ['Deuda relevante', 'Empresa individual', 'Sensibilidad a regulación, energía y ejecución'],
      sourceLabel: 'Vistra Q2 2026 + Yahoo Finance',
    },
  },
  {
    ticker: 'GRID',
    name: 'First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund',
    type: 'etf',
    role: 'Redes e infraestructura eléctrica',
    thesis: 'Diversifica la tesis energética hacia redes, equipos, transmisión y electrificación.',
    compareWith: 'ETN / GEV',
    fit: 'Aporta infraestructura física con menor dependencia de una sola empresa.',
    snapshot: {
      date: '2026-09-17',
      price: 176.84,
      forwardPE: 28.81,
      evEbitda: null,
      fundamentals: 78,
      riskResilience: 80,
      portfolioFit: 90,
      thesisStrength: 86,
      facts: [
        'ETF con 119 posiciones y rebalanceo trimestral.',
        'Expense ratio: 0,56%.',
        'P/E de cartera: 28,81x.',
        'Desviación estándar 3 años: 20,61%; beta: 1,20.',
      ],
      positives: ['Diversificación interna alta', 'Exposición directa a redes/equipamiento', 'Reduce riesgo de elegir una sola empresa'],
      risks: ['Valoración exigente', 'Costo mayor que un ETF núcleo', 'También mantiene sensibilidad cíclica e industrial'],
      sourceLabel: 'First Trust GRID',
    },
  },
  {
    ticker: 'CCJ',
    name: 'Cameco Corp.',
    type: 'stock',
    role: 'Uranio / cadena nuclear',
    thesis: 'Expone al combustible nuclear y a una parte de la cadena de valor nuclear de largo plazo.',
    compareWith: 'URA / NLR',
    fit: 'Es la tesis más específica y, por eso, exige mayor disciplina de tamaño y valoración.',
    snapshot: {
      date: '2026-09-17',
      price: 91.62,
      forwardPE: 50.51,
      evEbitda: 66.50,
      fundamentals: 80,
      riskResilience: 58,
      portfolioFit: 72,
      thesisStrength: 84,
      facts: [
        'Cameco mantiene su perspectiva anual de producción 2026.',
        'Caja aproximada CAD 1,1 mil millones y deuda total CAD 1,0 mil millones al cierre de Q2.',
        'Westinghouse amplía la exposición más allá de la minería de uranio.',
        'Valoración actual sigue elevada pese a la caída desde máximos.',
      ],
      positives: ['Balance sólido', 'Posición estratégica en ciclo nuclear', 'Exposición a Westinghouse'],
      risks: ['Valoración muy exigente', 'Commodity/ciclo del uranio', 'Mayor volatilidad temática'],
      sourceLabel: 'Cameco Q2 2026 + Yahoo Finance',
    },
  },
];

function avg(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function pctChange(current, previous) {
  if (!(Number.isFinite(current) && Number.isFinite(previous)) || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function sma(closes, period, endIndex = closes.length - 1) {
  if (endIndex < period - 1) return null;
  return avg(closes.slice(endIndex - period + 1, endIndex + 1));
}

function sessionsReturn(closes, sessions) {
  if (closes.length <= sessions) return null;
  return pctChange(closes.at(-1), closes.at(-(sessions + 1)));
}

function buildTrend(observations) {
  const closes = observations.map((row) => row.close);
  const price = closes.at(-1);
  const index = closes.length - 1;

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const ma50Prior = sma(closes, 50, index - 20);
  const ma50Slope20dPct = pctChange(ma50, ma50Prior);
  const momentum1mPct = sessionsReturn(closes, 21);
  const momentum3mPct = sessionsReturn(closes, 63);
  const momentum6mPct = sessionsReturn(closes, 126);

  const recent20 = closes.slice(-20);
  const previous20 = closes.slice(-40, -20);
  const recentLow20 = recent20.length ? Math.min(...recent20) : null;
  const previousLow20 = previous20.length ? Math.min(...previous20) : null;
  const higherLow20 = Number.isFinite(recentLow20) && Number.isFinite(previousLow20) && recentLow20 > previousLow20;

  let score = 0;
  if (Number.isFinite(ma50) && price > ma50) score += 20;
  if (Number.isFinite(ma200) && price > ma200) score += 25;
  if (Number.isFinite(ma50Slope20dPct) && ma50Slope20dPct > 0) score += 20;
  if (Number.isFinite(momentum3mPct) && momentum3mPct > 0) score += 15;
  if (Number.isFinite(momentum6mPct) && momentum6mPct > 0) score += 10;
  if (higherLow20) score += 10;

  const activeDowntrend = (
    Number.isFinite(ma200) && price < ma200
    && Number.isFinite(ma50Slope20dPct) && ma50Slope20dPct < 0
    && Number.isFinite(momentum3mPct) && momentum3mPct < 0
  );

  let state = 'stabilizing';
  let status = 'Estabilización / transición';
  let note = 'La tendencia aún no está plenamente confirmada, pero aparecen señales de estabilización.';

  if (activeDowntrend || score <= 25) {
    state = 'downtrend';
    status = 'Tendencia bajista activa';
    note = 'El precio sigue débil. Esto no invalida la tesis, pero exige una entrada pequeña y escalonada.';
  } else if (score >= 75 && Number.isFinite(ma200) && price > ma200 && Number.isFinite(ma50Slope20dPct) && ma50Slope20dPct > 0) {
    state = 'confirmed';
    status = 'Tendencia confirmada';
    note = 'Precio, medias y momentum muestran recuperación suficiente para un timing más favorable.';
  }

  return {
    state,
    status,
    score,
    note,
    ma20,
    ma50,
    ma200,
    priceVsMa50Pct: pctChange(price, ma50),
    priceVsMa200Pct: pctChange(price, ma200),
    ma50Slope20dPct,
    momentum1mPct,
    momentum3mPct,
    momentum6mPct,
    higherLow20,
  };
}

async function fetchHistory(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta || {};
    const timestamps = result?.timestamp || [];
    const rawCloses = result?.indicators?.quote?.[0]?.close || [];
    const observations = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(rawCloses[index]),
      }))
      .filter((row) => Number.isFinite(row.close));

    const closes = observations.map((row) => row.close);
    const price = Number(meta.regularMarketPrice ?? closes.at(-1));
    if (!Number.isFinite(price) || closes.length < 200) throw new Error('Datos insuficientes');

    observations[observations.length - 1].close = price;
    const currentCloses = observations.map((row) => row.close);
    const yearWindow = currentCloses.slice(-252);
    const high52w = Math.max(...yearWindow);
    const low52w = Math.min(...yearWindow);
    const first52w = yearWindow[0];
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? currentCloses.at(-2) ?? price);
    const drawdownFromHigh = high52w ? ((price / high52w) - 1) * 100 : 0;
    const oneYearChangePct = first52w ? ((price / first52w) - 1) * 100 : 0;
    const rangePosition = high52w === low52w ? 50 : ((price - low52w) / (high52w - low52w)) * 100;

    return {
      price,
      previousClose,
      dayChangePct: previousClose ? ((price / previousClose) - 1) * 100 : 0,
      high52w,
      low52w,
      drawdownFromHigh,
      oneYearChangePct,
      rangePosition,
      trend: buildTrend(observations),
      marketState: meta.marketState || 'UNKNOWN',
      source: 'market',
    };
  } catch {
    return {
      price: null,
      previousClose: null,
      dayChangePct: null,
      high52w: null,
      low52w: null,
      drawdownFromHigh: null,
      oneYearChangePct: null,
      rangePosition: null,
      trend: {
        state: 'unavailable',
        status: 'Sin datos de tendencia',
        score: null,
        note: 'No hay historial suficiente para evaluar timing.',
      },
      marketState: 'UNAVAILABLE',
      source: 'unavailable',
    };
  }
}

function priceSignal(drawdown) {
  if (!Number.isFinite(drawdown)) {
    return { status: 'Sin datos', level: 'neutral', note: 'No hay precio suficiente para evaluar.' };
  }
  if (drawdown <= -20) {
    return {
      status: 'Dislocación alta',
      level: 'review',
      note: 'Está 20% o más bajo su máximo de 1 año. Es una dislocación de precio, no una señal de compra por sí sola.',
    };
  }
  if (drawdown <= -10) {
    return {
      status: 'Dislocación media',
      level: 'watch',
      note: 'Está entre 10% y 20% bajo su máximo de 1 año. Puede mejorar la asimetría si la tesis y los fundamentales siguen intactos.',
    };
  }
  return {
    status: 'Sin dislocación relevante',
    level: 'neutral',
    note: 'La distancia al máximo de 1 año es menor a 10%.',
  };
}

function dynamicValuation(candidate, currentPrice) {
  const base = candidate.snapshot;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(base.forwardPE) || !Number.isFinite(base.price)) {
    return { estimatedForwardPE: base.forwardPE, score: 50 };
  }

  const earningsProxy = base.price / base.forwardPE;
  const estimatedForwardPE = currentPrice / earningsProxy;
  let score;

  if (candidate.type === 'etf') {
    if (estimatedForwardPE <= 20) score = 85;
    else if (estimatedForwardPE <= 24) score = 72;
    else if (estimatedForwardPE <= 28) score = 60;
    else if (estimatedForwardPE <= 32) score = 48;
    else if (estimatedForwardPE <= 36) score = 35;
    else score = 22;
  } else {
    if (estimatedForwardPE <= 15) score = 88;
    else if (estimatedForwardPE <= 20) score = 76;
    else if (estimatedForwardPE <= 30) score = 60;
    else if (estimatedForwardPE <= 40) score = 45;
    else if (estimatedForwardPE <= 55) score = 28;
    else score = 15;
  }

  return { estimatedForwardPE, score };
}

function entryPlanFor(qualified, trend) {
  if (!qualified) {
    return {
      stage: 0,
      label: 'Sin entrada',
      size: '0% hasta superar hard gates',
      action: 'Seguir estudiando',
      explanation: 'El timing nunca compensa una tesis, valoración, calidad, riesgo o encaje que falle un hard gate.',
    };
  }

  if (trend?.state === 'downtrend') {
    return {
      stage: 1,
      label: 'Oportunidad anticipada',
      size: '20–30% del tamaño objetivo',
      action: 'Entrada parcial a evaluar',
      explanation: 'La calidad/valoración permite considerar exposición, pero la tendencia bajista obliga a reservar capital para nuevas caídas o una mejor confirmación.',
    };
  }

  if (trend?.state === 'confirmed') {
    return {
      stage: 3,
      label: 'Oportunidad confirmada',
      size: 'Completar gradualmente el tamaño objetivo',
      action: 'Entrada escalonada confirmada',
      explanation: 'La tesis supera los filtros y el precio ya muestra recuperación de estructura. No implica comprar todo de una vez.',
    };
  }

  return {
    stage: 2,
    label: 'Oportunidad en estabilización',
    size: '30–40% adicional si mantiene la base',
    action: 'Aumentar solo con confirmación',
    explanation: 'La caída pierde fuerza o aparece una base. Se puede ampliar gradualmente sin exigir esperar una recuperación completa.',
  };
}

function decisionFor(candidate, market) {
  const valuation = dynamicValuation(candidate, market.price);
  const s = candidate.snapshot;

  const weights = {
    valuation: 0.25,
    fundamentals: 0.25,
    risk: 0.20,
    fit: 0.20,
    thesis: 0.10,
  };

  const gates = {
    valuation: 60,
    fundamentals: 70,
    risk: 60,
    fit: 75,
    thesis: 75,
  };

  const scores = {
    valuation: valuation.score,
    fundamentals: s.fundamentals,
    risk: s.riskResilience,
    fit: s.portfolioFit,
    thesis: s.thesisStrength,
  };

  const score =
    scores.valuation * weights.valuation +
    scores.fundamentals * weights.fundamentals +
    scores.risk * weights.risk +
    scores.fit * weights.fit +
    scores.thesis * weights.thesis;

  const failedGates = Object.entries(gates)
    .filter(([key, minimum]) => scores[key] < minimum)
    .map(([key, minimum]) => ({ key, minimum, score: scores[key] }));

  const nearGate = Object.entries(gates)
    .filter(([key, minimum]) => scores[key] >= minimum && scores[key] <= minimum + 5)
    .map(([key, minimum]) => ({ key, minimum, score: scores[key] }));

  const labels = {
    valuation: 'valoración',
    fundamentals: candidate.type === 'etf' ? 'calidad del vehículo' : 'fundamentales',
    risk: 'riesgo / resiliencia',
    fit: 'encaje con cartera',
    thesis: 'tesis',
  };

  const qualified = failedGates.length === 0 && score >= 80;
  const entryPlan = entryPlanFor(qualified, market.trend);

  let status = 'Mantener en estudio';
  let level = 'study';
  let explanation = 'La tesis merece seguimiento, pero aún no supera todos los filtros obligatorios para incorporación.';
  let mainBlocker = '';

  if (qualified) {
    level = 'candidate';
    if (market.trend?.state === 'downtrend') {
      status = 'Oportunidad fundamental · tendencia bajista';
      explanation = 'Supera los hard gates de calidad y valoración. La tendencia no invalida la oportunidad; reduce el tamaño inicial y exige entrada escalonada.';
    } else if (market.trend?.state === 'confirmed') {
      status = 'Oportunidad confirmada';
      explanation = 'Supera los hard gates y además presenta una estructura de precio más favorable. Puede avanzar a construcción gradual de posición.';
    } else {
      status = 'Oportunidad en estabilización';
      explanation = 'Supera los hard gates y la presión bajista muestra señales de estabilización. Puede avanzar gradualmente sin esperar una recuperación total.';
    }
  } else if (failedGates.some((gate) => gate.key === 'valuation') && scores.thesis >= gates.thesis) {
    status = 'Esperar mejor valoración';
    level = 'wait';
    mainBlocker = `Valoración ${scores.valuation}/100 < mínimo ${gates.valuation}/100`;
    explanation = 'La tesis puede seguir siendo atractiva, pero la valoración actual no ofrece suficiente margen para incorporación.';
  } else if (failedGates.length > 0) {
    status = 'Mantener en estudio';
    level = 'study';
    mainBlocker = failedGates
      .map((gate) => `${labels[gate.key]} ${gate.score}/100 < mínimo ${gate.minimum}/100`)
      .join(' · ');
    explanation = `No puede incorporarse mientras falle un hard gate. Motivo principal: ${mainBlocker}.`;
  } else if (score < 60) {
    status = 'Descartar por ahora';
    level = 'reject';
    explanation = 'El balance global entre valoración, calidad, riesgo, encaje y tesis no justifica mantenerlo como candidato activo.';
  }

  return {
    status,
    level,
    score: Math.round(score),
    rawScore: Number(score.toFixed(1)),
    explanation,
    mainBlocker,
    failedGates,
    nearGate,
    qualified,
    entryPlan,
    estimatedForwardPE: valuation.estimatedForwardPE,
    methodology: {
      weights: { valuation: 25, fundamentals: 25, risk: 20, fit: 20, thesis: 10 },
      gates,
      timingRule: 'La tendencia no es hard gate. Define tamaño y secuencia de entrada después de superar calidad/valoración.',
    },
    blocks: [
      { key: 'valuation', label: 'Valoración', score: scores.valuation, gate: gates.valuation, weight: 25, note: `P/E forward estimado ~${valuation.estimatedForwardPE.toFixed(1)}x` },
      { key: 'fundamentals', label: candidate.type === 'etf' ? 'Calidad del vehículo' : 'Fundamentales', score: scores.fundamentals, gate: gates.fundamentals, weight: 25, note: candidate.type === 'etf' ? 'Diversificación, liquidez, costo y estructura.' : 'Resultados, balance, crecimiento y visibilidad.' },
      { key: 'risk', label: 'Riesgo / resiliencia', score: scores.risk, gate: gates.risk, weight: 20, note: 'Mayor puntaje = mejor capacidad de soportar escenarios adversos.' },
      { key: 'fit', label: 'Encaje cartera', score: scores.fit, gate: gates.fit, weight: 20, note: 'Función nueva, duplicación y compatibilidad con 60/20/15/5.' },
      { key: 'thesis', label: 'Tesis', score: scores.thesis, gate: gates.thesis, weight: 10, note: 'La tesis importa, pero no puede compensar valoración, riesgo o fundamentos deficientes.' },
    ],
  };
}

export async function GET() {
  const market = await Promise.all(CANDIDATES.map((candidate) => fetchHistory(candidate.ticker)));

  const candidates = CANDIDATES.map((candidate, index) => {
    const snapshot = market[index];
    const decision = decisionFor(candidate, snapshot);

    return {
      ...candidate,
      snapshot: undefined,
      ...snapshot,
      signal: priceSignal(snapshot.drawdownFromHigh),
      decision,
      fundamentalsUpdatedAt: candidate.snapshot.date,
      facts: candidate.snapshot.facts,
      positives: candidate.snapshot.positives,
      risks: candidate.snapshot.risks,
      sourceLabel: candidate.snapshot.sourceLabel,
      cadence: {
        market: 'Diaria',
        trend: 'Diaria',
        valuation: 'Diaria sobre estimación vigente',
        thesis: 'Semanal / por evento',
        fundamentals: 'Trimestral / resultados',
      },
    };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    methodology: 'Mirror separa calidad de oportunidad y timing. Hard gates: valoración 60, fundamentales 70, riesgo 60, encaje 75 y tesis 75. Una tendencia bajista no bloquea una oportunidad: reduce el tamaño inicial y obliga a escalonar.',
    candidates,
  });
}
