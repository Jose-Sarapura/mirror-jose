'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { portfolioHealthDecision } from '../lib/portfolio-health';
import styles from '../dashboard.module.css';

const PROFIT_REVIEW_BAND = {
  VOO: 5,
  SMH: 3,
  CFIETFGE: 2,
  BCH: 1,
};

function statusClass(level) {
  if (level === 'priority') return styles.healthAdd;
  if (level === 'later' || level === 'pause') return styles.healthWatch;
  if (level === 'review') return styles.healthReview;
  return styles.healthHold;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function riskLabel(health) {
  const score = Number(health?.scores?.risk);
  if (!Number.isFinite(score)) return '—';
  if (score >= 75) return 'Medio';
  if (score >= 60) return 'Medio-alto';
  return 'Alto';
}

function trimPctToTarget(currentWeight, targetWeight) {
  const current = Number(currentWeight);
  const target = Number(targetWeight);
  if (!Number.isFinite(current) || !Number.isFinite(target) || current <= target || current <= 0) return 0;
  return ((current - target) / current) * 100;
}

function timingPlan(asset, health, timing) {
  if (!timing || timing.trend?.state === 'unavailable') {
    return {
      label: 'Sin señal técnica',
      size: 'Sin cambio',
      explanation: 'No hay historial suficiente para ajustar el ritmo.',
    };
  }

  if (health.failedCritical.length) {
    return {
      label: 'No añadir',
      size: '0%',
      explanation: 'El timing no compensa un hard gate fallado.',
    };
  }

  if (!health.valuationAllowsNewMoney) {
    return {
      label: 'Esperar valoración',
      size: '0%',
      explanation: 'La valoración no habilita dinero nuevo.',
    };
  }

  const gap = asset.targetWeight - asset.weight;
  const atLimit = asset.weight >= asset.targetWeight - 0.5;

  if (atLimit) {
    return {
      label: 'Mantener posición',
      size: 'Sin aporte táctico',
      explanation: 'Ya está cerca o sobre su objetivo.',
    };
  }

  if (timing.trend.state === 'downtrend') {
    return {
      label: 'Aporte anticipado parcial',
      size: gap >= 0.6 ? '20–30% del tramo' : 'Solo mantenimiento',
      explanation: 'La tesis permite acumular, pero la tendencia exige reservar capital.',
    };
  }

  if (timing.trend.state === 'confirmed') {
    return {
      label: gap >= 0.6 ? 'Timing favorable' : 'Mantener objetivo',
      size: gap >= 0.6 ? 'Aporte normal y escalonado' : 'Sin acelerar',
      explanation: 'Precio y momentum acompañan.',
    };
  }

  return {
    label: 'Aporte moderado por tramos',
    size: gap >= 0.6 ? '30–40% del tramo' : 'Solo mantenimiento',
    explanation: 'Hay estabilización, pero aún no confirmación plena.',
  };
}

function profitReviewFor(asset, health) {
  const band = PROFIT_REVIEW_BAND[asset.ticker] ?? 2;
  const excess = asset.weight - asset.targetWeight;
  const triggerWeight = asset.targetWeight + band;
  const profitable = Number(asset.totalReturnPct) > 0;
  const trimPctNow = trimPctToTarget(asset.weight, asset.targetWeight);
  const trimPctAtTrigger = trimPctToTarget(triggerWeight, asset.targetWeight);

  if (health.failedCritical.length) {
    return {
      label: 'Revisar reducción',
      level: 'review',
      reason: 'Falla un hard gate. Antes de seguir manteniendo, revisar reducción, reemplazo o salida.',
      triggerWeight,
      trimPctNow,
      trimPctAtTrigger,
    };
  }

  if (profitable && excess >= band) {
    return {
      label: `Evaluar toma parcial · ~${trimPctNow.toFixed(0)}%`,
      level: 'review',
      reason: `Está ${excess.toFixed(1)} pp sobre objetivo y con ganancia. Un recorte aproximado de ${trimPctNow.toFixed(0)}% de esta posición la devolvería cerca de ${asset.targetWeight}%.`,
      triggerWeight,
      trimPctNow,
      trimPctAtTrigger,
    };
  }

  if (excess > 0.3) {
    return {
      label: 'Vigilar ganancia · 0% venta ahora',
      level: 'later',
      reason: `Está sobre objetivo, pero aún bajo el gatillo de ${triggerWeight.toFixed(0)}%. Si llega allí con tesis sana pero peor relación riesgo/valoración, el recorte orientativo para volver al objetivo sería ~${trimPctAtTrigger.toFixed(0)}% de la posición.`,
      triggerWeight,
      trimPctNow,
      trimPctAtTrigger,
    };
  }

  return {
    label: 'Sin cosecha activa · 0% venta',
    level: 'hold',
    reason: `Mantener. Si alcanza ${triggerWeight.toFixed(0)}% con ganancia y empeora la relación riesgo/valoración, Mirror preparará un recorte orientativo de ~${trimPctAtTrigger.toFixed(0)}% de la posición para volver al objetivo.`,
    triggerWeight,
    trimPctNow,
    trimPctAtTrigger,
  };
}

function mainDecision(asset, health, timing, plan, profit) {
  const gap = asset.targetWeight - asset.weight;

  if (health.failedCritical.length) {
    return {
      label: 'REEVALUAR',
      level: 'review',
      why: health.holdingReason,
      action: 'Pausar aportes. No vender a ciegas: primero definir nuevo objetivo, reemplazo o salida según la tesis.',
      change: 'Solo vuelve a normalidad cuando el hard gate se recupere o la tesis sea redefinida.',
    };
  }

  if (profit.level === 'review') {
    return {
      label: `EVALUAR TOMA PARCIAL · ~${profit.trimPctNow.toFixed(0)}%`,
      level: 'review',
      why: profit.reason,
      action: `Evaluar vender aproximadamente ${profit.trimPctNow.toFixed(0)}% de esta posición para volver de ${asset.weight.toFixed(1)}% a cerca de ${asset.targetWeight}%. Ejecutar solo con destino del capital definido.`,
      change: 'Si el sobrepeso se corrige o mejora riesgo/valoración, volver a mantener sin recorte. Si la tesis se deteriora, reevaluar un objetivo menor o reemplazo.',
    };
  }

  if (health.contributionLevel === 'priority') {
    const byTranches = timing?.trend?.state === 'downtrend' || timing?.trend?.state === 'stabilizing';
    return {
      label: byTranches ? 'APORTAR POR TRAMOS' : 'APORTAR',
      level: 'priority',
      why: `Está ${gap.toFixed(1)} pp bajo objetivo y mantiene sus hard gates aprobados.`,
      action: `${plan?.label || 'Aportar'} · ${plan?.size || 'escalonado'}.`,
      change: 'Detener el aporte al alcanzar el objetivo, fallar un hard gate o aparecer una alternativa claramente superior.',
    };
  }

  if (asset.weight > asset.targetWeight + 0.3 || (asset.ticker === 'SMH' && asset.weight >= 19.5)) {
    return {
      label: 'PAUSAR APORTES · 0% VENTA',
      level: 'later',
      why: `Está en ${asset.weight.toFixed(1)}% frente a un objetivo de ${asset.targetWeight}%.`,
      action: 'Mantener la posición y dirigir dinero nuevo a activos con brecha. No vender solo por estar levemente sobre objetivo.',
      change: profit.reason,
    };
  }

  return {
    label: 'MANTENER · 0% VENTA',
    level: 'hold',
    why: 'La tesis sigue vigente y el peso está cerca del objetivo.',
    action: 'No vender ni aumentar de forma táctica. Mantener el peso estratégico.',
    change: profit.reason,
  };
}

export default function PortfolioHealthGate({ portfolio, context = 'legacy' }) {
  const [timingData, setTimingData] = useState(null);

  useEffect(() => {
    if (context !== 'portfolio') return undefined;

    let active = true;
    fetch('/api/dashboard/portfolio-timing', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => { if (active) setTimingData(payload); })
      .catch(() => {});
    return () => { active = false; };
  }, [context]);

  const timingByTicker = useMemo(() => new Map(
    (timingData?.assets || []).map((item) => [item.ticker, item])
  ), [timingData]);

  const decisions = portfolio.assets
    .map((asset) => {
      const health = portfolioHealthDecision(asset);
      const timing = timingByTicker.get(asset.ticker) || null;
      const plan = health ? timingPlan(asset, health, timing) : null;
      const profit = health ? profitReviewFor(asset, health) : null;
      const decision = health ? mainDecision(asset, health, timing, plan, profit) : null;
      return { asset, health, timing, plan, profit, decision };
    })
    .filter((item) => item.health);

  if (context !== 'portfolio') return null;

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Plan por activo</p>
          <h2>Qué hacer ahora</h2>
          <span className={styles.panelSubtitle}>Una decisión principal por activo, con porcentaje concreto cuando corresponda proteger ganancias.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> {decisions.length} activos</span>
      </div>

      <div className={styles.healthGrid}>
        {decisions.map(({ asset, health, timing, plan, profit, decision }) => (
          <article className={styles.healthCard} key={asset.ticker}>
            <div className={styles.healthTop}>
              <div>
                <span className={styles.watchTicker} translate="no">{asset.ticker}</span>
                <strong>{health.category}</strong>
              </div>
              <span className={statusClass(decision.level)}>{decision.label}</span>
            </div>

            <div className={styles.healthDecision}>
              <div><span>Por qué</span><strong>{health.score}/100</strong></div>
              <p>{decision.why}</p>
            </div>

            <div className={styles.healthAllocation}>
              <span>Riesgo <strong>{riskLabel(health)}</strong></span>
              <span>Peso <strong>{asset.weight.toFixed(1)}% / {asset.targetWeight}%</strong></span>
              <span>Resultado <strong>{pct(asset.totalReturnPct)}</strong></span>
            </div>

            <div className={styles.healthContribution}>
              <span>Acción ahora</span>
              <strong className={statusClass(decision.level)}>{decision.action}</strong>
            </div>

            <div className={styles.healthContribution}>
              <span>Condición de cambio</span>
              <strong className={statusClass(profit.level)}>{profit.label}</strong>
              <small>{decision.change}</small>
            </div>

            <details className={styles.healthDetails}>
              <summary>Ver análisis completo</summary>

              <div className={styles.healthQuestions}>
                <div>
                  <span>Timing</span>
                  <p><b>{timing?.trend?.status || 'Actualizando'}.</b> {plan?.label} · {plan?.size}. {plan?.explanation}</p>
                </div>
                <div>
                  <span>Métricas técnicas</span>
                  <p>Máx. 1a {pct(timing?.drawdownFromHigh)} · MA200 {pct(timing?.trend?.priceVsMa200Pct)} · momentum 3m {pct(timing?.trend?.momentum3mPct)} · timing {Number.isFinite(timing?.trend?.score) ? `${timing.trend.score}/100` : '—'}.</p>
                </div>
                <div>
                  <span>¿Por qué lo tengo?</span>
                  <p>{health.whyOwn}</p>
                </div>
                <div>
                  <span>¿Qué me haría reducirlo?</span>
                  <p>{health.reduceIf}</p>
                </div>
              </div>

              <div className={styles.healthBlocks}>
                {health.blocks.map((block) => {
                  const gatePassed = block.score >= block.gate;
                  return (
                    <div key={block.key}>
                      <div>
                        <span>{block.label}</span>
                        <strong>{block.score}/100</strong>
                      </div>
                      <div className={styles.healthTrack}>
                        <i style={{ width: `${block.score}%` }} />
                        <b style={{ left: `${block.gate}%` }} title={`Hard gate: ${block.gate}`} />
                      </div>
                      <small className={gatePassed ? styles.gatePass : styles.gateFail}>
                        {gatePassed ? `✓ mín. ${block.gate}` : `✕ mín. ${block.gate}`}
                      </small>
                    </div>
                  );
                })}
              </div>

              <div className={styles.healthFacts}>
                <strong>Datos vigilados</strong>
                {health.facts.map((fact) => <span key={fact}>• {fact}</span>)}
                <small>{health.sourceLabel} · actualizado {new Date(health.sourceDate).toLocaleDateString('es-CL')}</small>
              </div>
            </details>
          </article>
        ))}
      </div>

      <div className={styles.radarFooter}>
        <Icon name="info" size={16} />
        <span><strong>Regla Mirror:</strong> en VOO, SMH, CFIETFGE y BCH la toma parcial busca volver al peso estratégico, no vender un porcentaje arbitrario. El porcentaje mostrado es orientativo y debe revisarse junto con destino del capital, costos e impuestos antes de ejecutar.</span>
      </div>
    </section>
  );
}
