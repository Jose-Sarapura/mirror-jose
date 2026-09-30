'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function statusClass(level) {
  if (level === 'review') return styles.healthReview;
  if (level === 'watch') return styles.healthWatch;
  if (level === 'good') return styles.healthAdd;
  return styles.healthHold;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function decisionFor(ticker, gate) {
  const key = gate?.key;

  if (key === 'evaluate_protection') {
    return {
      label: 'EVALUAR TOMA PARCIAL',
      level: 'review',
      action: 'Evaluar una primera reducción de 25%. No ejecutar una salida total automática.',
      change: ticker === 'BTC'
        ? 'Si el deterioro persiste 7–14 días, revisar un segundo tramo. Si las señales se recuperan, cancelar la protección.'
        : 'Si red y estructura siguen deteriorándose 7–14 días, revisar un segundo tramo. Si se recuperan, cancelar la protección.',
    };
  }

  if (key === 'prepare') {
    return {
      label: 'PREPARAR PROTECCIÓN',
      level: 'watch',
      action: 'Mantener por ahora. Dejar definido el tramo de protección si aparece la confirmación final.',
      change: ticker === 'BTC'
        ? 'Pasa a toma parcial si la confluencia núcleo persiste y se confirma el deterioro de demanda/estructura.'
        : 'Pasa a toma parcial si red + otra señal núcleo siguen confirmadas y aparece refuerzo MVRV/ETF.',
    };
  }

  if (key === 'watch') {
    return {
      label: 'VIGILAR',
      level: 'watch',
      action: 'Mantener. No vender por una señal aislada ni por una caída de precio.',
      change: ticker === 'BTC'
        ? 'Dos señales núcleo confirmadas y persistentes activan Preparar protección.'
        : 'Dos señales núcleo confirmadas activan Preparar protección; la red es obligatoria para escalar después.',
    };
  }

  if (key === 'insufficient_data') {
    return {
      label: 'NO ACTUAR',
      level: 'watch',
      action: 'No tomar una decisión de venta con datos incompletos.',
      change: 'Esperar a que Mirror recupere las señales operativas necesarias.',
    };
  }

  return {
    label: 'MANTENER',
    level: 'good',
    action: 'Mantener posición. No tomar ganancia solo porque el precio subió o retrocedió.',
    change: ticker === 'BTC'
      ? 'Dos señales núcleo confirmadas activan Preparar protección; una confluencia persistente puede llevar a toma parcial.'
      : 'Dos señales núcleo confirmadas activan Preparar protección; para una toma parcial la red debe deteriorarse junto a otra señal y un refuerzo.',
  };
}

export default function CryptoDecisionSummary({ portfolio, ticker }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const endpoint = ticker === 'ETH' ? '/api/dashboard/eth-health' : '/api/dashboard/btc-health';

    fetch(endpoint, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setError('');
      })
      .catch(() => {
        if (active) setError('No fue posible actualizar las señales');
      });

    return () => { active = false; };
  }, [ticker]);

  const asset = useMemo(
    () => portfolio?.cryptoAssets?.find((item) => item.ticker === ticker),
    [portfolio, ticker],
  );

  const decision = decisionFor(ticker, data?.gate);
  const confirmed = ticker === 'BTC'
    ? data?.diagnostics?.confirmedRisks
    : data?.diagnostics?.coreConfirmed;

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{ticker} · Decisión Mirror</p>
          <h2>{ticker === 'BTC' ? 'Bitcoin' : 'Ethereum'}</h2>
          <span className={styles.panelSubtitle}>Primero qué hacer. El análisis completo queda disponible solo si quieres profundizar.</span>
        </div>
        <span className={statusClass(decision.level)}>{data?.gate?.label || 'Actualizando'}</span>
      </div>

      <div className={styles.healthGrid}>
        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Decisión</span><strong>{decision.label}</strong></div>
            <p>{data?.gate?.explanation || 'Mirror está actualizando las señales estructurales.'}</p>
          </div>

          <div className={styles.healthFacts}>
            <strong>Acción ahora</strong>
            <span>{decision.action}</span>
          </div>

          <div className={styles.healthFacts}>
            <strong>Condición de cambio</strong>
            <span>{decision.change}</span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Riesgo</span><strong>Muy alto</strong></div>
            <p>La volatilidad por sí sola no activa venta. Mirror exige deterioro estructural y persistencia.</p>
          </div>

          <div className={styles.healthAllocation}>
            <span>Resultado <strong>{pct(asset?.totalReturnPct)}</strong></span>
            <span>Drawdown ciclo <strong>{pct(data?.marketPeak?.drawdownPct)}</strong></span>
            <span>Señales confirmadas <strong>{Number.isFinite(confirmed) ? `${confirmed}/3` : '—'}</strong></span>
          </div>

          <div className={styles.healthFacts}>
            <strong>Regla simple</strong>
            <span>Ganancia alta no obliga a vender. Caída grande tampoco. La acción cambia cuando el régimen se deteriora de forma suficiente y confirmada.</span>
          </div>
        </article>
      </div>

      {error && (
        <div className={styles.radarFooter}>
          <Icon name="info" size={15} />
          <span>{error}. Mirror no fuerza una decisión con información incompleta.</span>
        </div>
      )}
    </section>
  );
}
