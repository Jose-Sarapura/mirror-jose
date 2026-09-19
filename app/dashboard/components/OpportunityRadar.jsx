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
    return [...data.candidates]
      .filter((candidate) => Number.isFinite(candidate.drawdownFromHigh))
      .sort((a, b) => a.drawdownFromHigh - b.drawdownFromHigh)[0] || null;
  }, [data]);

  return (
    <section className={styles.opportunityPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Laboratorio de inversión</p>
          <h2>Motor de oportunidades</h2>
          <span className={styles.panelSubtitle}><span translate="no" className="notranslate">VST, GRID y CCJ</span> están en observación; ninguno forma parte de la cartera todavía.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="target" size={15} /> Máx. 3 candidatos</span>
      </div>

      {error && <div className={styles.inlineNotice}>{error}</div>}

      {!data ? (
        <div className={styles.opportunityLoading}>Analizando precios y distancia a máximos...</div>
      ) : (
        <>
          <div className={styles.opportunitySummary}>
            <div>
              <span>Mayor alerta de precio hoy</span>
              <strong>{priority ? <><span translate="no" className="notranslate">{priority.ticker}</span>: {priority.signal.status}</> : 'Sin alertas relevantes'}</strong>
              <small>{priority?.signal?.note || 'El radar no detecta una condición de precio que requiera revisión.'}</small>
            </div>
            <div className={styles.cadenceBox}>
              <span>Frecuencia del sistema</span>
              <strong>Precio diario</strong>
              <small>Tesis semanal / por evento · fundamentales trimestrales</small>
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
                  <span className={
                    candidate.signal.level === 'review'
                      ? styles.signalReview
                      : candidate.signal.level === 'watch'
                        ? styles.signalWatch
                        : styles.signalNeutral
                  }>
                    {candidate.signal.status}
                  </span>
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
                    <span>Estado de decisión</span>
                    <b>{candidate.decision.score}/100</b>
                  </div>
                  <strong>{candidate.decision.status}</strong>
                  <small>{candidate.decision.explanation}</small>
                </div>

                <div className={styles.opportunityMetrics}>
                  <div><span>Precio</span><strong>{Number.isFinite(candidate.price) ? money.format(candidate.price) : '—'}</strong></div>
                  <div><span>Desde máx. 1 año</span><strong>{pct(candidate.drawdownFromHigh)}</strong></div>
                  <div><span>1 año</span><strong>{pct(candidate.oneYearChangePct)}</strong></div>
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
                  {candidate.decision.blocks.map((block) => (
                    <div key={block.key}>
                      <span>{block.label}</span>
                      <strong>{Math.round(block.score)}/100</strong>
                      <div><i style={{ width: `${Math.max(0, Math.min(100, block.score))}%` }} /></div>
                    </div>
                  ))}
                </div>
                <p className={styles.decisionMethod}>
                  Datos fundamentales al {new Date(candidate.fundamentalsUpdatedAt).toLocaleDateString('es-CL')} · {candidate.sourceLabel}
                </p>
              </article>
            ))}
          </div>

          <div className={styles.radarFooter}>
            <Icon name="info" size={16} />
            <span><strong>Regla Mirror:</strong> la conclusión sale de 5 bloques: valoración 25%, fundamentales/calidad 25%, riesgo 15%, encaje con cartera 20% y tesis 15%. “Candidato a incorporar” significa que supera el filtro inicial; todavía falta decidir porcentaje y fuente de financiamiento.</span>
          </div>
        </>
      )}
    </section>
  );
}
