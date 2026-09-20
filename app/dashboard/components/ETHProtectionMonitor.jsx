'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { clp, percentage } from '../lib/format';
import styles from '../dashboard.module.css';

const KEY='mirror-v3-eth-high-water-v1';

export default function ETHProtectionMonitor({portfolio}){
  const eth=(portfolio.cryptoAssets||[]).find(a=>a.ticker==='ETH');
  const [peak,setPeak]=useState(null);

  useEffect(()=>{
    if(!eth||typeof window==='undefined') return;
    const stored=JSON.parse(localStorage.getItem(KEY)||'null');
    const current=Number(eth.price||0);
    const previous=Number(stored?.peakPriceCLP||0);
    const next={
      peakPriceCLP:Math.max(current,previous),
      startedAt:stored?.startedAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    };
    localStorage.setItem(KEY,JSON.stringify(next));
    setPeak(next);
  },[eth?.price,portfolio.updatedAt]);

  const metric=useMemo(()=>{
    if(!eth||!peak) return null;
    const current=Number(eth.price||0), shares=Number(eth.shares||0), avg=Number(eth.averageCost||0);
    const peakPrice=Number(peak.peakPriceCLP||current);
    return{
      current,
      peakPrice,
      drawdownPct:peakPrice>0?((current/peakPrice)-1)*100:0,
      currentProfit:(current-avg)*shares,
      peakProfit:(peakPrice-avg)*shares,
      returnedProfit:Math.max(0,(peakPrice-current)*shares),
    };
  },[eth,peak]);

  if(!eth||!metric) return null;

  return(
    <section className={styles.cryptoProtectionPanel}>
      <div className={styles.panelHeader}>
        <div><p className={styles.kicker}>Constitución ETH · protección</p><h2>Patrimonio devuelto desde el máximo</h2><span className={styles.panelSubtitle}>El drawdown de ETH solo activa revisión. La red decide si una corrección escala a protección.</span></div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15}/> ETH activo</span>
      </div>
      <div className={styles.cryptoProtectionHero}>
        <article><span>ETH actual</span><strong>{clp.format(metric.current)}</strong><small>Precio Buda/Mirror</small></article>
        <article><span>Máximo observado</span><strong>{clp.format(metric.peakPrice)}</strong><small>Desde activación del monitor</small></article>
        <article><span>Drawdown</span><strong className={metric.drawdownPct<0?styles.negative:styles.positive}>{percentage(metric.drawdownPct)}</strong><small>Revisión, no venta</small></article>
        <article><span>Patrimonio devuelto</span><strong>{clp.format(metric.returnedProfit)}</strong><small>Desde máximo observado</small></article>
      </div>
      <div className={styles.cryptoGuardrail}><Icon name="info" size={15}/><span><strong>Regla ETH:</strong> precio → revisión → red + capital/estructura → protección escalonada. Nunca copiar automáticamente una regla BTC.</span></div>
    </section>
  );
}
