'use client';

import Icon from './Icon';
import { calculateLookthrough } from '../lib/lookthrough';
import styles from '../dashboard.module.css';

function pct(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

export default function RealExposure({ portfolio }) {
  const exposure = calculateLookthrough(portfolio);
  const { summary } = exposure;
  const topCompanies = exposure.companies.slice(0, 8);
  const topCountries = exposure.countries.slice(0, 6);
  const topSectors = exposure.sectors.slice(0, 6);

  return (
    <section className={styles.exposurePanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Exposición real</p>
          <h2>Qué tienes realmente debajo de los fondos</h2>
          <span className={styles.panelSubtitle}>
            Look-through de la cartera principal Racional. BTC y ETH se analizan por separado porque no son fondos ni comparten esta metodología.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="brain" size={15} /> Look-through</span>
      </div>

      <div className={styles.exposureSummary}>
        <article>
          <span>Estados Unidos</span>
          <strong>{pct(summary.us)}</strong>
          <small>{summary.concentrationFlags.us}</small>
        </article>
        <article>
          <span>Tecnología</span>
          <strong>{pct(summary.technology)}</strong>
          <small>{summary.concentrationFlags.technology}</small>
        </article>
        <article>
          <span>Mayor empresa efectiva</span>
          <strong translate="no">{summary.largestCompany?.ticker || '—'} · {pct(summary.largestCompany?.weight)}</strong>
          <small>{summary.concentrationFlags.company}</small>
        </article>
        <article>
          <span>Internacional ex EE.UU./Chile</span>
          <strong>{pct(summary.internationalExUSChile)}</strong>
          <small>Diversificación internacional efectiva</small>
        </article>
      </div>

      <div className={styles.exposureGrid}>
        <article className={styles.exposureCard}>
          <div className={styles.exposureCardHead}>
            <div>
              <span>Empresas</span>
              <strong>Exposición efectiva</strong>
            </div>
            <small>Racional: VOO + SMH + Globales + BCH</small>
          </div>

          <div className={styles.exposureBars}>
            {topCompanies.map((company) => (
              <div key={company.ticker}>
                <div>
                  <span translate="no">{company.ticker} · {company.name}</span>
                  <strong>{pct(company.weight, 2)}</strong>
                </div>
                <div className={styles.exposureTrack}>
                  <i style={{ width: `${Math.min(100, company.weight * 8)}%` }} />
                </div>
                <small>
                  {company.repeated
                    ? `Repetida en ${company.vehicles.map((vehicle) => vehicle.ticker).join(' + ')}`
                    : `Exposición directa vía ${company.vehicles[0]?.ticker || 'cartera'}`}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.exposureCard}>
          <div className={styles.exposureCardHead}>
            <div>
              <span>Geografía</span>
              <strong>Países reales</strong>
            </div>
            <small>No confundir número de ETF con diversificación geográfica.</small>
          </div>

          <div className={styles.exposureBars}>
            {topCountries.map((country) => (
              <div key={country.name}>
                <div>
                  <span>{country.name}</span>
                  <strong>{pct(country.weight)}</strong>
                </div>
                <div className={styles.exposureTrack}>
                  <i style={{ width: `${Math.min(100, country.weight)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.exposureCard}>
          <div className={styles.exposureCardHead}>
            <div>
              <span>Sectores</span>
              <strong>Concentración económica</strong>
            </div>
            <small>Estimación look-through con los últimos snapshots disponibles.</small>
          </div>

          <div className={styles.exposureBars}>
            {topSectors.map((sector) => (
              <div key={sector.name}>
                <div>
                  <span>{sector.name}</span>
                  <strong>{pct(sector.weight)}</strong>
                </div>
                <div className={styles.exposureTrack}>
                  <i style={{ width: `${Math.min(100, sector.weight * 1.8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.exposureCard}>
          <div className={styles.exposureCardHead}>
            <div>
              <span>Solapamientos</span>
              <strong>Dónde se repite el riesgo</strong>
            </div>
            <small>La repetición no es mala por sí sola; debe ser consciente.</small>
          </div>

          <div className={styles.overlapList}>
            {exposure.overlaps.map((overlap) => (
              <div key={overlap.pair}>
                <div>
                  <strong translate="no">{overlap.pair}</strong>
                  <span className={
                    overlap.level === 'Alto'
                      ? styles.overlapHigh
                      : overlap.level === 'Medio'
                        ? styles.overlapMedium
                        : styles.overlapLow
                  }>{overlap.level}</span>
                </div>
                <div className={styles.overlapMetric}>
                  <span>Solapamiento visible</span>
                  <strong>{pct(overlap.knownOverlap, 2)}</strong>
                </div>
                {overlap.sharedTickers?.length > 0 && (
                  <small className={styles.overlapTickers}>
                    Empresas detectadas: <span translate="no">{overlap.sharedTickers.join(' · ')}</span>
                  </small>
                )}
                <p>{overlap.note}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className={styles.exposureReading}>
        <Icon name="info" size={16} />
        <div>
          <strong>Lectura Mirror</strong>
          <p>
            La cartera está diversificada por vehículos, pero mantiene una concentración real importante en EE.UU. y tecnología.
            Globales agrega diversificación efectiva, aunque parte de su peso vuelve a empresas estadounidenses ya presentes en VOO.
            Los porcentajes de solapamiento son mínimos conocidos basados en las posiciones visibles utilizadas; no representan el solapamiento total exacto entre todos los constituyentes.
          </p>
        </div>
      </div>

      <details className={styles.exposureSources}>
        <summary>Ver fecha de las composiciones utilizadas</summary>
        <div>
          {exposure.snapshotDates.map((item) => (
            <span key={item.ticker}>
              <b translate="no">{item.ticker}</b> · {new Date(item.date).toLocaleDateString('es-CL')} · {item.sourceLabel}
            </span>
          ))}
        </div>
      </details>
    </section>
  );
}
