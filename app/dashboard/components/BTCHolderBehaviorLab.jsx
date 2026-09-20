'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

function pp(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)} pp`;
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

function timing(daysBeforePeak) {
  const n = Number(daysBeforePeak);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `${n} días antes`;
  if (n < 0) return `${Math.abs(n)} días después`;
  return 'En el máximo';
}

export default function BTCHolderBehaviorLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-holder-behavior', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible validar comportamiento de holders');
        const payload = await response.json();
        if (cancelled) return;
        setData(payload);
        setError(payload?.sourceStatus === 'error' ? payload.error || 'Validación incompleta' : '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error de validación');
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const current = data?.current;

  return (
    <section className={styles.btcBacktestPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Independent Evidence Lab · holders</p>
          <h2>¿La oferta dormida añade una señal realmente distinta?</h2>
          <span className={styles.panelSubtitle}>
            Mirror prueba una cuarta familia con 1 Year Active Supply %: movimiento de monedas por edad, no valoración ni simple caída de precio.
          </span>
        </div>
        <span className={styles.reviewBadge}>
          <Icon name="brain" size={15} /> Investigación · fuera del Gate
        </span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Esta capa no modifica ninguna regla de salida.</span>
        </div>
      )}

      {data?.sourceStatus === 'holder-data-unavailable' && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>
            Coin Metrics Community devolvió precios, pero no la serie de 1 Year Active Supply %. Mirror no utilizará un proxy incompleto ni inventará una señal.
          </span>
        </div>
      )}

      <div className={styles.btcBacktestMethod}>
        <div>
          <span>Familia</span>
          <strong>Comportamiento de holders</strong>
          <small>Edad / movimiento de oferta</small>
        </div>
        <div>
          <span>Métrica</span>
          <strong>1 Year Active Supply %</strong>
          <small>Oferta que se movió dentro de los últimos 12 meses</small>
        </div>
        <div>
          <span>Uso</span>
          <strong>Proxy, no LTH exacto</strong>
          <small>No identifica personas ni usa todavía el corte LTH de 155 días</small>
        </div>
      </div>

      {current && (
        <div className={styles.btcBacktestSummary}>
          <article>
            <span>Oferta activa 1 año</span>
            <strong>{pct(current.active1yPct)}</strong>
            <small>Dato al {current.asOf}</small>
          </article>
          <article>
            <span>Oferta inactiva &gt;1 año · proxy</span>
            <strong>{pct(current.inactive1yPct)}</strong>
            <small>100% − oferta activa 1 año</small>
          </article>
          <article>
            <span>Cambio 30 días</span>
            <strong>{pp(current.active30dDeltaPp)}</strong>
            <small>Reactivación o dormancia reciente</small>
          </article>
          <article>
            <span>Cambio 90 días</span>
            <strong>{pp(current.active90dDeltaPp)}</strong>
            <small>{current.direction90d}</small>
          </article>
        </div>
      )}

      <div className={styles.btcBacktestTable}>
        <div className={styles.btcBacktestHead}>
          <span>Ciclo</span>
          <span>Máximo</span>
          <span>Activa 1y en máximo</span>
          <span>Inactiva &gt;1y</span>
          <span>Δ 90d en máximo</span>
          <span>Mayor reactivación previa</span>
          <span>Timing</span>
        </div>

        {(data?.cycles || []).map((cycle) => (
          <div className={styles.btcBacktestRow} key={cycle.cycle}>
            <div>
              <strong>{cycle.cycle}</strong>
              <small>{cycle.status === 'ok' ? 'Serie disponible' : 'Sin serie holder'}</small>
            </div>
            <div>
              <strong>{usd(cycle.peak?.price)}</strong>
              <small>{cycle.peak?.date || '—'}</small>
            </div>
            <div>
              <strong>{pct(cycle.holderAtPeak?.active1yPct)}</strong>
              <small>Oferta movida ≤1 año</small>
            </div>
            <div>
              <strong>{pct(cycle.holderAtPeak?.inactive1yPct)}</strong>
              <small>Proxy oferta dormida &gt;1 año</small>
            </div>
            <div>
              <strong>{pp(cycle.holderAtPeak?.active90dDeltaPp)}</strong>
              <small>Variación en puntos porcentuales</small>
            </div>
            <div>
              <strong>{pp(cycle.strongestPrePeakReactivation?.active90dDeltaPp)}</strong>
              <small>{cycle.strongestPrePeakReactivation?.date || '—'}</small>
            </div>
            <div>
              <strong>{timing(cycle.strongestPrePeakReactivation?.daysBeforePeak)}</strong>
              <small>Respecto del máximo del ciclo</small>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.btcBacktestConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Qué buscamos antes de convertirlo en regla</strong>
          <p>
            Primero queremos comprobar si la reactivación de oferta dormida aporta información consistente en 2017, 2021 y 2025.
            Solo después evaluaremos persistencia y falsos positivos. No fijaremos un umbral de venta porque “funcione” en una sola ventana histórica.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15} />
        <span>
          <strong>Guardrail:</strong> esta capa todavía no autoriza reducir BTC. Si el proxy de holders no resulta robusto, la siguiente familia será demanda spot/ETF como evidencia complementaria, no otro ajuste del drawdown.
        </span>
      </div>
    </section>
  );
}
