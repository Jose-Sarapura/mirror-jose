'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const RULE_MARKER = 'mirror-v3-btc-health-gate-rule-v1';
const HISTORY_KEY = 'mirror-v3-btc-health-history-v1';
const LTH_PENDING_RULE_MARKER = 'mirror-v3-btc-lth-pending-rule-v1';

const DEFINITIONS = {
  mvrv: {
    name: 'MVRV',
    role: 'Valoración / euforia',
    timing: 'Anticipación',
    independence: 'Alta',
    explanation: 'Compara valor de mercado con capital realizado. Detecta exceso de beneficio agregado, pero no identifica por sí solo el día de salida.',
  },
  lth: {
    name: 'Distribución LTH',
    role: 'Oferta / convicción',
    timing: 'Anticipación',
    independence: 'Alta',
    explanation: 'Busca si holders antiguos están activando oferta. Se mantiene como señal relevante de investigación, pero queda fuera del cálculo operativo hasta contar con una fuente válida.',
  },
  capital: {
    name: 'Entrada de capital',
    role: 'Demanda / absorción',
    timing: 'Anticipación + confirmación',
    independence: 'Media-alta',
    explanation: 'Usa la evolución del realized cap para medir si capital nuevo está entrando y absorbiendo la oferta disponible.',
  },
  sth: {
    name: 'STH cost basis',
    role: 'Estructura / régimen',
    timing: 'Confirmación',
    independence: 'Media',
    explanation: 'Compara el precio actual con el costo medio de compradores recientes. El precio es vivo; el cost basis exacto permanece como snapshot hasta conectar una fuente de cohortes.',
  },
};

function readHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-120)));
}

function recordChanges(data) {
  if (!data?.signals || typeof window === 'undefined') return [];
  const current = readHistory();
  const next = [...current];

  Object.entries(data.signals).forEach(([key, signal]) => {
    const last = [...next].reverse().find((item) => item.key === key);
    if (!last || last.status !== signal.status) {
      next.push({
        key,
        status: signal.status,
        tone: signal.tone,
        value: signal.value ?? signal.valueUSD ?? signal.change30dPct ?? null,
        asOf: data.asOf,
        recordedAt: new Date().toISOString(),
      });
    }
  });

  const gateLast = [...next].reverse().find((item) => item.key === 'gate');
  if (!gateLast || gateLast.status !== data.gate?.label) {
    next.push({
      key: 'gate',
      status: data.gate?.label || 'Sin estado',
      tone: data.gate?.key || 'neutral',
      value: null,
      asOf: data.asOf,
      recordedAt: new Date().toISOString(),
    });
  }

  writeHistory(next);
  return next;
}

function seedRule() {
  if (typeof window === 'undefined' || localStorage.getItem(RULE_MARKER) === 'seeded') return;
  const existing = readDecisionLog(localStorage);

  if (!existing.some((entry) => entry.id === 'btc-health-gate-rule-v1')) {
    appendDecisionLog(localStorage, {
      id: 'btc-health-gate-rule-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'btc-health-gate',
      ruleTitle: 'No contar señales redundantes como confirmaciones independientes',
      decision: 'Una acción BTC requiere confluencia entre señales de anticipación y confirmación, no una suma mecánica de indicadores',
      reason: 'MVRV, LTH, flujo de capital y STH cost basis miden dimensiones diferentes pero parcialmente relacionadas. Mirror debe distinguir quién anticipa y quién confirma.',
      evidence: 'MVRV = valoración macro; LTH = oferta/distribución; capital = demanda/absorción; STH cost basis = estructura de compradores recientes.',
      source: 'btc-health-gate',
      reviewStatus: 'pending',
    });
  }

  localStorage.setItem(RULE_MARKER, 'seeded');

  if (localStorage.getItem(LTH_PENDING_RULE_MARKER) !== 'seeded') {
    const refreshed = readDecisionLog(localStorage);
    if (!refreshed.some((entry) => entry.id === 'btc-lth-pending-rule-v1')) {
      appendDecisionLog(localStorage, {
        id: 'btc-lth-pending-rule-v1',
        date: new Date().toISOString().slice(0, 10),
        type: 'rule_definition',
        asset: 'BTC',
        ruleId: 'btc-lth-data-quality',
        ruleTitle: 'LTH queda fuera del Health Gate hasta tener una fuente válida',
        decision: 'Mantener LTH visible como señal pendiente, sin permitir que modifique Mantener / Preparar / Proteger',
        reason: 'La señal es conceptualmente valiosa, pero hoy no contamos con datos de cohortes suficientemente confiables para automatizarla.',
        evidence: 'Mirror prioriza calidad de datos sobre falsa precisión.',
        source: 'btc-health-gate',
        reviewStatus: 'pending',
      });
    }
    localStorage.setItem(LTH_PENDING_RULE_MARKER, 'seeded');
  }
}

function toneClass(signal) {
  if (signal?.tone === 'good') return styles.successPill;
  if (signal?.tone === 'danger') return styles.btcDangerPill;
  if (signal?.tone === 'watch') return styles.warningPill;
  return styles.neutralPill;
}

function modeLabel(mode) {
  if (mode === 'live') return 'Dato vivo';
  if (mode === 'proxy') return 'Proxy vivo';
  if (mode === 'hybrid') return 'Híbrido';
  if (mode === 'snapshot') return 'Snapshot';
  return 'Sin dato vivo';
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—';
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

export default function BTCHealthGate() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    seedRule();
    setHistory(readHistory());

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/dashboard/btc-health', { cache: 'no-store' });
        if (!response.ok) throw new Error('No fue posible actualizar BTC Health Gate');
        const payload = await response.json();
        if (cancelled) return;
        setData(payload);
        setHistory(recordChanges(payload));
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Error de actualización');
      }
    }

    load();
    const timer = setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const lastChanges = useMemo(() => {
    const result = {};
    Object.keys(DEFINITIONS).forEach((key) => {
      result[key] = [...history].reverse().find((item) => item.key === key) || null;
    });
    return result;
  }, [history]);

  const gateChanged = useMemo(
    () => [...history].reverse().find((item) => item.key === 'gate') || null,
    [history],
  );

  const operationalSignals = ['mvrv', 'capital', 'sth'].map((key) => ({
    key,
    ...DEFINITIONS[key],
    ...(data?.signals?.[key] || {}),
  }));

  const pendingLth = {
    key: 'lth',
    ...DEFINITIONS.lth,
    ...(data?.signals?.lth || {}),
  };

  return (
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Health Gate · V2 dinámico</p>
          <h2>Anticipación + confirmación + persistencia</h2>
          <span className={styles.panelSubtitle}>
            Tres señales operativas alimentan el Health Gate. LTH permanece visible como pendiente, pero no modifica el estado hasta contar con una fuente válida.
          </span>
        </div>
        <span className={styles.reviewBadge}>
          <Icon name="shield" size={15} /> {data?.gate?.label || 'Actualizando'}
        </span>
      </div>

      {error && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{error}. Se mantiene el último registro local disponible.</span>
        </div>
      )}

      {data?.gate?.key === 'insufficient_data' && (
        <div className={styles.btcHealthError}>
          <Icon name="info" size={14} />
          <span>{data.gate.explanation}</span>
        </div>
      )}

      <div className={styles.btcHealthSignalGrid}>
        {operationalSignals.map((signal) => {
          const change = lastChanges[signal.key];
          return (
            <article key={signal.key}>
              <div className={styles.btcHealthSignalTop}>
                <div>
                  <strong>{signal.name}</strong>
                  <small>{signal.role}</small>
                </div>
                <span className={toneClass(signal)}>{signal.status || 'Actualizando'}</span>
              </div>

              <div className={styles.btcHealthMeta}>
                <span>{signal.timing}</span>
                <span>Independencia {signal.independence}</span>
                <span>{modeLabel(signal.sourceMode)}</span>
              </div>

              <div className={styles.btcLiveMetric}>
                {signal.key === 'mvrv' && (
                  <><span>MVRV actual</span><strong>{fmt(signal.value, 2)}</strong></>
                )}
                {signal.key === 'capital' && (
                  <><span>Realized Cap · 30 días</span><strong>{fmt(signal.change30dPct, 2)}%</strong></>
                )}
                {signal.key === 'sth' && (
                  <><span>Precio vs. STH cost basis</span><strong>{fmt(signal.distancePct, 1)}%</strong></>
                )}
              </div>

              <p>{signal.explanation}</p>

              <div className={styles.btcPersistence}>
                <span>
                  Persistencia:
                  <strong>{
                    signal.sourceMode === 'unavailable'
                      ? ' no disponible'
                      : (signal.persistence?.days ? ' ' + signal.persistence.days + ' días' : ' iniciando registro')
                  }</strong>
                </span>
                <span>
                  Último cambio Mirror:
                  <strong>{signal.sourceMode === 'unavailable' ? '—' : (change?.asOf || ' hoy')}</strong>
                </span>
              </div>

              <small className={styles.btcHealthUse}>
                {signal.sourceLabel || 'Fuente pendiente'}
              </small>
            </article>
          );
        })}
      </div>

      <div className={styles.btcHealthDataQuality}>
        <div>
          <span>Señales operativas disponibles</span>
          <strong>{data?.coverage?.availableOperational ?? '—'}/3</strong>
          <small>MVRV · capital · STH cost basis</small>
        </div>
        <div>
          <span>Datos exactos vivos</span>
          <strong>{data?.coverage?.exactLive ?? '—'}/3</strong>
          <small>MVRV + entrada de capital</small>
        </div>
        <div>
          <span>Híbrido</span>
          <strong>{data?.coverage?.hybrid ?? '—'}/3</strong>
          <small>STH cost basis con precio vivo</small>
        </div>
        <div>
          <span>Fecha de datos</span>
          <strong>{data?.asOf || '—'}</strong>
          <small>{data?.sourceStatus === 'live' ? 'Actualización diaria pública' : 'Modo respaldo'}</small>
        </div>
      </div>

      <div className={styles.btcPendingSignal}>
        <div>
          <p className={styles.kicker}>Señal pendiente</p>
          <h3>Distribución LTH</h3>
        </div>
        <div>
          <span className={styles.neutralPill}>Excluida del cálculo</span>
          <p>{pendingLth.explanation}</p>
          <small>{pendingLth.sourceLabel || 'Pendiente de fuente de cohortes válida'}</small>
        </div>
      </div>

      <div className={styles.btcHealthRedundancy}>
        <div>
          <strong>MVRV ↔ STH cost basis</strong>
          <span>Solapamiento parcial. No se cuentan como dos alertas tempranas independientes: MVRV mira valoración macro y STH confirma régimen de compradores recientes.</span>
        </div>
        <div>
          <strong>LTH ↔ entrada de capital</strong>
          <span>Conceptualmente complementarios, pero LTH queda fuera del cálculo hasta tener una fuente válida. No puede subir por sí mismo el estado del Health Gate.</span>
        </div>
      </div>

      <div className={styles.btcHealthStages}>
        <article className={data?.gate?.key === 'maintain' ? styles.btcStageActive : ''}>
          <span>🟢 Mantener / vigilancia</span>
          <strong>0–1 señal operativa deteriorada</strong>
          <p>Una señal aislada no justifica protección.</p>
        </article>
        <article className={data?.gate?.key === 'prepare' ? styles.btcStageActive : ''}>
          <span>🟡 Preparar protección</span>
          <strong>≥2 señales operativas</strong>
          <p>Mirror prepara el plan, pero todavía no vende.</p>
        </article>
        <article className={data?.gate?.key === 'evaluate_protection' ? styles.btcStageActive : ''}>
          <span>🟠 Protección a evaluar</span>
          <strong>Alerta + confirmación persistente</strong>
          <p>Recién aquí corresponde estudiar una reducción.</p>
        </article>
        <article>
          <span>🔴 Reducir / salir</span>
          <strong>Tesis o régimen seriamente deteriorado</strong>
          <p>La invalidación de tesis puede dominar todas las métricas.</p>
        </article>
      </div>

      <div className={styles.btcHealthCurrent}>
        <div>
          <p className={styles.kicker}>Lectura automática · {data?.asOf || 'actualizando'}</p>
          <h3>{data?.gate?.label || 'Actualizando señales'}</h3>
        </div>
        <p>
          {data?.gate?.explanation || 'Mirror está obteniendo las métricas públicas disponibles.'}
          {gateChanged?.asOf ? ' Último cambio de estado registrado: ' + gateChanged.asOf + '.' : ''}
        </p>
      </div>

      <div className={styles.btcHealthResearchNote}>
        <Icon name="info" size={15} />
        <div>
          <strong>Calidad de datos antes que falsa precisión</strong>
          <p>
            MVRV y realized cap se actualizan desde Coin Metrics Community. LTH no participa del cálculo operativo hasta contar con una fuente de cohortes válida.
            El STH cost basis mantiene el snapshot de investigación de {data?.signals?.sth?.snapshotDate || '16-09-2026'}
            ({moneyUSD(data?.signals?.sth?.valueUSD)}), combinado con precio diario vivo.
          </p>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="target" size={15} />
        <span>
          <strong>Regla vigente:</strong> una caída o un único indicador no genera venta.
          La persistencia aumenta la importancia de una señal, pero la decisión sigue requiriendo confluencia e invalidación suficiente de la tesis o del régimen.
        </span>
      </div>
    </section>
  );
}
