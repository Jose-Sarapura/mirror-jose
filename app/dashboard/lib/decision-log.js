export const DECISION_LOG_KEY = 'mirror-v3-decision-log-v1';

export const DECISION_TYPES = [
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

export function reviewDecision(storage, decisionId, reviewNote) {
  const next = readDecisionLog(storage).map((entry) => (
    entry.id === decisionId
      ? {
          ...entry,
          reviewStatus: 'reviewed',
          reviewNote: String(reviewNote || '').trim(),
          reviewedAt: new Date().toISOString(),
        }
      : entry
  ));
  persistDecisionLog(storage, next);
  return next;
}
