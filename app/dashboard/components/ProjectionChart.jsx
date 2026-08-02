'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildProjection } from '../lib/calculations';
import { compactCLP, clp } from '../lib/format';
import styles from '../dashboard.module.css';

export default function ProjectionChart({ totalCLP, monthlyContributionCLP, endYear = 2030 }) {
  const startYear = new Date().getFullYear();
  const conservative = buildProjection({ initialCLP: totalCLP, monthlyCLP: monthlyContributionCLP, annualReturn: 5, startYear, endYear });
  const base = buildProjection({ initialCLP: totalCLP, monthlyCLP: monthlyContributionCLP, annualReturn: 9, startYear, endYear });
  const optimistic = buildProjection({ initialCLP: totalCLP, monthlyCLP: monthlyContributionCLP, annualReturn: 13, startYear, endYear });
  const data = base.map((point, index) => ({
    year: point.year,
    conservador: conservative[index].value,
    base: point.value,
    optimista: optimistic[index].value,
  }));

  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="baseProjection" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6fa8ff" stopOpacity={0.36} />
              <stop offset="100%" stopColor="#6fa8ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: '#8391a2', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => compactCLP.format(value)} tick={{ fill: '#8391a2', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
          <Tooltip contentStyle={{ background: '#0d131c', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14 }} formatter={(value, name) => [clp.format(value), name]} />
          <Area type="monotone" dataKey="conservador" stroke="#64748b" fill="transparent" strokeDasharray="5 5" strokeWidth={1.5} />
          <Area type="monotone" dataKey="base" stroke="#6fa8ff" fill="url(#baseProjection)" strokeWidth={3} />
          <Area type="monotone" dataKey="optimista" stroke="#28d9a7" fill="transparent" strokeDasharray="5 5" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
