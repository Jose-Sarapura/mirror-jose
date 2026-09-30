'use client';

import Icon from './Icon';
import { portfolioHealthDecision } from '../lib/portfolio-health';
import { STRATEGY_CONSTITUTION, nextStrategyCheckpoint, strategyStage } from '../lib/strategy-constitution';
import styles from '../dashboard.module.css';

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export default function StrategyConstitution({ portfolio }) {
  const stage = strategyStage(portfolio.totalInvestedCLP);
  const next = nextStrategyCheckpoint(portfolio.totalInvestedCLP);
  const health = portfolio.assets
    .map((asset) => ({ asset, decision: portfolioHealthDecision(asset) }))
    .filter((item) => item.decision);
  const failed = health.filter((item) => item.decision.failedCritical.length > 0);
  const smh = portfolio.assets.find((asset) => asset.ticker === 'SMH');
  const highVolatilityValue = (smh?.valueCLP || 0) + (portfolio.cryptoInvestedCLP || 0);
  const highVolatilityWeight = portfolio.totalInvestedCLP
    ? (highVolatilityValue / portfolio.totalInvestedCLP) * 100
    : 0;

  const strategyStatus = failed.length
    ? 'Reevaluar estrategia'
    : stage.key === 'accumulation'
      ? 'Mantener estrategia base'
      : 'Revisión estratégica obligatoria';

  const strategyReason = failed.length
    ? `${failed.map((item) => item.asset.ticker).join(', ')} falla al menos un hard gate. La distribución no debe mantenerse por inercia.`
    : stage.key === 'accumulation'
      ? 'Los activos de Racional siguen superando sus hard gates. El 60/20/15/5 puede mantenerse, sujeto a revisión continua de concentración y riesgo.'
      : `El patrimonio ya está en etapa ${stage.label}. Los porcentajes anteriores deben volver a justificarse antes de seguir aportando por inercia.`;

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Gobierno patrimonial</p>
          <h2>Constitución de Estrategia</h2>
          <span className={styles.panelSubtitle}>
            Evalúa si los activos, porcentajes y nivel de riesgo siguen siendo adecuados para la etapa patrimonial actual.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> V{STRATEGY_CONSTITUTION.version} · {STRATEGY_CONSTITUTION.adoptedAt}</span>
      </div>

      <div className={styles.healthGrid}>
        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Decisión actual</span><strong>{strategyStatus}</strong></div>
            <p>{strategyReason}</p>
          </div>
          <div className={styles.healthAllocation}>
            <span>Patrimonio invertido <strong>{clp.format(portfolio.totalInvestedCLP)}</strong></span>
            <span>Etapa <strong>{stage.label}</strong></span>
          </div>
          <div className={styles.healthFacts}>
            <strong>Prioridad de esta etapa</strong>
            <span>{stage.priority}</span>
            <span>{stage.rule}</span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Próximo punto de control</span><strong>{next ? clp.format(next.minCLP) : 'Meta alcanzada'}</strong></div>
            <p>{stage.transition}</p>
          </div>
          <div className={styles.healthFacts}>
            <strong>Base estratégica vigente</strong>
            <span>{stage.baseline}</span>
            <span>Revisión: {STRATEGY_CONSTITUTION.reviewCadence}</span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Riesgo de concentración</span><strong>{highVolatilityWeight.toFixed(1)}%</strong></div>
            <p>Exposición aproximada del patrimonio total a SMH + BTC + ETH. No es una medida de pérdida esperada; es una señal de cuánto patrimonio depende de activos de mayor volatilidad.</p>
          </div>
          <div className={styles.healthAllocation}>
            <span>SMH <strong>{smh ? `${smh.weight.toFixed(1)}% de Racional` : '—'}</strong></span>
            <span>Cripto <strong>{portfolio.budaWeightTotalInvested?.toFixed(1) || '0.0'}% total</strong></span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthFacts}>
            <strong>Reglas permanentes</strong>
            {STRATEGY_CONSTITUTION.principles.map((principle) => <span key={principle}>• {principle}</span>)}
          </div>
        </article>
      </div>

      <div className={styles.radarFooter}>
        <Icon name="info" size={16} />
        <span><strong>Regla Mirror:</strong> los hitos de $100M, $300M y $600M activan revisión obligatoria; no generan ventas automáticas. El cambio de activos o porcentajes debe justificarse por etapa patrimonial, hard gates y riesgo real.</span>
      </div>
    </section>
  );
}
