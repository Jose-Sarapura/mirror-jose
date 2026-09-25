'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { appendDecisionLog, readDecisionLog } from '../lib/decision-log';
import styles from '../dashboard.module.css';

const MARKER='mirror-v3-eth-exit-constitution-v1';

function seed(){
  if(typeof window==='undefined'||localStorage.getItem(MARKER)==='seeded') return;
  const existing=readDecisionLog(localStorage);
  if(!existing.some(e=>e.id==='eth-exit-constitution-v1')){
    appendDecisionLog(localStorage,{
      id:'eth-exit-constitution-v1',
      date:new Date().toISOString().slice(0,10),
      type:'rule_definition',
      asset:'ETH',
      ruleId:'eth-exit-constitution',
      ruleTitle:'Constitución de salida ETH · red obligatoria',
      decision:'Primera reducción 25% solo con deterioro confirmado de red + otra señal núcleo + refuerzo. Segunda reducción 25% si persiste 7–14 días. El 50% restante requiere invalidación estructural.',
      reason:'ETH depende más directamente de actividad, adopción y uso de red que BTC; por eso la red es condición obligatoria para escalar protección.',
      evidence:'ETH Health Gate V1: capital + actividad de red + estructura ETH/BTC; MVRV y ETF solo refuerzan.',
      source:'eth-exit-constitution',
      reviewStatus:'pending',
    });
  }
  if(!existing.some(e=>e.id==='eth-reentry-constitution-v1')){
    appendDecisionLog(localStorage,{
      id:'eth-reentry-constitution-v1',
      date:new Date().toISOString().slice(0,10),
      type:'rule_definition',
      asset:'ETH',
      ruleId:'eth-reentry-constitution',
      ruleTitle:'Reentrada ETH tras protección',
      decision:'Reentrar 50% de lo vendido tras recuperación de red + estructura; el resto tras 14 días adicionales sin deterioro confirmado.',
      reason:'ETH no se recompra por rebote de precio: debe recuperar uso de red y estructura relativa.',
      evidence:'La reentrada exige nueva validación del Health Gate ETH.',
      source:'eth-exit-constitution',
      reviewStatus:'pending',
    });
  }
  localStorage.setItem(MARKER,'seeded');
  window.dispatchEvent(new Event('mirror-decision-log-updated'));
}

export default function ETHExitConstitution(){
  const [data,setData]=useState(null);

  useEffect(()=>{
    seed();
    let cancelled=false;
    fetch('/api/dashboard/eth-health',{cache:'no-store'})
      .then(r=>r.json())
      .then(p=>{if(!cancelled)setData(p);})
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  const state=useMemo(()=>{
    const d=data?.diagnostics||{};
    const first=Boolean(
      data?.gate?.key==='evaluate_protection'
      && d.networkConfirmed
      && (d.capitalConfirmed||d.relativeConfirmed)
      && (d.valuationHigh||d.etfConfirmed)
    );
    return {first,network:!!d.networkConfirmed,capital:!!d.capitalConfirmed,relative:!!d.relativeConfirmed,refuerzo:!!(d.valuationHigh||d.etfConfirmed)};
  },[data]);

  return(
    <section className={styles.btcHealthPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Constitución ETH · salida y reentrada</p>
          <h2>Protección escalonada con red obligatoria</h2>
          <span className={styles.panelSubtitle}>ETH no hereda automáticamente las reglas BTC. La actividad de red debe deteriorarse antes de considerar una reducción.</span>
        </div>
        <span className={styles.reviewBadge}><Icon name="shield" size={15}/> Constitución activa</span>
      </div>

      <div className={styles.btcHealthStages}>
        <article><span>1 · Revisión</span><strong>Caída relevante</strong><p>Precio activa revisión, nunca venta.</p></article>
        <article className={data?.gate?.key==='prepare'?styles.btcStageActive:''}><span>2 · Preparar</span><strong>≥2 señales núcleo</strong><p>Capital, red y ETH/BTC.</p></article>
        <article className={state.first?styles.btcStageActive:''}><span>3 · Primera reducción</span><strong>25% de ETH</strong><p>Red confirmada + otra señal núcleo + MVRV alto o ETF débil.</p></article>
        <article><span>4 · Segunda reducción</span><strong>25% adicional</strong><p>Solo si el deterioro persiste 7–14 días.</p></article>
      </div>

      <div className={styles.btcHealthDataQuality}>
        <div><span>Red</span><strong>{state.network?'Confirmada':'No confirmada'}</strong><small>Condición obligatoria</small></div>
        <div><span>Capital</span><strong>{state.capital?'Confirmada':'No confirmada'}</strong><small>Realized Cap</small></div>
        <div><span>ETH/BTC</span><strong>{state.relative?'Débil':'Sin confirmación'}</strong><small>Estructura relativa</small></div>
        <div><span>Primera reducción</span><strong>{state.first?'Elegible para evaluar':'No elegible'}</strong><small>Nunca automática</small></div>
      </div>

      <div className={styles.btcHealthCurrent}>
        <div><p className={styles.kicker}>Reserva estratégica</p><h3>50% restante</h3></div>
        <p>Solo se evalúa una salida mayor si la tesis de Ethereum queda dañada de forma estructural: red debilitada de forma prolongada, pérdida persistente de adopción/uso o cambio material de tesis.</p>
      </div>

      <div className={styles.btcHealthStages}>
        <article><span>Reentrada A</span><strong>50% de lo vendido</strong><p>Red recuperada + ETH/BTC estabilizado durante 7 días.</p></article>
        <article><span>Reentrada B</span><strong>50% restante</strong><p>14 días adicionales con Gate normalizado.</p></article>
        <article><span>Prohibido</span><strong>Reentrar por FOMO</strong><p>Un rebote aislado no basta.</p></article>
        <article><span>Invalidación</span><strong>Decisión manual</strong><p>Salida mayor exige evidencia y registro.</p></article>
      </div>
    </section>
  );
}
