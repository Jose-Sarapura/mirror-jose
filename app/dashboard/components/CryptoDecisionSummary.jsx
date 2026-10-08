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
      label: 'EVALUAR TOMA PARCIAL · 25%',
      level: 'review',
      action: 'Evaluar vender 25% de la posición. No ejecutar una salida total automática.',
      change: ticker === 'BTC'
        ? 'Si el deterioro persiste 7–14 días, evaluar un segundo 25%. Mantener el 50% restante salvo invalidación estructural.'
        : 'Si red y estructura siguen deteriorándose 7–14 días, evaluar un segundo 25%. Mantener el 50% restante salvo deterioro estructural prolongado.',
      first: '25%',
      second: '25%',
      reserve: '50%',
    };
  }

  if (key === 'prepare') {
    return {
      label: 'PREPARAR PROTECCIÓN · 25%',
      level: 'watch',
      action: 'NO VENDER AÚN. Dejar preparado un primer tramo equivalente al 25% de la posición.',
      change: ticker === 'BTC'
        ? 'Si aparece la confirmación final de deterioro, pasa a EVALUAR TOMA PARCIAL y el primer tramo a considerar es 25%.'
        : 'Si red + otra señal núcleo siguen confirmadas y aparece refuerzo MVRV/ETF, pasa a EVALUAR TOMA PARCIAL por 25%.',
      first: '25%',
      second: '25%',
      reserve: '50%',
    };
  }

  if (key === 'watch') {
    return {
      label: 'VIGILAR · 0% VENTA',
      level: 'watch',
      action: 'Mantener. No vender por una señal aislada ni por una caída de precio.',
      change: ticker === 'BTC'
        ? 'Dos señales núcleo confirmadas y persistentes activan PREPARAR PROTECCIÓN con un primer tramo potencial de 25%.'
        : 'Dos señales núcleo confirmadas activan PREPARAR PROTECCIÓN con un primer tramo potencial de 25%; la red es obligatoria para escalar después.',
      first: '0%',
      second: '—',
      reserve: '100%',
    };
  }

  if (key === 'insufficient_data') {
    return {
      label: 'NO ACTUAR · 0% VENTA',
      level: 'watch',
      action: 'No tomar una decisión de venta con datos incompletos.',
      change: 'Esperar a que Mirror recupere las señales operativas necesarias.',
      first: '0%',
      second: '—',
      reserve: '100%',
    };
  }

  return {
    label: 'MANTENER · 0% VENTA',
    level: 'good',
    action: 'Mantener posición. No tomar ganancia solo porque el precio subió o retrocedió.',
    change: ticker === 'BTC'
      ? 'Dos señales núcleo confirmadas activan PREPARAR PROTECCIÓN. Ahí se deja listo un primer tramo potencial de 25%.'
      : 'Dos señales núcleo confirmadas activan PREPARAR PROTECCIÓN. Para vender 25%, la red debe deteriorarse junto a otra señal y un refuerzo.',
    first: '0%',
    second: '—',
    reserve: '100%',
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
          <span className={styles.panelSubtitle}>Qué hacer ahora, cuánto se protegería y qué tendría que pasar para cambiar de estado.</span>
        </div>
        <span className={statusClass(decision.level)}>{decision.label}</span>
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

          <div className={styles.healthAllocation}>
            <span>Primer tramo <strong>{decision.first}</strong></span>
            <span>Segundo tramo <strong>{decision.second}</strong></span>
            <span>Reserva <strong>{decision.reserve}</strong></span>
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
            <strong>Escalera simple</strong>
            <span>MANTENER = vender 0% · VIGILAR = vender 0% · PREPARAR = dejar listo 25%, sin vender · TOMA PARCIAL = evaluar vender 25%.</span>
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
