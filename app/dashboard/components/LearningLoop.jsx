'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { readDecisionLog } from '../lib/decision-log';
import {
  decisionLearningSummary,
  learningClassification,
} from '../lib/decision-learning';
import styles from '../dashboard.module.css';

function toneClass(tone) {
  if (tone === 'good') return styles.learningGood;
  if (tone === 'warning') return styles.learningWarning;
  if (tone === 'danger') return styles.learningDanger;
  if (tone === 'info') return styles.learningInfo;
  return styles.learningNeutral;
}

export default function LearningLoop() {
  const [entries, setEntries] = useState([]);

  const refresh = () => setEntries(readDecisionLog(localStorage));

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('mirror-decision-log-updated', handler);
    return () => window.removeEventListener('mirror-decision-log-updated', handler);
  }, []);

  const summary = useMemo(() => decisionLearningSummary(entries), [entries]);
  const reviewed = useMemo(
    () => entries
      .filter((entry) => entry.reviewStatus === 'reviewed' && entry.review)
      .sort((a, b) => new Date(b.reviewedAt || b.date).getTime() - new Date(a.reviewedAt || a.date).getTime()),
    [entries],
  );

  const pending = entries.filter((entry) => entry.reviewStatus !== 'reviewed').length;

  return (
    <section className={styles.learningLoop}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Ciclo de Aprendizaje</p>
          <h2>Aprender del proceso, no perseguir el resultado</h2>
          <span className={styles.panelSubtitle}>
            Mirror evalúa si la decisión respetó las reglas por separado de lo que hizo el mercado después.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="brain" size={15} /> Feedback Loop</span>
      </div>

      <div className={styles.learningSummary}>
        <article>
          <span>Decisiones revisadas</span>
          <strong>{summary.reviewed}</strong>
          <small>{pending} todavía programada(s)</small>
        </article>
        <article>
          <span>Disciplina del proceso</span>
          <strong>{summary.processDisciplinePct == null ? '—' : `${summary.processDisciplinePct.toFixed(0)}%`}</strong>
          <small>No depende de si hubo ganancia o pérdida</small>
        </article>
        <article>
          <span>Éxitos peligrosos</span>
          <strong>{summary.dangerousWins}</strong>
          <small>Ganó dinero, pero rompió reglas</small>
        </article>
        <article>
          <span>Buenas decisiones con mal resultado</span>
          <strong>{summary.goodBad}</strong>
          <small>No cambiar reglas por una sola experiencia</small>
        </article>
      </div>

      <div className={styles.learningMatrix}>
        <article className={styles.learningGood}>
          <span>Buen proceso + buen resultado</span>
          <strong>{summary.reinforced}</strong>
          <p>Refuerza el proceso, sin asumir que una sola observación demuestra que la regla es perfecta.</p>
        </article>
        <article className={styles.learningInfo}>
          <span>Buen proceso + mal resultado</span>
          <strong>{summary.goodBad}</strong>
          <p>La pérdida no invalida automáticamente una regla bien aplicada. Primero revisar tesis y evidencia.</p>
        </article>
        <article className={styles.learningWarning}>
          <span>Mal proceso + buen resultado</span>
          <strong>{summary.dangerousWins}</strong>
          <p><b>Éxito peligroso:</b> el mercado premió una conducta que no queremos convertir en hábito.</p>
        </article>
        <article className={styles.learningDanger}>
          <span>Mal proceso + mal resultado</span>
          <strong>{summary.failures}</strong>
          <p>Prioridad: corregir la disciplina antes de buscar una nueva explicación para justificar la decisión.</p>
        </article>
      </div>

      <div className={styles.learningRule}>
        <Icon name="shield" size={17} />
        <div>
          <strong>Regla de aprendizaje Mirror</strong>
          <p>
            Ninguna regla cambia automáticamente por una sola decisión. Un ajuste requiere evidencia repetida,
            cambio estructural de tesis o una revisión formal registrada.
          </p>
        </div>
      </div>

      <div className={styles.learningLessons}>
        <div className={styles.learningLessonsHead}>
          <strong>Aprendizajes recientes</strong>
          <span>{summary.lessons.length ? 'Lo que ya aprendimos' : 'Aparecerán después de cerrar revisiones'}</span>
        </div>

        {summary.lessons.length ? summary.lessons.slice(0, 5).map((entry) => {
          const classification = learningClassification(entry);
          return (
            <article key={entry.id}>
              <div>
                <span className={toneClass(classification.tone)}>{classification.label}</span>
                {entry.asset && <b translate="no">{entry.asset}</b>}
                <time>{new Date(entry.reviewedAt || entry.date).toLocaleDateString('es-CL')}</time>
              </div>
              <strong>{entry.decision}</strong>
              <p>{entry.review.lesson}</p>
              <small>{classification.explanation}</small>
            </article>
          );
        }) : (
          <div className={styles.learningEmpty}>
            <Icon name="clock" size={17} />
            <div>
              <strong>Aún no hay decisiones revisadas</strong>
              <span>
                Esto es correcto: primero registramos la decisión, dejamos pasar el tiempo definido y luego evaluamos
                proceso, resultado y tesis por separado.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
