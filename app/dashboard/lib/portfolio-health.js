export const PORTFOLIO_HEALTH = {
  VOO: {
    category: 'Núcleo',
    sourceDate: '2026-09-18',
    sourceLabel: 'Vanguard + S&P Dow Jones + valoración S&P 500',
    scores: {
      valuation: 72,
      fundamentals: 95,
      risk: 78,
      fit: 96,
      thesis: 96,
    },
    gates: {
      valuationForNewMoney: 55,
      fundamentals: 80,
      risk: 65,
      fit: 80,
      thesis: 80,
    },
    facts: [
      '505 posiciones y comisión anual de 0,03%.',
      'Top 10 del S&P 500 representa aproximadamente 37,8% del índice.',
      'Tecnología representa aproximadamente 37,9% del S&P 500.',
      'P/E forward del S&P 500 cercano a 19x en septiembre de 2026.',
    ],
    whyOwn: 'Es el núcleo de crecimiento diversificado de la cartera y la principal exposición a grandes empresas de EE.UU.',
    addMoreIf: 'Está bajo 60%, los hard gates siguen aprobados y no aparece una oportunidad claramente superior dentro de la estrategia.',
    stopAddingIf: 'Supera el objetivo, la concentración aumenta materialmente o la valoración se vuelve muy exigente frente a beneficios y tasas.',
    reduceIf: 'La tesis de núcleo deja de cumplir su función, aparece una concentración estructural incompatible con el plan o necesitamos reducir riesgo cerca de la libertad financiera.',
  },
  SMH: {
    category: 'Acelerador',
    sourceDate: '2026-09-18',
    sourceLabel: 'VanEck SMH + valoración sector semiconductores',
    scores: {
      valuation: 72,
      fundamentals: 86,
      risk: 55,
      fit: 86,
      thesis: 91,
    },
    gates: {
      valuationForNewMoney: 55,
      fundamentals: 75,
      risk: 50,
      fit: 75,
      thesis: 80,
    },
    facts: [
      '26 posiciones; NVIDIA representa aproximadamente 22% del fondo.',
      'El sector tecnología representa prácticamente 100% de SMH.',
      'P/E forward sectorial cercano a 20x en septiembre de 2026.',
      'La tesis estructural IA/data centers sigue fuerte, pero el sector continúa siendo cíclico.',
    ],
    whyOwn: 'Es el acelerador de crecimiento de la cartera mediante semiconductores, IA, data centers y digitalización.',
    addMoreIf: 'Está claramente bajo 20%, la tesis sigue intacta y el riesgo de concentración no empeora.',
    stopAddingIf: 'Alcanza 20%, aumenta mucho la concentración real en pocas empresas o el ciclo de CAPEX IA se deteriora.',
    reduceIf: 'Supera persistentemente el límite de 20%, la tesis estructural se deteriora o su drawdown podría comprometer una meta cercana de libertad financiera.',
  },
  CFIETFGE: {
    category: 'Diversificador global',
    sourceDate: '2026-09-18',
    sourceLabel: 'Singular Global Equities + FTSE Global All Cap',
    scores: {
      valuation: 67,
      fundamentals: 92,
      risk: 80,
      fit: 97,
      thesis: 95,
    },
    gates: {
      valuationForNewMoney: 50,
      fundamentals: 80,
      risk: 65,
      fit: 80,
      thesis: 80,
    },
    facts: [
      'Replica FTSE Global All Cap y entrega exposición a más de 10.000 acciones.',
      'EE.UU. representa aproximadamente 59%; el resto se distribuye entre desarrollados y emergentes.',
      'Remuneración anual de 0,25%.',
      'P/E del FTSE Global All Cap cercano a 20,8x según vehículo equivalente de referencia.',
    ],
    whyOwn: 'Reduce la dependencia exclusiva de EE.UU. y tecnología, agregando mercados desarrollados, emergentes y empresas medianas/pequeñas.',
    addMoreIf: 'Está bajo 15% y mantiene diversificación efectiva frente a VOO y SMH.',
    stopAddingIf: 'Alcanza el objetivo, pierde diversificación real por cambios en composición o su costo/estructura deja de ser competitivo.',
    reduceIf: 'Deja de cumplir el rol de diversificación global o aparece una alternativa claramente superior con menor costo y mejor implementación.',
  },
  BCH: {
    category: 'Satélite Chile / banco',
    sourceDate: '2026-09-18',
    sourceLabel: 'Banco de Chile Q2 2026 + métricas de mercado',
    scores: {
      valuation: 70,
      fundamentals: 91,
      risk: 68,
      fit: 84,
      thesis: 82,
    },
    gates: {
      valuationForNewMoney: 55,
      fundamentals: 75,
      risk: 60,
      fit: 75,
      thesis: 70,
    },
    facts: [
      'ROAE Q2 2026 cercano a 27,9%; CET1 aproximado de 13,9%.',
      'NPL cercano a 1,6% con coberturas robustas.',
      'P/E forward cercano a 14,7x.',
      'Riesgos principales: concentración en una sola empresa/país, costo de riesgo y entorno macro chileno.',
    ],
    whyOwn: 'Aporta exposición directa a Chile, un negocio bancario rentable y una fuente secundaria de dividendos sin dominar la cartera.',
    addMoreIf: 'Está bajo 5%, mantiene rentabilidad y calidad crediticia fuertes, y la valoración sigue razonable.',
    stopAddingIf: 'Está en o sobre 5%, sube el costo de riesgo, se deteriora calidad de cartera o la valoración deja de compensar el riesgo de concentración.',
    reduceIf: 'Se deterioran capital, calidad crediticia o rentabilidad estructural, o si necesitamos simplificar satélites para proteger patrimonio.',
  },
};

export function portfolioHealthDecision(asset) {
  const config = PORTFOLIO_HEALTH[asset.ticker];
  if (!config) return null;

  const { scores, gates } = config;
  const score = Math.round(
    scores.valuation * 0.20 +
    scores.fundamentals * 0.25 +
    scores.risk * 0.20 +
    scores.fit * 0.20 +
    scores.thesis * 0.15
  );

  const failedCritical = [];
  if (scores.fundamentals < gates.fundamentals) failedCritical.push('fundamentales/calidad');
  if (scores.risk < gates.risk) failedCritical.push('riesgo');
  if (scores.fit < gates.fit) failedCritical.push('encaje');
  if (scores.thesis < gates.thesis) failedCritical.push('tesis');

  const gap = asset.targetWeight - asset.weight;
  const valuationAllowsNewMoney = scores.valuation >= gates.valuationForNewMoney;

  let holdingStatus = 'Mantener';
  let holdingLevel = 'hold';
  let holdingReason = 'La tesis y los hard gates siguen vigentes; el activo merece seguir formando parte de la cartera.';

  let contributionStatus = 'Aportar para mantener objetivo';
  let contributionLevel = 'normal';
  let contributionReason = 'Puede recibir aportes cuando corresponda para conservar su porcentaje objetivo, sin desplazar activos con una brecha mayor.';

  if (failedCritical.length) {
    holdingStatus = 'Reevaluar';
    holdingLevel = 'review';
    holdingReason = `Falla un hard gate: ${failedCritical.join(', ')}. El puntaje promedio no compensa ese problema.`;
    contributionStatus = 'Pausar aportes';
    contributionLevel = 'pause';
    contributionReason = 'No destinar nuevo dinero hasta resolver el hard gate que falló.';
  } else if (asset.ticker === 'SMH' && asset.weight >= 19.5) {
    contributionStatus = 'Aportar después de corregir brechas';
    contributionLevel = 'later';
    contributionReason = 'SMH está prácticamente en su límite estratégico de 20%. Mantener la posición y volver a aportar solo si queda claramente bajo objetivo.';
  } else if (gap >= 0.6 && valuationAllowsNewMoney) {
    contributionStatus = 'Priorizar aportes ahora';
    contributionLevel = 'priority';
    contributionReason = `Está ${gap.toFixed(1)} puntos bajo su objetivo y todos los hard gates para nuevo dinero están aprobados.`;
  } else if (gap >= 0.6 && !valuationAllowsNewMoney) {
    contributionStatus = 'Esperar mejor valoración';
    contributionLevel = 'pause';
    contributionReason = 'Está bajo el objetivo, pero la valoración no supera el mínimo definido para nuevo dinero.';
  } else if (asset.weight > asset.targetWeight + 0.3) {
    contributionStatus = 'Aportar después de corregir brechas';
    contributionLevel = 'later';
    contributionReason = `Está ${(asset.weight - asset.targetWeight).toFixed(1)} puntos sobre su objetivo. Primero corregir activos infraponderados; luego puede volver a recibir aportes para mantener la estrategia.`;
  } else {
    contributionStatus = 'Aportar para mantener objetivo';
    contributionLevel = 'normal';
    contributionReason = 'Está cerca de su objetivo. Puede recibir aportes cuando sea necesario para conservar la asignación, después de atender brechas más importantes.';
  }

  return {
    ...config,
    score,
    holdingStatus,
    holdingLevel,
    holdingReason,
    contributionStatus,
    contributionLevel,
    contributionReason,
    failedCritical,
    valuationAllowsNewMoney,
    blocks: [
      { key: 'valuation', label: 'Valoración', score: scores.valuation, gate: gates.valuationForNewMoney, note: 'Influye principalmente en si conviene destinar nuevo dinero hoy.' },
      { key: 'fundamentals', label: asset.ticker === 'CFIETFGE' || asset.ticker === 'VOO' || asset.ticker === 'SMH' ? 'Calidad / fundamentales' : 'Fundamentales', score: scores.fundamentals, gate: gates.fundamentals, note: 'Calidad del activo, resultados, estructura y capacidad de sostener su función.' },
      { key: 'risk', label: 'Riesgo / resiliencia', score: scores.risk, gate: gates.risk, note: 'Concentración, volatilidad, balance, ciclo y capacidad de soportar escenarios adversos.' },
      { key: 'fit', label: 'Encaje cartera', score: scores.fit, gate: gates.fit, note: 'Qué tan bien cumple su rol dentro del 60/20/15/5 sin duplicar riesgos innecesarios.' },
      { key: 'thesis', label: 'Tesis', score: scores.thesis, gate: gates.thesis, note: 'Vigencia de la razón estructural por la que el activo sigue en cartera.' },
    ],
  };
}
