'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
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

function ruleReading(rule) {
  if (!rule) return { label: 'Sin datos', tone: 'neutral' };
  if (rule.cyclesTriggered < 2) return { label: 'Cobertura insuficiente', tone: 'neutral' };
  if (rule.falsePositives >= 3) return { label: 'Demasiado sensible', tone: 'watch' };
  if (Number.isFinite(rule.averageDamageAtTriggerPct) && rule.averageDamageAtTriggerPct <= -15) {
    return { label: 'Demasiado tardía', tone: 'danger' };
  }
  if (rule.falsePositives <= 1 && Number.isFinite(rule.averageDamageAtTriggerPct) && rule.averageDamageAtTriggerPct > -12) {
    return { label: 'Prometedora para estudiar', tone: 'good' };
  }
  return { label: 'Trade-off intermedio', tone: 'watch' };
}

function pillClass(tone) {
  if (tone === 'good') return styles.successPill;
  if (tone === 'danger') return styles.btcDangerPill;
  if (tone === 'watch') return styles.warningPill;
  return styles.neutralPill;
}

export default function BTCProfitProtectionLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-profit-protection', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible ejecutar el backtest de protección');
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

  const summary = useMemo(() => data?.summary || [], [data]);

  const oneContext = summary.filter((item) => item.context === 'any');
  const twoContexts = summary.filter((item) => item.context === 'both');

  return (
    <section className={styles.btcProfitPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Profit Protection Lab</p>
          <h2>¿Cuánto drawdown podemos tolerar antes de preparar protección?</h2>
          <span className={styles.panelSubtitle}>
            El máximo usado es siempre el máximo conocido hasta ese día. No hay look-ahead. El objetivo es minimizar dos errores: salir demasiado pronto o reaccionar demasiado tarde.
          </span>
        </div>
        <span className={styles.reviewBadge}>
          <Icon name="shield" size={15} /> No modifica reglas
        </span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Mirror no cambiará la Constitución BTC con resultados incompletos.</span>
        </div>
      )}

      <div className={styles.btcProfitMethod}>
        <div>
          <span>Drawdowns probados</span>
          <strong>-5 · -8 · -10 · -12 · -15%</strong>
          <small>Siempre desde máximo observado, no desde costo de compra.</small>
        </div>
        <div>
          <span>Contexto mínimo</span>
          <strong>MVRV ≥ 2,4 o capital débil</strong>
          <small>Una caída sola nunca constituye una salida.</small>
        </div>
        <div>
          <span>Contexto fuerte</span>
          <strong>MVRV + capital</strong>
          <small>Se prueba también exigir ambas familias simultáneamente.</small>
        </div>
        <div>
          <span>Muestra</span>
          <strong>2017 · 2021 · 2025</strong>
          <small>Sirve para descartar reglas frágiles, no para optimizar un número perfecto.</small>
        </div>
      </div>

      <div className={styles.btcProfitComparison}>
        <div className={styles.btcProfitColumn}>
          <div className={styles.btcProfitColumnTitle}>
            <p className={styles.kicker}>1 contexto</p>
            <h3>Más sensible</h3>
          </div>
          {oneContext.map((rule) => {
            const reading = ruleReading(rule);
            return (
              <article key={rule.rule}>
                <div>
                  <strong>{rule.label}</strong>
                  <span className={pillClass(reading.tone)}>{reading.label}</span>
                </div>
                <div className={styles.btcProfitMetrics}>
                  <span>Ciclos detectados <b>{rule.cyclesTriggered}/3</b></span>
                  <span>Falsos positivos <b>{rule.falsePositives}</b></span>
                  <span>Daño medio al activar <b>{pct(rule.averageDamageAtTriggerPct)}</b></span>
                  <span>Momento medio <b>{Number.isFinite(rule.averageDaysFromPeak) ? `${Math.round(rule.averageDaysFromPeak)} d` : '—'}</b></span>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.btcProfitColumn}>
          <div className={styles.btcProfitColumnTitle}>
            <p className={styles.kicker}>2 contextos</p>
            <h3>Más exigente</h3>
          </div>
          {twoContexts.map((rule) => {
            const reading = ruleReading(rule);
            return (
              <article key={rule.rule}>
                <div>
                  <strong>{rule.label}</strong>
                  <span className={pillClass(reading.tone)}>{reading.label}</span>
                </div>
                <div className={styles.btcProfitMetrics}>
                  <span>Ciclos detectados <b>{rule.cyclesTriggered}/3</b></span>
                  <span>Falsos positivos <b>{rule.falsePositives}</b></span>
                  <span>Daño medio al activar <b>{pct(rule.averageDamageAtTriggerPct)}</b></span>
                  <span>Momento medio <b>{Number.isFinite(rule.averageDaysFromPeak) ? `${Math.round(rule.averageDaysFromPeak)} d` : '—'}</b></span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className={styles.btcProfitCycles}>
        <div className={styles.btcProfitCyclesHead}>
          <span>Ciclo</span>
          <span>Máximo</span>
          <span>Regla</span>
          <span>Primera señal cerca del techo</span>
          <span>Daño al activar</span>
          <span>¿Recuperó nuevo máximo?</span>
        </div>
        {(data?.cycles || []).flatMap((cycle) =>
          (cycle.rules || [])
            .filter((rule) => ['dd8_any', 'dd10_any', 'dd12_any', 'dd10_both'].includes(rule.rule))
            .map((rule) => (
              <div className={styles.btcProfitCyclesRow} key={`${cycle.cycle}-${rule.rule}`}>
                <div><strong>{cycle.cycle}</strong><small>{cycle.peak?.date}</small></div>
                <div><strong>{usd(cycle.peak?.price)}</strong><small>MVRV {Number.isFinite(cycle.peak?.mvrv) ? Number(cycle.peak.mvrv).toFixed(2) : '—'}</small></div>
                <div><strong>{rule.label}</strong><small>{rule.falsePositives} falsos positivos previos</small></div>
                <div><strong>{rule.topTrigger?.date || 'No activó'}</strong><small>{rule.topTrigger ? `${rule.topTrigger.daysFromPeak} d desde máximo` : '—'}</small></div>
                <div><strong>{rule.topTrigger ? pct(rule.topTrigger.drawdownPct) : '—'}</strong><small>{rule.topTrigger ? usd(rule.topTrigger.price) : '—'}</small></div>
                <div>
                  <strong>{rule.topTrigger?.recovery?.recovered ? 'Sí' : (rule.topTrigger ? 'No' : '—')}</strong>
                  <small>{rule.topTrigger?.recovery?.recovered ? `en ${rule.topTrigger.recovery.days} días` : '120 días'}</small>
                </div>
              </div>
            ))
        )}
      </div>

      <div className={styles.btcProfitConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Qué estamos buscando</strong>
          <p>
            No queremos el porcentaje que “adivina” mejor el máximo. Queremos una zona de drawdown que aparezca suficientemente pronto
            para proteger patrimonio, pero que necesite contexto suficiente para no expulsarnos de correcciones normales.
            Ninguna regla de este laboratorio modifica todavía Mantener / Preparar / Proteger.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="info" size={15} />
        <span>
          <strong>Siguiente criterio:</strong> si varios umbrales ofrecen resultados similares, Mirror preferirá el más simple y conservador.
          Con solo tres ciclos no aceptaremos una precisión aparente que no pueda defenderse fuera de muestra.
        </span>
      </div>
    </section>
  );
}
