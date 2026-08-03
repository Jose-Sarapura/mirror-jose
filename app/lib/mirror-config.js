export const MIRROR_DEFAULTS = {
  goalCLP: 600000000,
  monthlyContributionCLP: 200000,
  cashCLP: 1874,
  horizonYear: 2030,
  assets: {
    VOO: {
      ticker: 'VOO',
      marketSymbol: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      shortName: 'S&P 500',
      currency: 'USD',
      shares: 9.43928896,
      averageCost: 669.17,
      dividends: 27.68,
      targetWeight: 60,
      fallbackPrice: 679.14,
      role: 'Núcleo',
      risk: 'Medio',
      thesis: 'Base diversificada del portafolio y principal motor de crecimiento de largo plazo.',
      scenarioReturns: { conservative: 5, base: 9, optimistic: 12 },
      accent: '#7c9cff',
    },
    SMH: {
      ticker: 'SMH',
      marketSymbol: 'SMH',
      name: 'VanEck Semiconductor ETF',
      shortName: 'Semiconductores',
      currency: 'USD',
      shares: 2.60217227,
      averageCost: 610.52,
      dividends: 0,
      targetWeight: 20,
      fallbackPrice: 540.53,
      role: 'Acelerador',
      risk: 'Alto',
      thesis: 'Exposición concentrada al ciclo global de chips, infraestructura de IA y fabricantes líderes.',
      scenarioReturns: { conservative: 3, base: 12, optimistic: 18 },
      accent: '#9c7cff',
    },
    BCH: {
      ticker: 'BCH',
      marketSymbol: 'BCH',
      name: 'Banco de Chile ADR',
      shortName: 'Banca chilena',
      currency: 'USD',
      shares: 14.17875002,
      averageCost: 37.48,
      dividends: 30.83,
      targetWeight: 10,
      fallbackPrice: 40.72,
      role: 'Chile / dividendos',
      risk: 'Medio',
      thesis: 'Exposición local rentable, con componente de dividendos y riesgo país concentrado.',
      scenarioReturns: { conservative: 3, base: 7, optimistic: 10 },
      accent: '#28d9a7',
    },
    CFIETFGE: {
      ticker: 'CFIETFGE',
      marketSymbol: 'CFIETFGE.SN',
      name: 'ETF Acciones Globales',
      shortName: 'Acciones globales',
      currency: 'CLP',
      shares: 431,
      averageCost: 1624.63,
      averageCostEstimated: true,
      dividends: 393,
      targetWeight: 10,
      fallbackPrice: 3247.15,
      role: 'Diversificación global',
      risk: 'Medio',
      thesis: 'Diversificación internacional en pesos y tratamiento tributario local 107 LIR.',
      scenarioReturns: { conservative: 4, base: 8, optimistic: 11 },
      accent: '#f3b85b',
    },
  },
};

export const PURCHASES = {
  VOO: [
    { date: '2026-06-30', amount: 15.71, currency: 'USD', label: 'Reinversión dividendo' },
  ],
  SMH: [
    { date: '2026-06-22', amount: 546.82, currency: 'USD', label: 'Compra SMH' },
    { date: '2026-07-13', amount: 213.31, currency: 'USD', label: 'Compra SMH' },
    { date: '2026-07-31', amount: 200.00, shares: 0.36634813, price: 545.93, currency: 'USD', label: 'Compra SMH' },
  ],
  BCH: [
    { date: '2025-11-26', amount: 531.36, currency: 'USD', label: 'Compra BCH' },
  ],
  CFIETFGE: [],
};

export const RANGE_OPTIONS = [
  { key: '1d', label: '1 día' },
  { key: '1m', label: '1 mes' },
  { key: '1y', label: '1 año' },
  { key: '5y', label: '5 años' },
];

export function getAssetConfig(ticker) {
  return MIRROR_DEFAULTS.assets[ticker] || null;
}
