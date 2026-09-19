'use client';

import { useEffect } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const RULE_MARKER = 'mirror-v3-btc-health-gate-rule-v1';

const signals = [
  {
    key: 'mvrv',
    name: 'MVRV',
    role: 'Alerta macro',
    timing: 'Anticipación',
    independence: 'Alta',
    status: 'No extremo',
    tone: 'good',
    explanation: 'Mide cuánto se aleja el valor de mercado del capital realizado. Detecta euforia o infravaloración, pero históricamente puede permanecer elevado durante meses.',
    use: 'Sube la vigilancia; nunca decide una salida por sí solo.',
  },
  {
    key: 'lth',
    name: 'Distribución LTH',
    role: 'Oferta / convicción',
    timing: 'Anticipación',
    independence: 'Alta',
    status: 'Vigilar',
    tone: 'watch',
    explanation: 'Observa si holders de largo plazo están transfiriendo monedas de forma persistente. Puede advertir que manos antiguas están monetizando antes de que el precio confirme deterioro.',
    use: 'Es una señal temprana más valiosa cuando la distribución persiste y aparece junto a valoración elevada o demanda debilitándose.',
  },
  {
    key: 'capital',
    name: 'Entrada de capital',
    role: 'Demanda / absorción',
    timing: 'Anticipación + confirmación',
    independence: 'Media-alta',
    status: 'Débil',
    tone: 'watch',
    explanation: 'Realized Cap, ETF, stablecoins y compras institucionales indican si existe capital nuevo capaz de absorber oferta. Puede desacelerarse antes de una pérdida clara de estructura.',
    use: 'Confirma si la distribución está siendo absorbida o si el mercado empieza a quedarse sin combustible.',
  },
  {
    key: 'sth',
    name: 'STH cost basis',
    role: 'Estructura / régimen',
    timing: 'Confirmación',
    independence: 'Media',
    status: 'Bajo presión',
    tone: 'watch',
    explanation: 'Es el costo medio de compradores recientes y reacciona más rápido al precio. Suele funcionar como soporte en tendencias alcistas y resistencia en tendencias bajistas.',
    use: 'No anticipa bien un techo por sí solo; confirma que el deterioro dejó de ser solo una alerta y está afectando la estructura.',
  },
];

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
}

export default function BTCHealthGate() {
  useEffect(() => {
    seedRule();
  }, []);

  return (
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Health Gate · V1</p>
          <h2>Qué anticipa y qué confirma</h2>
          <span className={styles.panelSubtitle}>
            Las cuatro señales no pesan igual. Mirror evita sumar indicadores correlacionados como si fueran cuatro pruebas independientes.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> Sin venta automática</span>
      </div>

      <div className={styles.btcHealthSignalGrid}>
        {signals.map((signal) => (
          <article key={signal.key}>
            <div className={styles.btcHealthSignalTop}>
              <div>
                <strong>{signal.name}</strong>
                <small>{signal.role}</small>
              </div>
              <span className={signal.tone === 'good' ? styles.successPill : styles.warningPill}>
                {signal.status}
              </span>
            </div>
            <div className={styles.btcHealthMeta}>
              <span>{signal.timing}</span>
              <span>Independencia {signal.independence}</span>
            </div>
            <p>{signal.explanation}</p>
            <small className={styles.btcHealthUse}>{signal.use}</small>
          </article>
        ))}
      </div>

      <div className={styles.btcHealthRedundancy}>
        <div>
          <strong>MVRV ↔ STH cost basis</strong>
          <span>Solapamiento parcial. Ambos usan realized-price/MVRV, pero MVRV agregado mira valoración macro y STH mira régimen de compradores recientes. No se cuentan como dos alertas tempranas independientes.</span>
        </div>
        <div>
          <strong>LTH ↔ entrada de capital</strong>
          <span>Relacionados, no equivalentes. LTH responde “quién está distribuyendo”; capital responde “si existe demanda nueva capaz de absorber esa oferta”. La combinación es más informativa que cualquiera por separado.</span>
        </div>
      </div>

      <div className={styles.btcHealthStages}>
        <article>
          <span>🟢 Mantener</span>
          <strong>0–1 familia deteriorada</strong>
          <p>Tesis intacta. Una señal aislada solo se vigila.</p>
        </article>
        <article>
          <span>🟡 Preparar protección</span>
          <strong>≥2 familias independientes</strong>
          <p>Debe existir al menos una alerta temprana: valoración, LTH o demanda. Todavía no implica vender.</p>
        </article>
        <article>
          <span>🟠 Protección a evaluar</span>
          <strong>Alerta + confirmación</strong>
          <p>Deterioro persistente en varias familias y confirmación por demanda o estructura. Recién aquí se estudia reducir.</p>
        </article>
        <article>
          <span>🔴 Reducir / salir</span>
          <strong>Tesis o régimen seriamente deteriorado</strong>
          <p>No depende de alcanzar un drawdown prefijado. La invalidación de tesis puede dominar todas las demás métricas.</p>
        </article>
      </div>

      <div className={styles.btcHealthCurrent}>
        <div>
          <p className={styles.kicker}>Lectura actual de investigación · 16-09-2026</p>
          <h3>Vigilancia, todavía no protección</h3>
        </div>
        <p>
          La investigación reciente muestra demanda/capital debilitados y estructura bajo presión, mientras la valoración no presenta euforia histórica extrema.
          Eso justifica vigilancia y confirmación adicional, no una reducción automática.
        </p>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="info" size={15} />
        <span>
          <strong>Regla de diseño:</strong> no fijaremos porcentaje de venta hasta validar persistencia, independencia y falsos positivos.
          Una señal debe aportar información nueva; si solo repite otra métrica, no aumenta la convicción.
        </span>
      </div>
    </section>
  );
}
