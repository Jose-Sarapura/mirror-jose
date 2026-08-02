export const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const compactCLP = new Intl.NumberFormat('es-CL', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function nativeMoney(value, currency) {
  return currency === 'USD' ? usd.format(value) : clp.format(value);
}

export function percentage(value, digits = 2) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value || 0).toFixed(digits)}%`;
}

export function shares(value) {
  return Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 8 });
}
