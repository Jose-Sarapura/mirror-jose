'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { portfolioHealthDecision } from '../lib/portfolio-health';
import styles from '../dashboard.module.css';

function statusClass(level) {
  if (level === 'priority') return styles.healthAdd;
  if (level === 'later' || level === 'pause') return styles.healthWatch;
  if (level === 'review') return styles.healthReview;
  return styles.healthHold;
}

function timingClass(state) {
  if (state === 'confirmed') return styles.healthAdd;
  if (state === 'downtrend') return styles.healthWatch;
  return styles.healthHold;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function timingPlan(asset, health, timing) {
  if (!timing || timing.trend?.state === 'unavailable') {
    return {
      label: 'Sin señal técnica',
      size: 'No cambia la decisión fundamental',
      explanation: 'Mirror no tiene historial suficiente para regular el timing. Mantiene la regla de asignación y calidad sin inventar una señal.',
    };
  }

  if (health.failedCritical.length) {
    return {
      label: 'No añadir',
      size: '0% hasta resolver hard gate',
      explanation: 'Una tendencia favorable nunca compensa un problema de fundamentales, riesgo, encaje o tesis.',
    };
  }

  if (!health.valuationAllowsNewMoney) {
    return {
      label: 'Esperar valoración',
      size: '0% de dinero nuevo por ahora',
      explanation: 'El timing no compensa una valoración que no supera el mínimo definido para nuevos aportes.',
    };
  }

  const gap = asset.targetWeight - asset.weight;
  const atLimit = asset.weight >= asset.targetWeight - 0.5;

  if (atLimit) {
    return {
      label: 'Mantener posición',
      size: 'Sin aporte táctico adicional',
      explanation: 'El activo ya está cerca de su objetivo. La tendencia sirve para vigilar, no para sobreponderarlo.',
    };
  }

  if (timing.trend.state === 'downtrend') {
    return {
      label: 'Aporte anticipado parcial',
      size: gap >= 0.6 ? '20–30% del tramo que tocaría invertir' : 'Solo mantenimiento',
      explanation: 'La tesis y valoración permiten seguir acumulando, pero la tendencia bajista exige reservar capital para nuevas caídas o una mejor confirmación.',
    };
  }

  if (timing.trend.state === 'confirmed') {
    return {
      label: gap >= 0.6 ? 'Timing favorable para aportar' : 'Mantener objetivo',
      size: gap >= 0.6 ? 'Aporte normal, siempre escalonado' : 'Sin necesidad de acelerar',
      explanation: 'Precio, medias y momentum acompañan. Puede cerrarse la brecha con mayor normalidad, sin comprar todo de una vez.',
    };
  }

  return {
    label: 'Aporte moderado por tramos',
    size: gap >= 0.6 ? '30–40% del tramo que tocaría invertir' : 'Solo mantenimiento',
    explanation: 'La tendencia muestra estabilización, pero todavía no confirmación plena. Conviene avanzar por etapas.',
  };
}

export default function PortfolioHealthGate({ portfolio }) {
  const [timingData, setTimingData] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/portfolio-timing', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => { if (active) setTimingData(payload); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const timingByTicker = useMemo(() => new Map(
    (timingData?.assets || []).map((item) => [item.ticker, item])
  ), [timingData]);

  const decisions = portfolio.assets
    .map((asset) => {
      const health = portfolioHealthDecision(asset);
      const timing = timingByTicker.get(asset.ticker) || null;
      return { asset, health, timing, plan: health ? timingPlan(asset, health, timing) : null };
    })
    .filter((item) => item.health);

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Auditoría de cartera</p>
          <h2>Portfolio Health Gate</h2>
          <span className={styles.panelSubtitle}>
            Primero decide si el activo merece seguir en cartera. Después usa tendencia y momentum para decidir cómo y cuándo aportar.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> 4 posiciones auditadas</span>
      </div>

      <div className={styles.healthGrid}>
        {decisions.map(({ asset, health, timing, plan }) => (
          <article className={styles.healthCard} key={asset.ticker}>
            <div className={styles.healthTop}>
              <div>
                <span className={styles.watchTicker} translate="no">{asset.ticker}</span>
                <strong>{health.category}</strong>
              </div>
              <span className={statusClass(health.holdingLevel)}>{health.holdingStatus}</span>
            </div>

            <div className={styles.healthDecision}>
              <div>
                <span>Calidad de la inversión</span>
                <strong>{health.score}/100</strong>
              </div>
              <p>{health.holdingReason}</p>
            </div>

            <div className={styles.healthContribution}>
              <span>Asignación / prioridad estructural</span>
              <strong className={statusClass(health.contributionLevel)}>{health.contributionStatus}</strong>
              <small>{health.contributionReason}</small>
            </div>

            <div className={styles.healthTimingBox}>
              <div className={styles.healthTimingTop}>
                <div>
                  <span>Timing de nuevos aportes</span>
                  <strong>{plan?.label || 'Actualizando'}</strong>
                </div>
                <span className={timingClass(timing?.trend?.state)}>{timing?.trend?.status || 'Actualizando'}</span>
              </div>

              <div className={styles.healthTimingMetrics}>
                <div><span>Desde máximo 1a</span><strong>{pct(timing?.drawdownFromHigh)}</strong></div>
                <div><span>Vs. MA200</span><strong>{pct(timing?.trend?.priceVsMa200Pct)}</strong></div>
                <div><span>Momentum 3m</span><strong>{pct(timing?.trend?.momentum3mPct)}</strong></div>
                <div><span>Score timing</span><strong>{Number.isFinite(timing?.trend?.score) ? `${timing.trend.score}/100` : '—'}</strong></div>
              </div>

              <p>{plan?.explanation}</p>
              <small><b>Tamaño:</b> {plan?.size || '—'}</small>
            </div>

            <div className={styles.healthAllocation}>
              <span>Peso actual <strong>{asset.weight.toFixed(1)}%</strong></span>
              <span>Objetivo <strong>{asset.targetWeight}%</strong></span>
              <span>Brecha <strong>{(asset.targetWeight - asset.weight).toFixed(1)} pp</strong></span>
            </div>

            <div className={styles.healthBlocks}>
              {health.blocks.map((block) => {
                const gatePassed = block.score >= block.gate;
                return (
                  <div key={block.key}>
                    <div>
                      <span>{block.label} · peso {block.weight}%</span>
                      <strong>{block.score}/100</strong>
                    </div>
                    <div className={styles.healthTrack}>
                      <i style={{ width: `${block.score}%` }} />
                      <b style={{ left: `${block.gate}%` }} title={`Hard gate: ${block.gate}`} />
                    </div>
                    <small className={gatePassed ? styles.gatePass : styles.gateFail}>
                      {gatePassed ? `✓ Cumple · mín. ${block.gate}` : `✕ No cumple · mín. ${block.gate}`}
                    </small>
                  </div>
                );
              })}
            </div>

            <details className={styles.healthDetails}>
              <summary>Por qué está en cartera y reglas de acción</summary>
              <div className={styles.healthQuestions}>
                <div>
                  <span>¿Por qué lo tengo?</span>
                  <p>{health.whyOwn}</p>
                </div>
                <div>
                  <span>¿Cuándo aportar más?</span>
                  <p>{health.addMoreIf}</p>
                </div>
                <div>
                  <span>¿Cuándo dejar de aportar?</span>
                  <p>{health.stopAddingIf}</p>
                </div>
                <div>
                  <span>¿Qué me haría reducirlo?</span>
                  <p>{health.reduceIf}</p>
                </div>
              </div>

              <div className={styles.healthFacts}>
                <strong>Datos que Mirror está vigilando</strong>
                {health.facts.map((fact) => <span key={fact}>• {fact}</span>)}
                <small>Base de análisis: {health.sourceLabel} · actualizado {new Date(health.sourceDate).toLocaleDateString('es-CL')}</small>
              </div>
            </details>
          </article>
        ))}
      </div>

      <div className={styles.radarFooter}>
        <Icon name="info" size={16} />
        <span>
          <strong>Regla Mirror:</strong> calidad/tesis determina si mantener; asignación determina cuánto necesita la cartera; tendencia/momentum determina el ritmo de entrada. Una caída no obliga a vender y una tendencia favorable no compensa un hard gate fallado.
        </span>
      </div>
    </section>
  );
}
