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

async function fetchHistory(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta || {};
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
    const price = Number(meta.regularMarketPrice ?? closes.at(-1));
    if (!Number.isFinite(price) || !closes.length) throw new Error('Datos inválidos');

    const high52w = Math.max(...closes);
    const low52w = Math.min(...closes);
    const first = closes[0];
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes.at(-2) ?? price);
    const drawdownFromHigh = high52w ? ((price / high52w) - 1) * 100 : 0;
    const oneYearChangePct = first ? ((price / first) - 1) * 100 : 0;
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
      status: 'Alerta de precio alta',
      level: 'review',
      note: 'Está 20% o más bajo su máximo de 1 año. Esto NO significa que esté barato ni que sea una compra.',
    };
  }
  if (drawdown <= -10) {
    return {
      status: 'Alerta de precio media',
      level: 'watch',
      note: 'Está entre 10% y 20% bajo su máximo de 1 año. Requiere análisis antes de cualquier decisión.',
    };
  }
  return {
    status: 'Sin alerta de precio',
    level: 'neutral',
    note: 'La distancia al máximo de 1 año es menor a 10%. El precio por sí solo no activa revisión.',
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

function decisionFor(candidate, market) {
  const valuation = dynamicValuation(candidate, market.price);
  const s = candidate.snapshot;

  const score =
    valuation.score * 0.25 +
    s.fundamentals * 0.25 +
    s.riskResilience * 0.15 +
    s.portfolioFit * 0.20 +
    s.thesisStrength * 0.15;

  let status = 'Mantener en estudio';
  let level = 'study';
  let explanation = 'La tesis merece seguimiento, pero todavía no hay una combinación suficientemente clara de valoración, riesgo y encaje.';

  if (score >= 78 && valuation.score >= 65 && s.portfolioFit >= 75) {
    status = 'Candidato a incorporar';
    level = 'candidate';
    explanation = 'Supera el filtro inicial de tesis, fundamentales, valoración, riesgo y encaje. El siguiente paso es definir tamaño y fuente de financiamiento; no es una orden de compra.';
  } else if (valuation.score < 45 && s.thesisStrength >= 75) {
    status = 'Esperar mejor valoración';
    level = 'wait';
    explanation = 'La tesis sigue siendo interesante, pero la valoración actual no ofrece suficiente margen para justificar incorporación.';
  } else if (score < 55 || s.thesisStrength < 60) {
    status = 'Descartar por ahora';
    level = 'reject';
    explanation = 'El balance entre valoración, fundamentales, riesgo y encaje no justifica mantenerlo como candidato activo en este momento.';
  }

  return {
    status,
    level,
    score: Math.round(score),
    explanation,
    estimatedForwardPE: valuation.estimatedForwardPE,
    blocks: [
      { key: 'valuation', label: 'Valoración', score: valuation.score, note: `P/E forward estimado ~${valuation.estimatedForwardPE.toFixed(1)}x` },
      { key: 'fundamentals', label: candidate.type === 'etf' ? 'Calidad del vehículo' : 'Fundamentales', score: s.fundamentals, note: candidate.type === 'etf' ? 'Diversificación, liquidez, costo y estructura.' : 'Resultados, balance, crecimiento y visibilidad.' },
      { key: 'risk', label: 'Riesgo / resiliencia', score: s.riskResilience, note: 'Mayor puntaje = mejor capacidad de soportar escenarios adversos.' },
      { key: 'fit', label: 'Encaje cartera', score: s.portfolioFit, note: 'Función nueva, duplicación y compatibilidad con 60/20/15/5.' },
      { key: 'thesis', label: 'Tesis', score: s.thesisStrength, note: 'Fuerza y vigencia estructural de la idea.' },
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
        valuation: 'Diaria sobre estimación vigente',
        thesis: 'Semanal / por evento',
        fundamentals: 'Trimestral / resultados',
      },
    };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    methodology: 'Decision Gate: valoración 25% + fundamentales 25% + riesgo 15% + encaje 20% + tesis 15%. No emite órdenes de compra.',
    candidates,
  });
}
