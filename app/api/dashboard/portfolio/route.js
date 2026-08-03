import { NextResponse } from 'next/server';
import { MIRROR_DEFAULTS } from '../../../lib/mirror-config';

export const dynamic = 'force-dynamic';

async function fetchQuote(symbol, fallbackPrice) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/2.0' },
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta || {};
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
    const price = Number(meta.regularMarketPrice ?? closes.at(-1));
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes.at(-2) ?? price);

    if (!Number.isFinite(price)) throw new Error('Precio inválido');

    return {
      price,
      previousClose: Number.isFinite(previousClose) ? previousClose : price,
      marketState: meta.marketState || 'UNKNOWN',
      marketTime: meta.regularMarketTime || null,
      source: 'market',
    };
  } catch {
    return {
      price: fallbackPrice,
      previousClose: fallbackPrice,
      marketState: 'FALLBACK',
      marketTime: null,
      source: 'fallback',
    };
  }
}

export async function GET() {
  const defaults = MIRROR_DEFAULTS;
  const configs = Object.values(defaults.assets);

  const [fxQuote, ...quotes] = await Promise.all([
    fetchQuote('CLP=X', 948.75),
    ...configs.map((asset) => fetchQuote(asset.marketSymbol, asset.fallbackPrice)),
  ]);

  const fx = fxQuote.price;
  const assets = configs.map((asset, index) => {
    const quote = quotes[index];
    const valueNative = quote.price * asset.shares;
    const previousValueNative = quote.previousClose * asset.shares;
    const valueCLP = asset.currency === 'USD' ? valueNative * fx : valueNative;
    const previousValueCLP = asset.currency === 'USD' ? previousValueNative * fx : previousValueNative;

    return {
      ...asset,
      price: quote.price,
      previousClose: quote.previousClose,
      dayChange: quote.price - quote.previousClose,
      dayChangePct: quote.previousClose ? ((quote.price / quote.previousClose) - 1) * 100 : 0,
      valueNative,
      previousValueNative,
      valueCLP,
      previousValueCLP,
      marketState: quote.marketState,
      marketTime: quote.marketTime,
      source: quote.source,
    };
  });

  const cashUSDCLP = defaults.cashUSD * fx;
  const totalCashCLP = defaults.cashCLP + cashUSDCLP;
  const investedCLP = assets.reduce((sum, asset) => sum + asset.valueCLP, 0);
  const previousInvestedCLP = assets.reduce((sum, asset) => sum + asset.previousValueCLP, 0);
  const totalCLP = investedCLP + totalCashCLP;
  const previousTotalCLP = previousInvestedCLP + totalCashCLP;

  const enrichedAssets = assets.map((asset) => ({
    ...asset,
    weight: investedCLP ? (asset.valueCLP / investedCLP) * 100 : 0,
    targetValueCLP: investedCLP * (asset.targetWeight / 100),
    gapCLP: investedCLP * (asset.targetWeight / 100) - asset.valueCLP,
  }));

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    fx,
    fxSource: fxQuote.source,
    totalCLP,
    investedCLP,
    previousTotalCLP,
    dayChangeCLP: totalCLP - previousTotalCLP,
    dayChangePct: previousTotalCLP ? ((totalCLP / previousTotalCLP) - 1) * 100 : 0,
    cashCLP: defaults.cashCLP,
    cashUSD: defaults.cashUSD,
    cashUSDCLP,
    totalCashCLP,
    goalCLP: defaults.goalCLP,
    monthlyContributionCLP: defaults.monthlyContributionCLP,
    assets: enrichedAssets,
  });
}
