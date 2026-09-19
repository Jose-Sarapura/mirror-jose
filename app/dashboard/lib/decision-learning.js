import { buildDisciplineState } from './risk-constitution';

export const PROCESS_OPTIONS = [
  { value: 'respected', label: 'Respeté las reglas' },
  { value: 'documented_exception', label: 'Excepción documentada' },
  { value: 'broken', label: 'Rompí / ignoré una regla' },
];

export const OUTCOME_OPTIONS = [
  { value: 'favorable', label: 'Favorable' },
  { value: 'neutral', label: 'Neutral / mixto' },
  { value: 'unfavorable', label: 'Desfavorable' },
  { value: 'too_early', label: 'Aún es pronto' },
];

export const THESIS_OPTIONS = [
  { value: 'intact', label: 'Tesis intacta' },
  { value: 'stronger', label: 'Tesis más fuerte' },
  { value: 'weaker', label: 'Tesis debilitada' },
  { value: 'invalidated', label: 'Tesis invalidada' },
  { value: 'not_applicable', label: 'No aplica' },
];

function allocationHealth(assets = []) {
  const deviation = assets.reduce(
    (sum, asset) => sum + Math.abs(Number(asset.weight || 0) - Number(asset.targetWeight || 0)),
    0,
  );
  return Math.max(0, Math.round(100 - deviation * 2.2));
}

export function buildDecisionSnapshot(portfolio, assetTicker = '', extra = {}) {
  if (!portfolio) return null;
  const discipline = buildDisciplineState(portfolio);
  const asset = assetTicker
    ? portfolio.assets.find((item) => item.ticker === assetTicker)
    : null;

  return {
    capturedAt: new Date().toISOString(),
    totalCLP: Number(portfolio.totalCLP || 0),
    investedCLP: Number(portfolio.investedCLP || 0),
    allocationHealth: allocationHealth(portfolio.assets),
    smhWeight: Number(portfolio.assets.find((item) => item.ticker === 'SMH')?.weight || 0),
    technology: Number(discipline.exposure.summary.technology || 0),
    largestCompanyTicker: discipline.exposure.summary.largestCompany?.ticker || '',
    largestCompanyWeight: Number(discipline.exposure.summary.largestCompany?.weight || 0),
    asset: asset ? {
      ticker: asset.ticker,
      price: Number(asset.price || 0),
      currency: asset.currency || '',
      weight: Number(asset.weight || 0),
      targetWeight: Number(asset.targetWeight || 0),
      totalReturnPct: Number(asset.totalReturnPct || 0),
    } : null,
    ...extra,
  };
}

export function isGoodProcess(review) {
  return review?.process === 'respected' || review?.process === 'documented_exception';
}

export function learningClassification(entry) {
  const review = entry?.review;
  if (!review) {
    return {
      key: 'pending',
      label: 'Sin revisar',
      tone: 'neutral',
      explanation: 'Todavía no existe evidencia posterior suficiente para evaluar el proceso.',
    };
  }

  const goodProcess = isGoodProcess(review);
  const favorable = review.outcome === 'favorable';
  const unfavorable = review.outcome === 'unfavorable';

  if (goodProcess && favorable) {
    return {
      key: 'reinforce',
      label: 'Proceso sólido + resultado favorable',
      tone: 'good',
      explanation: 'La decisión respetó el sistema y el resultado acompañó. Refuerza el proceso, pero no prueba por sí sola que la regla sea perfecta.',
    };
  }

  if (goodProcess && unfavorable) {
    return {
      key: 'good_bad',
      label: 'Buena decisión + resultado desfavorable',
      tone: 'info',
      explanation: 'Un resultado adverso no invalida automáticamente una decisión bien tomada. Revisar tesis y evidencia antes de tocar la regla.',
    };
  }

  if (!goodProcess && favorable) {
    return {
      key: 'dangerous_win',
      label: 'Éxito peligroso',
      tone: 'warning',
      explanation: 'El resultado fue favorable, pero el proceso rompió reglas. Mirror no debe premiar una conducta riesgosa solo porque esta vez funcionó.',
    };
  }

  if (!goodProcess && unfavorable) {
    return {
      key: 'discipline_failure',
      label: 'Fallo de disciplina',
      tone: 'danger',
      explanation: 'El proceso rompió reglas y el resultado fue adverso. La prioridad es corregir la conducta antes que buscar una nueva explicación del mercado.',
    };
  }

  return {
    key: 'inconclusive',
    label: 'Aprendizaje aún inconcluso',
    tone: 'neutral',
    explanation: review.outcome === 'too_early'
      ? 'Todavía es pronto para evaluar el resultado. Mantener la observación sin cambiar reglas.'
      : 'El resultado es mixto; conservar el registro y buscar evidencia adicional.',
  };
}

export function decisionLearningSummary(entries = []) {
  const reviewed = entries.filter((entry) => entry.reviewStatus === 'reviewed' && entry.review);
  const goodProcess = reviewed.filter((entry) => isGoodProcess(entry.review));
  const broken = reviewed.filter((entry) => entry.review?.process === 'broken');
  const dangerousWins = reviewed.filter((entry) => learningClassification(entry).key === 'dangerous_win');
  const goodBad = reviewed.filter((entry) => learningClassification(entry).key === 'good_bad');
  const failures = reviewed.filter((entry) => learningClassification(entry).key === 'discipline_failure');
  const reinforced = reviewed.filter((entry) => learningClassification(entry).key === 'reinforce');

  return {
    reviewed: reviewed.length,
    goodProcess: goodProcess.length,
    broken: broken.length,
    processDisciplinePct: reviewed.length ? (goodProcess.length / reviewed.length) * 100 : null,
    dangerousWins: dangerousWins.length,
    goodBad: goodBad.length,
    failures: failures.length,
    reinforced: reinforced.length,
    lessons: reviewed
      .filter((entry) => entry.review?.lesson)
      .sort((a, b) => new Date(b.reviewedAt || b.date).getTime() - new Date(a.reviewedAt || a.date).getTime()),
  };
}
