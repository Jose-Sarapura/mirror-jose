import { NextResponse } from 'next/server';
import { getAssetConfig } from '../../../lib/mirror-config';

export const dynamic = 'force-dynamic';

const RANGE_MAP = {
  '1d': { range: '1d', interval: '5m' },
  '1m': { range: '1mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '5y': { range: '5y', interval: '1wk' },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = String(searchParams.get('ticker') || 'SMH').toUpperCase();
  const selectedRange = String(searchParams.get('range') || '1y').toLowerCase();
  const asset = getAssetConfig(ticker);
  const rangeConfig = RANGE_MAP[selectedRange] || RANGE_MAP['1y'];

  if (!asset) {
    return NextResponse.json({ error: 'Activo no reconocido' }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.marketSymbol)}?range=${rangeConfig.range}&interval=${rangeConfig.interval}&events=div%2Csplits`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/2.0' },
      next: { revalidate: selectedRange === '1d' ? 60 : 1800 },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = (await response.json())?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const points = timestamps
      .map((timestamp, index) => ({
        timestamp: timestamp * 1000,
        date: new Date(timestamp * 1000).toISOString(),
        price: Number(closes[index]),
      }))
      .filter((point) => Number.isFinite(point.price));

    if (!points.length) throw new Error('Sin datos históricos');

    return NextResponse.json({
      ticker,
      range: selectedRange,
      currency: asset.currency,
      source: 'market',
      points,
    });
  } catch {
    return NextResponse.json({
      ticker,
      range: selectedRange,
      currency: asset.currency,
      source: 'unavailable',
      points: [],
      error: 'El histórico no está disponible temporalmente.',
    });
  }
}
