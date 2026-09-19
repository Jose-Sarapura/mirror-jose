import { portfolioHealthDecision } from './portfolio-health';
import { buildDisciplineState } from './risk-constitution';
import { LOOKTHROUGH_SNAPSHOTS } from './lookthrough';

function roundCLP(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function allocationHealthFromWeights(assets) {
  const deviation = assets.reduce(
    (sum, asset) => sum + Math.abs(Number(asset.weight || 0) - Number(asset.targetWeight || 0)),
    0,
  );
  return Math.max(0, Math.round(100 - deviation * 2.2));
}

function technologyExposureFromValues(assets, total) {
  if (!total) return 0;
  return assets.reduce((sum, asset) => {
    const technology = Number(LOOKTHROUGH_SNAPSHOTS[asset.ticker]?.sectors?.Tecnología || 0);
    return sum + (Number(asset.projectedValueCLP ?? asset.valueCLP ?? 0) / total) * technology;
  }, 0);
}

function contributionBlock(asset, health) {
  if (!health) return 'Sin Health Gate disponible.';
  if (health.failedCritical?.length) {
    return `Hard gate pendiente: ${health.failedCritical.join(', ')}.`;
  }
  if (health.contributionStatus === 'Pausar aportes') {
    return health.contributionReason || 'Aportes pausados por Health Gate.';
  }
  if (health.contributionStatus === 'Esperar mejor valoración') {
    return health.contributionReason || 'Valoración insuficiente para nuevo dinero.';
  }
  if (asset.ticker === 'SMH' && asset.weight >= 20) {
    return `SMH está en ${asset.weight.toFixed(1)}%, sobre su objetivo máximo de 20%.`;
  }
  return '';
}

export function buildActionPlan(portfolio, amountCLP, opportunityCandidates = []) {
  const amount = roundCLP(amountCLP);
  if (!portfolio || !amount) return null;

  const discipline = buildDisciplineState(portfolio);
  const futureInvested = Number(portfolio.investedCLP || 0) + amount;

  const assets = portfolio.assets.map((asset) => {
    const health = portfolioHealthDecision(asset);
    const blockedReason = contributionBlock(asset, health);
    const targetAfter = futureInvested * (Number(asset.targetWeight || 0) / 100);
    const deficitAfter = Math.max(0, targetAfter - Number(asset.valueCLP || 0));

    return {
      ...asset,
      health,
      blockedReason,
      eligible: !blockedReason,
      targetAfter,
      deficitAfter,
      allocationCLP: 0,
    };
  });

  let remaining = amount;

  const priorityOrder = [...assets]
    .filter((asset) => asset.eligible && asset.deficitAfter > 0)
    .sort((a, b) => {
      const aPriority = a.health?.contributionStatus === 'Priorizar aportes ahora' ? 1 : 0;
      const bPriority = b.health?.contributionStatus === 'Priorizar aportes ahora' ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.deficitAfter - a.deficitAfter;
    });

  priorityOrder.forEach((asset) => {
    if (remaining <= 0) return;
    const allocation = Math.min(remaining, roundCLP(asset.deficitAfter));
    asset.allocationCLP += allocation;
    remaining -= allocation;
  });

  // En un aporte extraordinariamente grande, evita que el dinero quede sin plan:
  // reparte el excedente solo entre activos habilitados, priorizando menor exposición tecnológica
  // y mayor encaje de cartera. Nunca fuerza dinero a un activo bloqueado.
  if (remaining > 0) {
    const fallback = [...assets]
      .filter((asset) => asset.eligible)
      .sort((a, b) => {
        const techA = Number(LOOKTHROUGH_SNAPSHOTS[a.ticker]?.sectors?.Tecnología || 0);
        const techB = Number(LOOKTHROUGH_SNAPSHOTS[b.ticker]?.sectors?.Tecnología || 0);
        if (discipline.exposure.summary.technology >= 45 && techA !== techB) return techA - techB;
        return Number(b.health?.scores?.fit || 0) - Number(a.health?.scores?.fit || 0);
      });

    if (fallback.length) {
      const targetSum = fallback.reduce((sum, asset) => sum + Number(asset.targetWeight || 0), 0) || 1;
      let distributed = 0;
      fallback.forEach((asset, index) => {
        const allocation = index === fallback.length - 1
          ? remaining - distributed
          : roundCLP(remaining * (Number(asset.targetWeight || 0) / targetSum));
        asset.allocationCLP += allocation;
        distributed += allocation;
      });
      remaining = 0;
    }
  }

  const projectedAssets = assets.map((asset) => {
    const projectedValueCLP = Number(asset.valueCLP || 0) + asset.allocationCLP;
    const projectedWeight = futureInvested ? (projectedValueCLP / futureInvested) * 100 : 0;
    return {
      ...asset,
      projectedValueCLP,
      projectedWeight,
      weight: projectedWeight,
    };
  });

  const allocations = projectedAssets
    .filter((asset) => asset.allocationCLP > 0)
    .sort((a, b) => b.allocationCLP - a.allocationCLP)
    .map((asset, index) => ({
      ticker: asset.ticker,
      name: asset.name,
      amountCLP: asset.allocationCLP,
      shareOfContribution: amount ? (asset.allocationCLP / amount) * 100 : 0,
      currentWeight: portfolio.assets.find((item) => item.ticker === asset.ticker)?.weight || 0,
      projectedWeight: asset.projectedWeight,
      targetWeight: asset.targetWeight,
      priority: index === 0 ? 'Primera prioridad' : 'Complemento',
      reason: asset.health?.contributionReason || 'Corrige la asignación objetivo.',
    }));

  const blockedAssets = assets
    .filter((asset) => asset.blockedReason)
    .map((asset) => ({
      ticker: asset.ticker,
      weight: asset.weight,
      targetWeight: asset.targetWeight,
      reason: asset.blockedReason,
    }));

  const healthBefore = allocationHealthFromWeights(portfolio.assets);
  const healthAfter = allocationHealthFromWeights(projectedAssets);

  const technologyBefore = Number(discipline.exposure.summary.technology || 0);
  const technologyAfter = technologyExposureFromValues(projectedAssets, futureInvested);
  const smhBefore = Number(portfolio.assets.find((asset) => asset.ticker === 'SMH')?.weight || 0);
  const smhAfter = Number(projectedAssets.find((asset) => asset.ticker === 'SMH')?.projectedWeight || 0);

  const opportunities = opportunityCandidates.map((candidate) => {
    const approved = candidate.decision?.level === 'candidate' &&
      (candidate.decision?.failedGates?.length || 0) === 0;

    return {
      ticker: candidate.ticker,
      approved,
      status: candidate.decision?.status || 'Sin evaluación',
      score: candidate.decision?.score,
      note: approved
        ? 'Supera el Decision Gate, pero todavía no forma parte de la asignación estratégica. Requiere definir tamaño antes de usar dinero del aporte ordinario.'
        : candidate.decision?.mainBlocker || candidate.decision?.explanation || 'No habilitada para incorporación.',
    };
  });

  const primary = allocations[0] || null;

  let headline = 'Mantener aporte en espera';
  let rationale = 'No encontramos un destino habilitado que mejore la estrategia con las reglas actuales.';

  if (primary) {
    headline = allocations.length === 1
      ? `Dirigir el próximo aporte a ${primary.ticker}`
      : `Priorizar ${primary.ticker} y completar con ${allocations.slice(1).map((item) => item.ticker).join(' + ')}`;

    rationale = `${primary.ticker} recibe la mayor parte porque corrige la brecha estratégica sin violar los hard gates actuales.`;
    if (smhBefore >= 20) {
      rationale += ' SMH no recibe dinero nuevo y su peso se diluye mediante aportes a otros activos.';
    }
    if (technologyBefore >= 45) {
      rationale += ' La concentración tecnológica permanece bajo vigilancia, por lo que el plan evita aumentarla deliberadamente.';
    }
  }

  return {
    amountCLP: amount,
    headline,
    rationale,
    allocations,
    blockedAssets,
    opportunities,
    metrics: {
      allocationHealthBefore: healthBefore,
      allocationHealthAfter: healthAfter,
      technologyBefore,
      technologyAfter,
      smhBefore,
      smhAfter,
    },
    rules: {
      smhContributionBlocked: smhBefore >= 20,
      technologyWatch: technologyBefore >= 45,
      opportunityRequiresFormalIncorporation: true,
    },
  };
}
