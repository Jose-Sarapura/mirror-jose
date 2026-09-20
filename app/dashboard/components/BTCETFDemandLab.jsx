'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function moneyM(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)} M`;
}

function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BTCETFDemandLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-etf-demand', { cache: 'no-store' });
        const payload = await response.json();
        if (cancelled) return;
        setData(payload);
        setError(payload?.sourceStatus === 'error' ? payload.error || 'Datos ETF incompletos' : '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error ETF');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const current = data?.current;
  const study = data?.study2025;

  return (
    <section className={styles.btcBacktestPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Independent Evidence Lab · spot/ETF</p>
          <h2>¿La demanda institucional añade confirmación útil?</h2>
          <span className={styles.panelSubtitle}>
            Flujos netos diarios de ETF spot de EE.UU. desde 2024. Es una familia de demanda distinta de MVRV, precio y Realized Cap.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="chart" size={15} /> Investigación · fuera del Gate</span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Mirror no modifica reglas con esta capa incompleta.</span>
        </div>
      )}

      <div className={styles.btcBacktestMethod}>
        <div><span>Fuente</span><strong>TFTC · open JSON</strong><small>SoSoValue + Farside + disclosures de emisores</small></div>
        <div><span>Historia disponible</span><strong>Desde 2024</strong><small>No existe para 2017/2021</small></div>
        <div><span>Uso</span><strong>Confirmación moderna</strong><small>No puede ser una regla universal de ciclo por sí sola</small></div>
      </div>

      {current && (
        <div className={styles.btcBacktestSummary}>
          <article><span>Último día</span><strong>{moneyM(current.latestDailyFlowUSDm)}</strong><small>{current.asOf}</small></article>
          <article><span>Flujo 5 sesiones</span><strong>{moneyM(current.flow5dUSDm)}</strong><small>Demanda muy reciente</small></article>
          <article><span>Flujo 20 sesiones</span><strong>{moneyM(current.flow20dUSDm)}</strong><small>{current.negativeDays20} días negativos</small></article>
          <article><span>Flujo 60 sesiones</span><strong>{moneyM(current.flow60dUSDm)}</strong><small>Contexto de demanda</small></article>
        </div>
      )}

      {study && (
        <div className={styles.btcEventStudy}>
          <div className={styles.btcEventStudyTitle}>
            <p className={styles.kicker}>Event study · máximo 2025</p>
            <h3>Demanda ETF alrededor del techo moderno</h3>
          </div>
          <article>
            <div><strong>Máximo BTC</strong><span>{study.peak?.date || '—'}</span></div>
            <p>{usd(study.peak?.price)}</p>
            <small>Máximo de precio identificado con Coin Metrics.</small>
          </article>
          <article>
            <div><strong>ETF 20 sesiones</strong><span>{study.flowAtPeak?.date || '—'}</span></div>
            <p>{moneyM(study.flowAtPeak?.rolling20USDm)}</p>
            <small>{study.flowAtPeak ? `${study.flowAtPeak.negativeDays20} sesiones negativas de 20` : 'Sin dato ETF'}</small>
          </article>
          <article>
            <div><strong>ETF 60 sesiones</strong><span>contexto</span></div>
            <p>{moneyM(study.flowAtPeak?.rolling60USDm)}</p>
            <small>Sirve para comparar demanda acumulada, no para fijar un gatillo.</small>
          </article>
        </div>
      )}

      <div className={styles.btcBacktestConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Regla metodológica</strong>
          <p>
            Esta familia puede mejorar la lectura de demanda desde 2024, pero no puede validarse en 2017/2021.
            Por eso podrá actuar como confirmación complementaria del régimen moderno, nunca como gatillo único de salida.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15} />
        <span><strong>Sin cambio operativo:</strong> primero observamos si el deterioro ETF acompaña el cambio de régimen de 2025 y el estado actual. Recién después decidimos si merece entrar al Health Gate.</span>
      </div>
    </section>
  );
}
