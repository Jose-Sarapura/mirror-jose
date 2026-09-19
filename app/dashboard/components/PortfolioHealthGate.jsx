'use client';

import Icon from './Icon';
import { portfolioHealthDecision } from '../lib/portfolio-health';
import styles from '../dashboard.module.css';

function statusClass(level) {
  if (level === 'add') return styles.healthAdd;
  if (level === 'watch') return styles.healthWatch;
  if (level === 'review') return styles.healthReview;
  return styles.healthHold;
}

export default function PortfolioHealthGate({ portfolio }) {
  const decisions = portfolio.assets
    .map((asset) => ({ asset, health: portfolioHealthDecision(asset) }))
    .filter((item) => item.health);

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Auditoría de cartera</p>
          <h2>Portfolio Health Gate</h2>
          <span className={styles.panelSubtitle}>
            No pregunta si el activo “subió o bajó”: evalúa si merece seguir en cartera y qué acción corresponde hoy.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> 4 posiciones auditadas</span>
      </div>

      <div className={styles.healthGrid}>
        {decisions.map(({ asset, health }) => (
          <article className={styles.healthCard} key={asset.ticker}>
            <div className={styles.healthTop}>
              <div>
                <span className={styles.watchTicker} translate="no">{asset.ticker}</span>
                <strong>{health.category}</strong>
              </div>
              <span className={statusClass(health.level)}>{health.status}</span>
            </div>

            <div className={styles.healthDecision}>
              <div>
                <span>Estado actual</span>
                <strong>{health.score}/100</strong>
              </div>
              <p>{health.reason}</p>
            </div>

            <div className={styles.healthAllocation}>
              <span>Peso actual <strong>{asset.weight.toFixed(1)}%</strong></span>
              <span>Objetivo <strong>{asset.targetWeight}%</strong></span>
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
                      {gatePassed ? 'Gate aprobado' : `Gate no aprobado · mínimo ${block.gate}`}
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
          <strong>Hard gate:</strong> un puntaje total alto no puede compensar un deterioro crítico. Si fundamentos, riesgo, encaje o tesis caen bajo su mínimo, Mirror cambia la acción aunque el promedio siga siendo alto.
        </span>
      </div>
    </section>
  );
}
