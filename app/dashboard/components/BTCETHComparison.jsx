'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { clp, percentage } from '../lib/format';
import styles from '../dashboard.module.css';

function gateTone(key){
  if(key==='evaluate_protection') return styles.btcDangerPill;
  if(key==='prepare') return styles.warningPill;
  if(key==='maintain') return styles.successPill;
  return styles.neutralPill;
}

export default function BTCETHComparison({ portfolio }){
  const [btcHealth,setBtcHealth]=useState(null);
  const [ethHealth,setEthHealth]=useState(null);

  useEffect(()=>{
    let cancelled=false;
    Promise.all([
      fetch('/api/dashboard/btc-health',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/dashboard/eth-health',{cache:'no-store'}).then(r=>r.json()),
    ]).then(([btc,eth])=>{
      if(cancelled) return;
      setBtcHealth(btc);
      setEthHealth(eth);
    }).catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  const btc=(portfolio.cryptoAssets||[]).find(a=>a.ticker==='BTC');
  const eth=(portfolio.cryptoAssets||[]).find(a=>a.ticker==='ETH');

  const strongest=useMemo(()=>{
    if(!btc||!eth) return '—';
    return btc.totalReturnPct>=eth.totalReturnPct?'BTC':'ETH';
  },[btc,eth]);

  return(
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC vs ETH · comparación</p>
          <h2>Dos tesis, dos motores de riesgo</h2>
          <span className={styles.panelSubtitle}>BTC se lee por ciclo, capital y estructura; ETH añade actividad de red como condición obligatoria.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="chart" size={15}/> Comparativa viva</span>
      </div>

      <div className={styles.cryptoCompareGrid}>
        <article>
          <div className={styles.cryptoCompareHead}><strong>BTC</strong><span className={gateTone(btcHealth?.gate?.key)}>{btcHealth?.gate?.label||'Actualizando'}</span></div>
          <h3>{btc?clp.format(btc.valueCLP):'—'}</h3>
          <p>{btc?btc.weightWithinCrypto.toFixed(1)+'% de Buda · '+percentage(btc.totalReturnPct):'Sin datos'}</p>
          <small>Motor: MVRV · capital · STH · ETF secundario</small>
        </article>

        <article>
          <div className={styles.cryptoCompareHead}><strong>ETH</strong><span className={gateTone(ethHealth?.gate?.key)}>{ethHealth?.gate?.label||'Actualizando'}</span></div>
          <h3>{eth?clp.format(eth.valueCLP):'—'}</h3>
          <p>{eth?eth.weightWithinCrypto.toFixed(1)+'% de Buda · '+percentage(eth.totalReturnPct):'Sin datos'}</p>
          <small>Motor: red · capital · ETH/BTC · MVRV/ETF como refuerzo</small>
        </article>

        <article>
          <span>Mayor peso cripto</span>
          <strong>{btc&&eth?(btc.weightWithinCrypto>=eth.weightWithinCrypto?'BTC':'ETH'):'—'}</strong>
          <small>Composición actual en Buda</small>
        </article>

        <article>
          <span>Mejor resultado acumulado</span>
          <strong>{strongest}</strong>
          <small>No implica preferencia automática de aportes</small>
        </article>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15}/>
        <span><strong>Lectura correcta:</strong> comparar no significa aplicar las mismas reglas. BTC y ETH conservan Constituciones de salida independientes.</span>
      </div>
    </section>
  );
}
