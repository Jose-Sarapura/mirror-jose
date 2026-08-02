'use client';

import { useMemo, useState } from 'react';
import { contributionRecommendation } from '../lib/calculations';
import { clp, nativeMoney, percentage } from '../lib/format';
import Icon from './Icon';
import styles from '../dashboard.module.css';

export default function ContributionSimulator({ portfolio, initialAmount = 300000 }) {
  const [amount, setAmount] = useState(initialAmount);
  const recommendation = useMemo(() => contributionRecommendation(portfolio, Number(amount)), [portfolio, amount]);

  if (!recommendation) return null;

  return (
    <section className={styles.recommendationCard}>
      <div className={styles.recommendationTop}>
        <span className={styles.recommendationIcon}><Icon name="target" /></span>
        <div>
          <p className={styles.kicker}>Próximo aporte sugerido</p>
          <h2>{recommendation.ticker}</h2>
        </div>
        <span className={styles.strategyTag}>Estrategia 60 / 20 / 10 / 10</span>
      </div>

      <p className={styles.recommendationText}>
        {recommendation.ticker} {recommendation.reason}. Con este aporte el peso estimado quedaría en <strong>{recommendation.newWeight.toFixed(1)}%</strong>.
      </p>

      <div className={styles.amountSelector}>
        {[150000, 250000, 300000].map((option) => (
          <button type="button" key={option} className={Number(amount) === option ? styles.amountActive : ''} onClick={() => setAmount(option)}>{clp.format(option)}</button>
        ))}
        <input type="number" min="10000" step="10000" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Monto del aporte" />
      </div>

      <div className={styles.recommendationMetrics}>
        <div><span>Aporte</span><strong>{clp.format(Number(amount))}</strong></div>
        <div><span>Nuevo costo promedio</span><strong>{nativeMoney(recommendation.newAverageCost, portfolio.assets.find((asset) => asset.ticker === recommendation.ticker)?.currency)}</strong></div>
        <div><span>Precio vs. tu promedio</span><strong className={recommendation.discountToCost > 0 ? styles.positive : ''}>{recommendation.discountToCost > 0 ? `${recommendation.discountToCost.toFixed(1)}% más bajo` : percentage(-recommendation.discountToCost)}</strong></div>
      </div>
    </section>
  );
}
