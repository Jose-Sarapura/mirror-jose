'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { clp, percentage } from '../lib/format';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const HIGH_WATER_KEY = 'mirror-v3-crypto-high-water-v1';
const RULES_MARKER_KEY = 'mirror-v3-crypto-protection-rules-v1';

function safeRead() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(HIGH_WATER_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistHighWater(data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIGH_WATER_KEY, JSON.stringify(data));
}

function seedProtectionRules() {
  if (typeof window === 'undefined' || localStorage.getItem(RULES_MARKER_KEY) === 'seeded') return;

  const existing = readDecisionLog(localStorage);
  const hasRule = (id) => existing.some((entry) => entry.id === id);

  if (!hasRule('crypto-rule-price-review-v1')) {
    appendDecisionLog(localStorage, {
      id: 'crypto-rule-price-review-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'crypto-price-review',
      ruleTitle: 'La caída activa revisión; no venta',
      decision: 'No vender BTC por un porcentaje de caída aislado',
      reason: 'La volatilidad del precio no invalida por sí sola la tesis. El precio debe activar una revisión de evidencia, no una orden automática.',
      evidence: 'Mirror Crypto separa precio, tesis, valoración/ciclo y estructura de mercado.',
      source: 'crypto-constitution',
      reviewStatus: 'pending',
    });
  }

  if (!hasRule('crypto-rule-protect-gains-v1')) {
    appendDecisionLog(localStorage, {
      id: 'crypto-rule-protect-gains-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'crypto-protect-gains',
      ruleTitle: 'Proteger patrimonio antes de una pérdida grande',
      decision: 'Medir máximo observado, beneficio devuelto y deterioro de tesis antes de decidir reducir o salir',
      reason: 'No esperar a estar 20% bajo el costo para recién diseñar una salida. La protección debe prepararse mientras la posición todavía conserva beneficios.',
      evidence: 'La salida futura requerirá confluencia de señales; ningún drawdown aislado será suficiente.',
      source: 'crypto-constitution',
      reviewStatus: 'pending',
    });
  }

  localStorage.setItem(RULES_MARKER_KEY, 'seeded');
}

function buildMetric(asset, stored) {
  const currentPrice = Number(asset.price || 0);
  const previousPeak = Number(stored?.peakPriceCLP || 0);
  const peakPriceCLP = Math.max(currentPrice, previousPeak);
  const shares = Number(asset.shares || 0);
  const averageCost = Number(asset.averageCost || 0);
  const currentValue = currentPrice * shares;
  const peakValue = peakPriceCLP * shares;
  const costBasis = averageCost * shares;
  const currentProfit = currentValue - costBasis;
  const peakProfit = peakValue - costBasis;
  const returnedProfit = Math.max(0, peakProfit - currentProfit);
  const drawdownPct = peakPriceCLP > 0 ? ((currentPrice / peakPriceCLP) - 1) * 100 : 0;

  return {
    ticker: asset.ticker,
    currentPrice,
    peakPriceCLP,
    currentValue,
    peakValue,
    currentProfit,
    peakProfit,
    returnedProfit,
    drawdownPct,
    startedAt: stored?.startedAt || new Date().toISOString(),
  };
}

export default function CryptoProtectionMonitor({ portfolio }) {
  const crypto = portfolio.cryptoAssets || [];
  const [highWater, setHighWater] = useState({});

  useEffect(() => {
    const stored = safeRead();
    const next = { ...stored };
    let changed = false;

    crypto.forEach((asset) => {
      const current = Number(asset.price || 0);
      const previous = Number(stored?.[asset.ticker]?.peakPriceCLP || 0);
      if (!stored?.[asset.ticker] || current > previous) {
        next[asset.ticker] = {
          peakPriceCLP: Math.max(current, previous),
          startedAt: stored?.[asset.ticker]?.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
    });

    if (changed) persistHighWater(next);
    setHighWater(next);
    seedProtectionRules();
  }, [portfolio.updatedAt, crypto]);

  const metrics = useMemo(
    () => crypto.map((asset) => buildMetric(asset, highWater?.[asset.ticker])),
    [crypto, highWater],
  );

  const btc = metrics.find((item) => item.ticker === 'BTC');
  if (!btc) return null;

  return (
    <section className={styles.cryptoProtectionPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Constitución Crypto · Protección</p>
          <h2>Preparar la salida antes de necesitarla</h2>
          <span className={styles.panelSubtitle}>
            El drawdown activa revisión. La protección BTC ya tiene Constitución escalonada: 25% + 25% y reserva estratégica del 50%.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> Regla activa</span>
      </div>

      <div className={styles.cryptoProtectionHero}>
        <article>
          <span>BTC · Precio actual</span>
          <strong>{clp.format(btc.currentPrice)}</strong>
          <small>Precio vivo utilizado por Mirror</small>
        </article>
        <article>
          <span>Máximo observado por Mirror</span>
          <strong>{clp.format(btc.peakPriceCLP)}</strong>
          <small>Desde {new Date(btc.startedAt).toLocaleDateString('es-CL')}</small>
        </article>
        <article>
          <span>Drawdown desde máximo</span>
          <strong className={btc.drawdownPct < 0 ? styles.negative : styles.positive}>{percentage(btc.drawdownPct)}</strong>
          <small>Dato de alerta, no orden de venta</small>
        </article>
        <article>
          <span>Patrimonio devuelto desde máximo</span>
          <strong>{clp.format(btc.returnedProfit)}</strong>
          <small>Sobre tu cantidad actual de BTC</small>
        </article>
      </div>

      <div className={styles.cryptoProtectionGrid}>
        <article>
          <span>Resultado actual BTC</span>
          <strong className={btc.currentProfit >= 0 ? styles.positive : styles.negative}>{clp.format(btc.currentProfit)}</strong>
          <small>Respecto del costo reconstruido en Mirror</small>
        </article>
        <article>
          <span>Resultado máximo observado</span>
          <strong>{clp.format(btc.peakProfit)}</strong>
          <small>Sirve para medir cuánto beneficio se conserva</small>
        </article>
        <article>
          <span>Estado de decisión</span>
          <strong>No automático</strong>
          <small>Precio → revisión → evidencia → decisión</small>
        </article>
      </div>

      <div className={styles.cryptoPrinciples}>
        <div>
          <strong>1</strong>
          <span><b>Una caída activa revisión.</b> No activa una venta.</span>
        </div>
        <div>
          <strong>2</strong>
          <span><b>No esperar a estar bajo el costo.</b> La protección comienza mientras todavía existe patrimonio que proteger.</span>
        </div>
        <div>
          <strong>3</strong>
          <span><b>Reducción escalonada.</b> Primera protección 25%; segunda 25% solo si el deterioro persiste 7–14 días.</span>
        </div>
        <div>
          <strong>4</strong>
          <span><b>Reserva + reentrada.</b> El 50% restante exige invalidación seria; lo vendido se recompra por etapas solo tras recuperación de estructura y demanda.</span>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="info" size={15} />
        <span>
          <strong>Importante:</strong> el máximo observado comienza desde la activación de este monitor.
          No reconstruye todavía máximos históricos previos de tu posición. Esa capa se agregará cuando validemos el modelo con ciclos anteriores.
        </span>
      </div>
    </section>
  );
}
