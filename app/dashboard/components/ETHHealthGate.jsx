'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function fmt(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function moneyUSD(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function pill(signal) {
  if (signal?.tone === 'danger') return styles.btcDangerPill;
  if (signal?.tone === 'watch') return styles.warningPill;
  if (signal?.tone === 'good') return styles.successPill;
  return styles.neutralPill;
}

export default function ETHHealthGate() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/eth-health', { cache: 'no-store' });
        const payload = await response.json();
        if (cancelled) return;
        setData(payload);
        setError(payload?.sourceStatus === 'fallback' ? 'Datos ETH incompletos' : '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error ETH');
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const signals = data?.signals || {};

  return (
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>ETH Health Gate · V1</p>
          <h2>Red + capital + estructura relativa</h2>
          <span className={styles.panelSubtitle}>
            ETH no copia a BTC: la actividad de red es obligatoria para escalar a Protección a evaluar. MVRV y ETF actúan como contexto/refuerzo.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> {data?.gate?.label || 'Actualizando'}</span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Mirror no fuerza una señal de salida.</span>
        </div>
      )}

      <div className={styles.btcHealthSignalGrid}>
        <article>
          <div className={styles.btcHealthSignalTop}>
            <div><strong>Capital</strong><small>Realized Cap</small></div>
            <span className={pill(signals.capital)}>{signals.capital?.status || 'Actualizando'}</span>
          </div>
          <div className={styles.btcLiveMetric}><span>Cambio 30 días</span><strong>{fmt(signals.capital?.change30dPct, 2)}%</strong></div>
          <p>Confirma deterioro si la contracción persiste al menos 14 días.</p>
          <small className={styles.btcHealthUse}>{signals.capital?.sourceLabel || 'Coin Metrics'}</small>
        </article>

        <article>
          <div className={styles.btcHealthSignalTop}>
            <div><strong>Actividad de red</strong><small>Uso económico</small></div>
            <span className={pill(signals.network)}>{signals.network?.status || 'Actualizando'}</span>
          </div>
          <div className={styles.btcLiveMetric}><span>Familias débiles</span><strong>{signals.network?.weakCount ?? '—'}/3</strong></div>
          <p>Direcciones activas {fmt(signals.network?.active30dChangePct)}% · fees {fmt(signals.network?.fee30dChangePct)}% · valor transferido {fmt(signals.network?.transfer30dChangePct)}%.</p>
          <small className={styles.btcHealthUse}>{signals.network?.sourceLabel || 'Coin Metrics'}</small>
        </article>

        <article>
          <div className={styles.btcHealthSignalTop}>
            <div><strong>Estructura ETH/BTC</strong><small>Fuerza relativa</small></div>
            <span className={pill(signals.relative)}>{signals.relative?.status || 'Actualizando'}</span>
          </div>
          <div className={styles.btcLiveMetric}><span>Vs media 90d</span><strong>{fmt(signals.relative?.distancePct)}%</strong></div>
          <p>Ayuda a distinguir debilidad específica de ETH de una caída general del mercado cripto.</p>
          <small className={styles.btcHealthUse}>{signals.relative?.sourceLabel || 'Coin Metrics'}</small>
        </article>

        <article>
          <div className={styles.btcHealthSignalTop}>
            <div><strong>Valoración MVRV</strong><small>Contexto</small></div>
            <span className={pill(signals.valuation)}>{signals.valuation?.status || 'Actualizando'}</span>
          </div>
          <div className={styles.btcLiveMetric}><span>MVRV · percentil 760d</span><strong>{fmt(signals.valuation?.value, 2)} · {fmt(signals.valuation?.percentile, 0)}%</strong></div>
          <p>No usa un umbral BTC. ETH se compara con su propia distribución reciente.</p>
          <small className={styles.btcHealthUse}>{signals.valuation?.sourceLabel || 'Coin Metrics'}</small>
        </article>
      </div>

      <div className={styles.btcHealthDataQuality}>
        <div><span>Núcleo confirmado</span><strong>{data?.diagnostics?.coreConfirmed ?? '—'}/3</strong><small>Capital · red · ETH/BTC</small></div>
        <div><span>ETF ETH</span><strong>{signals.etf?.status || 'Sin dato'}</strong><small>{signals.etf?.asOf || 'Fuente secundaria'}</small></div>
        <div><span>Precio ETH</span><strong>{moneyUSD(data?.priceUSD)}</strong><small>{data?.asOf || '—'}</small></div>
        <div><span>Regla clave</span><strong>Red obligatoria</strong><small>Sin deterioro de red no escala a Protección a evaluar</small></div>
      </div>

      <div className={styles.btcHealthStages}>
        <article className={data?.gate?.key === 'maintain' || data?.gate?.key === 'watch' ? styles.btcStageActive : ''}>
          <span>🟢 Mantener / vigilancia</span><strong>0–1 señal núcleo</strong><p>No vender por precio o MVRV aislado.</p>
        </article>
        <article className={data?.gate?.key === 'prepare' ? styles.btcStageActive : ''}>
          <span>🟡 Preparar protección</span><strong>≥2 señales núcleo</strong><p>Se prepara el plan, sin venta automática.</p>
        </article>
        <article className={data?.gate?.key === 'evaluate_protection' ? styles.btcStageActive : ''}>
          <span>🟠 Protección a evaluar</span><strong>Red + otra núcleo + refuerzo</strong><p>Refuerzo = MVRV alto o ETF débil.</p>
        </article>
        <article>
          <span>🔴 Salida mayor</span><strong>Invalidación de tesis</strong><p>Exige deterioro estructural prolongado de red y adopción.</p>
        </article>
      </div>

      <div className={styles.btcHealthCurrent}>
        <div><p className={styles.kicker}>Lectura automática ETH</p><h3>{data?.gate?.label || 'Actualizando'}</h3></div>
        <p>{data?.gate?.explanation || 'Mirror está cargando las señales ETH.'}</p>
      </div>
    </section>
  );
}
