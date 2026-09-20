'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MIRROR_DEFAULTS } from '../lib/mirror-config';
import DashboardShell from './components/DashboardShell';
import AllocationChart from './components/AllocationChart';
import AssetCard from './components/AssetCard';
import ActionEngine from './components/ActionEngine';
import ProjectionChart from './components/ProjectionChart';
import Icon from './components/Icon';
import PurchaseRegistrar from './components/PurchaseRegistrar';
import FormattedNumberInput from './components/FormattedNumberInput';
import OpportunityRadar from './components/OpportunityRadar';
import PortfolioHealthGate from './components/PortfolioHealthGate';
import RealExposure from './components/RealExposure';
import DisciplineMode from './components/DisciplineMode';
import DecisionJournal from './components/DecisionJournal';
import LearningLoop from './components/LearningLoop';
import CryptoExposure from './components/CryptoExposure';
import CryptoProtectionMonitor from './components/CryptoProtectionMonitor';
import BTCCycleLab from './components/BTCCycleLab';
import BTCHealthGate from './components/BTCHealthGate';
import BTCCalibrationBacktest from './components/BTCCalibrationBacktest';
import BTCProfitProtectionLab from './components/BTCProfitProtectionLab';
import BTCHolderBehaviorLab from './components/BTCHolderBehaviorLab';
import BTCETFDemandLab from './components/BTCETFDemandLab';
import BTCExitConstitution from './components/BTCExitConstitution';
import ETHCycleLab from './components/ETHCycleLab';
import ETHHealthGate from './components/ETHHealthGate';
import ETHExitConstitution from './components/ETHExitConstitution';
import ETHProtectionMonitor from './components/ETHProtectionMonitor';
import BTCETHComparison from './components/BTCETHComparison';
import { allocationHealth, estimateGoalYear, mergePortfolioData } from './lib/calculations';
import { createDefaultSettings, persistSettings, readStoredSettings } from './lib/settings';
import { clp, nativeMoney, percentage, shares } from './lib/format';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [active, setActive] = useState('overview');
  const [intelligenceTab, setIntelligenceTab] = useState('btc');
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
  const goalProgress = Math.min(100, (portfolio.totalInvestedCLP / goalCLP) * 100);
  const projectedGoalYear = estimateGoalYear({
    initialCLP: portfolio.totalCLP,
    monthlyCLP: monthlyContributionCLP,
    annualReturn: 9,
    goalCLP,
    startYear: new Date().getFullYear(),
  });
  const primaryGap = [...portfolio.assets].sort((a, b) => b.gapCLP - a.gapCLP)[0];
  const marketState = portfolio.assets.find((asset) => asset.currency === 'USD')?.marketState;
  const freedomMilestones = [
    { label: 'Primer nivel de libertad', target: 100000000, age: 45 },
    { label: 'Independencia fuerte', target: 300000000, age: 50 },
    { label: 'Gran holgura', target: 600000000, age: 55 },
  ];
  const smh = portfolio.assets.find((asset) => asset.ticker === 'SMH');
  const btc = portfolio.cryptoAssets?.find((asset) => asset.ticker === 'BTC');
  const eth = portfolio.cryptoAssets?.find((asset) => asset.ticker === 'ETH');
  const smhStressImpact = smh ? smh.weight * 0.5 : 0;

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
              <p>Patrimonio total invertido</p>
              <h2>{clp.format(portfolio.totalInvestedCLP)}</h2>
              <div className={styles.heroReturns}>
                <span className={portfolio.totalInvestedDayChangeCLP >= 0 ? styles.positiveBadge : styles.negativeBadge}>
                  {percentage(portfolio.totalInvestedDayChangePct)} 24 h · {clp.format(portfolio.totalInvestedDayChangeCLP)}
                </span>
                <span>Rentabilidad total <strong className={portfolio.totalInvestedReturnCLP >= 0 ? styles.positive : styles.negative}>{percentage(portfolio.totalInvestedReturnPct)}</strong></span>
              </div>
            </div>

            <div className={styles.heroGoal}>
              <div className={styles.goalRing} style={{ '--progress': `${goalProgress * 3.6}deg` }}>
                <div><strong>{goalProgress.toFixed(2)}%</strong><span>de la meta</span></div>
              </div>
              <div>
                <span>Meta patrimonial</span>
                <strong>{clp.format(goalCLP)}</strong>
                <small>Faltan {clp.format(Math.max(0, goalCLP - portfolio.totalInvestedCLP))}</small>
              </div>
            </div>
          </section>

          <section className={styles.walletSummary}>
            <article>
              <span>Racional · Cartera principal</span>
              <strong>{clp.format(portfolio.investedCLP)}</strong>
              <small>{portfolio.racionalWeightTotalInvested.toFixed(1)}% del total · objetivo interno 60/20/15/5</small>
            </article>
            <article>
              <span>Buda · Cripto</span>
              <strong>{clp.format(portfolio.cryptoInvestedCLP)}</strong>
              <small>{portfolio.budaWeightTotalInvested.toFixed(1)}% del total · BTC + ETH</small>
            </article>
            <article>
              <span>Bitcoin</span>
              <strong>{btc ? clp.format(btc.valueCLP) : '—'}</strong>
              <small>{btc ? `${btc.weightWithinCrypto.toFixed(1)}% de Buda · ${btc.weightTotalInvested.toFixed(1)}% total` : 'Sin datos'}</small>
            </article>
            <article>
              <span>Ethereum</span>
              <strong>{eth ? clp.format(eth.valueCLP) : '—'}</strong>
              <small>{eth ? `${eth.weightWithinCrypto.toFixed(1)}% de Buda · ${eth.weightTotalInvested.toFixed(1)}% total` : 'Sin datos'}</small>
            </article>
          </section>

          <section className={styles.milestoneStrip}>
            {freedomMilestones.map((milestone) => {
              const progress = Math.min(100, (portfolio.totalInvestedCLP / milestone.target) * 100);
              return (
                <article key={milestone.target}>
                  <div><span>{milestone.label}</span><strong>{clp.format(milestone.target)}</strong></div>
                  <small>Referencia edad {milestone.age} · {progress.toFixed(1)}% avanzado</small>
                  <div className={styles.milestoneTrack}><span style={{ width: `${progress}%` }} /></div>
                </article>
              );
            })}
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
              <div><p>Meta estimada Racional</p><strong>{projectedGoalYear ? Math.floor(projectedGoalYear) : '—'}</strong><small>9% anual + {clp.format(monthlyContributionCLP)}/mes · Buda aún no se proyecta</small></div>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statIcon}><Icon name="chart" /></span>
              <div><p>Costo invertido total</p><strong>{clp.format(portfolio.totalInvestedCostBasisCLP)}</strong><small>Resultado acumulado {clp.format(portfolio.totalInvestedReturnCLP)} · BTC incluye costo estimado</small></div>
            </article>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><p className={styles.kicker}>Racional · Asignación</p><h2>Actual vs. objetivo 60/20/15/5</h2></div>
                <button type="button" onClick={() => setActive('portfolio')}>Ver detalle <Icon name="arrow" size={16} /></button>
              </div>
              <AllocationChart assets={portfolio.assets} totalCLP={portfolio.investedCLP} />
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><p className={styles.kicker}>Racional · Camino al 2030</p><h2>Proyección de cartera principal</h2></div>
                <button type="button" onClick={() => setActive('projections')}>Escenarios <Icon name="arrow" size={16} /></button>
              </div>
              <ProjectionChart totalCLP={portfolio.totalCLP} monthlyContributionCLP={monthlyContributionCLP} endYear={2030} />
              <div className={styles.chartLegend}><span>Conservador 5%</span><span>Base 9%</span><span>Optimista 13%</span><span>Buda no incluido</span></div>
            </section>
          </div>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>
              <div><p className={styles.kicker}>Racional</p><h2>Cartera principal y posición estratégica</h2></div>
              <span>{portfolio.assets.length} posiciones · 60/20/15/5</span>
            </div>
            <div className={styles.assetGrid}>{portfolio.assets.map((asset) => <AssetCard key={asset.ticker} asset={asset} />)}</div>
          </section>

          <ActionEngine portfolio={portfolio} initialAmount={monthlyContributionCLP} />

          <section className={styles.mirrorBrief}>
            <div className={styles.mirrorAvatar}>M</div>
            <div>
              <p className={styles.kicker}>Lectura Mirror</p>
              <h2>{primaryGap.ticker} continúa siendo la principal brecha del portafolio.</h2>
              <p>
                Tu núcleo VOO representa {portfolio.assets.find((asset) => asset.ticker === 'VOO')?.weight.toFixed(1)}% y SMH {portfolio.assets.find((asset) => asset.ticker === 'SMH')?.weight.toFixed(1)}% dentro de Racional. Buda representa {portfolio.budaWeightTotalInvested.toFixed(1)}% del patrimonio total invertido y, por ahora, BTC/ETH permanecen fuera del motor de aportes hasta completar su estudio estratégico.
              </p>
            </div>
          </section>
        </>
      )}

      {active === 'portfolio' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Portafolio</p><h2>Posiciones por plataforma</h2><span>Racional mantiene su estrategia 60/20/15/5; Buda se muestra como exposición cripto independiente.</span></div>
          <div className={styles.platformSectionHead}>
            <div><p className={styles.kicker}>Racional</p><h3>Cartera principal</h3></div>
            <span>{clp.format(portfolio.investedCLP)} · {portfolio.racionalWeightTotalInvested.toFixed(1)}% del total invertido</span>
          </div>
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

          <div className={styles.platformSectionHead}>
            <div><p className={styles.kicker}>Buda</p><h3>Cripto existente</h3></div>
            <span>{clp.format(portfolio.cryptoInvestedCLP)} · {portfolio.budaWeightTotalInvested.toFixed(1)}% del total invertido</span>
          </div>

          <div className={styles.portfolioTable}>
            <div className={styles.tableHead}><span>Activo</span><span>Precio / costo</span><span>Valor</span><span>Resultado</span><span>Composición</span></div>
            {(portfolio.cryptoAssets || []).map((asset) => (
              <div className={styles.tableRow} key={asset.ticker}>
                <span className={styles.tableAsset}>
                  <i style={{ background: asset.accent }}>{asset.ticker.slice(0, 2)}</i>
                  <b>{asset.ticker}<small>{shares(asset.shares)} {asset.ticker}</small></b>
                </span>
                <span>
                  <b>{clp.format(asset.price)}</b>
                  <small>Prom. {clp.format(asset.averageCost)}{asset.averageCostEstimated ? ' · estimado' : ''}</small>
                </span>
                <span>
                  <b>{clp.format(asset.valueCLP)}</b>
                  <small>Buda.com</small>
                </span>
                <span>
                  <b className={asset.totalReturnPct >= 0 ? styles.positive : styles.negative}>{percentage(asset.totalReturnPct)}</b>
                  <small>{clp.format(asset.totalReturnNative)}</small>
                </span>
                <span>
                  <b>{asset.weightWithinCrypto.toFixed(1)}% de Buda</b>
                  <small>{asset.weightTotalInvested.toFixed(1)}% del total invertido</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {active === 'intelligence' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}>
            <p className={styles.kicker}>Mirror Intelligence</p>
            <h2>Inteligencia cripto por activo</h2>
            <span>BTC y ETH mantienen motores de riesgo distintos; la comparación queda separada para no mezclar reglas.</span>
          </div>

          <div className={styles.intelligenceTabs}>
            <button
              type="button"
              className={intelligenceTab === 'btc' ? styles.intelligenceTabActive : ''}
              onClick={() => setIntelligenceTab('btc')}
            >
              BTC
            </button>
            <button
              type="button"
              className={intelligenceTab === 'eth' ? styles.intelligenceTabActive : ''}
              onClick={() => setIntelligenceTab('eth')}
            >
              ETH
            </button>
            <button
              type="button"
              className={intelligenceTab === 'compare' ? styles.intelligenceTabActive : ''}
              onClick={() => setIntelligenceTab('compare')}
            >
              BTC vs ETH
            </button>
          </div>

          {intelligenceTab === 'btc' && (
            <div className={styles.intelligenceTabContent}>
              <CryptoProtectionMonitor portfolio={portfolio} />
              <BTCHealthGate />
              <BTCExitConstitution />
              <BTCCycleLab />
              <BTCCalibrationBacktest />
              <BTCProfitProtectionLab />
              <BTCHolderBehaviorLab />
              <BTCETFDemandLab />
            </div>
          )}

          {intelligenceTab === 'eth' && (
            <div className={styles.intelligenceTabContent}>
              <ETHProtectionMonitor portfolio={portfolio} />
              <ETHHealthGate />
              <ETHExitConstitution />
              <ETHCycleLab />
            </div>
          )}

          {intelligenceTab === 'compare' && (
            <div className={styles.intelligenceTabContent}>
              <BTCETHComparison portfolio={portfolio} />
              <CryptoExposure portfolio={portfolio} />

              <div className={styles.intelligenceSectionLabel}>
                <p className={styles.kicker}>Contexto general Mirror</p>
                <h3>Disciplina, exposición y aprendizaje</h3>
              </div>

              <DisciplineMode portfolio={portfolio} />
              <PortfolioHealthGate portfolio={portfolio} />
              <RealExposure portfolio={portfolio} />
              <DecisionJournal portfolio={portfolio} />
              <LearningLoop />

              <section className={styles.riskLab}>
                <div className={styles.panelHeader}>
                  <div><p className={styles.kicker}>Riesgo y corrección</p><h2>¿Cuánto puede doler una caída?</h2></div>
                  <span className={styles.reviewBadge}>Modo Corrección V3</span>
                </div>
                <div className={styles.riskLabGrid}>
                  <article>
                    <span>SMH actual</span>
                    <strong>{smh ? smh.weight.toFixed(1) : '—'}%</strong>
                    <small>Objetivo máximo estratégico: 20%</small>
                  </article>
                  <article>
                    <span>Si SMH cae 50%</span>
                    <strong>-{smhStressImpact.toFixed(1)}%</strong>
                    <small>Impacto aproximado sobre la cartera por esa posición aislada.</small>
                  </article>
                  <article>
                    <span>Recuperación tras -50%</span>
                    <strong>+100%</strong>
                    <small>Perder 50% exige duplicar para volver al origen.</small>
                  </article>
                  <article>
                    <span>Regla de corrección</span>
                    <strong>-10 / -15 / -20 / -25%</strong>
                    <small>Despliegue progresivo de liquidez; priorizando asignación y tesis.</small>
                  </article>
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      {active === 'opportunities' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}>
            <p className={styles.kicker}>Oportunidades</p>
            <h2>Decidir antes de incorporar</h2>
            <span>Solo tres candidatos activos. Menos posiciones, mejor entendidas.</span>
          </div>
          <OpportunityRadar />
        </section>
      )}

      {active === 'projections' && (
        <section className={styles.pageSection}>
          <div className={styles.pageTitle}><p className={styles.kicker}>Proyecciones</p><h2>Escenarios de la cartera principal</h2><span>Racional solamente. BTC y ETH no se proyectan hasta definir una metodología cripto específica.</span></div>
          <section className={styles.projectionHero}>
            <div><span>Racional actual</span><strong>{clp.format(portfolio.totalCLP)}</strong></div>
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
          <div className={styles.pageTitle}><p className={styles.kicker}>Configuración</p><h2>Datos de Racional y Buda</h2><span>Racional mantiene objetivos estratégicos; BTC y ETH se administran como posiciones independientes.</span></div>
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
                  <FormattedNumberInput
                    value={settings.assets[asset.ticker]?.shares}
                    decimals={8}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      assets: {
                        ...settings.assets,
                        [asset.ticker]: { ...settings.assets[asset.ticker], shares: value },
                      },
                    })}
                  />
                  <FormattedNumberInput
                    value={settings.assets[asset.ticker]?.averageCost}
                    decimals={2}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      assets: {
                        ...settings.assets,
                        [asset.ticker]: { ...settings.assets[asset.ticker], averageCost: value },
                      },
                    })}
                  />
                  <input type="number" step="1" value={settings.assets[asset.ticker]?.targetWeight} onChange={(event) => setSettings({ ...settings, assets: { ...settings.assets, [asset.ticker]: { ...settings.assets[asset.ticker], targetWeight: Number(event.target.value) } } })} />
                </div>
              ))}
            </div>

            <div className={styles.settingsCrypto}>
              <div className={styles.settingsCryptoTitle}>
                <div><p className={styles.kicker}>Buda</p><strong>BTC + ETH</strong></div>
                <span>Sin objetivo estratégico por ahora</span>
              </div>
              <div className={styles.settingsCryptoHead}><span>Activo</span><span>Unidades</span><span>Costo promedio CLP</span></div>
              {(portfolio.cryptoAssets || []).map((asset) => (
                <div className={styles.settingsCryptoRow} key={asset.ticker}>
                  <strong>{asset.ticker}</strong>
                  <FormattedNumberInput
                    value={settings.crypto?.[asset.ticker]?.shares}
                    decimals={9}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      crypto: {
                        ...settings.crypto,
                        [asset.ticker]: { ...settings.crypto?.[asset.ticker], shares: value },
                      },
                    })}
                  />
                  <FormattedNumberInput
                    value={settings.crypto?.[asset.ticker]?.averageCost}
                    decimals={2}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      crypto: {
                        ...settings.crypto,
                        [asset.ticker]: { ...settings.crypto?.[asset.ticker], averageCost: value },
                      },
                    })}
                  />
                </div>
              ))}
            </div>
            <div className={styles.settingsActions}>
              <button type="button" className={styles.primaryButton} onClick={saveSettings}><Icon name={saved ? 'check' : 'edit'} size={17} /> {saved ? 'Guardado' : 'Guardar cambios'}</button>
              <button type="button" className={styles.secondaryButton} onClick={resetSettings}>Restaurar datos base</button>
            </div>
            <p className={styles.settingsNote}><Icon name="info" size={16} /> Los datos se guardan en este dispositivo. Racional actualiza precios de mercado y BTC/ETH usan precios públicos de Buda.com.</p>
          </section>
        </section>
      )}
    </DashboardShell>
  );
}
