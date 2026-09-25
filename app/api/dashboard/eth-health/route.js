import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const ETH_ETF_READER = 'https://r.jina.ai/https://farside.co.uk/eth/';

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctChange(current, previous) {
  if (!(Number.isFinite(current) && Number.isFinite(previous)) || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function avg(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percentileRank(values, current) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length || !Number.isFinite(current)) return null;
  const belowOrEqual = valid.filter((value) => value <= current).length;
  return (belowOrEqual / valid.length) * 100;
}

function diffDays(a, b) {
  const one = new Date(a).getTime();
  const two = new Date(b).getTime();
  if (!Number.isFinite(one) || !Number.isFinite(two)) return null;
  return Math.max(1, Math.floor((two - one) / 86400000) + 1);
}

async function fetchAsset(asset, metrics, startTime) {
  const params = new URLSearchParams({
    assets: asset,
    metrics,
    frequency: '1d',
    start_time: startTime,
    paging_from: 'start',
    page_size: '2000',
    ignore_forbidden_errors: 'true',
    ignore_unsupported_errors: 'true',
  });

  const response = await fetch(`${COIN_METRICS}?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Coin Metrics ${asset} HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

function parseEthRows(rows) {
  return rows.map((row) => {
    const price = num(row.PriceUSD);
    const marketCap = num(row.CapMrktCurUSD);
    const mvrv = num(row.CapMVRVCur);
    return {
      time: row.time,
      date: row.time?.slice(0, 10),
      price,
      marketCap,
      mvrv,
      realizedCap: Number.isFinite(marketCap) && Number.isFinite(mvrv) && mvrv !== 0 ? marketCap / mvrv : null,
      activeAddresses: num(row.AdrActCnt),
      feeNtv: num(row.FeeTotNtv),
      transferAdjUSD: num(row.TxTfrValAdjUSD),
    };
  }).filter((row) => row.date && Number.isFinite(row.price))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function rollingAverage(rows, field, endIndex, days) {
  if (endIndex < 0) return null;
  const start = Math.max(0, endIndex - days + 1);
  return avg(rows.slice(start, endIndex + 1).map((row) => row[field]));
}

function buildDerived(rows) {
  return rows.map((row, index) => {
    const realized30 = index >= 30 ? rows[index - 30]?.realizedCap : null;
    const current30 = {
      active: rollingAverage(rows, 'activeAddresses', index, 30),
      fee: rollingAverage(rows, 'feeNtv', index, 30),
      transfer: rollingAverage(rows, 'transferAdjUSD', index, 30),
    };
    const prevEnd = index - 30;
    const previous30 = prevEnd >= 0 ? {
      active: rollingAverage(rows, 'activeAddresses', prevEnd, 30),
      fee: rollingAverage(rows, 'feeNtv', prevEnd, 30),
      transfer: rollingAverage(rows, 'transferAdjUSD', prevEnd, 30),
    } : { active: null, fee: null, transfer: null };

    const network = {
      active30dChangePct: pctChange(current30.active, previous30.active),
      fee30dChangePct: pctChange(current30.fee, previous30.fee),
      transfer30dChangePct: pctChange(current30.transfer, previous30.transfer),
    };

    const weak = [
      Number.isFinite(network.active30dChangePct) ? network.active30dChangePct <= -5 : null,
      Number.isFinite(network.fee30dChangePct) ? network.fee30dChangePct <= -10 : null,
      Number.isFinite(network.transfer30dChangePct) ? network.transfer30dChangePct <= -10 : null,
    ].filter((value) => value !== null);

    return {
      ...row,
      capital30dPct: pctChange(row.realizedCap, realized30),
      ...network,
      networkValid: weak.length,
      networkWeakCount: weak.filter(Boolean).length,
      networkRisk: weak.length >= 2 && weak.filter(Boolean).length >= 2,
    };
  });
}

function persistence(rows, predicate) {
  if (!rows.length || !predicate(rows[rows.length - 1])) return { days: 0, since: null };
  let since = rows[rows.length - 1].date;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (!predicate(rows[i])) break;
    since = rows[i].date;
  }
  return { days: diffDays(since, rows[rows.length - 1].date), since };
}

function classifyValuation(mvrv, percentile) {
  if (!Number.isFinite(mvrv) || !Number.isFinite(percentile)) return { status: 'Sin dato', tone: 'neutral', watch: false, risk: false };
  if (percentile >= 90) return { status: 'Valoración alta', tone: 'danger', watch: true, risk: true };
  if (percentile >= 75) return { status: 'Valoración elevada', tone: 'watch', watch: true, risk: false };
  return { status: 'Sin extremo', tone: 'good', watch: false, risk: false };
}

function classifyCapital(change30d) {
  if (!Number.isFinite(change30d)) return { status: 'Sin dato', tone: 'neutral', risk: false };
  if (change30d < 0) return { status: 'Contracción', tone: 'danger', risk: true };
  if (change30d < 0.5) return { status: 'Expansión débil', tone: 'watch', risk: false };
  return { status: 'Expansión', tone: 'good', risk: false };
}

function classifyNetwork(row) {
  if (!row || row.networkValid < 2) return { status: 'Datos insuficientes', tone: 'neutral', risk: false };
  if (row.networkRisk) return { status: 'Actividad debilitada', tone: 'danger', risk: true };
  if (row.networkWeakCount === 1) return { status: 'Debilidad parcial', tone: 'watch', risk: false };
  return { status: 'Actividad estable', tone: 'good', risk: false };
}

function buildRelative(ethRows, btcRows) {
  const btcByDate = new Map(btcRows.map((row) => [row.time?.slice(0,10), num(row.PriceUSD)]));
  const series = ethRows.map((row) => {
    const btc = btcByDate.get(row.date);
    return {
      date: row.date,
      ratio: Number.isFinite(row.price) && Number.isFinite(btc) && btc > 0 ? row.price / btc : null,
    };
  }).filter((row) => Number.isFinite(row.ratio));

  const latest = series[series.length - 1];
  if (!latest) return null;
  const avg90 = avg(series.slice(-90).map((row) => row.ratio));
  const distancePct = pctChange(latest.ratio, avg90);
  return {
    asOf: latest.date,
    ratio: latest.ratio,
    average90d: avg90,
    distancePct,
    status: !Number.isFinite(distancePct)
      ? 'Sin dato'
      : distancePct <= -10 ? 'ETH débil vs BTC'
      : distancePct <= -5 ? 'Bajo presión vs BTC'
      : 'Estructura relativa estable',
    tone: Number.isFinite(distancePct) && distancePct <= -10 ? 'danger'
      : Number.isFinite(distancePct) && distancePct <= -5 ? 'watch' : 'good',
    risk: Number.isFinite(distancePct) && distancePct <= -10,
  };
}

function parseFlow(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-' || raw === '—') return 0;
  const negative = /^\(.*\)$/.test(raw);
  const n = Number(raw.replace(/[(),$]/g, '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

async function fetchEthEtf() {
  try {
    const response = await fetch(ETH_ETF_READER, {
      headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0', Accept: 'text/plain' },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const text = await response.text();
    const rows = [];

    for (const raw of text.split('\n')) {
      const line = raw.trim().replace(/^\|\s*/, '');
      const match = line.match(/^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s*\|(.+)$/);
      if (!match) continue;
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const date = new Date(cells[0]);
      const total = parseFlow(cells[cells.length - 1]);
      if (Number.isNaN(date.getTime()) || !Number.isFinite(total)) continue;
      rows.push({ date: date.toISOString().slice(0,10), total });
    }

    const unique = [...new Map(rows.map((row) => [row.date, row])).values()].sort((a,b) => a.date.localeCompare(b.date));
    if (!unique.length) return null;

    const latest = unique[unique.length - 1];
    const flow5d = unique.slice(-5).reduce((sum,row)=>sum+row.total,0);
    const flow20d = unique.slice(-20).reduce((sum,row)=>sum+row.total,0);
    const negativeDays20 = unique.slice(-20).filter((row)=>row.total<0).length;

    return {
      asOf: latest.date,
      latestDailyFlowUSDm: latest.total,
      flow5dUSDm: flow5d,
      flow20dUSDm: flow20d,
      negativeDays20,
      confirmed: flow5d < 0 && flow20d < 0,
      watch: flow5d < 0 || flow20d < 0,
    };
  } catch {
    return null;
  }
}

function buildFallback() {
  return {
    updatedAt: new Date().toISOString(),
    sourceStatus: 'fallback',
    gate: {
      key: 'watch',
      label: 'Vigilancia',
      explanation: 'ETH no tiene suficientes datos vivos para elevar una acción. Mirror mantiene vigilancia sin vender.',
    },
    signals: {},
  };
}

export async function GET() {
  try {
    const start = daysAgo(760);
    const [ethRaw, btcRaw, etf] = await Promise.all([
      fetchAsset('eth', 'PriceUSD,CapMrktCurUSD,CapMVRVCur,AdrActCnt,FeeTotNtv,TxTfrValAdjUSD', start),
      fetchAsset('btc', 'PriceUSD', start),
      fetchEthEtf(),
    ]);

    const ethRows = buildDerived(parseEthRows(ethRaw));
    if (!ethRows.length) return NextResponse.json(buildFallback());

    const latest = ethRows[ethRows.length - 1];
    const cyclePeak = ethRows.reduce(
      (best, row) => !best || row.price > best.price ? row : best,
      null,
    );
    const cycleDrawdownPct = (
      Number.isFinite(latest?.price)
      && Number.isFinite(cyclePeak?.price)
      && cyclePeak.price > 0
    ) ? ((latest.price / cyclePeak.price) - 1) * 100 : null;
    const mvrvValues = ethRows.map((row) => row.mvrv).filter(Number.isFinite);
    const mvrvPercentile = percentileRank(mvrvValues, latest.mvrv);
    const valuation = classifyValuation(latest.mvrv, mvrvPercentile);
    const capital = classifyCapital(latest.capital30dPct);
    const network = classifyNetwork(latest);
    const relative = buildRelative(ethRows, btcRaw);

    const capitalPersist = persistence(
      ethRows.filter((row)=>Number.isFinite(row.capital30dPct)),
      (row)=>row.capital30dPct < 0
    );
    const networkPersist = persistence(
      ethRows.filter((row)=>row.networkValid>=2),
      (row)=>row.networkRisk
    );

    const capitalConfirmed = capital.risk && capitalPersist.days >= 14;
    const networkConfirmed = network.risk && networkPersist.days >= 7;
    const relativeConfirmed = Boolean(relative?.risk);
    const valuationHigh = valuation.risk;
    const etfConfirmed = Boolean(etf?.confirmed);

    const coreConfirmed = [capitalConfirmed, networkConfirmed, relativeConfirmed].filter(Boolean).length;

    let gate = {
      key: coreConfirmed === 0 ? 'maintain' : 'watch',
      label: coreConfirmed === 0 ? 'Mantener' : 'Vigilancia',
      explanation: coreConfirmed === 0
        ? 'Capital, red y estructura relativa no muestran deterioro confirmado conjunto.'
        : 'Existe deterioro parcial, pero todavía no hay confluencia suficiente para preparar protección.',
    };

    if (networkConfirmed && (capitalConfirmed || relativeConfirmed) && (valuationHigh || etfConfirmed)) {
      gate = {
        key: 'evaluate_protection',
        label: 'Protección a evaluar',
        explanation: 'ETH presenta deterioro confirmado de red más otra señal núcleo, reforzado por valoración alta o demanda ETF débil.',
      };
    } else if (coreConfirmed >= 2) {
      gate = {
        key: 'prepare',
        label: 'Preparar protección',
        explanation: 'Dos de las tres señales núcleo de ETH están confirmadas. Se prepara protección, sin venta automática.',
      };
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      asOf: latest.date,
      sourceStatus: 'live',
      priceUSD: latest.price,
      marketPeak: {
        windowDays: 760,
        priceUSD: cyclePeak?.price ?? null,
        date: cyclePeak?.date || null,
        drawdownPct: cycleDrawdownPct,
      },
      gate,
      methodology: {
        version: 'ETH V1',
        core: ['capital', 'network', 'relative_structure'],
        context: ['valuation_mvrv_percentile', 'etf_secondary'],
        rule: 'La red es obligatoria para escalar desde Preparar a Protección a evaluar.',
      },
      diagnostics: {
        coreConfirmed,
        capitalConfirmed,
        networkConfirmed,
        relativeConfirmed,
        valuationHigh,
        etfConfirmed,
      },
      signals: {
        valuation: {
          ...valuation,
          value: latest.mvrv,
          percentile: mvrvPercentile,
          asOf: latest.date,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics · MVRV ETH · percentil móvil 760d',
        },
        capital: {
          ...capital,
          change30dPct: latest.capital30dPct,
          persistence: capitalPersist,
          asOf: latest.date,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics · realized cap derivado',
        },
        network: {
          ...network,
          active30dChangePct: latest.active30dChangePct,
          fee30dChangePct: latest.fee30dChangePct,
          transfer30dChangePct: latest.transfer30dChangePct,
          weakCount: latest.networkWeakCount,
          persistence: networkPersist,
          asOf: latest.date,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics · active addresses + fees + adjusted transfer value',
        },
        relative: {
          ...(relative || { status:'Sin dato', tone:'neutral', risk:false }),
          sourceMode: relative ? 'live' : 'unavailable',
          sourceLabel: 'Coin Metrics · ETH/BTC vs media 90d',
        },
        etf: {
          status: !etf ? 'Sin dato vivo' : etf.confirmed ? 'Demanda ETF débil' : etf.watch ? 'ETF bajo vigilancia' : 'Demanda ETF favorable',
          tone: !etf ? 'neutral' : etf.confirmed ? 'danger' : etf.watch ? 'watch' : 'good',
          risk: Boolean(etf?.confirmed),
          confirmed: Boolean(etf?.confirmed),
          latestDailyFlowUSDm: etf?.latestDailyFlowUSDm ?? null,
          flow5dUSDm: etf?.flow5dUSDm ?? null,
          flow20dUSDm: etf?.flow20dUSDm ?? null,
          negativeDays20: etf?.negativeDays20 ?? null,
          asOf: etf?.asOf || null,
          sourceMode: etf ? 'secondary_live' : 'unavailable',
          sourceLabel: 'Farside Investors · Ethereum ETF Flow',
          standaloneTrigger: false,
        },
      },
    });
  } catch {
    return NextResponse.json(buildFallback());
  }
}
