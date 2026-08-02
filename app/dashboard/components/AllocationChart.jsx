'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { clp } from '../lib/format';
import styles from '../dashboard.module.css';

export default function AllocationChart({ assets, totalCLP }) {
  const data = assets.map((asset) => ({
    ticker: asset.ticker,
    value: asset.valueCLP,
    weight: asset.weight,
    accent: asset.accent,
  }));

  return (
    <div className={styles.allocationWrap}>
      <div className={styles.donutChart}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="ticker" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none">
              {data.map((entry) => <Cell key={entry.ticker} fill={entry.accent} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0d131c', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14 }}
              formatter={(value, _name, item) => [clp.format(value), item.payload.ticker]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <strong>{assets.length}</strong>
          <span>activos</span>
        </div>
      </div>

      <div className={styles.allocationLegend}>
        {assets.map((asset) => (
          <div key={asset.ticker}>
            <span className={styles.legendDot} style={{ background: asset.accent }} />
            <span>{asset.ticker}</span>
            <strong>{asset.weight.toFixed(1)}%</strong>
          </div>
        ))}
        <small>Total {clp.format(totalCLP)}</small>
      </div>
    </div>
  );
}
