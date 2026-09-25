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
  if (state === 'confirmed') return styles.trendConfirmed;
  if (state === 'stabilizing') return styles.trendStabilizing;
  if (state === 'downtrend') return styles.trendDown;
  return styles.signalNeutral;
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

  return (
    <section className={styles.opportunityPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Laboratorio de inversión</p>
          <h2>Motor de oportunidades</h2>
          <span className={styles.panelSubtitle}>
            <span translate="no" className="notranslate">VST, GRID y CCJ</span> se evalúan en dos capas: calidad de oportunidad y timing de entrada.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="target" size={15} /> Máx. 3 candidatos</span>
      </div>

      {error && <div className={styles.inlineNotice}>{error}</div>}

      {!data ? (
        <div className={styles.opportunityLoading}>Analizando calidad, valoración, tendencia y momentum...</div>
      ) : (
        <>
          <div className={styles.opportunitySummary}>
            <div>
              <span>Mejor candidato estructural hoy</span>
              <strong>
                {priority ? <><span translate="no" className="notranslate">{priority.ticker}</span>: {priority.decision.status}</> : 'Sin candidato calificado'}
              </strong>
              <small>
                {priority
                  ? `${priority.decision.score}/100 en calidad · timing ${priority.trend?.score ?? '—'}/100 · ${priority.decision.entryPlan?.size || 'sin tramo definido'}`
                  : 'Ningún activo supera todavía los filtros obligatorios.'}
              </small>
            </div>
            <div className={styles.cadenceBox}>
              <span>Regla central</span>
              <strong>Caída ≠ oportunidad</strong>
              <small>Primero calidad/valoración; después tendencia y tamaño de entrada.</small>
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

                <div className={styles.entryTimingBox}>
                  <div className={styles.entryTimingHead}>
                    <div>
                      <span>Timing de entrada</span>
                      <strong>{candidate.decision.entryPlan?.label || 'Sin plan'}</strong>
                    </div>
                    <b>{candidate.trend?.score ?? '—'}/100</b>
                  </div>
                  <div className={styles.entryPlanRow}>
                    <span>Tramo</span>
                    <strong>{candidate.decision.entryPlan?.size || '—'}</strong>
                  </div>
                  <p>{candidate.decision.entryPlan?.explanation || candidate.trend?.note}</p>
                </div>

                <div className={styles.opportunityMetricsFour}>
                  <div><span>Precio</span><strong>{Number.isFinite(candidate.price) ? money.format(candidate.price) : '—'}</strong></div>
                  <div><span>Desde máx. 1 año</span><strong>{pct(candidate.drawdownFromHigh)}</strong></div>
                  <div><span>Momentum 3m</span><strong>{pct(candidate.trend?.momentum3mPct)}</strong></div>
                  <div><span>Vs. media 200d</span><strong>{pct(candidate.trend?.priceVsMa200Pct)}</strong></div>
                </div>

                <div className={styles.trendDetailGrid}>
                  <div><span>Momentum 1m</span><strong>{pct(candidate.trend?.momentum1mPct)}</strong></div>
                  <div><span>Momentum 6m</span><strong>{pct(candidate.trend?.momentum6mPct)}</strong></div>
                  <div><span>Pendiente MA50</span><strong>{pct(candidate.trend?.ma50Slope20dPct)}</strong></div>
                  <div><span>Mínimo 20d</span><strong>{candidate.trend?.higherLow20 ? 'Mejorando' : 'Sin confirmar'}</strong></div>
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
                  <small>Comparar con: {candidate.compareWith}</small>
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
              <strong>Regla Mirror:</strong> valoración, fundamentales/calidad, riesgo, encaje y tesis deciden si el activo merece ser comprado. La tendencia NO es un hard gate: define el timing y el tamaño inicial. Tendencia bajista + hard gates superados = oportunidad anticipada con entrada parcial, no descarte automático.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
