'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import PortfolioHealthGate from './PortfolioHealthGate';
import StrategyConstitution from './StrategyConstitution';
import CryptoDecisionSummary from './CryptoDecisionSummary';
import { mergePortfolioData } from '../lib/calculations';
import { readStoredSettings } from '../lib/settings';
import styles from '../dashboard.module.css';

const NAV = [
  { key: 'overview', label: 'Inicio', icon: 'home' },
  { key: 'portfolio', label: 'Portafolio', icon: 'portfolio' },
  { key: 'intelligence', label: 'Inteligencia', icon: 'brain' },
  { key: 'opportunities', label: 'Oportunidades', icon: 'target' },
  { key: 'projections', label: 'Proyecciones', icon: 'chart' },
  { key: 'settings', label: 'Config.', icon: 'settings' },
];

export default function DashboardShell({ active, onChange, updatedAt, onRefresh, refreshing, children }) {
  const [portfolioHealthData, setPortfolioHealthData] = useState(null);

  useEffect(() => {
    if (active !== 'portfolio' && active !== 'intelligence') return undefined;

    let alive = true;
    const loadPortfolioHealth = async () => {
      try {
        const response = await fetch('/api/dashboard/portfolio', { cache: 'no-store' });
        if (!response.ok) return;
        const apiData = await response.json();
        const settings = readStoredSettings(localStorage);
        const merged = mergePortfolioData(apiData, settings);
        if (alive) setPortfolioHealthData(merged);
      } catch {
        // La vista principal sigue operativa aunque esta capa no actualice.
      }
    };

    loadPortfolioHealth();
    return () => { alive = false; };
  }, [active, updatedAt]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}>M</span>
          <span>
            <strong translate="no" className="notranslate">Mirror</strong>
            <small translate="no" className="notranslate">Portfolio Intelligence</small>
          </span>
        </Link>

        <nav className={styles.sideNav} aria-label="Navegación principal">
          {NAV.map((item) => (
            <button
              type="button"
              key={item.key}
              className={active === item.key ? styles.navActive : styles.navButton}
              onClick={() => onChange(item.key)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.liveDot} />
          <div>
            <strong>Datos de mercado</strong>
            <small>{updatedAt ? new Date(updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'Conectando'}</small>
          </div>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.header}>
          <div>
            <p translate="no" className="notranslate">Mirror Wealth</p>
            <h1>Hola, José</h1>
          </div>
          <button type="button" className={styles.refreshButton} onClick={onRefresh} disabled={refreshing}>
            <Icon name="refresh" />
            <span>{refreshing ? 'Actualizando' : 'Actualizar'}</span>
          </button>
        </header>

        <main className={styles.content}>
          {active === 'intelligence' ? (
            <>
              {portfolioHealthData ? (
                <>
                  <CryptoDecisionSummary portfolio={portfolioHealthData} ticker="BTC" />
                  <CryptoDecisionSummary portfolio={portfolioHealthData} ticker="ETH" />
                </>
              ) : (
                <section className={styles.healthPanel}>
                  <div className={styles.panelHeader}>
                    <div><p className={styles.kicker}>Decisiones cripto</p><h2>Actualizando BTC y ETH</h2></div>
                  </div>
                </section>
              )}

              <details className={`${styles.healthPanel} ${styles.healthDetails}`}>
                <summary>Ver análisis completo · BTC, ETH y comparación</summary>
                <div>{children}</div>
              </details>
            </>
          ) : (
            <>
              {children}
              {active === 'portfolio' && portfolioHealthData && (
                <>
                  <StrategyConstitution portfolio={portfolioHealthData} />
                  <PortfolioHealthGate portfolio={portfolioHealthData} context="portfolio" />
                </>
              )}
            </>
          )}
        </main>
      </div>

      <nav className={styles.mobileNav} aria-label="Navegación móvil">
        {NAV.map((item) => (
          <button
            type="button"
            key={item.key}
            className={active === item.key ? styles.mobileNavActive : ''}
            onClick={() => onChange(item.key)}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
