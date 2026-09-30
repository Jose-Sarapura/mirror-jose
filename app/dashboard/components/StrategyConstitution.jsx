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
    ? 'REEVALUAR ESTRATEGIA'
    : stage.key === 'accumulation'
      ? 'MANTENER ESTRATEGIA'
      : 'REVISIÓN OBLIGATORIA';

  const actionNow = failed.length
    ? `Pausar cambios automáticos y revisar ${failed.map((item) => item.asset.ticker).join(', ')}.`
    : stage.key === 'accumulation'
      ? 'Mantener 60/20/15/5 por ahora. Ajustar con aportes y revisar ganancias/sobrepesos, no por miedo.'
      : 'No asumir los porcentajes actuales por inercia. Revalidar riesgo y necesidad de protección.';

  return (
    <section className={styles.healthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Plan maestro</p>
          <h2>Estrategia actual</h2>
          <span className={styles.panelSubtitle}>Primero la decisión. El detalle de la Constitución queda desplegable.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> V{STRATEGY_CONSTITUTION.version}</span>
      </div>

      <div className={styles.healthGrid}>
        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Estado</span><strong>{strategyStatus}</strong></div>
            <p>{actionNow}</p>
          </div>
          <div className={styles.healthAllocation}>
            <span>Etapa <strong>{stage.label}</strong></span>
            <span>Patrimonio <strong>{clp.format(portfolio.totalInvestedCLP)}</strong></span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Próximo control</span><strong>{next ? clp.format(next.minCLP) : 'Meta alcanzada'}</strong></div>
            <p>{next ? 'Al llegar a este nivel se vuelven a justificar activos, porcentajes y riesgo.' : 'La prioridad pasa a sostener la libertad financiera.'}</p>
          </div>
          <div className={styles.healthAllocation}>
            <span>Prioridad <strong>{stage.priority}</strong></span>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Exposición de mayor volatilidad</span><strong>{highVolatilityWeight.toFixed(1)}%</strong></div>
            <p>SMH + BTC + ETH sobre el patrimonio invertido. Se vigila para que el crecimiento no dependa demasiado de pocos motores.</p>
          </div>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.healthDecision}>
            <div><span>Ciclo de capital</span><strong>5 pasos</strong></div>
            <p>{STRATEGY_CONSTITUTION.capitalFlow.sequence.join(' → ')}</p>
          </div>
          <div className={styles.healthContribution}>
            <span>Regla</span>
            <strong>No vender sin destino</strong>
            <small>Si se toma ganancia, Mirror debe registrar cuánto se reduce, dónde va el capital y cuándo podría reentrar.</small>
          </div>
        </article>
      </div>

      <details className={styles.healthDetails}>
        <summary>Ver Constitución completa</summary>
        <div className={styles.healthQuestions}>
          <div>
            <span>Base vigente</span>
            <p>{stage.baseline}</p>
          </div>
          <div>
            <span>Regla de etapa</span>
            <p>{stage.rule}</p>
          </div>
          <div>
            <span>Transición</span>
            <p>{stage.transition}</p>
          </div>
          <div>
            <span>Frecuencia de revisión</span>
            <p>{STRATEGY_CONSTITUTION.reviewCadence}</p>
          </div>
          <div>
            <span>Toma de ganancias</span>
            <p>{STRATEGY_CONSTITUTION.capitalFlow.takeProfitRule}</p>
          </div>
          <div>
            <span>Rotación</span>
            <p>{STRATEGY_CONSTITUTION.capitalFlow.rotationRule}</p>
          </div>
          <div>
            <span>Reentrada</span>
            <p>{STRATEGY_CONSTITUTION.capitalFlow.reentryRule}</p>
          </div>
        </div>
        <div className={styles.healthFacts}>
          <strong>Reglas permanentes</strong>
          {STRATEGY_CONSTITUTION.principles.map((principle) => <span key={principle}>• {principle}</span>)}
        </div>
      </details>

      <div className={styles.radarFooter}>
        <Icon name="info" size={16} />
        <span><strong>Mirror:</strong> ganar no obliga a vender; perder no obliga a aguantar. Cada cambio necesita tesis, destino del capital y regla de reentrada.</span>
      </div>
    </section>
  );
}
