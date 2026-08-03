'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MIRROR_DEFAULTS } from '../lib/mirror-config';
import DashboardShell from './components/DashboardShell';
import AllocationChart from './components/AllocationChart';
import AssetCard from './components/AssetCard';
import ContributionSimulator from './components/ContributionSimulator';
import ProjectionChart from './components/ProjectionChart';
import Icon from './components/Icon';
import PurchaseRegistrar from './components/PurchaseRegistrar';
import { allocationHealth, estimateGoalYear, mergePortfolioData } from './lib/calculations';
import { createDefaultSettings, persistSettings, readStoredSettings } from './lib/settings';
import { clp, nativeMoney, percentage, shares } from './lib/format';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [active, setActive] = useState('overview');
  const [apiData, setApiData] = useState(null);
  const [settings, setSettings] = useState(createDefaultSettings);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(readStoredSettings(localStorage));
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/dashboard/portfolio', { cache: 'no-store' });
      if (!response.ok) throw new Error('No fue posible obtener los precios');
      setApiData(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const portfolio = useMemo(() => mergePortfolioData(apiData, settings), [apiData, settings]);

  const saveSettings = () => {
    persistSettings(localStorage, settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const resetSettings = () => {
    const next = createDefaultSettings();
    setSettings(next);
    persistSettings(localStorage, next);
  };

  if (!portfolio) {
    return (
      <div className={styles.loadingScreen}>
        <span className={styles.loadingMark}>M</span>
        <strong>Construyendo tu Mirror</strong>
        <small>{error || 'Conectando con el mercado...'}</small>
        {error && <button type="button" onClick={load}>Reintentar</button>}
      </div>
    );
  }

  const goalCLP = Number(settings.goalCLP || MIRROR_DEFAULTS.goalCLP);
  const monthlyContributionCLP = Number(settings.monthlyContributionCLP || MIRROR_DEFAULTS.monthlyContributionCLP);
  const health = allocationHealth(portfolio.assets);
  const goalProgress = Math.min(100, (portfolio.totalCLP / goalCLP) * 100);
  const projectedGoalYear = estimateGoalYear({
    initialCLP: portfolio.totalCLP,
    monthlyCLP: monthlyContributionCLP,
    annualReturn: 9,
    goalCLP,
    startYear: new Date().getFullYear(),
  });
  const primaryGap = [...portfolio.assets].sort((a, b) => b.gapCLP - a.gapCLP)[0];
  const marketState = portfolio.assets.find((asset) => asset.currency === 'USD')?.marketState;

  return (
    <DashboardShell active={active} onChange={setActive} updatedAt={portfolio.updatedAt} onRefresh={load} refreshing={refreshing}>
      {error && <div className={styles.alert}>{error}. Se mantienen los últimos datos disponibles.</div>}

      {active === 'overview' && (
        <>
          <section className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}>
                <span className={styles.liveDot} />
                <span>{marketState === 'REGULAR' ? 'Mercado abierto' : 'Valores actualizados'}</span>
              </div>
              <p>Patrimonio total</p>
              <h2>{clp.format(portfolio.totalCLP)}</h2>
              <div className={styles.heroReturns}>
                <span className={portfolio.dayChangeCLP >= 0 ? styles.positiveBadge : styles.negativeBadge}>
                  {percentage(portfolio.dayChangePct)} hoy · {clp.format(portfolio.dayChangeCLP)}
                </span>
                <span>Rentabilidad total <strong className={portfolio.totalReturnCLP >= 0 ? styles.positive : styles.negative}>{percentage(portfolio.totalReturnPct)}</strong></span>
              </div>
            </div>

            <div className={styles.heroGoal}>
              <div className={styles.goalRing} style={{ '--progress': `${goalProgress * 3.6}deg` }}>
                <div><strong>{goalProgress.toFixed(2)}%</strong><span>de la meta</span></div>
              </div>
              <div>
                <span>Meta patrimonial</span>
                <strong>{clp.format(goalCLP)}</strong>
                <small>Faltan {clp.format(Math.max(0, goalCLP - portfolio.totalCLP))}</small>
              </div>
            </div>
          </section>

          <section className={styles.walletSummary}>
            <article>
              <span>Capital invertido</span>
              <strong>{clp.format(portfolio.investedCLP)}</strong>
              <small>VOO, SMH, BCH y Acciones Globales</small>
            </article>
            <article>
              <span>Billetera USD</span>
              <strong>{nativeMoney(portfolio.cashUSD, 'USD')}</strong>
              <small>{clp.format(portfolio.cashUSDCLP)} al tipo de cambio actual</small>
            </article>
            <article>
              <span>Billetera CLP</span>
              <strong>{clp.format(portfolio.cashCLP)}</strong>
              <small>Disponible para activos nacionales</small>
            </article>
            <article>
              <span>Efectivo disponible</span>
              <strong>{clp.format(portfolio.totalCashCLP)}</strong>
              <small>Incluido en el patrimonio total</small>
            </article>
          </section>

          <section className={styles.statGrid}>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Icon name="shield" /></span>
              <div><p>Salud de asignación</p><strong>{health}/100</strong><small>{health >= 85 ? 'Muy alineada' : health >= 70 ? 'Buena, con ajustes pendientes' : 'Requiere rebalanceo'}</small></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Icon name="target" /></span>
              <div><p>Mayor brecha</p><strong>{primaryGap.ticker}</strong><small>{clp.format(Math.max(0, primaryGap.gapCLP))} para llegar al objetivo actual</small></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Icon name="clock" /></span>
              <div><p>Meta estimada</p><strong>{projectedGoalYear ? Math.floor(projectedGoalYear) : '—'}</strong><small>Escenario base: 9% anual + {clp.format(monthlyContributionCLP)}/mes</small></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Icon name="chart" /></span>
              <div><p>Capital registrado</p><strong>{clp.format(portfolio.totalCostBasisCLP)}</strong><small>Ganancia acumulada {clp.format(portfolio.totalReturnCLP)}</small></div>
            </article>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><p className={styles.kicker}>Asignación</p><h2>Actual vs. objetivo</h2></div>
                <button type="button" onClick={() => setActive('portfolio')}>Ver detalle <Icon name="arrow" size={16} /></button>
              </div>
              <AllocationChart assets={portfolio.assets} totalCLP={portfolio.investedCLP} />
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><p className={styles.kicker}>Camino al 2030</p><h2>Proyección patrimonial</h2></div>
                <button type="button" onClick={() => setActive('projections')}>Escenarios <Icon name="arrow" size={16} /></button>
              </div>
              <ProjectionChart totalCLP={portfolio.totalCLP} monthlyContributionCLP={monthlyContributionCLP} endYear={2030} />
              <div className={styles.chartLegend}><span>Conservador 5%</span><span>Base 9%</span><span>Optimista 13%</span></div>
            </section>
          </div>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <div><p className={styles.kicker}>Tu portafolio</p><h2>Activos y posición estratégica</h2></div>
              <span>{portfolio.assets.length} posiciones</span>
            </div>
            <div className={styles.assetGrid}>{portfolio.assets.map((asset) => <AssetCard key={asset.ticker} asset={asset} />)}</div>
          </section>

          <ContributionSimulator portfolio={portfolio} />

          <section className={styles.mirrorBrief}>
            <div className={styles.mirrorAvatar}>M</div>
            <div>
              <p className={styles.kicker}>Lectura Mirror</p>
              <h2>{primaryGap.ticker} continúa siendo la principal brecha del portafolio.</h2>
              <p>
                Tu núcleo VOO representa {portfolio.assets.find((asset) => asset.ticker === 'VOO')?.weight.toFixed(1)}% y SMH {portfolio.assets.find((asset) => asset.ticker === 'SMH')?.weight.toFixed(1)}%. La decisión del próximo aporte debe priorizar la asignación objetivo, no el movimiento de una sola sesión.
              </p>
            </div>
          </section>
        </>
      )}

      {active === 'portfolio' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Portafolio</p><h2>Posiciones completas</h2><span>Cada activo incluye precio, costo promedio, peso y brecha.</span></div>
          <div className={styles.portfolioTable}>
            <div className={styles.tableHead}><span>Activo</span><span>Precio / costo</span><span>Valor</span><span>Resultado</span><span>Asignación</span></div>
            {portfolio.assets.map((asset) => (
              <Link href={`/dashboard/activo/${asset.ticker}`} className={styles.tableRow} key={asset.ticker}>
                <span className={styles.tableAsset}><i style={{ background: asset.accent }}>{asset.ticker.slice(0, 2)}</i><b>{asset.ticker}<small>{shares(asset.shares)} participaciones</small></b></span>
                <span><b>{nativeMoney(asset.price, asset.currency)}</b><small>Prom. {nativeMoney(asset.averageCost, asset.currency)}</small></span>
                <span><b>{clp.format(asset.valueCLP)}</b><small>{nativeMoney(asset.valueNative, asset.currency)}</small></span>
                <span><b className={asset.totalReturnPct >= 0 ? styles.positive : styles.negative}>{percentage(asset.totalReturnPct)}</b><small>{nativeMoney(asset.totalReturnNative, asset.currency)}</small></span>
                <span><b>{asset.weight.toFixed(1)}% / {asset.targetWeight}%</b><small className={asset.weightGap > 0 ? styles.warningText : ''}>{asset.allocationStatus}</small></span>
              </Link>
            ))}
          </div>

          <div className={styles.rebalanceGrid}>
            {portfolio.assets.map((asset) => (
              <article className={styles.rebalanceCard} key={asset.ticker}>
                <div><span style={{ background: asset.accent }} /><strong>{asset.ticker}</strong><small>{asset.allocationStatus}</small></div>
                <h3>{asset.weight.toFixed(1)}% <small>de {asset.targetWeight}%</small></h3>
                <div className={styles.targetTrack}><div style={{ width: `${Math.min(100, asset.weight / asset.targetWeight * 100)}%`, background: asset.accent }} /></div>
                <p>{asset.gapCLP > 0 ? `Faltan ${clp.format(asset.gapCLP)}` : `Sobre objetivo por ${clp.format(Math.abs(asset.gapCLP))}`}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {active === 'intelligence' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Mirror Intelligence</p><h2>Qué significan tus números</h2><span>Interpretación automática según tu estrategia y costo de entrada.</span></div>
          <div className={styles.insightGrid}>
            {portfolio.assets.map((asset) => {
              const belowCost = asset.price < asset.averageCost;
              return (
                <Link href={`/dashboard/activo/${asset.ticker}`} className={styles.insightCard} key={asset.ticker}>
                  <div className={styles.insightTop}><span style={{ color: asset.accent }}>{asset.ticker}</span><b className={asset.risk === 'Alto' ? styles.negativeBadge : styles.neutralBadge}>Riesgo {asset.risk}</b></div>
                  <h3>{asset.allocationStatus}</h3>
                  <p>{asset.thesis}</p>
                  <ul>
                    <li><Icon name="check" size={15} /> Peso: {asset.weight.toFixed(1)}% vs. objetivo {asset.targetWeight}%.</li>
                    <li><Icon name={belowCost ? 'target' : 'chart'} size={15} /> {belowCost ? `Precio ${Math.abs(asset.totalReturnPct).toFixed(1)}% bajo tu promedio.` : `Precio ${asset.totalReturnPct.toFixed(1)}% sobre tu promedio.`}</li>
                    <li><Icon name="shield" size={15} /> Rol: {asset.role}.</li>
                  </ul>
                  <span className={styles.cardLink}>Abrir análisis <Icon name="arrow" size={15} /></span>
                </Link>
              );
            })}
          </div>
          <div className={styles.riskPanel}>
            <div><p className={styles.kicker}>Reglas permanentes</p><h2>Disciplina del portafolio</h2></div>
            <div className={styles.rulesGrid}>
              <article><strong>1</strong><span>VOO mantiene el rol de núcleo y no se vende para perseguir tendencias.</span></article>
              <article><strong>2</strong><span>SMH tiene un límite estratégico de 20% por su volatilidad sectorial.</span></article>
              <article><strong>3</strong><span>Los aportes nuevos corrigen brechas antes de vender posiciones.</span></article>
              <article><strong>4</strong><span>Una caída de precio no invalida la tesis; un cambio fundamental sí.</span></article>
            </div>
          </div>
        </section>
      )}

      {active === 'projections' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Proyecciones</p><h2>Escenarios de planificación</h2><span>No son predicciones: muestran el impacto de aportes y rentabilidad.</span></div>
          <section className={styles.projectionHero}>
            <div><span>Patrimonio actual</span><strong>{clp.format(portfolio.totalCLP)}</strong></div>
            <div><span>Aporte mensual</span><strong>{clp.format(monthlyContributionCLP)}</strong></div>
            <div><span>Meta</span><strong>{clp.format(goalCLP)}</strong></div>
            <div><span>Año estimado base</span><strong>{projectedGoalYear ? projectedGoalYear.toFixed(1) : '—'}</strong></div>
          </section>
          <section className={styles.panelLarge}>
            <div className={styles.panelHeader}><div><p className={styles.kicker}>2026–2030</p><h2>Evolución por escenario</h2></div></div>
            <ProjectionChart totalCLP={portfolio.totalCLP} monthlyContributionCLP={monthlyContributionCLP} endYear={2030} />
            <div className={styles.scenarioGrid}>
              {[['Conservador', 5], ['Base', 9], ['Optimista', 13]].map(([label, rate]) => (
                <article key={label}><span>{label}</span><strong>{rate}% anual</strong><small>{label === 'Conservador' ? 'Mercado débil y múltiplos moderados.' : label === 'Base' ? 'Crecimiento estable de largo plazo.' : 'Ciclo favorable y expansión tecnológica.'}</small></article>
              ))}
            </div>
          </section>
        </section>
      )}

      {active === 'settings' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Configuración</p><h2>Datos de tu portafolio</h2><span>Administra billeteras y registra compras sin tocar código.</span></div>
          <section className={styles.settingsPanel}>
            <div className={styles.settingsGeneral}>
              <label>Meta patrimonial<input type="number" value={settings.goalCLP} onChange={(event) => setSettings({ ...settings, goalCLP: Number(event.target.value) })} /></label>
              <label>Aporte mensual<input type="number" value={settings.monthlyContributionCLP} onChange={(event) => setSettings({ ...settings, monthlyContributionCLP: Number(event.target.value) })} /></label>
              <label>Billetera USD<input type="number" min="0" step="0.01" value={settings.cashUSD} onChange={(event) => setSettings({ ...settings, cashUSD: Number(event.target.value) })} /></label>
              <label>Billetera CLP<input type="number" min="0" step="1" value={settings.cashCLP} onChange={(event) => setSettings({ ...settings, cashCLP: Number(event.target.value) })} /></label>
            </div>
            <PurchaseRegistrar portfolio={portfolio} settings={settings} setSettings={setSettings} />
            <div className={styles.settingsAssets}>
              <div className={styles.settingsHead}><span>Activo</span><span>Participaciones</span><span>Costo promedio</span><span>Objetivo %</span></div>
              {portfolio.assets.map((asset) => (
                <div className={styles.settingsRow} key={asset.ticker}>
                  <strong>{asset.ticker}</strong>
                  <input type="number" step="0.00000001" value={settings.assets[asset.ticker]?.shares} onChange={(event) => setSettings({ ...settings, assets: { ...settings.assets, [asset.ticker]: { ...settings.assets[asset.ticker], shares: Number(event.target.value) } } })} />
                  <input type="number" step="0.01" value={settings.assets[asset.ticker]?.averageCost} onChange={(event) => setSettings({ ...settings, assets: { ...settings.assets, [asset.ticker]: { ...settings.assets[asset.ticker], averageCost: Number(event.target.value) } } })} />
                  <input type="number" step="1" value={settings.assets[asset.ticker]?.targetWeight} onChange={(event) => setSettings({ ...settings, assets: { ...settings.assets, [asset.ticker]: { ...settings.assets[asset.ticker], targetWeight: Number(event.target.value) } } })} />
                </div>
              ))}
            </div>
            <div className={styles.settingsActions}>
              <button type="button" className={styles.primaryButton} onClick={saveSettings}><Icon name={saved ? 'check' : 'edit'} size={17} /> {saved ? 'Guardado' : 'Guardar cambios'}</button>
              <button type="button" className={styles.secondaryButton} onClick={resetSettings}>Restaurar datos base</button>
            </div>
            <p className={styles.settingsNote}><Icon name="info" size={16} /> Los datos se guardan en este dispositivo. Los precios se actualizan desde el mercado.</p>
          </section>
        </section>
      )}
    </DashboardShell>
  );
}
