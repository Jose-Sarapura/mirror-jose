'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildActionPlan } from '../lib/action-engine';
import { appendDecisionLog } from '../lib/decision-log';
import { buildDecisionSnapshot } from '../lib/decision-learning';
import { clp, nativeMoney, shares } from '../lib/format';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function addDays(date, days) {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export default function ActionEngine({ portfolio, initialAmount = 200000 }) {
  const [amount, setAmount] = useState(Number(initialAmount) || 200000);
  const [opportunities, setOpportunities] = useState([]);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/opportunities', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active) setOpportunities(data?.candidates || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const plan = useMemo(
    () => buildActionPlan(portfolio, Number(amount), opportunities),
    [portfolio, amount, opportunities],
  );

  if (!plan) return null;

  const quickAmounts = [...new Set([
    100000,
    Number(initialAmount) || 200000,
    300000,
    500000,
  ])].sort((a, b) => a - b);

  const registerPlan = () => {
    const today = new Date().toISOString().slice(0, 10);
    const allocations = plan.allocations
      .map((item) => `${item.ticker}: ${clp.format(item.amountCLP)} (${item.shareOfContribution.toFixed(0)}%)`)
      .join(' · ');

    appendDecisionLog(localStorage, {
      type: 'rebalance',
      date: today,
      decision: plan.headline,
      reason: plan.rationale,
      evidence: `Aporte simulado ${clp.format(plan.amountCLP)}. Distribución: ${allocations || 'sin asignación'}. Salud de asignación ${plan.metrics.allocationHealthBefore}→${plan.metrics.allocationHealthAfter}. SMH ${plan.metrics.smhBefore.toFixed(1)}%→${plan.metrics.smhAfter.toFixed(1)}%. Tecnología ${plan.metrics.technologyBefore.toFixed(1)}%→${plan.metrics.technologyAfter.toFixed(1)}%.`,
      reviewDate: addDays(today, 30),
      source: 'manual',
      snapshot: buildDecisionSnapshot(portfolio, '', {
        plannedContributionCLP: plan.amountCLP,
        plannedAllocationHealth: plan.metrics.allocationHealthAfter,
        plannedSmhWeight: plan.metrics.smhAfter,
        plannedTechnology: plan.metrics.technologyAfter,
      }),
    });
    window.dispatchEvent(new Event('mirror-decision-log-updated'));
    setRegistered(true);
    setTimeout(() => setRegistered(false), 1800);
  };

  return (
    <section className={styles.actionEngine}>
      <div className={styles.actionEngineHeader}>
        <div>
          <p className={styles.kicker}>Motor de Acción</p>
          <h2>Qué hacer con el próximo aporte</h2>
          <span>
            Distribuye el próximo aporte dentro de Racional 60/20/15/5. BTC y ETH quedan fuera hasta definir una estrategia cripto específica.
          </span>
        </div>
        <span className={styles.actionEngineBadge}><Icon name="target" size={15} /> Plan según tus reglas</span>
      </div>

      <div className={styles.actionHero}>
        <div className={styles.actionHeroMain}>
          <span>Acción propuesta</span>
          <h3>{plan.headline}</h3>
          <p>{plan.rationale}</p>
        </div>

        <div className={styles.actionAmountBox}>
          <span>Aporte a distribuir</span>
          <strong>{clp.format(Number(amount))}</strong>
          <div className={styles.actionAmountButtons}>
            {quickAmounts.map((option) => (
              <button
                type="button"
                key={option}
                className={Number(amount) === option ? styles.actionAmountActive : ''}
                onClick={() => setAmount(option)}
              >
                {clp.format(option)}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="10000"
            step="10000"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            aria-label="Monto del próximo aporte"
          />
        </div>
      </div>

      <div className={styles.actionAllocations}>
        {plan.allocations.map((item, index) => (
          <article className={index === 0 ? styles.actionAllocationPrimary : styles.actionAllocation} key={item.ticker}>
            <div>
              <span>{item.priority} · {item.actionLabel}</span>
              <strong translate="no">{item.ticker}</strong>
            </div>
            <div className={styles.actionAllocationMoney}>
              <strong>{clp.format(item.amountCLP)}</strong>
              <span>{item.shareOfContribution.toFixed(0)}% del aporte</span>
              <small>
                Compra estimada: <b>{nativeMoney(item.amountNative, item.currency)}</b>
                {item.estimatedShares > 0 && <> · <b>{shares(item.estimatedShares)}</b> participaciones</>}
              </small>
            </div>
            <div className={styles.actionAllocationWeights}>
              <span>Ahora <b>{item.currentWeight.toFixed(1)}%</b></span>
              <i>→</i>
              <span>Después <b>{item.projectedWeight.toFixed(1)}%</b></span>
              <small>Objetivo {item.targetWeight}%</small>
            </div>
            <p className={styles.actionAllocationReason}>{item.reason}</p>
          </article>
        ))}
      </div>

      <div className={styles.actionMetrics}>
        <article>
          <span>Salud de asignación</span>
          <strong>{plan.metrics.allocationHealthBefore} → {plan.metrics.allocationHealthAfter}</strong>
          <small>{plan.metrics.allocationHealthAfter >= plan.metrics.allocationHealthBefore ? 'Mejora con el aporte' : 'Revisar distribución'}</small>
        </article>
        <article>
          <span>SMH</span>
          <strong>{plan.metrics.smhBefore.toFixed(1)}% → {plan.metrics.smhAfter.toFixed(1)}%</strong>
          <small>{plan.rules.smhContributionBlocked ? 'Sin comprar SMH' : 'Dentro de regla de aportes'}</small>
        </article>
        <article>
          <span>Tecnología efectiva</span>
          <strong>{plan.metrics.technologyBefore.toFixed(1)}% → {plan.metrics.technologyAfter.toFixed(1)}%</strong>
          <small>{plan.rules.technologyWatch ? 'Vigilancia activa' : 'Dentro del rango operativo'}</small>
        </article>
      </div>

      <div className={styles.actionRulesGrid}>
        <article>
          <div className={styles.actionSectionTitle}>
            <span>No aumentar ahora</span>
            <strong>{plan.blockedAssets.length}</strong>
          </div>
          {plan.blockedAssets.length ? (
            <div className={styles.actionBlockedList}>
              {plan.blockedAssets.map((item) => (
                <div key={item.ticker}>
                  <strong translate="no">{item.ticker}</strong>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.actionEmptyText}>Ningún activo actual está bloqueado para nuevos aportes.</p>
          )}
        </article>

        <article>
          <div className={styles.actionSectionTitle}>
            <span>Oportunidades externas</span>
            <strong>{plan.opportunities.filter((item) => item.approved).length} habilitada(s)</strong>
          </div>
          <div className={styles.actionOpportunityList}>
            {plan.opportunities.length ? plan.opportunities.map((item) => (
              <div key={item.ticker}>
                <div>
                  <strong translate="no">{item.ticker}</strong>
                  <span className={item.approved ? styles.actionOpportunityReady : styles.actionOpportunityBlocked}>
                    {item.approved ? 'Gate aprobado' : 'Bloqueada'}
                  </span>
                </div>
                <p>{item.note}</p>
              </div>
            )) : <p className={styles.actionEmptyText}>Cargando Decision Gate de oportunidades…</p>}
          </div>
        </article>
      </div>

      <div className={styles.actionFooter}>
        <div>
          <Icon name="shield" size={16} />
          <span>
            <strong>Importante:</strong> este motor administra solo la cartera principal Racional.
            “Complemento” no significa que un activo esté infraponderado; puede recibir una fracción solo para mantenerse cerca de su objetivo.
            BTC y ETH no reciben aportes desde este motor mientras no definamos tesis, límite y porcentaje estratégico.
          </span>
        </div>
        <button type="button" onClick={registerPlan}>
          <Icon name={registered ? 'check' : 'edit'} size={15} />
          {registered ? 'Plan registrado' : 'Registrar este plan'}
        </button>
      </div>
    </section>
  );
}
