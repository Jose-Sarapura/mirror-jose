export function mergePortfolioData(apiData, settings) {
  if (!apiData) return null;

  const fx = apiData.fx;
  const assets = apiData.assets.map((marketAsset) => {
    const override = settings?.assets?.[marketAsset.ticker] || {};
    const shares = numberOr(override.shares, marketAsset.shares);
    const averageCost = numberOr(override.averageCost, marketAsset.averageCost);
    const targetWeight = numberOr(override.targetWeight, marketAsset.targetWeight);
    const valueNative = shares * marketAsset.price;
    const previousValueNative = shares * marketAsset.previousClose;
    const valueCLP = marketAsset.currency === 'USD' ? valueNative * fx : valueNative;
    const previousValueCLP = marketAsset.currency === 'USD' ? previousValueNative * fx : previousValueNative;
    const costBasisNative = shares * averageCost;
    const costBasisCLP = marketAsset.currency === 'USD' ? costBasisNative * fx : costBasisNative;

    return {
      ...marketAsset,
      ...override,
      shares,
      averageCost,
      targetWeight,
      valueNative,
      previousValueNative,
      valueCLP,
      previousValueCLP,
      costBasisNative,
      costBasisCLP,
      totalReturnNative: valueNative - costBasisNative,
      totalReturnPct: costBasisNative ? ((valueNative / costBasisNative) - 1) * 100 : 0,
      dayChangeNative: valueNative - previousValueNative,
    };
  });

  const cashCLP = numberOr(settings?.cashCLP, apiData.cashCLP);
  const cashUSD = numberOr(settings?.cashUSD, apiData.cashUSD);
  const cashUSDCLP = cashUSD * fx;
  const totalCashCLP = cashCLP + cashUSDCLP;
  const investedCLP = assets.reduce((sum, asset) => sum + asset.valueCLP, 0);
  const previousInvestedCLP = assets.reduce((sum, asset) => sum + asset.previousValueCLP, 0);
  const totalCLP = investedCLP + totalCashCLP;
  const previousTotalCLP = previousInvestedCLP + totalCashCLP;
  const investedCostBasisCLP = assets.reduce((sum, asset) => sum + asset.costBasisCLP, 0);
  const totalCostBasisCLP = investedCostBasisCLP + totalCashCLP;

  const enrichedAssets = assets.map((asset) => {
    const weight = investedCLP ? (asset.valueCLP / investedCLP) * 100 : 0;
    const targetValueCLP = investedCLP * (asset.targetWeight / 100);
    return {
      ...asset,
      weight,
      targetValueCLP,
      gapCLP: targetValueCLP - asset.valueCLP,
      weightGap: asset.targetWeight - weight,
      allocationStatus: allocationStatus(weight, asset.targetWeight),
    };
  });

  return {
    ...apiData,
    assets: enrichedAssets,
    cashCLP,
    cashUSD,
    cashUSDCLP,
    totalCashCLP,
    investedCLP,
    previousInvestedCLP,
    investedCostBasisCLP,
    totalCLP,
    previousTotalCLP,
    totalCostBasisCLP,
    totalReturnCLP: totalCLP - totalCostBasisCLP,
    totalReturnPct: totalCostBasisCLP ? ((totalCLP / totalCostBasisCLP) - 1) * 100 : 0,
    dayChangeCLP: totalCLP - previousTotalCLP,
    dayChangePct: previousTotalCLP ? ((totalCLP / previousTotalCLP) - 1) * 100 : 0,
    wallets: {
      USD: { currency: 'USD', balance: cashUSD, valueCLP: cashUSDCLP },
      CLP: { currency: 'CLP', balance: cashCLP, valueCLP: cashCLP },
    },
  };
}

export function contributionRecommendation(portfolio, amountCLP) {
  if (!portfolio || !amountCLP) return null;
  const futureInvested = portfolio.investedCLP + amountCLP;

  const ranked = portfolio.assets
    .map((asset) => {
      const targetAfter = futureInvested * (asset.targetWeight / 100);
      const deficit = Math.max(0, targetAfter - asset.valueCLP);
      const discountToCost = asset.averageCost ? Math.max(0, ((asset.averageCost - asset.price) / asset.averageCost) * 100) : 0;
      const score = deficit + amountCLP * Math.min(discountToCost, 25) / 100;
      return { ...asset, deficit, discountToCost, score };
    })
    .sort((a, b) => b.score - a.score);

  const primary = ranked[0];
  const allocated = Math.min(amountCLP, Math.max(0, primary.deficit || amountCLP));
  const amountNative = primary.currency === 'USD' ? allocated / portfolio.fx : allocated;
  const newShares = amountNative / primary.price;
  const newAverageCost = (primary.costBasisNative + amountNative) / (primary.shares + newShares);
  const newWeight = ((primary.valueCLP + allocated) / futureInvested) * 100;

  return {
    ticker: primary.ticker,
    name: primary.name,
    amountCLP: allocated,
    amountNative,
    newShares,
    newAverageCost,
    newWeight,
    currentWeight: primary.weight,
    targetWeight: primary.targetWeight,
    discountToCost: primary.discountToCost,
    reason: buildRecommendationReason(primary),
  };
}

function buildRecommendationReason(asset) {
  const reasons = [];
  if (asset.weightGap > 0.5) reasons.push(`está ${asset.weightGap.toFixed(1)} puntos bajo su objetivo`);
  if (asset.discountToCost > 1) reasons.push(`cotiza ${asset.discountToCost.toFixed(1)}% bajo tu costo promedio`);
  if (!reasons.length) reasons.push('es el activo con mayor déficit relativo');
  return reasons.join(' y ');
}

export function allocationHealth(assets) {
  const deviation = assets.reduce((sum, asset) => sum + Math.abs(asset.weight - asset.targetWeight), 0);
  return Math.max(0, Math.round(100 - deviation * 2.2));
}

export function allocationStatus(weight, target) {
  const diff = weight - target;
  if (Math.abs(diff) <= 1) return 'En rango';
  return diff > 0 ? 'Sobreponderado' : 'Infraponderado';
}

export function buildProjection({ initialCLP, monthlyCLP, annualReturn, startYear, endYear }) {
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  let value = initialCLP;
  const points = [{ year: startYear, value: Math.round(value) }];

  for (let year = startYear + 1; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      value = value * (1 + monthlyRate) + monthlyCLP;
    }
    points.push({ year, value: Math.round(value) });
  }

  return points;
}

export function estimateGoalYear({ initialCLP, monthlyCLP, annualReturn, goalCLP, startYear }) {
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  let value = initialCLP;
  for (let month = 1; month <= 600; month += 1) {
    value = value * (1 + monthlyRate) + monthlyCLP;
    if (value >= goalCLP) return startYear + month / 12;
  }
  return null;
}

export function historyMetrics(points) {
  if (!points?.length) return null;
  const prices = points.map((point) => point.price).filter(Number.isFinite);
  if (!prices.length) return null;
  const first = prices[0];
  const last = prices.at(-1);
  let peak = prices[0];
  let maxDrawdown = 0;

  prices.forEach((price) => {
    peak = Math.max(peak, price);
    const drawdown = peak ? ((price / peak) - 1) * 100 : 0;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
  });

  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    changePct: first ? ((last / first) - 1) * 100 : 0,
    maxDrawdown,
  };
}

export function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
