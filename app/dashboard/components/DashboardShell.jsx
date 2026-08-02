'use client';

import Link from 'next/link';
import Icon from './Icon';
import styles from '../dashboard.module.css';

const NAV = [
  { key: 'overview', label: 'Inicio', icon: 'home' },
  { key: 'portfolio', label: 'Portafolio', icon: 'portfolio' },
  { key: 'intelligence', label: 'Inteligencia', icon: 'brain' },
  { key: 'projections', label: 'Proyecciones', icon: 'chart' },
  { key: 'settings', label: 'Config.', icon: 'settings' },
];

export default function DashboardShell({ active, onChange, updatedAt, onRefresh, refreshing, children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}>M</span>
          <span>
            <strong>Mirror</strong>
            <small>Portfolio Intelligence</small>
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
            <p>Mirror Wealth</p>
            <h1>Hola, José</h1>
          </div>
          <button type="button" className={styles.refreshButton} onClick={onRefresh} disabled={refreshing}>
            <Icon name="refresh" />
            <span>{refreshing ? 'Actualizando' : 'Actualizar'}</span>
          </button>
        </header>

        <main className={styles.content}>{children}</main>
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
