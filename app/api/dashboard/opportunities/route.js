import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CANDIDATES = [
  {
    ticker: 'VST',
    name: 'Vistra Corp.',
    role: 'Generación eléctrica / demanda de data centers',
    thesis: 'Captura de forma directa la necesidad creciente de electricidad firme asociada a centros de datos e IA.',
    compareWith: 'CEG',
    fit: 'Complementa SMH desde la capa de energía; no reemplaza el núcleo VOO.',
  },
  {
    ticker: 'GRID',
    name: 'First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund',
    role: 'Redes e infraestructura eléctrica',
    thesis: 'Diversifica la tesis energética hacia redes, equipos, transmisión y electrificación.',
    compareWith: 'ETN / GEV',
    fit: 'Aporta infraestructura física con menor dependencia de una sola empresa.',
  },
  {
    ticker: 'CCJ',
    name: 'Cameco Corp.',
    role: 'Uranio / cadena nuclear',
    thesis: 'Expone al combustible nuclear y a una parte de la cadena de valor nuclear de largo plazo.',
    compareWith: 'URA / NLR',
    fit: 'Es la tesis más específica y, por eso, exige mayor disciplina de tamaño y valoración.',
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

export async function GET() {
  const market = await Promise.all(CANDIDATES.map((candidate) => fetchHistory(candidate.ticker)));

  const candidates = CANDIDATES.map((candidate, index) => {
    const snapshot = market[index];
    return {
      ...candidate,
      ...snapshot,
      signal: priceSignal(snapshot.drawdownFromHigh),
      thesisStatus: 'En estudio',
      decisionStatus: 'Aún no evaluado para incorporación',
      decisionNote: 'Faltan valoración, fundamentales, riesgo y encaje con la cartera antes de decidir.',
      cadence: {
        market: 'Diaria',
        thesis: 'Semanal / por evento',
        fundamentals: 'Trimestral / resultados',
      },
    };
  });

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    methodology: 'Precio diario + revisión de tesis/fundamentales. Mirror no emite órdenes de compra.',
    candidates,
  });
}
