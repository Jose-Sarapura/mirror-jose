export const DECISION_LOG_KEY = 'mirror-v3-decision-log-v1';
export const DECISION_BASELINE_KEY = 'mirror-v3-decision-baseline-v1';

export const DECISION_TYPES = [
  { value: 'strategy', label: 'Estrategia' },
  { value: 'rule_definition', label: 'Regla definida' },
  { value: 'opportunity', label: 'Oportunidad' },
  { value: 'buy', label: 'Compra' },
  { value: 'sell', label: 'Venta' },
  { value: 'rule_change', label: 'Cambio de regla' },
  { value: 'exception', label: 'Excepción' },
  { value: 'no_action', label: 'No actuar' },
  { value: 'rebalance', label: 'Rebalanceo' },
];

function normalize(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: entry.id || `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: entry.createdAt || new Date().toISOString(),
      date: entry.date || new Date().toISOString().slice(0, 10),
      type: entry.type || 'no_action',
      asset: entry.asset || '',
      ruleId: entry.ruleId || '',
      ruleTitle: entry.ruleTitle || '',
      decision: entry.decision || '',
      reason: entry.reason || '',
      evidence: entry.evidence || '',
      reviewDate: entry.reviewDate || '',
      reviewStatus: entry.reviewStatus || 'pending',
      reviewNote: entry.reviewNote || '',
      source: entry.source || 'manual',
      sourceTransactionId: entry.sourceTransactionId || '',
      bias: entry.bias || '',
      snapshot: entry.snapshot || null,
      review: entry.review || null,
      reviewedAt: entry.reviewedAt || '',
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function readDecisionLog(storage) {
  if (!storage) return [];
  try {
    return normalize(JSON.parse(storage.getItem(DECISION_LOG_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function persistDecisionLog(storage, entries) {
  if (!storage) return;
  storage.setItem(DECISION_LOG_KEY, JSON.stringify(normalize(entries)));
}

export function appendDecisionLog(storage, entry) {
  const entries = readDecisionLog(storage);
  const next = {
    id: entry.id || `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt || new Date().toISOString(),
    date: entry.date || new Date().toISOString().slice(0, 10),
    type: entry.type || 'no_action',
    asset: entry.asset || '',
    ruleId: entry.ruleId || '',
    ruleTitle: entry.ruleTitle || '',
    decision: entry.decision || '',
    reason: entry.reason || '',
    evidence: entry.evidence || '',
    reviewDate: entry.reviewDate || '',
    reviewStatus: entry.reviewStatus || 'pending',
    reviewNote: entry.reviewNote || '',
    source: entry.source || 'manual',
    sourceTransactionId: entry.sourceTransactionId || '',
    bias: entry.bias || '',
    snapshot: entry.snapshot || null,
    review: entry.review || null,
    reviewedAt: entry.reviewedAt || '',
  };
  persistDecisionLog(storage, [next, ...entries]);
  return next;
}

export function removeDecisionLog(storage, decisionId) {
  const next = readDecisionLog(storage).filter((entry) => entry.id !== decisionId);
  persistDecisionLog(storage, next);
  return next;
}

export function removeDecisionBySource(storage, sourceTransactionId) {
  if (!sourceTransactionId) return readDecisionLog(storage);
  const next = readDecisionLog(storage).filter((entry) => entry.sourceTransactionId !== sourceTransactionId);
  persistDecisionLog(storage, next);
  return next;
}

export function reviewDecision(storage, decisionId, reviewInput) {
  const review = typeof reviewInput === 'string'
    ? {
        process: 'respected',
        outcome: 'too_early',
        thesis: 'not_applicable',
        bias: 'not_recorded',
        lesson: String(reviewInput || '').trim(),
      }
    : {
        process: reviewInput?.process || 'respected',
        outcome: reviewInput?.outcome || 'too_early',
        thesis: reviewInput?.thesis || 'not_applicable',
        bias: reviewInput?.bias || 'not_recorded',
        lesson: String(reviewInput?.lesson || '').trim(),
      };

  const next = readDecisionLog(storage).map((entry) => (
    entry.id === decisionId
      ? {
          ...entry,
          reviewStatus: 'reviewed',
          reviewNote: review.lesson,
          review,
          reviewedAt: new Date().toISOString(),
        }
      : entry
  ));
  persistDecisionLog(storage, next);
  return next;
}


function baselineEntry(index, payload) {
  const stamp = `2026-09-19T12:${String(index).padStart(2, '0')}:00.000Z`;
  return {
    id: `baseline-v3-${index}`,
    createdAt: stamp,
    date: '2026-09-19',
    reviewStatus: 'pending',
    reviewDate: payload.reviewDate || '2026-12-18',
    source: 'baseline',
    sourceTransactionId: '',
    ruleId: payload.ruleId || '',
    ruleTitle: payload.ruleTitle || '',
    evidence: payload.evidence || '',
    reviewNote: '',
    ...payload,
  };
}

export function seedBaselineDecisions(storage, { portfolio, candidates = [] } = {}) {
  if (!storage || storage.getItem(DECISION_BASELINE_KEY) === 'seeded') {
    return readDecisionLog(storage);
  }

  const assets = Object.fromEntries((portfolio?.assets || []).map((asset) => [asset.ticker, asset]));
  const candidateMap = Object.fromEntries((candidates || []).map((candidate) => [candidate.ticker, candidate]));
  const smh = assets.SMH;
  const globals = assets.CFIETFGE;

  const baseline = [
    baselineEntry(1, {
      type: 'strategy',
      decision: 'Mantener estrategia objetivo 60/20/15/5',
      reason: 'VOO permanece como núcleo, SMH como acelerador, Globales como diversificador internacional y BCH como satélite chileno.',
      evidence: 'Objetivos vigentes: VOO 60% · SMH 20% · CFIETFGE 15% · BCH 5%.',
    }),
    baselineEntry(2, {
      type: 'rule_definition',
      asset: 'SMH',
      ruleId: 'concentration',
      ruleTitle: 'La concentración tiene límites',
      decision: 'SMH: objetivo máximo 20%; revisar rebalanceo sobre 22%',
      reason: 'Se incorpora tolerancia operativa para no vender por pequeñas variaciones de mercado, pero se bloquean nuevos aportes al superar el objetivo.',
      evidence: '20–22%: mantener sin nuevos aportes. >22%: revisar rebalanceo. Nunca vender automáticamente solo por superar un umbral.',
    }),
    baselineEntry(3, {
      type: 'no_action',
      asset: 'SMH',
      ruleId: 'concentration',
      ruleTitle: 'La concentración tiene límites',
      decision: 'Mantener SMH y no aumentar por ahora',
      reason: smh
        ? `SMH está en ${smh.weight.toFixed(1)}% frente a un objetivo de 20%; los nuevos aportes deben corregir otras brechas.`
        : 'SMH está en torno a su objetivo máximo estratégico.',
      evidence: smh
        ? `Peso registrado al crear la línea base V3: ${smh.weight.toFixed(2)}%.`
        : 'Regla vigente de concentración.',
    }),
    baselineEntry(4, {
      type: 'rebalance',
      asset: 'CFIETFGE',
      decision: 'Priorizar nuevos aportes a Globales antes de volver a aumentar activos ya alineados',
      reason: globals
        ? `Globales está en ${globals.weight.toFixed(1)}% frente a un objetivo de 15%, por lo que es la brecha prioritaria de la cartera.`
        : 'Globales es el activo infraponderado prioritario dentro del 60/20/15/5.',
      evidence: globals
        ? `Peso registrado al crear la línea base V3: ${globals.weight.toFixed(2)}% · objetivo 15%.`
        : 'Health Gate V3.',
    }),
    baselineEntry(5, {
      type: 'opportunity',
      asset: 'VST',
      decision: candidateMap.VST?.decision?.status || 'Candidato a incorporar — con riesgo a vigilar',
      reason: candidateMap.VST?.decision?.explanation || 'Supera el filtro inicial, pero el riesgo debe permanecer bajo vigilancia antes de definir tamaño.',
      evidence: candidateMap.VST
        ? `Score ${candidateMap.VST.decision.score}/100 · hard gates fallidos: ${candidateMap.VST.decision.failedGates?.length || 0}.`
        : 'Decision Gate V3.',
    }),
    baselineEntry(6, {
      type: 'opportunity',
      asset: 'GRID',
      decision: candidateMap.GRID?.decision?.status || 'Esperar mejor valoración',
      reason: candidateMap.GRID?.decision?.explanation || 'La tesis y el encaje son favorables, pero la valoración no supera el hard gate.',
      evidence: candidateMap.GRID?.decision?.mainBlocker || 'Valoración bajo el mínimo requerido por el Decision Gate.',
    }),
    baselineEntry(7, {
      type: 'opportunity',
      asset: 'CCJ',
      decision: candidateMap.CCJ?.decision?.status || 'Esperar mejor valoración',
      reason: candidateMap.CCJ?.decision?.explanation || 'La tesis nuclear sigue en estudio, pero la valoración/riesgo no justifican incorporación hoy.',
      evidence: candidateMap.CCJ?.decision?.mainBlocker || 'Hard gates no aprobados en el Decision Gate.',
    }),
    baselineEntry(8, {
      type: 'rule_definition',
      ruleId: 'concentration',
      ruleTitle: 'La concentración tiene límites',
      decision: 'Tecnología total bajo vigilancia operativa',
      reason: 'La exposición tecnológica efectiva es superior a lo que sugiere mirar solo el 20% nominal de SMH, porque VOO y Globales también contienen tecnología.',
      evidence: 'Umbral inicial de vigilancia: 45%. Este nivel no genera ventas automáticas; condiciona la prioridad de nuevos aportes.',
    }),
  ];

  const current = readDecisionLog(storage);
  const existingIds = new Set(current.map((entry) => entry.id));
  const merged = [...current, ...baseline.filter((entry) => !existingIds.has(entry.id))];
  persistDecisionLog(storage, merged);
  storage.setItem(DECISION_BASELINE_KEY, 'seeded');
  return readDecisionLog(storage);
}
