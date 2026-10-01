'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const CONCLUSION_MARKER = 'mirror-v3-btc-profit-protection-conclusion-v1';

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

function bestByCoverage(summary, minimumCycles = 3) {
  return [...(summary || [])]
    .filter((item) => item.cyclesTriggered >= minimumCycles)
    .sort((a, b) => {
      if (a.falsePositives !== b.falsePositives) return a.falsePositives - b.falsePositives;
      const aDamage = Number.isFinite(a.averageDamageAtConfirmationPct) ? a.averageDamageAtConfirmationPct : -999;
      const bDamage = Number.isFinite(b.averageDamageAtConfirmationPct) ? b.averageDamageAtConfirmationPct : -999;
      return bDamage - aDamage;
    })[0] || null;
}

function seedLabConclusion(data) {
  if (typeof window === 'undefined' || !data?.summary?.length) return;
  if (localStorage.getItem(CONCLUSION_MARKER) === 'seeded') return;

  const existing = readDecisionLog(localStorage);
  const id = 'btc-profit-protection-lab-conclusion-v1';

  if (!existing.some((entry) => entry.id === id)) {
    const v22Full = bestByCoverage(data.summary, 3);
    const v22Two = bestByCoverage(data.summary, 2);
    const v21Full = bestByCoverage(data.legacyV21?.summary, 3);

    appendDecisionLog(localStorage, {
      id,
      date: new Date().toISOString().slice(0, 10),
      type: 'no_action',
      asset: 'BTC',
      ruleId: 'btc-profit-protection-lab',
      ruleTitle: 'Ninguna regla del Profit Protection Lab entra al BTC Health Gate',
      decision: 'No adoptar V2, V2.1.1 ni V2.2 como regla de salida de BTC',
      reason: 'V2 confirmó demasiado tarde; V2.1.1 redujo el daño pero produjo demasiados falsos positivos; V2.2 exigió doble confirmación y el ruido siguió siendo alto o la cobertura cayó al endurecer el drawdown.',
      evidence: [
        `V2: ${data.diagnostics?.legacyV2WithTwoOrMoreCycles ?? 0} combinaciones con cobertura >=2/3.`,
        v21Full ? `V2.1.1 mejor cobertura 3/3: ${v21Full.falsePositives} falsos positivos; daño medio ${pct(v21Full.averageDamageAtConfirmationPct)}.` : 'V2.1.1: sin regla robusta.',
        v22Full ? `V2.2 mejor cobertura 3/3: ${v22Full.falsePositives} falsos positivos; daño medio ${pct(v22Full.averageDamageAtConfirmationPct)}.` : 'V2.2: sin cobertura 3/3.',
        v22Two ? `V2.2 mejor cobertura >=2/3: ${v22Two.falsePositives} falsos positivos; daño medio ${pct(v22Two.averageDamageAtConfirmationPct)}.` : '',
      ].filter(Boolean).join(' '),
      source: 'btc-profit-protection-lab',
      reviewStatus: 'reviewed',
      reviewNote: 'Laboratorio cerrado sin promover parámetros. El drawdown sigue activando revisión, no venta. La próxima mejora debe venir de una familia de evidencia realmente independiente y con datos históricos válidos.',
    });
  }

  localStorage.setItem(CONCLUSION_MARKER, 'seeded');
  window.dispatchEvent(new Event('mirror-decision-log-updated'));
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

  useEffect(() => {
    if (data?.sourceStatus === 'live-backtest-v2-2' && data?.summary?.length) {
      seedLabConclusion(data);
    }
  }, [data]);

  const labComparison = useMemo(() => ({
    v2Qualified: data?.diagnostics?.legacyV2WithTwoOrMoreCycles ?? 0,
    v21Full: bestByCoverage(data?.legacyV21?.summary, 3),
    v22Full: bestByCoverage(data?.summary, 3),
    v22TwoPlus: bestByCoverage(data?.summary, 2),
  }), [data]);

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
          <p className={styles.kicker}>BTC Profit Protection Lab · conclusión</p>
          <h2>Protección sí; regla automática de salida, todavía no</h2>
          <span className={styles.panelSubtitle}>
            V2, V2.1.1 y V2.2 ya cumplieron su propósito: descartar reglas frágiles. Mirror conserva el drawdown como alerta de revisión, pero ninguna combinación probada se incorpora al Health Gate.
          </span>
        </div>
        <span className={styles.reviewBadge}>
          <Icon name="shield" size={15} /> Lab cerrado · 0 reglas adoptadas
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
          <p className={styles.kicker}>Última prueba · V2.2</p>
          <h3>Resultados conservados para auditoría</h3>
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

      <div className={styles.btcProfitMethod}>
        <div>
          <span>V2 · confirmación lenta</span>
          <strong>Descartado</strong>
          <small>{labComparison.v2Qualified} combinaciones alcanzaron cobertura ≥2/3; la confirmación llegaba demasiado tarde.</small>
        </div>
        <div>
          <span>V2.1.1 · confirmación rápida</span>
          <strong>Descartado</strong>
          <small>{labComparison.v21Full ? `Mejor 3/3: ${labComparison.v21Full.falsePositives} falsos positivos · daño ${pct(labComparison.v21Full.averageDamageAtConfirmationPct)}.` : 'No produjo una regla robusta.'}</small>
        </div>
        <div>
          <span>V2.2 · doble confirmación</span>
          <strong>Descartado</strong>
          <small>{labComparison.v22Full ? `Mejor 3/3: ${labComparison.v22Full.falsePositives} falsos positivos · daño ${pct(labComparison.v22Full.averageDamageAtConfirmationPct)}.` : 'No conservó cobertura 3/3.'}</small>
        </div>
        <div>
          <span>Resultado operativo</span>
          <strong>Sin cambio</strong>
          <small>Drawdown = revisión. Reducir/salir exige confluencia independiente y una decisión explícita.</small>
        </div>
      </div>

      <div className={styles.btcProfitConclusion}>
        <Icon name="shield" size={15} />
        <div>
          <strong>Conclusión formal del Profit Protection Lab</strong>
          <p>
            No seguiremos ajustando -8/-10/-12%, 30/60 días o 7/14/21 días para hacer que el pasado encaje.
            Con precio, MVRV y Realized Cap no apareció una zona suficientemente robusta: acelerar aumenta el ruido y endurecer la regla sacrifica cobertura o llega tarde.
            <b> Ninguna de estas versiones entra al BTC Health Gate.</b>
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="target" size={15} />
        <span>
          <strong>Siguiente capa de investigación:</strong> incorporar una familia realmente independiente —STH/LTH cost basis, demanda spot/ETF o comportamiento de holders—
          solo cuando exista una serie histórica suficientemente válida. Hasta entonces, Mirror mantiene la Constitución acordada: precio activa revisión; evidencia y confluencia deciden.
        </span>
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
          <strong>Estado del experimento</strong>
          <p>
            V2.2 queda archivado como evidencia, no como regla. Su función fue demostrar que exigir dos confirmaciones relacionadas reduce poco el ruido y no justifica seguir optimizando parámetros dentro de la misma familia.
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
