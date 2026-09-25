'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { buildDisciplineState, RISK_CONSTITUTION, DISCIPLINE_THRESHOLDS } from '../lib/risk-constitution';
import styles from '../dashboard.module.css';

function alertClass(severity) {
  return severity === 'block' ? styles.disciplineBlock : styles.disciplineWarning;
}

export default function DisciplineMode({ portfolio }) {
  const discipline = useMemo(() => buildDisciplineState(portfolio), [portfolio]);
  const [opportunityData, setOpportunityData] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/opportunities', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active) setOpportunityData(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const blockedCandidates = useMemo(() => {
    return (opportunityData?.candidates || [])
      .filter((candidate) => candidate.decision?.failedGates?.length > 0)
      .map((candidate) => ({
        ticker: candidate.ticker,
        status: candidate.decision.status,
        blocker: candidate.decision.mainBlocker,
      }));
  }, [opportunityData]);

  const statusClass = discipline.blockers > 0
    ? styles.disciplineStatusBlock
    : discipline.warnings > 0
      ? styles.disciplineStatusWarning
      : styles.disciplineStatusGood;

  return (
    <section className={styles.disciplinePanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Constitución de Riesgo</p>
          <h2>Modo Disciplina</h2>
          <span className={styles.panelSubtitle}>
            Las reglas se definen en frío. Cuando el mercado presiona, Mirror las ejecuta y explica; no las renegocia.
          </span>
        </div>
        <span className={statusClass}>
          <Icon name="shield" size={15} />
          {discipline.status}
        </span>
      </div>

      <div className={styles.disciplineSummary}>
        <article>
          <span>Alertas activas</span>
          <strong>{discipline.alerts.length}</strong>
          <small>{discipline.blockers} bloqueantes · {discipline.warnings} vigilancia</small>
        </article>
        <article>
          <span>SMH</span>
          <strong>{portfolio.assets.find((asset) => asset.ticker === 'SMH')?.weight.toFixed(1) || '—'}%</strong>
          <small>Objetivo máximo: {DISCIPLINE_THRESHOLDS.smhTargetMax}% · revisar rebalanceo sobre {DISCIPLINE_THRESHOLDS.smhRebalanceReview}%</small>
        </article>
        <article>
          <span>Tecnología efectiva</span>
          <strong>{discipline.exposure.summary.technology.toFixed(1)}%</strong>
          <small>Vigilancia operativa desde {DISCIPLINE_THRESHOLDS.technologyWarning}%</small>
        </article>
        <article>
          <span>Mayor empresa efectiva</span>
          <strong translate="no">
            {discipline.exposure.summary.largestCompany?.ticker || '—'} · {discipline.exposure.summary.largestCompany?.weight.toFixed(2) || '0.00'}%
          </strong>
          <small>Vigilancia operativa desde {DISCIPLINE_THRESHOLDS.singleCompanyWarning}%</small>
        </article>
      </div>

      <div className={styles.disciplineGrid}>
        <article className={styles.disciplineActive}>
          <div className={styles.disciplineSectionHead}>
            <div>
              <span>Reglas activas hoy</span>
              <strong>Qué permite y qué bloquea Mirror</strong>
            </div>
          </div>

          {discipline.alerts.length ? (
            <div className={styles.disciplineAlertList}>
              {discipline.alerts.map((alert) => (
                <div className={alertClass(alert.severity)} key={alert.id}>
                  <div>
                    <span>{alert.rule}</span>
                    <strong>{alert.current}</strong>
                  </div>
                  <small>{alert.limit}</small>
                  <p>{alert.action}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.disciplineNoAlerts}>
              <Icon name="check" size={17} />
              <div>
                <strong>Sin reglas activadas</strong>
                <span>La cartera está dentro de los límites definidos actualmente.</span>
              </div>
            </div>
          )}

          {blockedCandidates.length > 0 && (
            <div className={styles.candidateBlocks}>
              <span>Candidatos bloqueados por hard gates</span>
              {blockedCandidates.map((candidate) => (
                <div key={candidate.ticker}>
                  <strong translate="no">{candidate.ticker}</strong>
                  <p>{candidate.blocker || candidate.status}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className={styles.disciplinePrinciple}>
          <span>Principio operativo</span>
          <blockquote>
            Las reglas sirven especialmente cuando aparece la tentación de romperlas.
          </blockquote>
          <p>
            Mirror no convierte una caída, un rebote o una emoción en una decisión. Primero revisa la regla, luego la evidencia y finalmente la acción permitida.
          </p>

          <div className={styles.disciplineFlow}>
            <span>1 · Regla previa</span>
            <i>→</i>
            <span>2 · Evidencia</span>
            <i>→</i>
            <span>3 · Acción permitida</span>
          </div>
        </article>
      </div>

      <details className={styles.constitutionDetails}>
        <summary>Ver Constitución Mirror completa · 8 reglas</summary>
        <div className={styles.constitutionGrid}>
          {RISK_CONSTITUTION.map((rule) => (
            <article key={rule.id}>
              <b>{String(rule.number).padStart(2, '0')}</b>
              <div>
                <strong>{rule.title}</strong>
                <p>{rule.text}</p>
              </div>
              <span>{rule.type === 'hard' ? 'Regla dura' : 'Principio'}</span>
            </article>
          ))}
        </div>

        <div className={styles.thresholdNote}>
          <Icon name="info" size={15} />
          <span>
            Los umbrales de tecnología y empresa individual son <strong>alertas operativas iniciales</strong>, no órdenes automáticas de venta.
            En SMH, superar 20% bloquea nuevos aportes; recién sobre 22% se revisa rebalanceo. Ningún umbral genera una venta automática.
          </span>
        </div>
      </details>
    </section>
  );
}
