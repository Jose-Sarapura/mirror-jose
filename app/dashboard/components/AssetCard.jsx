'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { clp, nativeMoney, percentage, shares } from '../lib/format';
import { historyMetrics } from '../lib/calculations';
import styles from '../dashboard.module.css';

export default function AssetCard({ asset }) {
  const positive = asset.totalReturnPct >= 0;
  const [yearHistory, setYearHistory] = useState([]);
  useEffect(() => {
    fetch(`/api/dashboard/history?ticker=${asset.ticker}&range=1y`)
      .then((response) => response.json())
      .then((result) => setYearHistory(result.points || []))
      .catch(() => setYearHistory([]));
  }, [asset.ticker]);
  const yearMetrics = useMemo(() => historyMetrics(yearHistory), [yearHistory]);
  const targetRatio = Math.min(100, (asset.weight / asset.targetWeight) * 100);

  return (
    <Link href={`/dashboard/activo/${asset.ticker}`} className={styles.assetCard}>
      <div className={styles.assetCardTop}>
        <div className={styles.assetIdentity}>
          <span className={styles.assetLogo} style={{ '--asset-accent': asset.accent }}>{asset.ticker.slice(0, 2)}</span>
          <div>
            <strong>{asset.ticker}</strong>
            <small>{asset.shortName}</small>
          </div>
        </div>
        <span className={styles.chevron}><Icon name="chevron" size={18} /></span>
      </div>

      <div className={styles.assetMainValue}>
        <strong>{clp.format(asset.valueCLP)}</strong>
        <span className={positive ? styles.positive : styles.negative}>{percentage(asset.totalReturnPct)}</span>
      </div>

      <div className={styles.assetFacts}>
        <span><small>Precio</small><strong>{nativeMoney(asset.price, asset.currency)}</strong></span>
        <span><small>Costo prom.</small><strong>{nativeMoney(asset.averageCost, asset.currency)}</strong></span>
        <span><small>Participaciones</small><strong>{shares(asset.shares)}</strong></span>
      </div>

      {yearMetrics && (
        <div className={styles.cardRangeContext}>
          <span><small>Mín. 1 año</small><strong>{nativeMoney(yearMetrics.low, asset.currency)}</strong></span>
          <span><small>Máx. 1 año</small><strong>{nativeMoney(yearMetrics.high, asset.currency)}</strong></span>
          <span><small>Al máximo</small><strong>{percentage(((asset.price / yearMetrics.high) - 1) * 100)}</strong></span>
        </div>
      )}

      <div className={styles.targetHeader}>
        <span>{asset.weight.toFixed(1)}% actual</span>
        <span>{asset.targetWeight}% objetivo</span>
      </div>
      <div className={styles.targetTrack}><div style={{ width: `${targetRatio}%`, background: asset.accent }} /></div>
      <div className={styles.assetStatusRow}>
        <span className={asset.allocationStatus === 'Infraponderado' ? styles.warningPill : asset.allocationStatus === 'Sobreponderado' ? styles.neutralPill : styles.successPill}>{asset.allocationStatus}</span>
        <span>{asset.gapCLP > 0 ? `Faltan ${clp.format(asset.gapCLP)}` : `Exceso ${clp.format(Math.abs(asset.gapCLP))}`}</span>
      </div>
    </Link>
  );
}
