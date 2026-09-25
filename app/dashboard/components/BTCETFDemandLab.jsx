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
            Demanda ETF en vivo + estudio documentado del máximo 2025. Buscamos confirmación de régimen, no otro gatillo automático.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="chart" size={15} /> Confirmación secundaria</span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Mirror no modifica reglas con esta capa incompleta.</span>
        </div>
      )}

      <div className={styles.btcBacktestMethod}>
        <div><span>Dato vivo</span><strong>Axel Adler Jr.</strong><small>BTC US ETF Flow Monitor</small></div>
        <div><span>Estudio histórico</span><strong>Farside Investors</strong><small>Máximo 2025 y deterioro posterior</small></div>
        <div><span>Uso</span><strong>Confirmación moderna</strong><small>No existe para 2017/2021</small></div>
      </div>

      {current && (
        <div className={styles.btcBacktestSummary}>
          <article><span>Último día</span><strong>{moneyM(current.latestDailyFlowUSDm)}</strong><small>{current.asOf || '—'}</small></article>
          <article><span>Última semana</span><strong>{moneyM(current.flow5dUSDm)}</strong><small>Demanda agregada reciente</small></article>
          <article><span>Flujo acumulado</span><strong>{moneyM(current.allTimeFlowUSDm)}</strong><small>Desde enero 2024</small></article>
          <article><span>BTC vs basis ETF</span><strong>{Number.isFinite(current.btcVsEtfBasisPct) ? `${current.btcVsEtfBasisPct.toFixed(1)}%` : '—'}</strong><small>{current.etfRealizedPriceUSD ? `Basis ETF ${usd(current.etfRealizedPriceUSD)}` : 'Contexto de posicionamiento'}</small></article>
        </div>
      )}

      {study && (
        <div className={styles.btcEventStudy}>
          <div className={styles.btcEventStudyTitle}>
            <p className={styles.kicker}>Event study · máximo 2025</p>
            <h3>ETF no anticipó el techo; confirmó después</h3>
          </div>
          <article>
            <div><strong>Máximo BTC</strong><span>{study.peak?.date || '—'}</span></div>
            <p>{usd(study.peak?.priceUSD)}</p>
            <small>Máximo usado por Mirror para el estudio 2025.</small>
          </article>
          <article>
            <div><strong>ETF en el máximo</strong><span>{study.peak?.date || '—'}</span></div>
            <p>{moneyM(study.atPeak?.dailyFlowUSDm)}</p>
            <small>{study.atPeak?.reading || '—'}</small>
          </article>
          <article>
            <div><strong>Después del máximo</strong><span>deterioro</span></div>
            <p>{study.afterPeak?.filter((item) => item.flowUSDm < 0).length || 0} sesiones negativas destacadas</p>
            <small>{study.conclusion || '—'}</small>
          </article>
        </div>
      )}

      <div className={styles.btcBacktestConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Regla metodológica</strong>
          <p>
            El estudio 2025 indica que ETF no anticipó el máximo: la demanda seguía fuerte en el techo y se deterioró después.
            En el Health Gate V3 solo se confirma debilidad ETF cuando la semana es negativa y BTC está bajo el ETF realized price. Nunca actúa sola.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15} />
        <span><strong>Uso operativo limitado:</strong> ETF ya puede reforzar una confluencia de ≥2 señales núcleo, pero no puede iniciar Preparar protección ni una venta por sí sola.</span>
      </div>
    </section>
  );
}
