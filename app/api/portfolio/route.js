import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const HOLDINGS = {
  VOO: { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', shares: 9.43928896, fallbackPrice: 679.14 },
  SMH: { symbol: 'SMH', name: 'VanEck Semiconductor ETF', shares: 2.23582414, fallbackPrice: 561.19 },
  BCH: { symbol: 'BCH', name: 'Banco de Chile ADR', shares: 14.17875002, fallbackPrice: 40.72 },
  CFIETFGE: { symbol: 'CFIETFGE.SN', name: 'Acciones Globales', shares: 431, fallbackPrice: 3247.15 }
};

async function quote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`Error consultando ${symbol}`);
  const json = await r.json();
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!Number.isFinite(price)) throw new Error(`Precio inválido para ${symbol}`);
  return price;
}

async function safeQuote(symbol, fallbackPrice) {
  try { return { price: await quote(symbol), source: 'market' }; }
  catch { return { price: fallbackPrice, source: 'fallback' }; }
}

export async function GET() {
  const [fxQ, vooQ, smhQ, bchQ, globalQ] = await Promise.all([
    safeQuote('CLP=X', 948.75),
    safeQuote(HOLDINGS.VOO.symbol, HOLDINGS.VOO.fallbackPrice),
    safeQuote(HOLDINGS.SMH.symbol, HOLDINGS.SMH.fallbackPrice),
    safeQuote(HOLDINGS.BCH.symbol, HOLDINGS.BCH.fallbackPrice),
    safeQuote(HOLDINGS.CFIETFGE.symbol, HOLDINGS.CFIETFGE.fallbackPrice)
  ]);

  const fx = fxQ.price;
  const raw = [
    { ticker: 'VOO', name: HOLDINGS.VOO.name, currency: 'USD', valueNative: vooQ.price * HOLDINGS.VOO.shares, valueCLP: vooQ.price * HOLDINGS.VOO.shares * fx, source: vooQ.source },
    { ticker: 'SMH', name: HOLDINGS.SMH.name, currency: 'USD', valueNative: smhQ.price * HOLDINGS.SMH.shares, valueCLP: smhQ.price * HOLDINGS.SMH.shares * fx, source: smhQ.source },
    { ticker: 'BCH', name: HOLDINGS.BCH.name, currency: 'USD', valueNative: bchQ.price * HOLDINGS.BCH.shares, valueCLP: bchQ.price * HOLDINGS.BCH.shares * fx, source: bchQ.source },
    { ticker: 'CFIETFGE', name: HOLDINGS.CFIETFGE.name, currency: 'CLP', valueNative: globalQ.price * HOLDINGS.CFIETFGE.shares, valueCLP: globalQ.price * HOLDINGS.CFIETFGE.shares, source: globalQ.source }
  ];

  const cashCLP = 1874;
  const totalCLP = raw.reduce((sum, a) => sum + a.valueCLP, 0) + cashCLP;
  const assets = raw.map(a => ({ ...a, weight: a.valueCLP / totalCLP * 100 }));

  return NextResponse.json({ updatedAt: new Date().toISOString(), fx, fxSource: fxQ.source, cashCLP, totalCLP, assets });
}
