export const LOOKTHROUGH_SNAPSHOTS = {
  VOO: {
    sourceDate: '2026-03-31',
    sourceLabel: 'Vanguard VOO fact sheet / weighted exposures',
    companies: {
      NVDA: { name: 'NVIDIA', weight: 7.6 },
      AAPL: { name: 'Apple', weight: 6.7 },
      MSFT: { name: 'Microsoft', weight: 4.9 },
      GOOGL: { name: 'Alphabet', weight: 5.4 },
      AMZN: { name: 'Amazon', weight: 3.6 },
      AVGO: { name: 'Broadcom', weight: 2.6 },
      META: { name: 'Meta', weight: 2.2 },
      TSLA: { name: 'Tesla', weight: 1.9 },
    },
    countries: {
      'Estados Unidos': 100,
    },
    sectors: {
      Tecnología: 38.01,
      Financieras: 11.78,
      'Comunicación': 9.68,
      'Consumo discrecional': 9.31,
      Salud: 8.89,
      Industriales: 8.82,
      'Consumo básico': 4.57,
      Energía: 2.98,
      Utilities: 2.20,
      Materiales: 1.83,
      'Bienes raíces': 1.83,
    },
  },
  SMH: {
    sourceDate: '2026-09-17',
    sourceLabel: 'VanEck SMH daily holdings',
    companies: {
      NVDA: { name: 'NVIDIA', weight: 22.42 },
      TSM: { name: 'TSMC', weight: 9.80 },
      AMD: { name: 'AMD', weight: 6.16 },
      AVGO: { name: 'Broadcom', weight: 5.67 },
      MU: { name: 'Micron', weight: 5.61 },
      ASML: { name: 'ASML', weight: 4.81 },
      INTC: { name: 'Intel', weight: 4.70 },
      QCOM: { name: 'Qualcomm', weight: 4.46 },
      MRVL: { name: 'Marvell', weight: 4.41 },
      ADI: { name: 'Analog Devices', weight: 4.26 },
      TXN: { name: 'Texas Instruments', weight: 4.24 },
    },
    countries: {
      'Estados Unidos': 83.08,
      Taiwan: 9.80,
      'Países Bajos': 5.77,
      'Reino Unido': 1.02,
      'Corea del Sur': 0.33,
    },
    sectors: {
      Tecnología: 100,
    },
  },
  CFIETFGE: {
    sourceDate: '2026-05-31',
    sourceLabel: 'Singular Global Equities / FTSE Global All Cap',
    companies: {
      NVDA: { name: 'NVIDIA', weight: 4.3 },
      AAPL: { name: 'Apple', weight: 3.9 },
      MSFT: { name: 'Microsoft', weight: 2.9 },
      AMZN: { name: 'Amazon', weight: 2.2 },
      GOOGL: { name: 'Alphabet', weight: 3.4 },
      AVGO: { name: 'Broadcom', weight: 1.6 },
      TSM: { name: 'TSMC', weight: 1.6 },
      META: { name: 'Meta', weight: 1.2 },
      TSLA: { name: 'Tesla', weight: 1.1 },
    },
    countries: {
      'Estados Unidos': 59,
      Japón: 6,
      'Reino Unido': 3,
      Canadá: 3,
      Taiwan: 3,
      China: 3,
      Suiza: 2,
      'Corea del Sur': 2,
      Francia: 2,
      Alemania: 2,
      'Resto del mundo': 14,
    },
    sectors: {
      Tecnología: 29.27,
      Financieras: 15.56,
      Industriales: 13.72,
      'Consumo discrecional': 12.74,
      Salud: 8.59,
      'Consumo básico': 4.21,
      Materiales: 3.84,
      Energía: 3.97,
      'Comunicación': 2.84,
      'Bienes raíces': 2.42,
    },
  },
  BCH: {
    sourceDate: '2026-09-18',
    sourceLabel: 'Banco de Chile',
    companies: {
      BCH: { name: 'Banco de Chile', weight: 100 },
    },
    countries: {
      Chile: 100,
    },
    sectors: {
      Financieras: 100,
    },
  },
};

function addWeighted(target, key, contribution) {
  target[key] = (target[key] || 0) + contribution;
}

export function calculateLookthrough(portfolio) {
  const companyExposure = {};
  const companySources = {};
  const countryExposure = {};
  const sectorExposure = {};
  const snapshotDates = [];

  portfolio.assets.forEach((asset) => {
    const snapshot = LOOKTHROUGH_SNAPSHOTS[asset.ticker];
    if (!snapshot) return;

    const portfolioWeight = Number(asset.weight || 0);
    snapshotDates.push({
      ticker: asset.ticker,
      date: snapshot.sourceDate,
      sourceLabel: snapshot.sourceLabel,
    });

    Object.entries(snapshot.companies || {}).forEach(([ticker, company]) => {
      const contribution = portfolioWeight * (company.weight / 100);
      addWeighted(companyExposure, ticker, contribution);
      companySources[ticker] = companySources[ticker] || {
        ticker,
        name: company.name,
        vehicles: [],
      };
      companySources[ticker].vehicles.push({
        ticker: asset.ticker,
        fundWeight: company.weight,
        portfolioContribution: contribution,
      });
    });

    Object.entries(snapshot.countries || {}).forEach(([country, weight]) => {
      addWeighted(countryExposure, country, portfolioWeight * (weight / 100));
    });

    Object.entries(snapshot.sectors || {}).forEach(([sector, weight]) => {
      addWeighted(sectorExposure, sector, portfolioWeight * (weight / 100));
    });
  });

  const companies = Object.entries(companyExposure)
    .map(([ticker, weight]) => ({
      ...companySources[ticker],
      ticker,
      weight,
      repeated: (companySources[ticker]?.vehicles?.length || 0) > 1,
    }))
    .sort((a, b) => b.weight - a.weight);

  const countries = Object.entries(countryExposure)
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);

  const sectors = Object.entries(sectorExposure)
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);

  const us = countryExposure['Estados Unidos'] || 0;
  const chile = countryExposure.Chile || 0;
  const internationalExUSChile = Math.max(0, 100 - us - chile);
  const technology = sectorExposure.Tecnología || 0;
  const largestCompany = companies[0] || null;

  const assetMap = Object.fromEntries(portfolio.assets.map((asset) => [asset.ticker, asset]));

  function knownPairOverlap(leftTicker, rightTicker) {
    const leftSnapshot = LOOKTHROUGH_SNAPSHOTS[leftTicker];
    const rightSnapshot = LOOKTHROUGH_SNAPSHOTS[rightTicker];
    const leftAsset = assetMap[leftTicker];
    const rightAsset = assetMap[rightTicker];

    if (!leftSnapshot || !rightSnapshot || !leftAsset || !rightAsset) {
      return { weight: 0, shared: [] };
    }

    const shared = Object.keys(leftSnapshot.companies || {})
      .filter((ticker) => rightSnapshot.companies?.[ticker])
      .map((ticker) => {
        const leftCompany = leftSnapshot.companies[ticker];
        const rightCompany = rightSnapshot.companies[ticker];
        const leftContribution = Number(leftAsset.weight || 0) * (leftCompany.weight / 100);
        const rightContribution = Number(rightAsset.weight || 0) * (rightCompany.weight / 100);
        return {
          ticker,
          name: leftCompany.name || rightCompany.name,
          duplicateContribution: Math.min(leftContribution, rightContribution),
        };
      })
      .sort((a, b) => b.duplicateContribution - a.duplicateContribution);

    return {
      weight: shared.reduce((sum, item) => sum + item.duplicateContribution, 0),
      shared,
    };
  }

  const vooGlobal = knownPairOverlap('VOO', 'CFIETFGE');
  const vooSmh = knownPairOverlap('VOO', 'SMH');
  const smhGlobal = knownPairOverlap('SMH', 'CFIETFGE');

  const overlaps = [
    {
      pair: 'VOO ↔ Globales',
      level: 'Alto',
      knownOverlap: vooGlobal.weight,
      sharedTickers: vooGlobal.shared.slice(0, 5).map((item) => item.ticker),
      note: 'Comparten varias mega-cap estadounidenses. El porcentaje mostrado es un mínimo conocido basado en las posiciones identificadas en ambos vehículos.',
    },
    {
      pair: 'VOO ↔ SMH',
      level: 'Alto',
      knownOverlap: vooSmh.weight,
      sharedTickers: vooSmh.shared.slice(0, 5).map((item) => item.ticker),
      note: 'SMH refuerza semiconductores que ya existen en VOO. El solapamiento visible está dominado por NVIDIA y Broadcom.',
    },
    {
      pair: 'SMH ↔ Globales',
      level: 'Medio',
      knownOverlap: smhGlobal.weight,
      sharedTickers: smhGlobal.shared.slice(0, 5).map((item) => item.ticker),
      note: 'Comparten algunas grandes compañías de semiconductores, aunque Globales aporta miles de empresas adicionales.',
    },
    {
      pair: 'BCH ↔ resto',
      level: 'Bajo',
      knownOverlap: 0,
      sharedTickers: [],
      note: 'No detectamos empresas compartidas en los snapshots utilizados; BCH aporta una exposición chilena y bancaria distinta.',
    },
  ];

  const concentrationFlags = {
    company: largestCompany && largestCompany.weight >= 8
      ? 'Alta'
      : largestCompany && largestCompany.weight >= 5
        ? 'Moderada'
        : 'Controlada',
    us: us >= 80 ? 'Alta e intencional' : us >= 65 ? 'Elevada' : 'Diversificada',
    technology: technology >= 45 ? 'Alta' : technology >= 35 ? 'Elevada' : 'Moderada',
  };

  return {
    companies,
    countries,
    sectors,
    overlaps,
    snapshotDates,
    summary: {
      us,
      chile,
      internationalExUSChile,
      technology,
      largestCompany,
      concentrationFlags,
    },
  };
}
