'use client';

import { useEffect, useState } from 'react';

function formatDisplay(value, decimals) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toLocaleString('es-CL', {
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseInput(value) {
  const cleaned = String(value ?? '').trim();
  if (!cleaned) return NaN;

  // A comma is treated as the decimal separator. Without a comma,
  // a period can still be used while editing.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  return Number(normalized);
}

export default function FormattedNumberInput({
  value,
  decimals,
  onValueChange,
  min = 0,
}) {
  const [draft, setDraft] = useState(() => formatDisplay(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatDisplay(value, decimals));
  }, [value, decimals, focused]);

  const commit = () => {
    setFocused(false);
    const numeric = parseInput(draft);

    if (Number.isFinite(numeric) && numeric >= min) {
      onValueChange(numeric);
      setDraft(formatDisplay(numeric, decimals));
      return;
    }

    setDraft(formatDisplay(value, decimals));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        setDraft(Number(value || 0).toFixed(decimals));
        requestAnimationFrame(() => event.target.select());
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (/^\d*(?:[.,]\d*)?$/.test(next)) setDraft(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(formatDisplay(value, decimals));
          event.currentTarget.blur();
        }
      }}
    />
  );
}
