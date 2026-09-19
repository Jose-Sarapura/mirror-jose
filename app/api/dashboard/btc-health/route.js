import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';
const STH_SNAPSHOT = {
  valueUSD: 71300,
  asOf: '2026-09-16',
  source: 'Glassnode research snapshot',
};
const TRUE_MARKET_MEAN_SNAPSHOT = {
  valueUSD: 76700,
  asOf: '2026-09-16',
  source: 'Glassnode research snapshot',
};

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pctChange(current, previous) {
  if (!(Number.isFinite(current) && Number.isFinite(previous)) || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function diffDays(a, b) {
  const one = new Date(a).getTime();
  const two = new Date(b).getTime();
  if (!Number.isFinite(one) || !Number.isFinite(two)) return null;
  return Math.max(1, Math.floor((two - one) / 86400000) + 1);
}

function classifyMvrv(value) {
  if (!Number.isFinite(value)) return { status: 'Sin dato', tone: 'neutral', risk: false };
  if (value >= 3.2) return { status: 'Extremo', tone: 'danger', risk: true };
  if (value >= 2.4) return { status: 'Elevado', tone: 'watch', risk: true };
  if (value < 1) return { status: 'Bajo costo agregado', tone: 'good', risk: false };
  return { status: 'No extremo', tone: 'good', risk: false };
}

function classifyCapital(change30d) {
  if (!Number.isFinite(change30d)) return { status: 'Sin dato', tone: 'neutral', risk: false };
  if (change30d < -1) return { status: 'Contracción', tone: 'danger', risk: true };
  if (change30d < 0.5) return { status: 'Débil', tone: 'watch', risk: true };
  return { status: 'Expansión', tone: 'good', risk: false };
}

function classifyLthProxy(change30dPp) {
  if (!Number.isFinite(change30dPp)) return { status: 'Sin dato vivo', tone: 'neutral', risk: false };
  if (change30dPp >= 1) return { status: 'Actividad creciente', tone: 'danger', risk: true };
  if (change30dPp >= 0.25) return { status: 'Vigilar', tone: 'watch', risk: true };
  return { status: 'Estable', tone: 'good', risk: false };
}

function classifySth(price, basis) {
  if (!(Number.isFinite(price) && Number.isFinite(basis))) {
    return { status: 'Sin dato', tone: 'neutral', risk: false, distancePct: null };
  }
  const distancePct = ((price / basis) - 1) * 100;
  if (distancePct < 0) return { status: 'Bajo cost basis', tone: 'danger', risk: true, distancePct };
  if (distancePct < 5) return { status: 'Zona sensible', tone: 'watch', risk: true, distancePct };
  return { status: 'Sobre cost basis', tone: 'good', risk: false, distancePct };
}

function persistence(series, classifier, currentStatus) {
  if (!series.length || !currentStatus) return { days: null, since: null };
  let since = series[series.length - 1]?.time?.slice(0, 10) || null;

  for (let i = series.length - 1; i >= 0; i -= 1) {
    const state = classifier(series[i]);
    if (state !== currentStatus) break;
    since = series[i]?.time?.slice(0, 10) || since;
  }

  const latest = series[series.length - 1]?.time?.slice(0, 10);
  return {
    since,
    days: since && latest ? diffDays(since, latest) : null,
  };
}

async function fetchCoinMetrics() {
  const params = new URLSearchParams({
    assets: 'btc',
    metrics: 'PriceUSD,CapMrktCurUSD,CapMVRVCur,SplyCur,SplyActPct1yr',
    frequency: '1d',
    start_time: daysAgo(125),
    paging_from: 'start',
    page_size: '1000',
    ignore_forbidden_errors: 'true',
    ignore_unsupported_errors: 'true',
  });

  const response = await fetch(`${COIN_METRICS}?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Mirror-Jose/3.0' },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Coin Metrics HTTP ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return rows
    .map((row) => {
      const price = num(row.PriceUSD);
      const marketCap = num(row.CapMrktCurUSD);
      const mvrv = num(row.CapMVRVCur);
      const active1yPct = num(row.SplyActPct1yr);
      const realizedCap = Number.isFinite(marketCap) && Number.isFinite(mvrv) && mvrv !== 0
        ? marketCap / mvrv
        : null;

      return {
        time: row.time,
        price,
        marketCap,
        mvrv,
        realizedCap,
        active1yPct,
      };
    })
    .filter((row) => row.time && Number.isFinite(row.price))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function valueAtOffset(series, field, offsetDays) {
  const latestIndex = series.length - 1;
  const index = Math.max(0, latestIndex - offsetDays);
  return num(series[index]?.[field]);
}

function buildFallback() {
  return {
    updatedAt: new Date().toISOString(),
    asOf: '2026-09-16',
    sourceStatus: 'fallback',
    priceUSD: null,
    gate: {
      key: 'watch',
      label: 'Vigilancia',
      explanation: 'No fue posible actualizar las métricas públicas. Mirror conserva el último marco de investigación sin emitir una acción nueva.',
    },
    signals: {
      mvrv: { status: 'Sin dato vivo', tone: 'neutral', risk: false, sourceMode: 'fallback' },
      lth: { status: 'Snapshot pendiente', tone: 'neutral', risk: false, sourceMode: 'snapshot' },
      capital: { status: 'Sin dato vivo', tone: 'neutral', risk: false, sourceMode: 'fallback' },
      sth: {
        status: 'Snapshot de investigación',
        tone: 'neutral',
        risk: false,
        valueUSD: STH_SNAPSHOT.valueUSD,
        snapshotDate: STH_SNAPSHOT.asOf,
        sourceMode: 'snapshot',
      },
    },
  };
}

export async function GET() {
  try {
    const series = await fetchCoinMetrics();
    if (!series.length) return NextResponse.json(buildFallback());

    const latest = series[series.length - 1];
    const mvrvState = classifyMvrv(latest.mvrv);

    const realized30 = valueAtOffset(series, 'realizedCap', 30);
    const realized90 = valueAtOffset(series, 'realizedCap', 90);
    const capitalChange30dPct = pctChange(latest.realizedCap, realized30);
    const capitalChange90dPct = pctChange(latest.realizedCap, realized90);
    const capitalState = classifyCapital(capitalChange30dPct);

    const active30 = valueAtOffset(series, 'active1yPct', 30);
    const lthProxyChange30dPp = Number.isFinite(latest.active1yPct) && Number.isFinite(active30)
      ? latest.active1yPct - active30
      : null;
    const lthState = classifyLthProxy(lthProxyChange30dPp);

    const sthState = classifySth(latest.price, STH_SNAPSHOT.valueUSD);

    const mvrvPersistence = persistence(
      series.filter((row) => Number.isFinite(row.mvrv)),
      (row) => classifyMvrv(row.mvrv).status,
      mvrvState.status,
    );
    const capitalPersistence = persistence(
      series.map((row, index) => {
        const compare = index >= 30 ? series[index - 30]?.realizedCap : null;
        return { ...row, capitalChange30dPct: pctChange(row.realizedCap, compare) };
      }).filter((row) => Number.isFinite(row.capitalChange30dPct)),
      (row) => classifyCapital(row.capitalChange30dPct).status,
      capitalState.status,
    );
    const lthPersistence = Number.isFinite(lthProxyChange30dPp)
      ? persistence(
          series.map((row, index) => {
            const compare = index >= 30 ? series[index - 30]?.active1yPct : null;
            return {
              ...row,
              lthProxyChange30dPp: Number.isFinite(row.active1yPct) && Number.isFinite(compare)
                ? row.active1yPct - compare
                : null,
            };
          }).filter((row) => Number.isFinite(row.lthProxyChange30dPp)),
          (row) => classifyLthProxy(row.lthProxyChange30dPp).status,
          lthState.status,
        )
      : { days: null, since: null };

    const sthSeries = series.filter((row) => new Date(row.time) >= new Date(`${STH_SNAPSHOT.asOf}T00:00:00Z`));
    const sthPersistence = persistence(
      sthSeries,
      (row) => classifySth(row.price, STH_SNAPSHOT.valueUSD).status,
      sthState.status,
    );

    const earlyRisks = [
      mvrvState.risk,
      lthState.risk,
      capitalState.risk,
    ].filter(Boolean).length;

    const independentRisks = [
      mvrvState.risk,
      lthState.risk,
      capitalState.risk,
      sthState.risk,
    ].filter(Boolean).length;

    const confirmation = sthState.risk || (capitalState.risk && (capitalPersistence.days || 0) >= 14);

    let gate = {
      key: 'maintain',
      label: independentRisks === 0 ? 'Mantener' : 'Vigilancia',
      explanation: independentRisks === 0
        ? 'No hay suficientes familias deterioradas para preparar protección.'
        : 'Hay señales que requieren seguimiento, pero todavía no existe confluencia suficiente.',
    };

    if (earlyRisks >= 2 && confirmation) {
      gate = {
        key: 'evaluate_protection',
        label: 'Protección a evaluar',
        explanation: 'Coinciden varias familias de riesgo y existe una señal de confirmación. Esto activa revisión; no una venta automática.',
      };
    } else if (earlyRisks >= 2) {
      gate = {
        key: 'prepare',
        label: 'Preparar protección',
        explanation: 'Dos o más familias tempranas están deterioradas. Mirror prepara el plan, pero espera confirmación antes de considerar reducción.',
      };
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      asOf: latest.time?.slice(0, 10),
      sourceStatus: 'live',
      priceUSD: latest.price,
      gate,
      coverage: {
        exactLive: 2,
        proxyLive: Number.isFinite(latest.active1yPct) ? 1 : 0,
        snapshot: 1,
      },
      signals: {
        mvrv: {
          ...mvrvState,
          value: latest.mvrv,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics Community · CapMVRVCur',
          persistence: mvrvPersistence,
        },
        lth: {
          ...lthState,
          value: latest.active1yPct,
          change30dPp: lthProxyChange30dPp,
          sourceMode: Number.isFinite(latest.active1yPct) ? 'proxy' : 'unavailable',
          sourceLabel: Number.isFinite(latest.active1yPct)
            ? 'Coin Metrics Community · SplyActPct1yr (proxy, no LTH exacto)'
            : 'LTH exacto requiere fuente de cohortes',
          persistence: lthPersistence,
        },
        capital: {
          ...capitalState,
          realizedCapUSD: latest.realizedCap,
          change30dPct: capitalChange30dPct,
          change90dPct: capitalChange90dPct,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics Community · realized cap derivado de Market Cap / MVRV',
          persistence: capitalPersistence,
        },
        sth: {
          ...sthState,
          valueUSD: STH_SNAPSHOT.valueUSD,
          snapshotDate: STH_SNAPSHOT.asOf,
          trueMarketMeanUSD: TRUE_MARKET_MEAN_SNAPSHOT.valueUSD,
          distancePct: sthState.distancePct,
          sourceMode: 'hybrid',
          sourceLabel: 'Cost basis: snapshot Glassnode · precio: Coin Metrics diario',
          persistence: sthPersistence,
        },
      },
    });
  } catch {
    return NextResponse.json(buildFallback());
  }
}
