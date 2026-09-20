'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import styles from '../dashboard.module.css';

function fmt(v,d=1){ const n=Number(v); return Number.isFinite(n)?n.toFixed(d):'—'; }
function usd(v){ const n=Number(v); return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):'—'; }

export default function ETHCycleLab(){
  const [data,setData]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/dashboard/eth-cycle',{cache:'no-store'})
      .then(r=>r.json())
      .then(payload=>{ if(!cancelled) setData(payload); })
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  return (
    <section className={styles.btcBacktestPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>ETH Cycle Lab</p>
          <h2>2017–18 · 2021 · 2025–26</h2>
          <span className={styles.panelSubtitle}>
            ETH se valida con valoración y actividad de red. El objetivo es evitar copiar umbrales BTC o sobreajustar un solo ciclo.
          </span>
        </div>
        <span className={styles.reviewBadge}><Icon name="brain" size={15}/> Evidencia histórica</span>
      </div>

      <div className={styles.btcBacktestTable}>
        <div className={styles.btcBacktestHead}>
          <span>Ciclo</span><span>Máximo</span><span>MVRV pico</span><span>Direcciones 30d</span><span>Fees 30d</span><span>Transferencias 30d</span><span>Lectura</span>
        </div>
        {(data?.cycles||[]).map(c=>(
          <div className={styles.btcBacktestRow} key={c.cycle}>
            <div><strong>{c.cycle}</strong><small>{c.peak?.date||'—'}</small></div>
            <div><strong>{usd(c.peak?.price)}</strong><small>Máximo observado</small></div>
            <div><strong>{fmt(c.peak?.mvrv,2)}</strong><small>Máx. 180d {fmt(c.prePeakMvrvMax?.value,2)}</small></div>
            <div><strong>{fmt(c.networkAtPeak?.active30dChangePct)}%</strong><small>Vs 30d previos</small></div>
            <div><strong>{fmt(c.networkAtPeak?.fee30dChangePct)}%</strong><small>Fees nativas</small></div>
            <div><strong>{fmt(c.networkAtPeak?.transfer30dChangePct)}%</strong><small>Valor ajustado</small></div>
            <div><strong>Contexto, no gatillo</strong><small>Buscar patrones repetidos, no números perfectos</small></div>
          </div>
        ))}
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15}/>
        <span><strong>Regla:</strong> MVRV ETH se interpreta por percentil propio y la red debe confirmar deterioro. Ningún máximo histórico define por sí solo una venta futura.</span>
      </div>
    </section>
  );
}
