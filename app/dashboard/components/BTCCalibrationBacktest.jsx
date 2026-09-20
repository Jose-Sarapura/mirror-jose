'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function fmtPct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function fmtUSD(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function leadLabel(signal) {
  if (!signal) return 'No apareció';
  if (signal.daysToPeak > 0) return `${signal.daysToPeak} días antes`;
  if (signal.daysToPeak < 0) return `${Math.abs(signal.daysToPeak)} días después`;
  return 'En el máximo';
}

export default function BTCCalibrationBacktest() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-backtest', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible ejecutar la validación histórica');
        const payload = await response.json();
        if (cancelled) return;
        setData(payload);
        setError(payload?.sourceStatus === 'error' ? payload.error || 'Backtest incompleto' : '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error de backtest');
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const capitalSummary = useMemo(
    () => data?.calibration?.capitalPersistence || [],
    [data],
  );

  return (
    <section className={styles.btcBacktestPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Calibration Lab</p>
          <h2>¿La Calibración V1 habría llegado a tiempo?</h2>
          <span className={styles.panelSubtitle}>
            Backtest diario para MVRV y Realized Cap. STH cost basis se valida como event study documentado porque no tenemos la serie histórica exacta de cohortes.
          </span>
        </div>
        <span className={styles.reviewBadge}>
          <Icon name="chart" size={15} /> {data?.sourceStatus === 'live-backtest' ? 'Backtest activo' : 'Validando'}
        </span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Mirror no modificará reglas con resultados incompletos.</span>
        </div>
      )}

      <div className={styles.btcBacktestMethod}>
        <div>
          <span>Backtest exacto</span>
          <strong>MVRV + Realized Cap</strong>
          <small>Serie diaria Coin Metrics</small>
        </div>
        <div>
          <span>Event study</span>
          <strong>STH cost basis</strong>
          <small>Glassnode 2021 + 2025</small>
        </div>
        <div>
          <span>No validado todavía</span>
          <strong>LTH exacto</strong>
          <small>Fuera de cualquier regla automática</small>
        </div>
      </div>

      <div className={styles.btcBacktestTable}>
        <div className={styles.btcBacktestHead}>
          <span>Ciclo</span>
          <span>Máximo</span>
          <span>MVRV 2,4</span>
          <span>MVRV 3,0</span>
          <span>Capital - 7d</span>
          <span>Capital - 14d</span>
          <span>Capital - 21d</span>
        </div>

        {(data?.cycles || []).map((cycle) => (
          <div className={styles.btcBacktestRow} key={cycle.cycle}>
            <div>
              <strong>{cycle.cycle}</strong>
              <small>{cycle.peak?.date || '—'}</small>
            </div>
            <div>
              <strong>{fmtUSD(cycle.peak?.price)}</strong>
              <small>MVRV pico {cycle.peak?.mvrv ? Number(cycle.peak.mvrv).toFixed(2) : '—'}</small>
            </div>
            <div>
              <strong>{leadLabel(cycle.mvrv?.attention24)}</strong>
              <small>{cycle.mvrv?.attention24?.date || '—'}</small>
            </div>
            <div>
              <strong>{leadLabel(cycle.mvrv?.overheated30)}</strong>
              <small>{cycle.mvrv?.overheated30?.date || '—'}</small>
            </div>
            {[cycle.capital?.negative7d, cycle.capital?.negative14d, cycle.capital?.negative21d].map((signal, index) => (
              <div key={index}>
                <strong>{leadLabel(signal)}</strong>
                <small>{signal ? `DD ${fmtPct(signal.drawdownFromPeakPct)}` : 'Sin señal'}</small>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.btcBacktestSummary}>
        {capitalSummary.map((item) => (
          <article key={item.days}>
            <span>Capital negativo · {item.days} días</span>
            <strong>{item.observations} observaciones</strong>
            <small>
              Antes del máximo: {item.beforePeak} · Después: {item.afterPeak}
              {Number.isFinite(item.averageDrawdownPct) ? ` · DD medio ${fmtPct(item.averageDrawdownPct)}` : ''}
            </small>
          </article>
        ))}
      </div>

      <div className={styles.btcEventStudy}>
        <div className={styles.btcEventStudyTitle}>
          <p className={styles.kicker}>STH cost basis · Event study</p>
          <h3>Qué nos enseñan 2021 y 2025</h3>
        </div>

        {(data?.sthEventStudy || []).map((event, index) => (
          <article key={`${event.cycle}-${index}`}>
            <div>
              <strong>{event.cycle}</strong>
              <span>{event.verdict}</span>
            </div>
            <p>{event.finding}</p>
            <small>{event.implication} · {event.source}</small>
          </article>
        ))}
      </div>

      <div className={styles.btcBacktestConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Lectura metodológica</strong>
          <p>
            {data?.calibration?.provisionalConclusion
              || 'Primero medimos cuánto tarda cada señal y cuánto patrimonio ya se habría devuelto. No se modifica la Constitución BTC hasta tener resultados completos.'}
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15} />
        <span>
          <strong>Regla:</strong> el backtest sirve para eliminar reglas malas, no para encontrar parámetros “perfectos”.
          Si un umbral solo funciona porque conocemos el pasado, Mirror no lo adopta.
        </span>
      </div>
    </section>
  );
}
