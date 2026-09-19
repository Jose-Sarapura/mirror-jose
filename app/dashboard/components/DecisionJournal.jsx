'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { RISK_CONSTITUTION } from '../lib/risk-constitution';
import {
  DECISION_TYPES,
  appendDecisionLog,
  readDecisionLog,
  removeDecisionLog,
  reviewDecision,
} from '../lib/decision-log';
import styles from '../dashboard.module.css';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function typeLabel(type) {
  return DECISION_TYPES.find((item) => item.value === type)?.label || type;
}

export default function DecisionJournal({ portfolio }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(() => ({
    date: today(),
    type: 'no_action',
    asset: '',
    ruleId: '',
    decision: '',
    reason: '',
    evidence: '',
    reviewDate: addDays(today(), 90),
  }));
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});

  const refresh = () => setEntries(readDecisionLog(localStorage));

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('mirror-decision-log-updated', handler);
    return () => window.removeEventListener('mirror-decision-log-updated', handler);
  }, []);

  const summary = useMemo(() => {
    const pending = entries.filter((entry) => entry.reviewStatus !== 'reviewed').length;
    const exceptions = entries.filter((entry) => entry.type === 'exception' || entry.type === 'rule_change').length;
    const automatic = entries.filter((entry) => entry.source === 'purchase').length;
    const overdue = entries.filter((entry) => (
      entry.reviewStatus !== 'reviewed' &&
      entry.reviewDate &&
      entry.reviewDate <= today()
    )).length;

    return { pending, exceptions, automatic, overdue };
  }, [entries]);

  const assetOptions = [
    ...portfolio.assets.map((asset) => ({ ticker: asset.ticker, label: asset.name })),
    { ticker: 'VST', label: 'Vistra Corp.' },
    { ticker: 'GRID', label: 'First Trust Smart Grid ETF' },
    { ticker: 'CCJ', label: 'Cameco Corp.' },
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    const rule = RISK_CONSTITUTION.find((item) => item.id === form.ruleId);
    const requiresEvidence = form.type === 'exception' || form.type === 'rule_change';

    if (!form.decision.trim() || !form.reason.trim()) {
      setError('La decisión y el motivo son obligatorios.');
      return;
    }

    if (requiresEvidence && (!rule || !form.evidence.trim())) {
      setError('Una excepción o cambio de regla debe indicar la regla involucrada y la evidencia que justifica el cambio.');
      return;
    }

    appendDecisionLog(localStorage, {
      ...form,
      ruleTitle: rule?.title || '',
      source: 'manual',
    });

    window.dispatchEvent(new Event('mirror-decision-log-updated'));
    setForm({
      date: today(),
      type: 'no_action',
      asset: '',
      ruleId: '',
      decision: '',
      reason: '',
      evidence: '',
      reviewDate: addDays(today(), 90),
    });
  };

  const handleDelete = (entry) => {
    const next = removeDecisionLog(localStorage, entry.id);
    setEntries(next);
  };

  const handleReview = (entry) => {
    const note = String(reviewNotes[entry.id] || '').trim();
    if (!note) {
      setError('Para cerrar una revisión, escribe qué aprendiste o si la decisión original sigue siendo válida.');
      return;
    }
    const next = reviewDecision(localStorage, entry.id, note);
    setEntries(next);
    setReviewNotes((current) => ({ ...current, [entry.id]: '' }));
    setError('');
  };

  return (
    <section className={styles.decisionJournal}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Regla Nº 8</p>
          <h2>Registro de Decisiones</h2>
          <span className={styles.panelSubtitle}>
            Mirror guarda la decisión y su razonamiento para evaluar después el proceso, no solo si el mercado terminó dando la razón.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="edit" size={15} /> Auditoría personal</span>
      </div>

      <div className={styles.decisionSummary}>
        <article>
          <span>Decisiones registradas</span>
          <strong>{entries.length}</strong>
          <small>Historial total</small>
        </article>
        <article>
          <span>Excepciones / cambios</span>
          <strong>{summary.exceptions}</strong>
          <small>Deben tener evidencia explícita</small>
        </article>
        <article>
          <span>Revisiones pendientes</span>
          <strong>{summary.pending}</strong>
          <small>{summary.overdue ? `${summary.overdue} vencida(s)` : 'Ninguna vencida'}</small>
        </article>
        <article>
          <span>Compras automáticas</span>
          <strong>{summary.automatic}</strong>
          <small>Registradas desde Mirror</small>
        </article>
      </div>

      <details className={styles.decisionFormDetails}>
        <summary>+ Registrar una nueva decisión</summary>
        <form className={styles.decisionForm} onSubmit={handleSubmit}>
          <label>
            Tipo
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {DECISION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label>
            Fecha
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </label>

          <label>
            Activo
            <select value={form.asset} onChange={(event) => setForm({ ...form, asset: event.target.value })}>
              <option value="">Cartera / regla general</option>
              {assetOptions.map((item) => <option key={item.ticker} value={item.ticker}>{item.ticker} · {item.label}</option>)}
            </select>
          </label>

          <label>
            Regla involucrada
            <select value={form.ruleId} onChange={(event) => setForm({ ...form, ruleId: event.target.value })}>
              <option value="">Sin regla específica</option>
              {RISK_CONSTITUTION.map((rule) => <option key={rule.id} value={rule.id}>{rule.number}. {rule.title}</option>)}
            </select>
          </label>

          <label className={styles.decisionWide}>
            Decisión tomada
            <input
              type="text"
              value={form.decision}
              onChange={(event) => setForm({ ...form, decision: event.target.value })}
              placeholder="Ej.: No aumentar SMH y dirigir el próximo aporte a Globales"
              required
            />
          </label>

          <label className={styles.decisionWide}>
            Motivo
            <textarea
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              placeholder="¿Por qué esta decisión respeta o modifica el plan?"
              required
            />
          </label>

          <label className={styles.decisionWide}>
            Evidencia
            <textarea
              value={form.evidence}
              onChange={(event) => setForm({ ...form, evidence: event.target.value })}
              placeholder="Datos, resultados, valoración, cambio de tesis, riesgo, etc. Obligatoria en excepciones y cambios de regla."
            />
          </label>

          <label>
            Revisar decisión el
            <input type="date" value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} />
          </label>

          <div className={styles.decisionFormAction}>
            <button type="submit" className={styles.primaryButton}><Icon name="check" size={15} /> Guardar decisión</button>
          </div>
        </form>
      </details>

      {error && <p className={styles.decisionError}><Icon name="info" size={14} /> {error}</p>}

      <div className={styles.decisionTimeline}>
        <div className={styles.decisionTimelineHead}>
          <strong>Historial</strong>
          <span>Últimas {Math.min(entries.length, 8)} decisiones</span>
        </div>

        {entries.length ? entries.slice(0, 8).map((entry) => (
          <article className={styles.decisionEntry} key={entry.id}>
            <div className={styles.decisionEntryTop}>
              <div>
                <span className={styles.decisionType}>{typeLabel(entry.type)}</span>
                {entry.asset && <b translate="no">{entry.asset}</b>}
                {entry.source === 'purchase' && <em>Automática</em>}
              </div>
              <time>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('es-CL')}</time>
            </div>

            <h3>{entry.decision}</h3>
            <p>{entry.reason}</p>

            {(entry.ruleTitle || entry.evidence) && (
              <details className={styles.decisionEvidence}>
                <summary>Ver regla y evidencia</summary>
                {entry.ruleTitle && <span><strong>Regla:</strong> {entry.ruleTitle}</span>}
                {entry.evidence && <span><strong>Evidencia:</strong> {entry.evidence}</span>}
              </details>
            )}

            <div className={styles.decisionReviewBar}>
              {entry.reviewStatus === 'reviewed' ? (
                <div className={styles.decisionReviewed}>
                  <Icon name="check" size={14} />
                  <span><strong>Revisada.</strong> {entry.reviewNote || 'Sin observación adicional.'}</span>
                </div>
              ) : (
                <>
                  <div>
                    <Icon name="clock" size={14} />
                    <span>
                      Revisar: <strong>{entry.reviewDate ? new Date(`${entry.reviewDate}T12:00:00`).toLocaleDateString('es-CL') : 'sin fecha'}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={reviewNotes[entry.id] || ''}
                    onChange={(event) => setReviewNotes((current) => ({ ...current, [entry.id]: event.target.value }))}
                    placeholder="¿Qué aprendimos?"
                  />
                  <button type="button" onClick={() => handleReview(entry)}>Cerrar revisión</button>
                </>
              )}
            </div>

            {entry.source !== 'purchase' && (
              <button className={styles.decisionDelete} type="button" onClick={() => handleDelete(entry)}>Eliminar registro</button>
            )}
          </article>
        )) : (
          <div className={styles.decisionEmpty}>
            <Icon name="edit" size={18} />
            <div>
              <strong>Aún no hay decisiones registradas</strong>
              <span>Las próximas compras desde Mirror aparecerán automáticamente aquí.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
