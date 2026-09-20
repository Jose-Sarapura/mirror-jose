'use client';

import { useEffect } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const RULE_MARKER = 'mirror-v3-btc-cycle-context-rule-v1';

const cycles = [
  {
    year: '2017',
    type: 'Ciclo clásico',
    valuation: 'MVRV llegó aproximadamente a 4× el realized cap.',
    holders: 'Los LTH reactivaron cerca de 17% de la oferta antes del techo.',
    structure: 'Gran transferencia de riqueza desde holders antiguos hacia compradores nuevos.',
    capital: 'Euforia amplia y fuerte entrada de participantes nuevos.',
    lesson: 'El calendario coincidió con el techo, pero la señal útil fue la confluencia de euforia + distribución + nuevos compradores.',
  },
  {
    year: '2021',
    type: 'Doble techo',
    valuation: 'MVRV volvió a aproximarse a 4×, pero el segundo máximo mostró menor rentabilidad on-chain.',
    holders: 'Distribución agresiva en la primera mitad; luego re-acumulación antes del segundo máximo.',
    structure: 'El STH cost basis (~US$53K) fue soporte clave tras el máximo de noviembre; perderlo elevó el riesgo de régimen bajista.',
    capital: 'El impulso de capital de STH alcanzó su máximo antes del techo final.',
    lesson: 'Una caída fuerte en abril no significó fin del ciclo. Salir solo por drawdown habría sido prematuro; reentrada habría sido obligatoria.',
  },
  {
    year: '2025',
    type: 'Ciclo más maduro',
    valuation: 'MVRV se mantuvo mayormente entre 2× y 3×, sin repetir la euforia de 2017/2021.',
    holders: 'Distribución LTH persistente desde julio; después del máximo continuó incluso con debilidad.',
    structure: 'Tras el ATH de ~US$126K, BTC perdió el STH cost basis y entró en una fase correctiva más frágil.',
    capital: 'ETF y demanda spot perdieron fuerza mientras aumentó la distribución.',
    lesson: 'El patrón de 4 años cambió de forma: hubo techo sin blow-off clásico. El ciclo sirve de contexto, no como reloj de venta.',
  },
];

const families = [
  {
    title: 'Valoración / euforia',
    body: 'MVRV y rentabilidad agregada. Busca exceso de beneficios, no un número mágico aislado.',
  },
  {
    title: 'Distribución LTH',
    body: 'Comprueba si holders antiguos están transfiriendo oferta de forma sostenida a compradores recientes.',
  },
  {
    title: 'Demanda / capital',
    body: 'Realized Cap, ETF, stablecoins y compradores institucionales. Sin demanda nueva, una tendencia pierde combustible.',
  },
  {
    title: 'Estructura de mercado',
    body: 'True Market Mean, STH cost basis y capacidad de recuperar niveles perdidos. Confirma si la corrección cambia de régimen.',
  },
];

function seedCycleRule() {
  if (typeof window === 'undefined' || localStorage.getItem(RULE_MARKER) === 'seeded') return;
  const existing = readDecisionLog(localStorage);

  if (!existing.some((entry) => entry.id === 'btc-cycle-context-rule-v1')) {
    appendDecisionLog(localStorage, {
      id: 'btc-cycle-context-rule-v1',
      date: new Date().toISOString().slice(0, 10),
      type: 'rule_definition',
      asset: 'BTC',
      ruleId: 'btc-cycle-context',
      ruleTitle: 'El ciclo es contexto, no gatillo de venta',
      decision: 'No vender Bitcoin solo porque el calendario histórico sugiera una fase madura',
      reason: 'Los ciclos muestran recurrencias, pero su forma ha cambiado con la madurez, liquidez e institucionalización de Bitcoin.',
      evidence: '2017 mostró un techo eufórico clásico; 2021 tuvo doble techo; 2025 alcanzó un máximo con MVRV más moderado y menor volatilidad.',
      source: 'btc-cycle-lab',
      reviewStatus: 'pending',
    });
  }

  localStorage.setItem(RULE_MARKER, 'seeded');
}

export default function BTCCycleLab() {
  useEffect(() => {
    seedCycleRule();
  }, []);

  return (
    <section className={styles.btcCyclePanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC Cycle Lab</p>
          <h2>2017 · 2021 · 2025: qué señales sobrevivieron</h2>
          <span className={styles.panelSubtitle}>
            Validación histórica para construir una salida anticipada sin convertir el ciclo de cuatro años en una regla automática.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="brain" size={15} /> Evidencia histórica</span>
      </div>

      <div className={styles.btcCycleFamilies}>
        {families.map((family) => (
          <article key={family.title}>
            <strong>{family.title}</strong>
            <p>{family.body}</p>
          </article>
        ))}
      </div>

      <div className={styles.btcCycleTable}>
        <div className={styles.btcCycleHead}>
          <span>Ciclo</span>
          <span>Valoración</span>
          <span>LTH</span>
          <span>Estructura / capital</span>
        </div>
        {cycles.map((cycle) => (
          <div className={styles.btcCycleRow} key={cycle.year}>
            <div>
              <strong>{cycle.year}</strong>
              <small>{cycle.type}</small>
            </div>
            <p>{cycle.valuation}</p>
            <p>{cycle.holders}</p>
            <div>
              <p>{cycle.structure}</p>
              <small>{cycle.capital}</small>
            </div>
            <blockquote>{cycle.lesson}</blockquote>
          </div>
        ))}
      </div>

      <div className={styles.btcCurrentResearch}>
        <div>
          <p className={styles.kicker}>Snapshot investigación · 16-09-2026</p>
          <h3>Vigilancia de demanda y estructura, no señal de salida automática</h3>
        </div>
        <div className={styles.btcCurrentGrid}>
          <article>
            <span>Valoración</span>
            <strong>No eufórica</strong>
            <small>La lectura de ciclo reciente había salido de zona de valor, pero seguía lejos de extremos históricos.</small>
          </article>
          <article>
            <span>Estructura</span>
            <strong>Debilitada</strong>
            <small>BTC cayó bajo el True Market Mean (~US$76,7K); STH cost basis ~US$71,3K queda como siguiente referencia.</small>
          </article>
          <article>
            <span>Demanda</span>
            <strong>En pausa</strong>
            <small>Realized Cap frenó, ETF pasaron a salidas, stablecoins planas y tesorerías corporativas dejaron de comprar.</small>
          </article>
          <article>
            <span>Lectura Mirror</span>
            <strong>Confirmar antes de actuar</strong>
            <small>Hay deterioro en dos familias, pero no euforia extrema ni invalidación de tesis. La evidencia debe evolucionar antes de reducir.</small>
          </article>
        </div>
      </div>

      <div className={styles.btcCycleConclusions}>
        <div>
          <Icon name="check" size={15} />
          <span><strong>Se mantiene:</strong> MVRV, LTH, demanda/capital y STH cost basis aportan información distinta y complementaria.</span>
        </div>
        <div>
          <Icon name="check" size={15} />
          <span><strong>Se descarta:</strong> “pasaron cuatro años, hay que vender” y “cayó X%, hay que salir”.</span>
        </div>
        <div>
          <Icon name="target" size={15} />
          <span><strong>Pendiente:</strong> validar una familia realmente independiente —STH/LTH cost basis, demanda spot/ETF o comportamiento de holders— con datos históricos suficientes. No seguiremos afinando umbrales de precio, MVRV y Realized Cap para forzar una regla de salida.</span>
        </div>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="info" size={15} />
        <span>
          <strong>Metodología:</strong> Mirror busca reglas simples que funcionen en ciclos distintos y evita sobreajustar el pasado.
          El calendario aumenta nuestra atención; la evidencia decide la acción.
        </span>
      </div>
    </section>
  );
}
