import { MIRROR_DEFAULTS } from '../../lib/mirror-config';

export const SETTINGS_VERSION = 5;
export const STORAGE_KEY = `mirror-v2-settings-v${SETTINGS_VERSION}`;
export const LEGACY_STORAGE_KEYS = ['mirror-v2-settings-v4', 'mirror-v2-settings-v3'];

export function createDefaultSettings() {
  return {
    version: SETTINGS_VERSION,
    goalCLP: MIRROR_DEFAULTS.goalCLP,
    monthlyContributionCLP: MIRROR_DEFAULTS.monthlyContributionCLP,
    cashCLP: MIRROR_DEFAULTS.cashCLP,
    cashUSD: MIRROR_DEFAULTS.cashUSD,
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
    cashCLP: numberOr(stored.cashCLP, defaults.cashCLP),
    cashUSD: numberOr(stored.cashUSD, defaults.cashUSD),
    transactions: Array.isArray(stored.transactions) ? stored.transactions : [],
    assets: {
      ...defaults.assets,
      ...(stored.assets || {}),
    },
  };
}

export function readStoredSettings(storage) {
  if (!storage) return createDefaultSettings();

  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const merged = mergeStoredSettings(JSON.parse(raw));

      // Migración v5: conserva compras, costos, participaciones y billeteras,
      // pero corrige la asignación estratégica definitiva 60/20/5/15.
      if (key !== STORAGE_KEY) {
        merged.assets = {
          ...merged.assets,
          VOO: { ...merged.assets.VOO, targetWeight: 60 },
          SMH: { ...merged.assets.SMH, targetWeight: 20 },
          BCH: { ...merged.assets.BCH, targetWeight: 5 },
          CFIETFGE: { ...merged.assets.CFIETFGE, targetWeight: 15 },
        };
        storage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }

      return merged;
    } catch {}
  }

  return createDefaultSettings();
}

export function persistSettings(storage, settings) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
}

export function registerPurchase(settings, purchase) {
  const current = settings.assets[purchase.ticker];
  if (!current) throw new Error('Activo no válido');

  const purchasedShares = Number(purchase.shares);
  const amount = Number(purchase.amount);
  const currentShares = Number(current.shares);
  const currentAverage = Number(current.averageCost);
  const walletField = purchase.currency === 'USD' ? 'cashUSD' : 'cashCLP';
  const walletBalance = numberOr(settings[walletField], 0);

  if (!(purchasedShares > 0) || !(amount > 0)) {
    throw new Error('Ingresa un monto y participaciones válidas');
  }

  if (amount > walletBalance + 0.000001) {
    throw new Error(`Saldo insuficiente en la billetera ${purchase.currency}`);
  }

  const newShares = currentShares + purchasedShares;
  const newAverageCost = ((currentShares * currentAverage) + amount) / newShares;
  const remainingBalance = Math.max(0, walletBalance - amount);
  const normalizedBalance = purchase.currency === 'USD'
    ? (remainingBalance < 0.005 ? 0 : round(remainingBalance, 2))
    : (remainingBalance < 0.5 ? 0 : Math.round(remainingBalance));

  const transaction = {
    id: `${purchase.ticker}-${purchase.date}-${Date.now()}`,
    ticker: purchase.ticker,
    date: purchase.date,
    amount,
    shares: purchasedShares,
    price: amount / purchasedShares,
    currency: purchase.currency,
    walletField,
    walletDeducted: true,
    label: `Compra ${purchase.ticker}`,
    createdAt: new Date().toISOString(),
  };

  return {
    settings: {
      ...settings,
      [walletField]: normalizedBalance,
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

  if (previousShares < -0.00000001 || previousCostBasis < -0.01) return settings;

  const next = {
    ...settings,
    assets: {
      ...settings.assets,
      [transaction.ticker]: {
        ...current,
        shares: Math.max(0, previousShares),
        averageCost: previousShares > 0 ? Math.max(0, previousCostBasis) / previousShares : 0,
      },
    },
    transactions: settings.transactions.filter((item) => item.id !== transactionId),
  };

  if (transaction.walletDeducted) {
    const walletField = transaction.walletField || (transaction.currency === 'USD' ? 'cashUSD' : 'cashCLP');
    const restored = numberOr(next[walletField], 0) + Number(transaction.amount);
    next[walletField] = transaction.currency === 'USD' ? round(restored, 2) : Math.round(restored);
  }

  return next;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
