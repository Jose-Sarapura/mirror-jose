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
  if (value === null || value === undefined || value === '') return null;
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
  if (!Number.isFinite(value) || value <= 0) return { status: 'Sin dato', tone: 'neutral', risk: false };
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
    metrics: 'PriceUSD,CapMrktCurUSD,CapMVRVCur',
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
      const realizedCap = Number.isFinite(marketCap) && Number.isFinite(mvrv) && mvrv !== 0
        ? marketCap / mvrv
        : null;

      return {
        time: row.time,
        price,
        marketCap,
        mvrv,
        realizedCap,
      };
    })
    .filter((row) => row.time && Number.isFinite(row.price))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function latestValidRow(series, field, validator = (value) => Number.isFinite(value)) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i]?.[field];
    if (validator(value)) return series[i];
  }
  return null;
}

function valueAtOrBeforeDate(series, field, anchorTime, offsetDays) {
  if (!anchorTime) return null;
  const target = new Date(anchorTime);
  target.setUTCDate(target.getUTCDate() - offsetDays);
  const targetMs = target.getTime();

  for (let i = series.length - 1; i >= 0; i -= 1) {
    const rowMs = new Date(series[i]?.time).getTime();
    const value = series[i]?.[field];
    if (rowMs <= targetMs && Number.isFinite(value)) return value;
  }
  return null;
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
      lth: {
        status: 'Pendiente de fuente válida',
        tone: 'neutral',
        risk: false,
        sourceMode: 'pending',
        excludedFromGate: true,
        sourceLabel: 'Fuera del cálculo hasta contar con datos de cohortes válidos',
      },
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

    const latestPriceRow = latestValidRow(series, 'price');
    const latestMvrvRow = latestValidRow(series, 'mvrv', (value) => Number.isFinite(value) && value > 0);
    const latestCapitalRow = latestValidRow(series, 'realizedCap', (value) => Number.isFinite(value) && value > 0);

    const mvrvValue = latestMvrvRow?.mvrv ?? null;
    const mvrvState = classifyMvrv(mvrvValue);

    const realizedCapValue = latestCapitalRow?.realizedCap ?? null;
    const realized30 = valueAtOrBeforeDate(series, 'realizedCap', latestCapitalRow?.time, 30);
    const realized90 = valueAtOrBeforeDate(series, 'realizedCap', latestCapitalRow?.time, 90);
    const capitalChange30dPct = pctChange(realizedCapValue, realized30);
    const capitalChange90dPct = pctChange(realizedCapValue, realized90);
    const capitalState = classifyCapital(capitalChange30dPct);

    const sthState = classifySth(latestPriceRow?.price, STH_SNAPSHOT.valueUSD);

    const mvrvPersistence = persistence(
      series.filter((row) => Number.isFinite(row.mvrv) && row.mvrv > 0),
      (row) => classifyMvrv(row.mvrv).status,
      mvrvState.status,
    );
    const validCapitalSeries = series.filter((row) => Number.isFinite(row.realizedCap) && row.realizedCap > 0);
    const capitalPersistence = persistence(
      validCapitalSeries.map((row, index) => {
        const compare = index >= 30 ? validCapitalSeries[index - 30]?.realizedCap : null;
        return { ...row, capitalChange30dPct: pctChange(row.realizedCap, compare) };
      }).filter((row) => Number.isFinite(row.capitalChange30dPct)),
      (row) => classifyCapital(row.capitalChange30dPct).status,
      capitalState.status,
    );
    const sthSeries = series.filter((row) =>
      Number.isFinite(row.price)
      && new Date(row.time) >= new Date(`${STH_SNAPSHOT.asOf}T00:00:00Z`)
    );
    const sthPersistence = persistence(
      sthSeries,
      (row) => classifySth(row.price, STH_SNAPSHOT.valueUSD).status,
      sthState.status,
    );

    const earlyRisks = [
      mvrvState.risk,
      capitalState.risk,
    ].filter(Boolean).length;

    const operationalRisks = [
      mvrvState.risk,
      capitalState.risk,
      sthState.risk,
    ].filter(Boolean).length;

    const structuralConfirmation = sthState.risk && (sthPersistence.days || 0) >= 3;

    const availability = {
      mvrv: Number.isFinite(mvrvValue) && mvrvValue > 0,
      capital: Number.isFinite(capitalChange30dPct),
      sth: Number.isFinite(sthState.distancePct),
    };
    const availableOperational = Object.values(availability).filter(Boolean).length;
    const missingOperational = Object.entries(availability)
      .filter(([, available]) => !available)
      .map(([key]) => key);

    let gate = {
      key: 'maintain',
      label: operationalRisks === 0 ? 'Mantener' : 'Vigilancia',
      explanation: operationalRisks === 0
        ? 'Ninguna de las tres señales operativas está deteriorada.'
        : 'Hay una señal que requiere seguimiento, pero todavía no existe confluencia suficiente.',
    };

    if (availableOperational < 3) {
      gate = {
        key: 'insufficient_data',
        label: 'Datos incompletos',
        explanation: `Falta información operativa válida (${missingOperational.join(', ')}). Mirror no emite una lectura de Mantener/Proteger hasta recuperar esos datos.`,
      };
    } else if (operationalRisks >= 2 && structuralConfirmation && earlyRisks >= 1) {
      gate = {
        key: 'evaluate_protection',
        label: 'Protección a evaluar',
        explanation: 'Coincide al menos una señal temprana con deterioro estructural persistente. Esto activa revisión; no una venta automática.',
      };
    } else if (operationalRisks >= 2) {
      gate = {
        key: 'prepare',
        label: 'Preparar protección',
        explanation: 'Dos señales operativas independientes están deterioradas. Mirror prepara el plan y espera confirmación suficiente antes de considerar reducción.',
      };
    }

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      asOf: latestPriceRow?.time?.slice(0, 10) || latestCapitalRow?.time?.slice(0, 10) || latestMvrvRow?.time?.slice(0, 10),
      sourceStatus: 'live',
      priceUSD: latestPriceRow?.price ?? null,
      dataDates: {
        price: latestPriceRow?.time?.slice(0, 10) || null,
        mvrv: latestMvrvRow?.time?.slice(0, 10) || null,
        capital: latestCapitalRow?.time?.slice(0, 10) || null,
        sthSnapshot: STH_SNAPSHOT.asOf,
      },
      gate,
      coverage: {
        operationalTotal: 3,
        availableOperational,
        exactLive: [availability.mvrv, availability.capital].filter(Boolean).length,
        hybrid: availability.sth ? 1 : 0,
        pending: 1,
        missingOperational,
      },
      signals: {
        mvrv: {
          ...mvrvState,
          value: mvrvValue,
          asOf: latestMvrvRow?.time?.slice(0, 10) || null,
          sourceMode: 'live',
          sourceLabel: 'Coin Metrics Community · CapMVRVCur',
          persistence: mvrvPersistence,
        },
        lth: {
          status: 'Pendiente de fuente válida',
          tone: 'neutral',
          risk: false,
          sourceMode: 'pending',
          excludedFromGate: true,
          sourceLabel: 'Fuera del cálculo operativo hasta contar con una fuente de cohortes válida',
          persistence: { days: null, since: null },
        },
        capital: {
          ...capitalState,
          realizedCapUSD: realizedCapValue,
          change30dPct: capitalChange30dPct,
          change90dPct: capitalChange90dPct,
          asOf: latestCapitalRow?.time?.slice(0, 10) || null,
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
          asOf: latestPriceRow?.time?.slice(0, 10) || null,
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
