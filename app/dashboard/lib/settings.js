import { MIRROR_DEFAULTS } from '../../lib/mirror-config';

export const SETTINGS_VERSION = 3;
export const STORAGE_KEY = `mirror-v2-settings-v${SETTINGS_VERSION}`;

export function createDefaultSettings() {
  return {
    version: SETTINGS_VERSION,
    goalCLP: MIRROR_DEFAULTS.goalCLP,
    monthlyContributionCLP: MIRROR_DEFAULTS.monthlyContributionCLP,
    cashCLP: MIRROR_DEFAULTS.cashCLP,
    transactions: [],
    assets: Object.fromEntries(
      Object.values(MIRROR_DEFAULTS.assets).map((asset) => [
        asset.ticker,
        {
          shares: asset.shares,
          averageCost: asset.averageCost,
          targetWeight: asset.targetWeight,
        },
      ]),
    ),
  };
}

export function mergeStoredSettings(stored) {
  const defaults = createDefaultSettings();
  if (!stored || typeof stored !== 'object') return defaults;

  return {
    ...defaults,
    ...stored,
    version: SETTINGS_VERSION,
    transactions: Array.isArray(stored.transactions) ? stored.transactions : [],
    assets: {
      ...defaults.assets,
      ...(stored.assets || {}),
    },
  };
}

export function registerPurchase(settings, purchase) {
  const current = settings.assets[purchase.ticker];
  if (!current) throw new Error('Activo no válido');

  const purchasedShares = Number(purchase.shares);
  const amount = Number(purchase.amount);
  const currentShares = Number(current.shares);
  const currentAverage = Number(current.averageCost);

  if (!(purchasedShares > 0) || !(amount > 0)) {
    throw new Error('Ingresa un monto y participaciones válidas');
  }

  const newShares = currentShares + purchasedShares;
  const newAverageCost = ((currentShares * currentAverage) + amount) / newShares;
  const transaction = {
    id: `${purchase.ticker}-${purchase.date}-${Date.now()}`,
    ticker: purchase.ticker,
    date: purchase.date,
    amount,
    shares: purchasedShares,
    price: amount / purchasedShares,
    currency: purchase.currency,
    label: `Compra ${purchase.ticker}`,
    createdAt: new Date().toISOString(),
  };

  return {
    settings: {
      ...settings,
      assets: {
        ...settings.assets,
        [purchase.ticker]: {
          ...current,
          shares: newShares,
          averageCost: newAverageCost,
        },
      },
      transactions: [...(settings.transactions || []), transaction],
    },
    transaction,
  };
}

export function removePurchase(settings, transactionId) {
  const transaction = (settings.transactions || []).find((item) => item.id === transactionId);
  if (!transaction) return settings;

  const current = settings.assets[transaction.ticker];
  const currentShares = Number(current.shares);
  const currentCostBasis = currentShares * Number(current.averageCost);
  const previousShares = currentShares - Number(transaction.shares);
  const previousCostBasis = currentCostBasis - Number(transaction.amount);

  if (previousShares < 0 || previousCostBasis < 0) return settings;

  return {
    ...settings,
    assets: {
      ...settings.assets,
      [transaction.ticker]: {
        ...current,
        shares: previousShares,
        averageCost: previousShares > 0 ? previousCostBasis / previousShares : 0,
      },
    },
    transactions: settings.transactions.filter((item) => item.id !== transactionId),
  };
}
