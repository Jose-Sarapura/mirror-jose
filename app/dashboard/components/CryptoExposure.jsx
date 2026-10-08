'use client';

import Icon from './Icon';
import { clp, percentage, shares } from '../lib/format';
import styles from '../dashboard.module.css';

export default function CryptoExposure({ portfolio }) {
  const crypto = portfolio.cryptoAssets || [];
  if (!crypto.length) return null;

  return (
    <section className={styles.cryptoPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Buda · Cripto</p>
          <h2>Exposición cripto existente</h2>
          <span className={styles.panelSubtitle}>
            BTC y ETH forman parte del patrimonio total, pero todavía no tienen porcentaje objetivo ni reciben aportes automáticos desde Mirror.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15} /> En estudio</span>
      </div>

      <div className={styles.cryptoSummary}>
        <article>
          <span>Patrimonio Buda</span>
          <strong>{clp.format(portfolio.cryptoInvestedCLP)}</strong>
          <small>{portfolio.budaWeightTotalInvested.toFixed(1)}% del patrimonio total invertido</small>
        </article>
        <article>
          <span>Resultado acumulado</span>
          <strong className={portfolio.cryptoReturnCLP >= 0 ? styles.positive : styles.negative}>
            {percentage(portfolio.cryptoReturnPct)}
          </strong>
          <small>{clp.format(portfolio.cryptoReturnCLP)}</small>
        </article>
        <article>
          <span>Custodio actual</span>
          <strong>Buda.com</strong>
          <small>Riesgo de activo y riesgo de custodia se analizarán por separado</small>
        </article>
      </div>

      <div className={styles.cryptoGrid}>
        {crypto.map((asset) => (
          <article key={asset.ticker} className={styles.cryptoCard}>
            <div className={styles.cryptoCardTop}>
              <div>
                <span style={{ background: asset.accent }} />
                <div>
                  <strong translate="no">{asset.ticker} · {asset.name}</strong>
                  <small>{shares(asset.shares)} {asset.ticker}</small>
                </div>
              </div>
              <em>{asset.role}</em>
            </div>

            <div className={styles.cryptoValueRow}>
              <div>
                <span>Valor actual</span>
                <strong>{clp.format(asset.valueCLP)}</strong>
              </div>
              <div>
                <span>Precio Buda</span>
                <strong>{clp.format(asset.price)}</strong>
              </div>
            </div>

            <div className={styles.cryptoMetrics}>
              <div>
                <span>Dentro de Buda</span>
                <strong>{asset.weightWithinCrypto.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Del total invertido</span>
                <strong>{asset.weightTotalInvested.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Costo promedio</span>
                <strong>{clp.format(asset.averageCost)}</strong>
              </div>
              <div>
                <span>Rentabilidad</span>
                <strong className={asset.totalReturnPct >= 0 ? styles.positive : styles.negative}>
                  {percentage(asset.totalReturnPct)}
                </strong>
              </div>
            </div>

            {asset.averageCostEstimated && (
              <p className={styles.cryptoCostNote}>
                <Icon name="info" size={13} />
                El costo de BTC incluye el criterio acordado para el tramo histórico sin costo documentado.
              </p>
            )}
          </article>
        ))}
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="target" size={15} />
        <span>
          <strong>Guardrail actual:</strong> integrar no significa aumentar. BTC y ETH quedan visibles y medibles;
          cualquier nuevo aporte requerirá antes definir tesis, rol, límites y reglas específicas para cripto.
        </span>
      </div>
    </section>
  );
}
