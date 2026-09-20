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

function pillClass(label) {
  if (label === 'Candidata a estudiar') return styles.successPill;
  if (label === 'Demasiado tardía') return styles.btcDangerPill;
  if (label === 'Demasiado sensible' || label === 'Trade-off intermedio') return styles.warningPill;
  return styles.neutralPill;
}

function confirmationLabel(type) {
  if (type === 'dual_confirmation') return 'Capital + precio';
  if (type === 'capital_7d_negative') return 'Capital 7d negativo';
  if (type === 'capital_7d_deterioration') return 'Capital 7d deteriora';
  if (type === 'price_deeper_4pp') return 'Drawdown profundiza +4 pp';
  if (type === 'price_below_3d') return '3 cierres bajo umbral';
  if (type === 'capital_negative') return 'Capital 30d negativo';
  if (type === 'capital_weak_7d') return 'Capital débil 7d';
  return '—';
}

export default function BTCProfitProtectionLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-profit-protection', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible ejecutar el backtest secuencial');
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

  const candidates = useMemo(() => {
    const sorted = [...summary].sort((a, b) => {
      if (a.cyclesTriggered !== b.cyclesTriggered) return b.cyclesTriggered - a.cyclesTriggered;
      if (a.falsePositives !== b.falsePositives) return a.falsePositives - b.falsePositives;
      const aDamage = Number.isFinite(a.averageDamageAtConfirmationPct) ? a.averageDamageAtConfirmationPct : -999;
      const bDamage = Number.isFinite(b.averageDamageAtConfirmationPct) ? b.averageDamageAtConfirmationPct : -999;
      return bDamage - aDamage;
    });

    const preferred = sorted.filter((item) => item.classification === 'Candidata a estudiar');
    if (preferred.length) return preferred.slice(0, 6);

    const multiCycle = sorted.filter((item) => item.cyclesTriggered >= 2);
    if (multiCycle.length) return multiCycle.slice(0, 6);

    // Si ninguna regla llega a 2/3 ciclos, no ocultamos el resultado:
    // mostramos las mejores combinaciones solo para diagnóstico.
    return sorted.slice(0, 6);
  }, [summary]);

  const qualifiedCount = useMemo(
    () => summary.filter((item) => item.cyclesTriggered >= 2).length,
    [summary],
  );

  const selectedKeys = new Set(candidates.slice(0, 4).map((item) => item.key));

  return (
    <section className={styles.btcProfitPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Profit Protection Lab · V2.2</p>
          <h2>Contexto → drawdown → doble confirmación</h2>
          <span className={styles.panelSubtitle}>
            V2 fue demasiado lento y V2.1.1 demasiado sensible. V2.2 exige deterioro de capital y de estructura de precio dentro de la misma ventana, sin obligarlos a coincidir el mismo día.
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

      <div className={styles.btcSequenceFlow}>
        <article>
          <span>1</span>
          <div>
            <strong>Contexto previo</strong>
            <p>MVRV ≥ 2,4 o capital débil durante los 30/60 días anteriores.</p>
          </div>
        </article>
        <i>→</i>
        <article>
          <span>2</span>
          <div>
            <strong>Evento</strong>
            <p>BTC cruza -8%, -10% o -12% desde el máximo conocido hasta ese día.</p>
          </div>
        </article>
        <i>→</i>
        <article>
          <span>3</span>
          <div>
            <strong>Doble confirmación posterior</strong>
            <p>Deben aparecer capital relativo deteriorado y estructura de precio deteriorada dentro de 7/14/21 días.</p>
          </div>
        </article>
      </div>

      <div className={styles.btcProfitMethod}>
        <div>
          <span>Contexto previo</span>
          <strong>30 o 60 días</strong>
          <small>No necesita seguir activo el día exacto del drawdown.</small>
        </div>
        <div>
          <span>Drawdown probado</span>
          <strong>-8 · -10 · -12%</strong>
          <small>Desde máximo observado, nunca desde costo de compra.</small>
        </div>
        <div>
          <span>Confirmación</span>
          <strong>7 · 14 · 21 días</strong>
          <small>La señal se confirma cuando aparece la segunda familia; no tienen que ocurrir el mismo día.</small>
        </div>
        <div>
          <span>Falso positivo</span>
          <strong>Luego recupera ATH</strong>
          <small>Ventana ampliada a 270 días para capturar el doble techo de 2021.</small>
        </div>
      </div>

      <div className={styles.btcSequenceCandidates}>
        <div className={styles.btcProfitColumnTitle}>
          <p className={styles.kicker}>Candidatas para inspección</p>
          <h3>No es un ranking definitivo</h3>
        </div>

        {data?.diagnostics && (
          <div className={styles.cryptoGuardrail}>
            <Icon name="info" size={15} />
            <span>
              <strong>Diagnóstico V2.2:</strong> {data.diagnostics.rowCount} precios · {data.diagnostics.validMvrvRows} filas MVRV · {data.diagnostics.validRealizedCapRows} filas de capital realizado · {data.diagnostics.combinationsTested} combinaciones de doble confirmación. Controles preservados: V2 {data.diagnostics.legacyV2Combinations} combinaciones ({data.diagnostics.legacyV2WithTwoOrMoreCycles} con cobertura ≥2/3) · V2.1.1 {data.diagnostics.legacyV21Combinations} combinaciones ({data.diagnostics.legacyV21WithTwoOrMoreCycles} con cobertura ≥2/3).
            </span>
          </div>
        )}

        {summary.length > 0 && qualifiedCount === 0 && (
          <div className={styles.cryptoGuardrail}>
            <Icon name="info" size={15} />
            <span>
              <strong>El backtest V2.2 sí devolvió resultados.</strong> Si ninguna combinación alcanza al menos 2 de 3 ciclos, las seis que aparecen abajo se muestran solo para diagnóstico y no son candidatas de salida.
            </span>
          </div>
        )}

        <div className={styles.btcSequenceCandidateGrid}>
          {candidates.map((rule) => (
            <article key={rule.key}>
              <div className={styles.btcSequenceCandidateTop}>
                <strong>{rule.label}</strong>
                <span className={pillClass(rule.classification)}>{rule.classification}</span>
              </div>
              <div className={styles.btcProfitMetrics}>
                <span>Ciclos detectados <b>{rule.cyclesTriggered}/3</b></span>
                <span>Falsos positivos <b>{rule.falsePositives}</b></span>
                <span>Daño medio <b>{pct(rule.averageDamageAtConfirmationPct)}</b></span>
                <span>Peor daño <b>{pct(rule.worstDamageAtConfirmationPct)}</b></span>
              </div>
            </article>
          ))}
          {!candidates.length && (
            <article>
              <strong>Esperando resultados</strong>
              <p>El backtest secuencial todavía no ha devuelto combinaciones comparables.</p>
            </article>
          )}
        </div>
      </div>

      <div className={styles.btcProfitCycles}>
        <div className={styles.btcSequenceCyclesHead}>
          <span>Ciclo</span>
          <span>Máximo</span>
          <span>Secuencia</span>
          <span>Contexto</span>
          <span>Drawdown</span>
          <span>Confirmación</span>
          <span>Daño al confirmar</span>
        </div>

        {(data?.cycles || []).flatMap((cycle) =>
          (cycle.rules || [])
            .filter((rule) => selectedKeys.has(rule.key))
            .map((rule) => (
              <div className={styles.btcSequenceCyclesRow} key={`${cycle.cycle}-${rule.key}`}>
                <div><strong>{cycle.cycle}</strong><small>{cycle.peak?.date}</small></div>
                <div><strong>{usd(cycle.peak?.price)}</strong><small>MVRV {Number.isFinite(cycle.peak?.mvrv) ? Number(cycle.peak.mvrv).toFixed(2) : '—'}</small></div>
                <div><strong>{rule.label}</strong><small>{rule.falsePositives} falsos positivos</small></div>
                <div><strong>{rule.topTrigger?.contextDate || '—'}</strong><small>ventana previa</small></div>
                <div><strong>{rule.topTrigger?.eventDate || 'No activó'}</strong><small>{rule.topTrigger ? pct(rule.topTrigger.eventDrawdownPct) : '—'}</small></div>
                <div><strong>{rule.topTrigger?.confirmDate || '—'}</strong><small>{confirmationLabel(rule.topTrigger?.confirmationType)}</small></div>
                <div><strong>{rule.topTrigger ? pct(rule.topTrigger.damageAtConfirmationPct) : '—'}</strong><small>{rule.topTrigger ? `${rule.topTrigger.daysFromPeak} d desde máximo` : '—'}</small></div>
              </div>
            ))
        )}
      </div>

      <div className={styles.btcProfitConclusion}>
        <Icon name="target" size={15} />
        <div>
          <strong>Qué debe demostrar V2.2</strong>
          <p>
            La doble confirmación debe conservar cobertura de al menos dos ciclos y reducir de forma material los falsos positivos de V2.1.1 sin volver al retraso del V2 original.
            Si el ruido baja pero el daño al confirmar vuelve a ser excesivo, también se descarta.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="info" size={15} />
        <span>
          <strong>Regla metodológica:</strong> este laboratorio puede descartar parámetros, pero todavía no autoriza vender BTC.
          La eventual Constitución de salida exigirá además tesis, estructura y plan de reentrada.
        </span>
      </div>
    </section>
  );
}
