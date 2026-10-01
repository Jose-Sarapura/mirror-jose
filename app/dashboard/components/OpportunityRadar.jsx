'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function pct(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function trendClass(state) {
  if (state === 'confirmed') return styles.signalReview;
  if (state === 'stabilizing') return styles.signalNeutral;
  if (state === 'downtrend') return styles.signalWatch;
  return styles.signalNeutral;
}

function replacementTarget(candidate) {
  if (candidate.ticker === 'VST') return 'BCH o, solo con evidencia fuerte, una fracción de SMH';
  if (candidate.ticker === 'GRID') return 'BCH, si mejora claramente retorno/riesgo y diversificación';
  if (candidate.ticker === 'CCJ') return 'BCH, con umbral alto por volatilidad y valoración';
  return 'Uno de los 4 actuales, nunca como agregado automático';
}

export default function OpportunityRadar() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError('');
        const response = await fetch('/api/dashboard/opportunities', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible actualizar el radar');
        const result = await response.json();
        if (active) setData(result);
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };

    load();
    const timer = setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const priority = useMemo(() => {
    if (!data?.candidates?.length) return null;
    const qualified = data.candidates.filter((candidate) => candidate.decision?.qualified);
    if (qualified.length) {
      return [...qualified].sort((a, b) => {
        if (b.decision.score !== a.decision.score) return b.decision.score - a.decision.score;
        return (b.trend?.score || 0) - (a.trend?.score || 0);
      })[0];
    }
    return [...data.candidates].sort((a, b) => b.decision.score - a.decision.score)[0] || null;
  }, [data]);

  const hasQualifiedReplacement = Boolean(priority?.decision?.qualified);

  return (
    <section className={styles.opportunityPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Modo Acumulación · 0–100M</p>
          <h2>Radar de reemplazo</h2>
          <span className={styles.panelSubtitle}>
            Las oportunidades no se agregan por defecto: deben demostrar que mejoran a uno de los 4 activos actuales.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="target" size={15} /> Reemplazar antes que agregar</span>
      </div>

      {error && <div className={styles.inlineNotice}>{error}</div>}

      {!data ? (
        <div className={styles.opportunityLoading}>Comparando calidad, valoración, riesgo, encaje y timing...</div>
      ) : (
        <>
          <div className={styles.opportunitySummary}>
            <div>
              <span>Decisión de cartera hoy</span>
              <strong>
                {hasQualifiedReplacement
                  ? <><span translate="no" className="notranslate">{priority.ticker}</span>: candidato para comparación</>
                  : 'Mantener los 4 activos actuales'}
              </strong>
              <small>
                {hasQualifiedReplacement
                  ? `${priority.decision.score}/100 en calidad · todavía debe justificar a quién reemplaza y por qué mejora el portafolio completo.`
                  : 'Ningún candidato justifica hoy ampliar el número de posiciones. La base 60/20/15/5 sigue siendo la referencia.'}
              </small>
            </div>
            <div className={styles.cadenceBox}>
              <span>Pregunta obligatoria</span>
              <strong>¿Reemplaza a quién?</strong>
              <small>Si no hay una respuesta clara y una mejora de retorno/riesgo, el activo no entra.</small>
            </div>
          </div>

          <div className={styles.opportunityGrid}>
            {data.candidates.map((candidate) => (
              <article className={styles.opportunityCard} key={candidate.ticker}>
                <div className={styles.opportunityTop}>
                  <div>
                    <span className={styles.watchTicker} translate="no">{candidate.ticker}</span>
                    <strong>{candidate.name}</strong>
                  </div>
                  <span className={trendClass(candidate.trend?.state)}>{candidate.trend?.status || 'Sin timing'}</span>
                </div>

                <p className={styles.opportunityRole}>{candidate.role}</p>

                <div className={styles.decisionStatusBox}>
                  <div className={styles.decisionTitleRow}>
                    <span>Reemplazo potencial</span>
                    <b>4 activos máx.</b>
                  </div>
                  <strong>{replacementTarget(candidate)}</strong>
                  <small>{candidate.fit || 'Debe aportar algo que el portafolio actual no capture suficientemente.'}</small>
                </div>

                <div className={
                  candidate.decision.level === 'candidate'
                    ? styles.decisionCandidate
                    : candidate.decision.level === 'wait'
                      ? styles.decisionWait
                      : candidate.decision.level === 'reject'
                        ? styles.decisionReject
                        : styles.decisionStatusBox
                }>
                  <div className={styles.decisionTitleRow}>
                    <span>Calidad de oportunidad</span>
                    <b>{candidate.decision.score}/100</b>
                  </div>
                  <strong>{candidate.decision.status}</strong>
                  <small>{candidate.decision.explanation}</small>
                  {candidate.decision.mainBlocker && (
                    <em className={styles.mainBlocker}>Bloqueo actual: {candidate.decision.mainBlocker}</em>
                  )}
                </div>

                <div className={styles.decisionStatusBox}>
                  <div className={styles.decisionTitleRow}>
                    <span>Timing de entrada</span>
                    <b>{candidate.trend?.score ?? '—'}/100</b>
                  </div>
                  <strong>{candidate.decision.entryPlan?.label || 'Sin plan'}</strong>
                  <small>{candidate.decision.entryPlan?.size || '—'}</small>
                  <small>{candidate.decision.entryPlan?.explanation || candidate.trend?.note}</small>
                </div>

                <div className={styles.opportunityMetrics}>
                  <div><span>Precio</span><strong>{Number.isFinite(candidate.price) ? money.format(candidate.price) : '—'}</strong></div>
                  <div><span>Desde máx. 1 año</span><strong>{pct(candidate.drawdownFromHigh)}</strong></div>
                  <div><span>Momentum 3m</span><strong>{pct(candidate.trend?.momentum3mPct)}</strong></div>
                </div>

                <div className={styles.opportunityMetrics}>
                  <div><span>Vs. media 200d</span><strong>{pct(candidate.trend?.priceVsMa200Pct)}</strong></div>
                  <div><span>Momentum 6m</span><strong>{pct(candidate.trend?.momentum6mPct)}</strong></div>
                  <div><span>Pendiente MA50</span><strong>{pct(candidate.trend?.ma50Slope20dPct)}</strong></div>
                </div>

                <div className={styles.rangeBar}>
                  <span style={{ width: `${Math.max(0, Math.min(100, candidate.rangePosition || 0))}%` }} />
                </div>
                <div className={styles.rangeLabels}>
                  <span>{Number.isFinite(candidate.low52w) ? money.format(candidate.low52w) : '—'}</span>
                  <span>rango 1 año</span>
                  <span>{Number.isFinite(candidate.high52w) ? money.format(candidate.high52w) : '—'}</span>
                </div>

                <div className={styles.opportunityThesis}>
                  <strong>Tesis</strong>
                  <p>{candidate.thesis}</p>
                  <small>Benchmark sectorial: {candidate.compareWith}</small>
                </div>

                <div className={styles.decisionBlocks}>
                  {candidate.decision.blocks.map((block) => {
                    const passed = block.score >= block.gate;
                    return (
                      <div key={block.key}>
                        <div>
                          <span>{block.label} · peso {block.weight}%</span>
                          <strong>{Math.round(block.score)}/100</strong>
                        </div>
                        <div className={styles.opportunityGateTrack}>
                          <i style={{ width: `${Math.max(0, Math.min(100, block.score))}%` }} />
                          <b style={{ left: `${block.gate}%` }} title={`Hard gate: ${block.gate}`} />
                        </div>
                        <small className={passed ? styles.gatePass : styles.gateFail}>
                          {passed ? `✓ Cumple · mín. ${block.gate}` : `✕ No cumple · mín. ${block.gate}`}
                        </small>
                      </div>
                    );
                  })}
                </div>

                <p className={styles.decisionMethod}>
                  Fundamentales al {new Date(candidate.fundamentalsUpdatedAt).toLocaleDateString('es-CL')} · {candidate.sourceLabel}
                </p>
              </article>
            ))}
          </div>

          <div className={styles.radarFooter}>
            <Icon name="info" size={16} />
            <span>
              <strong>Regla Mirror 0–100M:</strong> VOO, SMH, Global y BCH se mantienen mientras sigan justificando su función. Un candidato nuevo solo avanza si mejora claramente el retorno/riesgo esperado, aporta algo distinto, controla la duplicación con VOO/SMH y define qué posición desplaza. La tendencia decide timing y tamaño; nunca compensa una tesis o fundamentales débiles.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
