import { calculateLookthrough } from './lookthrough';

export const RISK_CONSTITUTION = [
  {
    id: 'rules-during-stress',
    number: 1,
    title: 'Las reglas no se cambian bajo presión',
    text: 'Los límites se revisan en frío y con evidencia. Una caída, euforia o miedo no es razón suficiente para reescribirlos.',
    type: 'principle',
  },
  {
    id: 'hard-gate',
    number: 2,
    title: 'Un hard gate no se negocia',
    text: 'Un promedio alto nunca compensa un fallo crítico de valoración, fundamentales, riesgo, encaje o tesis.',
    type: 'hard',
  },
  {
    id: 'role-specific',
    number: 3,
    title: 'Cada activo se administra según su función',
    text: 'VOO, SMH, Globales, BCH y futuros satélites no usan las mismas reglas de riesgo ni de salida.',
    type: 'principle',
  },
  {
    id: 'concentration',
    number: 4,
    title: 'La concentración tiene límites',
    text: 'SMH tiene límite estratégico de 20%. Tecnología y empresas individuales se vigilan por exposición efectiva, no solo por el peso nominal del ETF.',
    type: 'hard',
  },
  {
    id: 'no-buy-drawdown',
    number: 5,
    title: 'Una caída no es una señal de compra',
    text: 'El precio puede activar una revisión, pero toda incorporación debe superar el Decision Gate completo.',
    type: 'hard',
  },
  {
    id: 'no-sell-drawdown',
    number: 6,
    title: 'Una caída tampoco es una señal de venta',
    text: 'En el núcleo de largo plazo, vender requiere deterioro de tesis/riesgo o una transición patrimonial planificada.',
    type: 'principle',
  },
  {
    id: 'reentry',
    number: 7,
    title: 'La reentrada necesita una nueva validación',
    text: 'Después de salir o bloquear una posición, no se vuelve a entrar por FOMO, rabia o rebote; debe superar otra vez el proceso completo.',
    type: 'hard',
  },
  {
    id: 'exception-log',
    number: 8,
    title: 'Toda excepción debe quedar registrada',
    text: 'Si una regla se modifica, debe quedar escrito qué evidencia cambió, quién cambia la regla y desde cuándo aplica.',
    type: 'principle',
  },
];

export const DISCIPLINE_THRESHOLDS = {
  smhHardMax: 20,
  smhWarning: 19,
  technologyWarning: 45,
  technologyHigh: 50,
  singleCompanyWarning: 10,
  singleCompanyHigh: 12,
};

export function buildDisciplineState(portfolio) {
  const exposure = calculateLookthrough(portfolio);
  const smh = portfolio.assets.find((asset) => asset.ticker === 'SMH');
  const smhWeight = Number(smh?.weight || 0);
  const technology = Number(exposure.summary.technology || 0);
  const largestCompany = exposure.summary.largestCompany;
  const largestCompanyWeight = Number(largestCompany?.weight || 0);

  const alerts = [];

  if (smhWeight > DISCIPLINE_THRESHOLDS.smhHardMax) {
    alerts.push({
      id: 'smh-hard',
      severity: 'block',
      rule: 'Límite estratégico SMH',
      current: `${smhWeight.toFixed(1)}%`,
      limit: `${DISCIPLINE_THRESHOLDS.smhHardMax}% máximo`,
      action: 'No aumentar SMH. Corregir mediante nuevos aportes a otros activos; evaluar reducción solo si la sobreponderación persiste o cambia la tesis.',
    });
  } else if (smhWeight >= DISCIPLINE_THRESHOLDS.smhWarning) {
    alerts.push({
      id: 'smh-warning',
      severity: 'warning',
      rule: 'SMH cerca del límite',
      current: `${smhWeight.toFixed(1)}%`,
      limit: `${DISCIPLINE_THRESHOLDS.smhHardMax}% máximo`,
      action: 'No priorizar nuevos aportes a SMH hasta que vuelva a quedar claramente bajo su objetivo.',
    });
  }

  if (technology >= DISCIPLINE_THRESHOLDS.technologyHigh) {
    alerts.push({
      id: 'technology-high',
      severity: 'block',
      rule: 'Concentración tecnológica elevada',
      current: `${technology.toFixed(1)}%`,
      limit: `alerta fuerte desde ${DISCIPLINE_THRESHOLDS.technologyHigh}%`,
      action: 'Evitar aumentar exposición tecnológica hasta que la concentración baje o se revise formalmente esta regla.',
    });
  } else if (technology >= DISCIPLINE_THRESHOLDS.technologyWarning) {
    alerts.push({
      id: 'technology-warning',
      severity: 'warning',
      rule: 'Tecnología bajo vigilancia',
      current: `${technology.toFixed(1)}%`,
      limit: `vigilancia desde ${DISCIPLINE_THRESHOLDS.technologyWarning}%`,
      action: 'Nuevos aportes deben favorecer diversificación antes que aumentar tecnología.',
    });
  }

  if (largestCompany && largestCompanyWeight >= DISCIPLINE_THRESHOLDS.singleCompanyHigh) {
    alerts.push({
      id: 'single-company-high',
      severity: 'block',
      rule: 'Concentración efectiva por empresa',
      current: `${largestCompany.ticker} ${largestCompanyWeight.toFixed(2)}%`,
      limit: `alerta fuerte desde ${DISCIPLINE_THRESHOLDS.singleCompanyHigh}%`,
      action: 'No aumentar deliberadamente la exposición a esa empresa hasta reducir concentración o revisar formalmente el umbral.',
    });
  } else if (largestCompany && largestCompanyWeight >= DISCIPLINE_THRESHOLDS.singleCompanyWarning) {
    alerts.push({
      id: 'single-company-warning',
      severity: 'warning',
      rule: 'Empresa individual bajo vigilancia',
      current: `${largestCompany.ticker} ${largestCompanyWeight.toFixed(2)}%`,
      limit: `vigilancia desde ${DISCIPLINE_THRESHOLDS.singleCompanyWarning}%`,
      action: 'Antes de aportar a fondos que la contienen, revisar la exposición efectiva total.',
    });
  }

  const blockers = alerts.filter((alert) => alert.severity === 'block').length;
  const warnings = alerts.filter((alert) => alert.severity === 'warning').length;

  return {
    alerts,
    blockers,
    warnings,
    status: blockers > 0 ? 'Regla bloqueante activa' : warnings > 0 ? 'Vigilancia activa' : 'Dentro de reglas',
    exposure,
  };
}
