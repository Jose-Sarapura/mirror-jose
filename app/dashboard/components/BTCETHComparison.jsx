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

function signalTone(signal){
  if(signal?.tone==='danger') return styles.btcDangerPill;
  if(signal?.tone==='watch') return styles.warningPill;
  if(signal?.tone==='good') return styles.successPill;
  return styles.neutralPill;
}

function fmt(value,digits=1){
  const n=Number(value);
  return Number.isFinite(n)?n.toFixed(digits):'—';
}

function moneyM(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return '—';
  const sign=n>0?'+':'';
  return sign+n.toFixed(1)+' M';
}

function btcNext(data){
  const d=data?.diagnostics||{};
  const core=Number(d.confirmedRisks||0);
  if(data?.gate?.key==='evaluate_protection') return 'Confluencia suficiente para evaluar la primera protección de 25%. No automática.';
  if(data?.gate?.key==='prepare') return d.etfConfirmedRisk
    ? 'ETF ya refuerza la lectura. Falta mayor persistencia o confluencia fuerte para escalar.'
    : 'Ya hay ≥2 señales núcleo. ETF o mayor persistencia pueden elevar el estado.';
  return 'Faltan '+Math.max(0,2-core)+' confirmaciones núcleo para entrar en Preparar protección.';
}

function ethNext(data){
  const d=data?.diagnostics||{};
  const core=Number(d.coreConfirmed||0);
  if(data?.gate?.key==='evaluate_protection') return 'Red + otra señal núcleo + refuerzo permiten evaluar la primera protección de 25%.';
  if(data?.gate?.key==='prepare') {
    if(!d.networkConfirmed) return 'El Gate no puede escalar sin deterioro confirmado de actividad de red.';
    if(!(d.valuationHigh||d.etfConfirmed)) return 'La red está confirmada; falta refuerzo de MVRV alto o ETF débil.';
    return 'Falta completar la confluencia exigida por la Constitución ETH.';
  }
  return 'Faltan '+Math.max(0,2-core)+' confirmaciones núcleo para Preparar; la red es obligatoria para Proteger.';
}

export default function BTCETHComparison({ portfolio }){
  const [btcHealth,setBtcHealth]=useState(null);
  const [ethHealth,setEthHealth]=useState(null);

  const btc=(portfolio.cryptoAssets||[]).find(a=>a.ticker==='BTC');
  const eth=(portfolio.cryptoAssets||[]).find(a=>a.ticker==='ETH');

  useEffect(()=>{
    let cancelled=false;
    Promise.all([
      fetch('/api/dashboard/btc-health',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/dashboard/eth-health',{cache:'no-store'}).then(r=>r.json()),
    ]).then(([btcData,ethData])=>{
      if(cancelled) return;
      setBtcHealth(btcData);
      setEthHealth(ethData);
    }).catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  const summary=useMemo(()=>({
    btcCore:Number(btcHealth?.diagnostics?.confirmedRisks||0),
    ethCore:Number(ethHealth?.diagnostics?.coreConfirmed||0),
    btcNext:btcNext(btcHealth),
    ethNext:ethNext(ethHealth),
  }),[btcHealth,ethHealth]);

  const rows=[
    {
      label:'Valoración',
      btc:{
        main:'MVRV '+fmt(btcHealth?.signals?.mvrv?.value,2),
        sub:btcHealth?.signals?.mvrv?.status||'—',
        signal:btcHealth?.signals?.mvrv,
      },
      eth:{
        main:'MVRV '+fmt(ethHealth?.signals?.valuation?.value,2)+' · P'+fmt(ethHealth?.signals?.valuation?.percentile,0),
        sub:ethHealth?.signals?.valuation?.status||'—',
        signal:ethHealth?.signals?.valuation,
      },
    },
    {
      label:'Entrada de capital',
      btc:{
        main:fmt(btcHealth?.signals?.capital?.change30dPct,2)+'%',
        sub:btcHealth?.signals?.capital?.status||'—',
        signal:btcHealth?.signals?.capital,
      },
      eth:{
        main:fmt(ethHealth?.signals?.capital?.change30dPct,2)+'%',
        sub:ethHealth?.signals?.capital?.status||'—',
        signal:ethHealth?.signals?.capital,
      },
    },
    {
      label:'Estructura',
      btc:{
        main:fmt(btcHealth?.signals?.sth?.distancePct,1)+'%',
        sub:'Precio vs STH cost basis',
        signal:btcHealth?.signals?.sth,
      },
      eth:{
        main:fmt(ethHealth?.signals?.relative?.distancePct,1)+'%',
        sub:'ETH/BTC vs media 90d',
        signal:ethHealth?.signals?.relative,
      },
    },
    {
      label:'Demanda ETF',
      btc:{
        main:moneyM(btcHealth?.signals?.etf?.weeklyFlowUSDm),
        sub:btcHealth?.signals?.etf?.status||'—',
        signal:btcHealth?.signals?.etf,
      },
      eth:{
        main:moneyM(ethHealth?.signals?.etf?.flow5dUSDm),
        sub:ethHealth?.signals?.etf?.status||'—',
        signal:ethHealth?.signals?.etf,
      },
    },
    {
      label:'Motor específico',
      btc:{
        main:btcHealth?.signals?.lth?.status||'Pendiente',
        sub:'LTH aún fuera del Gate',
        signal:btcHealth?.signals?.lth,
      },
      eth:{
        main:(ethHealth?.signals?.network?.weakCount ?? '—')+'/3 débiles',
        sub:ethHealth?.signals?.network?.status||'—',
        signal:ethHealth?.signals?.network,
      },
    },
  ];

  return(
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>BTC vs ETH · panel de decisión</p>
          <h2>Comparación operativa, no solo de rentabilidad</h2>
          <span className={styles.panelSubtitle}>Estado, señales, drawdown y condición exacta para que cada activo avance hacia protección.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="chart" size={15}/> Comparativa viva</span>
      </div>

      <div className={styles.cryptoDecisionHero}>
        <article>
          <div className={styles.cryptoCompareHead}>
            <div><span>BTC</span><strong>{btc?clp.format(btc.valueCLP):'—'}</strong></div>
            <span className={gateTone(btcHealth?.gate?.key)}>{btcHealth?.gate?.label||'Actualizando'}</span>
          </div>
          <div className={styles.cryptoDecisionStats}>
            <div><span>Peso Buda</span><strong>{btc?fmt(btc.weightWithinCrypto,1)+'%':'—'}</strong></div>
            <div><span>Resultado</span><strong>{btc?percentage(btc.totalReturnPct):'—'}</strong></div>
            <div><span>Drawdown ciclo</span><strong>{Number.isFinite(btcHealth?.marketPeak?.drawdownPct)?percentage(btcHealth.marketPeak.drawdownPct):'—'}</strong><small>Máx. {btcHealth?.marketPeak?.date || '—'}</small></div>
            <div><span>Núcleo confirmado</span><strong>{summary.btcCore}/3</strong></div>
          </div>
          <p className={styles.cryptoNextStep}><b>Siguiente condición:</b> {summary.btcNext}</p>
        </article>

        <article>
          <div className={styles.cryptoCompareHead}>
            <div><span>ETH</span><strong>{eth?clp.format(eth.valueCLP):'—'}</strong></div>
            <span className={gateTone(ethHealth?.gate?.key)}>{ethHealth?.gate?.label||'Actualizando'}</span>
          </div>
          <div className={styles.cryptoDecisionStats}>
            <div><span>Peso Buda</span><strong>{eth?fmt(eth.weightWithinCrypto,1)+'%':'—'}</strong></div>
            <div><span>Resultado</span><strong>{eth?percentage(eth.totalReturnPct):'—'}</strong></div>
            <div><span>Drawdown ciclo</span><strong>{Number.isFinite(ethHealth?.marketPeak?.drawdownPct)?percentage(ethHealth.marketPeak.drawdownPct):'—'}</strong><small>Máx. {ethHealth?.marketPeak?.date || '—'}</small></div>
            <div><span>Núcleo confirmado</span><strong>{summary.ethCore}/3</strong></div>
          </div>
          <p className={styles.cryptoNextStep}><b>Siguiente condición:</b> {summary.ethNext}</p>
        </article>
      </div>

      <div className={styles.cryptoSignalMatrix}>
        <div className={styles.cryptoSignalHead}>
          <span>Familia</span><span>BTC</span><span>ETH</span>
        </div>
        {rows.map(row=>(
          <div className={styles.cryptoSignalRow} key={row.label}>
            <strong>{row.label}</strong>
            <div>
              <span className={signalTone(row.btc.signal)}>{row.btc.sub}</span>
              <b>{row.btc.main}</b>
            </div>
            <div>
              <span className={signalTone(row.eth.signal)}>{row.eth.sub}</span>
              <b>{row.eth.main}</b>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.cryptoDecisionRules}>
        <article>
          <span>BTC · Preparar</span>
          <strong>≥2 señales núcleo confirmadas</strong>
          <small>Capital, STH y MVRV. ETF solo refuerza.</small>
        </article>
        <article>
          <span>BTC · Proteger</span>
          <strong>Confluencia fuerte</strong>
          <small>Persistencia núcleo o ≥2 núcleo + ETF confirmado.</small>
        </article>
        <article>
          <span>ETH · Preparar</span>
          <strong>≥2 señales núcleo</strong>
          <small>Capital, red y ETH/BTC.</small>
        </article>
        <article>
          <span>ETH · Proteger</span>
          <strong>Red obligatoria + refuerzo</strong>
          <small>Red + capital/ETH-BTC + MVRV alto o ETF débil.</small>
        </article>
      </div>

      <div className={styles.cryptoGuardrail}>
        <Icon name="shield" size={15}/>
        <span><strong>Uso de esta pestaña:</strong> detectar cuál tesis está acumulando deterioro y qué condición falta. No asigna aportes ni ejecuta ventas automáticamente.</span>
      </div>
    </section>
  );
}
