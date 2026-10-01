import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COIN_METRICS = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics';

const WINDOWS = [
  { key:'2017-18', start:'2017-01-01', end:'2018-12-31' },
  { key:'2021', start:'2020-07-01', end:'2022-06-30' },
  { key:'2025-26', start:'2024-01-01', end:'2026-09-19' },
];

function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
function avg(values){ const valid=values.filter(Number.isFinite); return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null; }
function pct(a,b){ return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?((a/b)-1)*100:null; }

async function fetchRows(){
  const p=new URLSearchParams({
    assets:'eth',
    metrics:'PriceUSD,CapMrktCurUSD,CapMVRVCur,AdrActCnt,FeeTotNtv,TxTfrValAdjUSD',
    frequency:'1d',
    start_time:'2017-01-01',
    end_time:'2026-09-19',
    paging_from:'start',
    page_size:'10000',
    ignore_forbidden_errors:'true',
    ignore_unsupported_errors:'true',
  });
  const r=await fetch(`${COIN_METRICS}?${p.toString()}`,{
    headers:{'User-Agent':'Mozilla/5.0 Mirror-Jose/3.0'},
    next:{revalidate:86400},
  });
  if(!r.ok) throw new Error(`Coin Metrics ETH HTTP ${r.status}`);
  const payload=await r.json();
  return (payload?.data||[]).map(row=>({
    date:row.time?.slice(0,10),
    price:num(row.PriceUSD),
    mvrv:num(row.CapMVRVCur),
    active:num(row.AdrActCnt),
    fee:num(row.FeeTotNtv),
    transfer:num(row.TxTfrValAdjUSD),
  })).filter(row=>row.date&&Number.isFinite(row.price)).sort((a,b)=>a.date.localeCompare(b.date));
}

function rolling(rows,field,index,days){
  const start=Math.max(0,index-days+1);
  return avg(rows.slice(start,index+1).map(r=>r[field]));
}

function analyzeWindow(allRows,win){
  const rows=allRows.filter(r=>r.date>=win.start&&r.date<=win.end);
  if(!rows.length) return null;
  const peak=rows.reduce((best,row)=>row.price>best.price?row:best,rows[0]);
  const idx=rows.findIndex(r=>r.date===peak.date);
  const prevEnd=idx-30;

  const active30=rolling(rows,'active',idx,30);
  const fee30=rolling(rows,'fee',idx,30);
  const transfer30=rolling(rows,'transfer',idx,30);

  const prevActive=prevEnd>=0?rolling(rows,'active',prevEnd,30):null;
  const prevFee=prevEnd>=0?rolling(rows,'fee',prevEnd,30):null;
  const prevTransfer=prevEnd>=0?rolling(rows,'transfer',prevEnd,30):null;

  const pre180=rows.slice(Math.max(0,idx-180),idx+1).filter(r=>Number.isFinite(r.mvrv));
  const maxMvrv=pre180.length?pre180.reduce((best,row)=>row.mvrv>best.mvrv?row:best,pre180[0]):null;

  return {
    cycle:win.key,
    peak:{date:peak.date,price:peak.price,mvrv:peak.mvrv},
    prePeakMvrvMax:maxMvrv?{date:maxMvrv.date,value:maxMvrv.mvrv}:null,
    networkAtPeak:{
      active30dChangePct:pct(active30,prevActive),
      fee30dChangePct:pct(fee30,prevFee),
      transfer30dChangePct:pct(transfer30,prevTransfer),
    },
  };
}

export async function GET(){
  try{
    const rows=await fetchRows();
    return NextResponse.json({
      updatedAt:new Date().toISOString(),
      sourceStatus:'live-backtest',
      methodology:{
        purpose:'Contexto histórico ETH; no optimiza umbrales de salida.',
        note:'Compara valoración y actividad de red alrededor de máximos de distintos regímenes.',
      },
      cycles:WINDOWS.map(win=>analyzeWindow(rows,win)).filter(Boolean),
    });
  }catch(error){
    return NextResponse.json({updatedAt:new Date().toISOString(),sourceStatus:'error',error:error?.message||'ETH cycle lab error',cycles:[]});
  }
}
