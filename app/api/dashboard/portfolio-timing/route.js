import { NextResponse } from 'next/server';
import { MIRROR_DEFAULTS } from '../../../lib/mirror-config';

export const dynamic = 'force-dynamic';

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
  let note = 'La estructura todavía no está plenamente confirmada; conviene aportar por tramos.';

  if (activeDowntrend || score <= 25) {
    state = 'downtrend';
    status = 'Tendencia bajista activa';
    note = 'La tendencia es débil. No obliga a vender si la tesis está intacta, pero sí reduce el ritmo de nuevos aportes.';
  } else if (score >= 75 && Number.isFinite(ma200) && price > ma200 && Number.isFinite(ma50Slope20dPct) && ma50Slope20dPct > 0) {
    state = 'confirmed';
    status = 'Tendencia confirmada';
    note = 'Precio, medias y momentum acompañan. El timing permite aportar con mayor normalidad si la asignación lo requiere.';
  }

  return {
    state,
    status,
    score,
    note,
    priceVsMa50Pct: pctChange(price, ma50),
    priceVsMa200Pct: pctChange(price, ma200),
    ma50Slope20dPct,
    momentum1mPct,
    momentum3mPct,
    momentum6mPct,
    higherLow20,
  };
}

async function fetchTiming(asset) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.marketSymbol)}?interval=1d&range=2y`;
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
    const drawdownFromHigh = high52w ? ((price / high52w) - 1) * 100 : null;

    return {
      ticker: asset.ticker,
      asOf: observations.at(-1)?.date || null,
      price,
      high52w,
      low52w,
      drawdownFromHigh,
      trend: buildTrend(observations),
      source: 'Yahoo Finance market history',
    };
  } catch {
    return {
      ticker: asset.ticker,
      asOf: null,
      price: null,
      high52w: null,
      low52w: null,
      drawdownFromHigh: null,
      trend: {
        state: 'unavailable',
        status: 'Sin datos de timing',
        score: null,
        note: 'Mirror mantiene la decisión fundamental y de asignación; no inventa una señal técnica.',
      },
      source: 'unavailable',
    };
  }
}

export async function GET() {
  const assets = Object.values(MIRROR_DEFAULTS.assets);
  const rows = await Promise.all(assets.map(fetchTiming));
  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    methodology: 'La calidad/tesis decide si mantener el activo. Tendencia y momentum solo regulan el timing y la velocidad de nuevos aportes; nunca obligan a vender por sí solos.',
    assets: rows,
  });
}
