'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PURCHASES, RANGE_OPTIONS } from '../../lib/mirror-config';
import { historyMetrics, mergePortfolioData } from '../lib/calculations';
import { mergeStoredSettings, STORAGE_KEY } from '../lib/settings';
import { clp, nativeMoney, percentage, shares } from '../lib/format';
import Icon from './Icon';
import styles from '../dashboard.module.css';

export default function AssetDetail({ ticker }) {
  const [range, setRange] = useState('1y');
  const [apiData, setApiData] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySource, setHistorySource] = useState('loading');
  const [amountCLP, setAmountCLP] = useState(150000);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      setSettings(mergeStoredSettings(stored));
    } catch { setSettings(mergeStoredSettings(null)); }
  }, []);

  useEffect(() => {
    fetch('/api/dashboard/portfolio', { cache: 'no-store' }).then((response) => response.json()).then(setApiData);
  }, []);

  useEffect(() => {
    setHistorySource('loading');
    fetch(`/api/dashboard/history?ticker=${ticker}&range=${range}`, { cache: range === '1d' ? 'no-store' : 'default' })
      .then((response) => response.json())
      .then((result) => {
        setHistory(result.points || []);
        setHistorySource(result.source || 'unavailable');
      })
      .catch(() => { setHistory([]); setHistorySource('unavailable'); });
  }, [ticker, range]);

  const portfolio = useMemo(() => apiData ? mergePortfolioData(apiData, settings || {}) : null, [apiData, settings]);
  const asset = portfolio?.assets.find((item) => item.ticker === ticker);
  const metrics = useMemo(() => historyMetrics(history), [history]);
  const chartPurchases = useMemo(() => [
    ...(PURCHASES[ticker] || []),
    ...((settings?.transactions || []).filter((transaction) => transaction.ticker === ticker)),
  ], [settings, ticker]);
  const chartData = useMemo(() => attachPurchases(history, chartPurchases), [history, chartPurchases]);

  if (!asset || !portfolio) {
    return <div className={styles.loadingScreen}><span className={styles.loadingMark}>M</span><strong>Cargando {ticker}</strong></div>;
  }

  const amountNative = asset.currency === 'USD' ? Number(amountCLP) / portfolio.fx : Number(amountCLP);
  const addedShares = amountNative / asset.price;
  const newAverageCost = (asset.costBasisNative + amountNative) / (asset.shares + addedShares);
  const futureTotal = portfolio.totalCLP + Number(amountCLP);
  const newWeight = ((asset.valueCLP + Number(amountCLP)) / futureTotal) * 100;
  const targetValue = portfolio.totalCLP * asset.targetWeight / 100;
  const amountToTarget = Math.max(0, targetValue - asset.valueCLP);
  const yearsTo2030 = Math.max(0, 2030 - new Date().getFullYear());
  const scenarios = Object.entries(asset.scenarioReturns).map(([key, rate]) => ({
    key,
    rate,
    price: asset.price * Math.pow(1 + rate / 100, yearsTo2030),
    positionValue: asset.valueNative * Math.pow(1 + rate / 100, yearsTo2030),
  }));

  return (
    <div className={styles.assetPage}>
      <header className={styles.assetPageHeader}>
        <Link href="/dashboard" className={styles.backButton}>← Volver al dashboard</Link>
        <div className={styles.assetPageBrand}><span className={styles.liveDot} /> Mirror Intelligence</div>
      </header>

      <main className={styles.assetPageContent}>
        <section className={styles.assetHero}>
          <div className={styles.assetHeroIdentity}>
            <span className={styles.assetHeroLogo} style={{ '--asset-accent': asset.accent }}>{asset.ticker.slice(0, 2)}</span>
            <div><p>{asset.role}</p><h1>{asset.ticker}</h1><span>{asset.name}</span></div>
          </div>
          <div className={styles.assetHeroPrice}>
            <span>Precio actual</span>
            <strong>{nativeMoney(asset.price, asset.currency)}</strong>
            <small className={asset.dayChangePct >= 0 ? styles.positive : styles.negative}>{percentage(asset.dayChangePct)} hoy</small>
          </div>
        </section>

        <section className={styles.assetMetricGrid}>
          <article><span>Valor de tu inversión</span><strong>{nativeMoney(asset.valueNative, asset.currency)}</strong><small>{clp.format(asset.valueCLP)}</small></article>
          <article><span>Costo promedio</span><strong>{nativeMoney(asset.averageCost, asset.currency)}</strong><small>{asset.averageCostEstimated ? 'Estimado desde rendimiento registrado' : 'Registrado en Racional'}</small></article>
          <article><span>Resultado total</span><strong className={asset.totalReturnPct >= 0 ? styles.positive : styles.negative}>{nativeMoney(asset.totalReturnNative, asset.currency)}</strong><small className={asset.totalReturnPct >= 0 ? styles.positive : styles.negative}>{percentage(asset.totalReturnPct)}</small></article>
          <article><span>Participaciones</span><strong>{shares(asset.shares)}</strong><small>Dividendos: {nativeMoney(asset.dividends, asset.currency)}</small></article>
          <article><span>Peso actual</span><strong>{asset.weight.toFixed(2)}%</strong><small>Objetivo {asset.targetWeight}%</small></article>
          <article><span>Falta para objetivo</span><strong>{clp.format(amountToTarget)}</strong><small>{asset.allocationStatus}</small></article>
        </section>

        <section className={styles.assetChartPanel}>
          <div className={styles.panelHeader}>
            <div><p className={styles.kicker}>Histórico de precio</p><h2>{asset.ticker} + tu inversión</h2></div>
            <div className={styles.rangeTabs}>{RANGE_OPTIONS.map((option) => <button type="button" key={option.key} className={range === option.key ? styles.rangeActive : ''} onClick={() => setRange(option.key)}>{option.label}</button>)}</div>
          </div>

          <div className={styles.assetChart}>
            {historySource === 'loading' ? <div className={styles.chartEmpty}>Cargando histórico...</div> : history.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 16, right: 18, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="assetArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={asset.accent} stopOpacity={0.34}/><stop offset="100%" stopColor={asset.accent} stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(value) => formatAxisDate(value, range)} tick={{ fill: '#8391a2', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                  <YAxis domain={[dataMin => Math.min(dataMin, asset.averageCost) * 0.98, dataMax => Math.max(dataMax, asset.averageCost) * 1.02]} tickFormatter={(value) => asset.currency === 'USD' ? `$${Math.round(value)}` : `$${Math.round(value).toLocaleString('es-CL')}`} tick={{ fill: '#8391a2', fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip content={<AssetTooltip asset={asset} range={range} />} />
                  <Area type="monotone" dataKey="price" stroke={asset.accent} strokeWidth={2.7} fill="url(#assetArea)" />
                  <ReferenceLine y={asset.averageCost} ifOverflow="extendDomain" stroke="#f3b85b" strokeDasharray="7 6" label={{ value: `Costo prom. ${nativeMoney(asset.averageCost, asset.currency)}`, fill: '#f3b85b', fontSize: 11, position: 'insideTopRight' }} />
                  <Scatter dataKey="purchasePrice" fill="#ffffff" stroke={asset.accent} strokeWidth={3} r={5} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className={styles.chartEmpty}>Histórico temporalmente no disponible.</div>}
          </div>

          <div className={styles.chartMetrics}>
            <div><span>Máximo del período</span><strong>{metrics ? nativeMoney(metrics.high, asset.currency) : '—'}</strong></div>
            <div><span>Mínimo del período</span><strong>{metrics ? nativeMoney(metrics.low, asset.currency) : '—'}</strong></div>
            <div><span>Variación</span><strong className={metrics?.changePct >= 0 ? styles.positive : styles.negative}>{metrics ? percentage(metrics.changePct) : '—'}</strong></div>
            <div><span>Máxima caída</span><strong className={styles.negative}>{metrics ? percentage(metrics.maxDrawdown) : '—'}</strong></div>
          </div>
          <p className={styles.chartNote}><span className={styles.costLegend} /> Línea amarilla: costo promedio. <span className={styles.buyLegend} /> Puntos: compras registradas.</p>
        </section>

        <div className={styles.assetTwoColumn}>
          <section className={styles.buySimulator}>
            <div><p className={styles.kicker}>Simulador de compra</p><h2>¿Cómo cambia tu promedio?</h2></div>
            <div className={styles.amountSelector}>
              {[150000, 250000, 300000].map((amount) => <button type="button" key={amount} className={Number(amountCLP) === amount ? styles.amountActive : ''} onClick={() => setAmountCLP(amount)}>{clp.format(amount)}</button>)}
              <input type="number" value={amountCLP} onChange={(event) => setAmountCLP(event.target.value)} />
            </div>
            <div className={styles.simulatorResult}>
              <div><span>Promedio actual</span><strong>{nativeMoney(asset.averageCost, asset.currency)}</strong></div>
              <Icon name="arrow" />
              <div><span>Nuevo promedio</span><strong>{nativeMoney(newAverageCost, asset.currency)}</strong></div>
            </div>
            <div className={styles.simulatorFacts}>
              <span>Comprarías <strong>{shares(addedShares)}</strong> participaciones.</span>
              <span>El peso subiría de <strong>{asset.weight.toFixed(1)}%</strong> a <strong>{newWeight.toFixed(1)}%</strong>.</span>
              <span>Si luego cae 10%, tu horizonte y objetivo no cambian; cambia solo la volatilidad temporal.</span>
            </div>
          </section>

          <section className={styles.thesisPanel}>
            <p className={styles.kicker}>Tesis Mirror</p>
            <h2>{asset.allocationStatus}</h2>
            <p>{asset.thesis}</p>
            <div className={styles.thesisSignals}>
              <span><Icon name="target" size={17} /> Objetivo: {asset.targetWeight}%</span>
              <span><Icon name="shield" size={17} /> Riesgo: {asset.risk}</span>
              <span><Icon name="chart" size={17} /> Rol: {asset.role}</span>
            </div>
            <div className={styles.thesisConclusion}>
              <strong>Lectura actual</strong>
              <p>{asset.weight < asset.targetWeight ? `${asset.ticker} está por debajo de su peso estratégico. Los aportes graduales tienen sentido mientras no supere el ${asset.targetWeight}% y la tesis se mantenga.` : `${asset.ticker} ya alcanzó o superó su peso estratégico. Los nuevos aportes deberían priorizar otros activos.`}</p>
            </div>
          </section>
        </div>

        <section className={styles.scenarioPanel}>
          <div className={styles.panelHeader}><div><p className={styles.kicker}>Hasta 2030</p><h2>Escenarios del activo</h2></div><span className={styles.disclaimer}>Planificación, no predicción</span></div>
          <div className={styles.assetScenarioGrid}>
            {scenarios.map((scenario) => (
              <article key={scenario.key}>
                <span>{scenario.key === 'conservative' ? 'Conservador' : scenario.key === 'base' ? 'Base' : 'Optimista'}</span>
                <strong>{nativeMoney(scenario.price, asset.currency)}</strong>
                <small>{scenario.rate}% anual · tu posición: {nativeMoney(scenario.positionValue, asset.currency)}</small>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function attachPurchases(points, purchases) {
  if (!points.length || !purchases.length) return points;
  const next = points.map((point) => ({ ...point }));
  purchases.forEach((purchase) => {
    const purchaseTime = new Date(`${purchase.date}T16:00:00Z`).getTime();
    let nearestIndex = 0;
    let distance = Infinity;
    next.forEach((point, index) => {
      const currentDistance = Math.abs(point.timestamp - purchaseTime);
      if (currentDistance < distance) { distance = currentDistance; nearestIndex = index; }
    });
    next[nearestIndex].purchasePrice = Number(purchase.price) || next[nearestIndex].price;
    const purchaseLabel = `${purchase.label}: ${purchase.currency} ${purchase.amount.toLocaleString('es-CL')}`;
    next[nearestIndex].purchaseLabel = next[nearestIndex].purchaseLabel
      ? `${next[nearestIndex].purchaseLabel} · ${purchaseLabel}`
      : purchaseLabel;
  });
  return next;
}

function formatAxisDate(value, range) {
  const date = new Date(value);
  if (range === '1d') return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  if (range === '5y') return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

function AssetTooltip({ active, payload, label, asset, range }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className={styles.assetTooltip}>
      <span>{range === '1d' ? new Date(label).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit' }) : new Date(label).toLocaleDateString('es-CL')}</span>
      <strong>{nativeMoney(point.price, asset.currency)}</strong>
      {point.purchaseLabel && <small>{point.purchaseLabel}</small>}
    </div>
  );
}
