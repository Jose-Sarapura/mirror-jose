export const STRATEGY_CONSTITUTION = {
  version: '1.2',
  adoptedAt: '2026-09-30',
  reviewCadence: 'Mensual + por evento material + al cruzar un hito patrimonial',
  principles: [
    'La estrategia no se mantiene por inercia: activos, porcentajes y riesgos deben volver a justificarse.',
    'Un cambio de precio por sí solo no obliga a vender; una ruptura de tesis o de hard gate sí obliga a reevaluar.',
    'No se toma ganancia solo porque un activo subió: se revisa cuando hay sobrepeso, valoración/riesgo menos favorables o un destino de capital claramente mejor.',
    'En VOO, SMH, CFIETFGE y BCH, una toma parcial busca volver al peso estratégico vigente; Mirror calcula el porcentaje aproximado de la posición a reducir.',
    'En BTC y ETH, Preparar protección no vende: deja listo un primer tramo de 25%. Protección a evaluar habilita revisar ese 25%; un segundo 25% requiere persistencia adicional y el 50% restante queda como reserva salvo deterioro estructural.',
    'Toda toma de ganancia parcial debe definir antes el destino del capital: otro activo del portafolio, una nueva oportunidad o liquidez estratégica.',
    'Si la tesis del activo sigue vigente después de reducirlo, Mirror debe dejar registrada una condición de reentrada para evitar quedar fuera por miedo.',
    'Los hitos patrimoniales activan una revisión obligatoria de riesgo, concentración y necesidad de activos defensivos.',
    'Cruzar un hito no genera una venta automática: cambia la prioridad entre crecimiento y protección del patrimonio.',
    'BTC y ETH permanecen fuera del 60/20/15/5 y se gestionan con sus motores especializados de riesgo y protección.',
  ],
  capitalFlow: {
    sequence: ['Mantener', 'Vigilar', 'Preparar protección', 'Tomar ganancia parcial', 'Rotar capital', 'Reentrar'],
    takeProfitRule: 'Cosechar ganancias solo cuando el beneficio de reducir riesgo o financiar una oportunidad supera el costo de cortar un ganador.',
    sizingRule: 'Racional: recorte orientativo hasta volver al peso objetivo vigente. Cripto: 25% inicial, segundo 25% solo con deterioro persistente y 50% de reserva salvo invalidación estructural.',
    rotationRule: 'No vender sin destino. Toda rotación debe mejorar diversificación, valoración, riesgo o cercanía a la meta patrimonial.',
    reentryRule: 'Si la tesis sigue intacta, definir de antemano qué recuperación de valoración, peso o estructura permitiría reconstruir la posición.',
  },
  checkpoints: [
    {
      minCLP: 0,
      maxCLP: 100000000,
      key: 'accumulation',
      label: 'Acumulación',
      priority: 'Crecimiento disciplinado',
      baseline: '60% VOO / 20% SMH / 15% Global / 5% BCH',
      rule: 'La distribución base puede mantenerse mientras todos los hard gates sigan aprobados y el riesgo de concentración permanezca controlado.',
      transition: 'Al acercarse a $100M, revisar si SMH todavía justifica 20%, si BCH sigue aportando valor y cuánto riesgo cripto es aceptable para el siguiente tramo.',
    },
    {
      minCLP: 100000000,
      maxCLP: 300000000,
      key: 'consolidation',
      label: 'Consolidación',
      priority: 'Crecer sin depender de concentración',
      baseline: 'La estrategia 60/20/15/5 deja de asumirse automáticamente.',
      rule: 'Revalidar el peso máximo de SMH, evitar ampliar satélites por inercia y comenzar a diseñar un bloque defensivo si el patrimonio ya no necesita el mismo nivel de riesgo para avanzar.',
      transition: 'Antes de $300M debe existir una decisión explícita sobre reducción de concentración y rol de renta fija, caja u otros activos defensivos.',
    },
    {
      minCLP: 300000000,
      maxCLP: 600000000,
      key: 'protection',
      label: 'Protección',
      priority: 'Preservación + crecimiento suficiente',
      baseline: 'La protección del capital pasa a ser una restricción de primer nivel.',
      rule: 'Los activos de alta volatilidad y los satélites deben justificar su tamaño. El portafolio debe poder soportar una corrección severa sin comprometer la meta de libertad financiera.',
      transition: 'Definir una estructura de retiro y un bloque defensivo antes de alcanzar la meta patrimonial.',
    },
    {
      minCLP: 600000000,
      maxCLP: Infinity,
      key: 'freedom',
      label: 'Libertad financiera',
      priority: 'Sostener libertad, no maximizar riesgo',
      baseline: 'La cartera se diseña desde la necesidad de preservar capacidad de retiro y estabilidad.',
      rule: 'Las posiciones concentradas o de alta volatilidad pasan a ser opcionales y acotadas. Núcleo diversificado, liquidez y activos defensivos toman mayor prioridad.',
      transition: 'Revisión anual completa de retiro, inflación, riesgo secuencial y suficiencia patrimonial.',
    },
  ],
};

export function strategyStage(totalInvestedCLP) {
  const value = Number(totalInvestedCLP || 0);
  return STRATEGY_CONSTITUTION.checkpoints.find(
    (stage) => value >= stage.minCLP && value < stage.maxCLP,
  ) || STRATEGY_CONSTITUTION.checkpoints.at(-1);
}

export function nextStrategyCheckpoint(totalInvestedCLP) {
  const value = Number(totalInvestedCLP || 0);
  return STRATEGY_CONSTITUTION.checkpoints.find((stage) => stage.minCLP > value) || null;
}
