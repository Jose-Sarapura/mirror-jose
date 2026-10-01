export const STRATEGY_CONSTITUTION = {
  version: '1.3',
  adoptedAt: '2026-10-01',
  reviewCadence: 'Mensual + por evento material + al cruzar un hito patrimonial',
  principles: [
    'La estrategia no se mantiene por inercia: activos, porcentajes y riesgos deben volver a justificarse.',
    'Entre $0 y $100M Mirror opera en Modo Acumulación: prioriza crecimiento disciplinado, simplicidad y permanencia en mercado.',
    'La base 60% VOO / 20% SMH / 15% Global / 5% BCH se mantiene mientras los cuatro activos sigan justificando su rol y aprueben sus hard gates.',
    'Un activo nuevo no entra por novedad ni por narrativa: primero debe demostrar que mejora claramente el retorno/riesgo esperado del portafolio y qué activo actual reemplazaría total o parcialmente.',
    'Durante Modo Acumulación, la regla por defecto es reemplazar antes que agregar. Ampliar el número de activos requiere una justificación estructural excepcional.',
    'Mirror debe penalizar la duplicación innecesaria. Si una empresa ya está contenida de forma relevante en VOO u otro vehículo existente, una posición directa necesita una ventaja adicional clara.',
    'VOO es el núcleo diversificado; SMH es el acelerador de crecimiento; Global diversifica geografía/factores; BCH es un satélite pequeño y revisable. Global y BCH no se clasifican como activos defensivos.',
    'SMH puede seguir siendo el principal acelerador de crecimiento, pero no debe superar estructuralmente su 20% objetivo sin una revisión completa de concentración, valoración y riesgo.',
    'BCH puede mantenerse en 5% mientras su tesis, fundamentales y retorno/riesgo sigan siendo competitivos; su costo promedio o dividendos recibidos no sustituyen el análisis prospectivo.',
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
  accumulationMode: {
    minCLP: 0,
    maxCLP: 100000000,
    baselineAssets: ['VOO', 'SMH', 'CFIETFGE', 'BCH'],
    baselineWeights: { VOO: 60, SMH: 20, CFIETFGE: 15, BCH: 5 },
    newAssetRule: 'Reemplazar antes que agregar.',
    candidateQuestion: '¿Este activo es suficientemente mejor como para reemplazar total o parcialmente a uno de los cuatro actuales?',
    admissionTests: [
      'Mejora clara de retorno/riesgo esperado frente al activo que desplazaría.',
      'Aporta un motor de crecimiento o diversificación que el portafolio actual no captura suficientemente.',
      'La valoración y los fundamentales justifican asumir el riesgo adicional.',
      'La duplicación con VOO/SMH/Global es aceptable y deliberada.',
      'Existe un tamaño objetivo y una fuente de capital explícita; no se agrega por acumulación de ideas.',
    ],
  },
  capitalFlow: {
    sequence: ['Mantener', 'Vigilar', 'Preparar protección', 'Tomar ganancia parcial', 'Rotar capital', 'Reentrar'],
    takeProfitRule: 'Cosechar ganancias solo cuando el beneficio de reducir riesgo o financiar una oportunidad supera el costo de cortar un ganador.',
    sizingRule: 'Racional: recorte orientativo hasta volver al peso objetivo vigente. Cripto: 25% inicial, segundo 25% solo con deterioro persistente y 50% de reserva salvo invalidación estructural.',
    rotationRule: 'No vender sin destino. Durante Modo Acumulación, una oportunidad nueva debe indicar explícitamente qué posición desplaza y por qué mejora el conjunto.',
    reentryRule: 'Si la tesis sigue intacta, definir de antemano qué recuperación de valoración, peso o estructura permitiría reconstruir la posición.',
  },
  checkpoints: [
    {
      minCLP: 0,
      maxCLP: 100000000,
      key: 'accumulation',
      label: 'Modo Acumulación · 0–100M',
      priority: 'Crecimiento disciplinado + simplicidad',
      baseline: '60% VOO / 20% SMH / 15% Global / 5% BCH',
      rule: 'Mantener cuatro activos por defecto. Una nueva oportunidad solo avanza si demuestra que merece reemplazar total o parcialmente a uno de ellos y mejora el portafolio completo, no solo su rentabilidad aislada.',
      transition: 'Al acercarse a $100M, revisar si SMH todavía justifica 20%, si BCH sigue siendo el mejor satélite, si Global mantiene su función y cuánto riesgo cripto es aceptable para el siguiente tramo.',
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
