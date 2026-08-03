'use client';

import { useMemo, useState } from 'react';
import { registerPurchase, removePurchase, STORAGE_KEY } from '../lib/settings';
import { nativeMoney, shares as formatShares } from '../lib/format';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function todayInChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function PurchaseRegistrar({ portfolio, settings, setSettings }) {
  const [ticker, setTicker] = useState('SMH');
  const [date, setDate] = useState(todayInChile);
  const [amount, setAmount] = useState('');
  const [purchasedShares, setPurchasedShares] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const asset = portfolio.assets.find((item) => item.ticker === ticker);
  const calculatedPrice = useMemo(() => {
    const numericAmount = Number(amount);
    const numericShares = Number(purchasedShares);
    return numericAmount > 0 && numericShares > 0 ? numericAmount / numericShares : 0;
  }, [amount, purchasedShares]);

  const transactions = [...(settings.transactions || [])].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const persist = (nextSettings) => {
    setSettings(nextSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const result = registerPurchase(settings, {
        ticker,
        date,
        amount: Number(amount),
        shares: Number(purchasedShares),
        currency: asset.currency,
      });
      persist(result.settings);
      setMessage(
        `${ticker} actualizado: ${formatShares(result.settings.assets[ticker].shares)} participaciones · promedio ${nativeMoney(result.settings.assets[ticker].averageCost, asset.currency)}.`,
      );
      setAmount('');
      setPurchasedShares('');
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleRemove = (transactionId) => {
    const nextSettings = removePurchase(settings, transactionId);
    persist(nextSettings);
    setMessage('Compra eliminada y posición recalculada.');
    setError('');
  };

  return (
    <section className={styles.purchaseRegistrar}>
      <div className={styles.purchaseRegistrarHeader}>
        <div>
          <p className={styles.kicker}>Registro de movimientos</p>
          <h3>Registrar una compra real</h3>
          <span>Actualiza participaciones, costo promedio y puntos del gráfico automáticamente.</span>
        </div>
        <span className={styles.autoSaveBadge}><Icon name="check" size={15} /> Guardado automático</span>
      </div>

      <form className={styles.purchaseForm} onSubmit={handleSubmit}>
        <label>
          Activo
          <select value={ticker} onChange={(event) => setTicker(event.target.value)}>
            {portfolio.assets.map((item) => <option key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>)}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>
          Monto ({asset.currency})
          <input type="number" min="0" step="0.01" placeholder="200.00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label>
          Participaciones compradas
          <input type="number" min="0" step="0.00000001" placeholder="0.36634813" value={purchasedShares} onChange={(event) => setPurchasedShares(event.target.value)} required />
        </label>
        <div className={styles.purchaseCalculated}>
          <span>Precio calculado</span>
          <strong>{calculatedPrice ? nativeMoney(calculatedPrice, asset.currency) : '—'}</strong>
        </div>
        <button type="submit" className={styles.primaryButton}><Icon name="edit" size={17} /> Registrar compra</button>
      </form>

      {message && <p className={styles.purchaseSuccess}><Icon name="check" size={15} /> {message}</p>}
      {error && <p className={styles.purchaseError}><Icon name="info" size={15} /> {error}</p>}

      <div className={styles.purchaseHistory}>
        <div className={styles.purchaseHistoryTitle}>
          <strong>Compras añadidas desde Mirror</strong>
          <span>{transactions.length} movimiento{transactions.length === 1 ? '' : 's'}</span>
        </div>
        {transactions.length ? transactions.map((transaction) => (
          <div className={styles.purchaseHistoryRow} key={transaction.id}>
            <div><strong>{transaction.ticker}</strong><span>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString('es-CL')}</span></div>
            <div><strong>{nativeMoney(transaction.amount, transaction.currency)}</strong><span>{formatShares(transaction.shares)} participaciones</span></div>
            <div><strong>{nativeMoney(transaction.price, transaction.currency)}</strong><span>precio</span></div>
            <button type="button" onClick={() => handleRemove(transaction.id)}>Eliminar</button>
          </div>
        )) : <p className={styles.purchaseEmpty}>Las compras base ya están incorporadas. Las próximas aparecerán aquí.</p>}
      </div>
    </section>
  );
}
