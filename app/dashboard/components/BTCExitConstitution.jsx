'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const RULE_MARKER = 'mirror-v3-btc-exit-constitution-v1';

function seedExitConstitution() {
  if (typeof window === 'undefined' || localStorage.getItem(RULE_MARKER) === 'seeded') return;

  const existing = readDecisionLog(localStorage);
  if (!existing.some((entry) => entry.id === 'btc-exit-constitution-v1')) {
    appendDecisionLog(localStorage, {
      id: 'btc-exit-constitution-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'btc-exit-constitution',
      ruleTitle: 'Constitución final de salida BTC · escalonada',
      decision: 'Precio activa revisión; primera protección = 25%, segunda = 25%; el 50% restante solo se evalúa ante invalidación de tesis o deterioro prolongado. Ninguna etapa se ejecuta automáticamente.',
      reason: 'El Profit Protection Lab descartó reglas de drawdown aislado. La protección debe usar confluencia y preservar capacidad de reentrada si la señal resulta falsa.',
      evidence: 'V2 fue tardío; V2.1.1 y V2.2 fueron demasiado sensibles. ETF 2025 confirmó después del máximo y se incorpora solo como evidencia secundaria de demanda.',
      source: 'btc-exit-constitution',
      reviewStatus: 'pending',
    });
  }

  if (!existing.some((entry) => entry.id === 'btc-reentry-constitution-v1')) {
    appendDecisionLog(localStorage, {
      id: 'btc-reentry-constitution-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'btc-reentry-constitution',
      ruleTitle: 'Reentrada BTC después de protección',
      decision: 'Reentrar por etapas: 50% de lo vendido tras recuperación estructural + demanda; 50% restante tras 14 días adicionales con Gate normalizado.',
      reason: 'Una salida defensiva sin plan de reentrada puede destruir el beneficio de haber protegido bien.',
      evidence: 'La reentrada nunca se ejecuta por FOMO o rebote aislado; necesita nueva validación.',
      source: 'btc-exit-constitution',
      reviewStatus: 'pending',
    });
  }

  localStorage.setItem(RULE_MARKER, 'seeded');
  window.dispatchEvent(new Event('mirror-decision-log-updated'));
}

export default function BTCExitConstitution() {
  const [data, setData] = useState(null);

  useEffect(() => {
    seedExitConstitution();
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-health', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) setData(payload);
      } catch {}
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const readiness = useMemo(() => {
    const d = data?.diagnostics || {};
    const firstReductionEligible = Boolean(
      data?.gate?.key === 'evaluate_protection'
      && d.capitalConfirmedRisk
      && d.sthConfirmedRisk
      && (d.mvrvOverheated || d.etfConfirmedRisk)
    );

    return {
      firstReductionEligible,
      capital: Boolean(d.capitalConfirmedRisk),
      structure: Boolean(d.sthConfirmedRisk),
      valuationOrEtf: Boolean(d.mvrvOverheated || d.etfConfirmedRisk),
    };
  }, [data]);

  return (
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Constitución BTC · salida y reentrada</p>
          <h2>Reglas definitivas de protección patrimonial</h2>
          <span className={styles.panelSubtitle}>
            Simples, escalonadas y sin venta automática. Los porcentajes son reglas de gestión de riesgo, no parámetros optimizados por backtest.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> Constitución activa</span>
      </div>

      <div className={styles.btcHealthStages}>
        <article>
          <span>1 · Revisión</span>
          <strong>Drawdown relevante</strong>
          <p>Una caída desde máximos activa revisión de evidencia. Nunca vende por sí sola.</p>
        </article>

        <article className={data?.gate?.key === 'prepare' ? styles.btcStageActive : ''}>
          <span>2 · Preparar</span>
          <strong>≥2 señales núcleo confirmadas</strong>
          <p>Se prepara protección y reentrada, pero todavía no se vende.</p>
        </article>

        <article className={readiness.firstReductionEligible ? styles.btcStageActive : ''}>
          <span>3 · Primera reducción</span>
          <strong>25% de BTC</strong>
          <p>Solo si demanda + estructura están confirmadas y existe una tercera evidencia: MVRV sobrecalentado o ETF débil confirmado.</p>
        </article>

        <article>
          <span>4 · Segunda reducción</span>
          <strong>25% adicional</strong>
          <p>Solo después de la primera y si durante 7–14 días no recuperan estructura ni demanda y el Gate sigue en Protección a evaluar.</p>
        </article>
      </div>

      <div className={styles.btcHealthDataQuality}>
        <div>
          <span>Demanda núcleo</span>
          <strong>{readiness.capital ? 'Confirmada' : 'No confirmada'}</strong>
          <small>Realized Cap 30d + persistencia</small>
        </div>
        <div>
          <span>Estructura</span>
          <strong>{readiness.structure ? 'Confirmada' : 'No confirmada'}</strong>
          <small>STH cost basis + persistencia</small>
        </div>
        <div>
          <span>Tercera evidencia</span>
          <strong>{readiness.valuationOrEtf ? 'Presente' : 'Ausente'}</strong>
          <small>MVRV extremo o ETF secundario confirmado</small>
        </div>
        <div>
          <span>Primera reducción hoy</span>
          <strong>{readiness.firstReductionEligible ? 'Elegible para evaluar' : 'No elegible'}</strong>
          <small>Nunca se ejecuta automáticamente</small>
        </div>
      </div>

      <div className={styles.btcHealthCurrent}>
        <div>
          <p className={styles.kicker}>Reserva estratégica</p>
          <h3>El 50% restante no se vende por señales normales</h3>
        </div>
        <p>
          Tras dos reducciones, el remanente solo se evalúa para salida mayor si la tesis estructural de BTC queda invalidada
          o si el deterioro conjunto de estructura, demanda y oferta/holders se prolonga sin recuperación.
        </p>
      </div>

      <div className={styles.btcHealthStages}>
        <article>
          <span>Reentrada A</span>
          <strong>50% de lo vendido</strong>
          <p>Cuando BTC recupere estructura durante 7 días y al menos una familia de demanda vuelva a estado sano.</p>
        </article>
        <article>
          <span>Reentrada B</span>
          <strong>50% restante de lo vendido</strong>
          <p>Tras 14 días adicionales si el Gate vuelve a Mantener/Vigilancia y no reaparece deterioro confirmado.</p>
        </article>
        <article>
          <span>Prohibido</span>
          <strong>Reentrar por FOMO</strong>
          <p>Un rebote de precio aislado nunca es una señal de reentrada.</p>
        </article>
        <article>
          <span>Invalidación de tesis</span>
          <strong>Decisión manual extraordinaria</strong>
          <p>Puede justificar una salida mayor, pero exige evidencia explícita y registro de la decisión.</p>
        </article>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="target" size={15} />
        <span>
          <strong>Secuencia final:</strong> precio → revisión → confluencia → 25% → persistencia 7–14d → 25% → reserva 50%.
          Reentrada: recuperación de estructura + demanda → 50% de lo vendido → 14d estables → resto.
        </span>
      </div>
    </section>
  );
}
