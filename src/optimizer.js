import {
  PARTS,FIELDS,ENERGY,TIE_LEVELS,RED_LEVELS,SUPPORT_LEVELS,PAIRS,
  pairKey,pairLabel,levelName,blankInventory,cloneInventory
} from './game-data.js';

function num(x){ const n=parseInt(x,10); return Number.isFinite(n)&&n>0?n:0; }
function emptyState(){ const s={}; for(const k of TIE_LEVELS)s[k]=0; return s; }
function cloneState(s){ const o={}; for(const k of TIE_LEVELS)o[k]=s[k]||0; return o; }
function stateCmp(a,b){ for(const k of TIE_LEVELS){const d=(a[k]||0)-(b[k]||0);if(d)return d;} return 0; }
function betterCand(a,b){ if(!b)return true; if(a.energy!==b.energy)return a.energy>b.energy; return stateCmp(a.state,b.state)>0; }
function redTieCode(state){ let z=0; for(const k of RED_LEVELS)z=z*100+(state[k]||0); return z; }
function addState(a,b){ const s=emptyState(); for(const k of TIE_LEVELS)s[k]=(a[k]||0)+(b[k]||0); return s; }
export function totalEternals(state){ return state.Rainbow||0; }

export function makePartSolver(raw,S,bonusR0=0,consumeEternal=0){
  let p0=raw.P0||0;
  let p1=(raw.P1||0)+Math.floor(p0/2),p0l=p0%2;
  let p2=(raw.P2||0)+Math.floor(p1/2),p1l=p1%2;
  let y0fromp=Math.floor(p2/2),p2l=p2%2;

  const redCache=new Map(),y3Cache=new Map(),y2Cache=new Map(),y1Cache=new Map();

  function solveRed(extraR0){
    if(redCache.has(extraR0))return redCache.get(extraR0);
    const init=[(raw.R0||0)+extraR0+bonusR0,raw.R1||0,raw.R2||0,raw.R3||0,raw.R4||0,raw.Rainbow||0];
    const q=[init],seen=new Set([init.join(',')]);let qi=0;
    const best=Array(S+1).fill(null);

    while(qi<q.length){
      const st=q[qi++],[r0,r1,r2,r3,r4,rb]=st;
      if(rb>=consumeEternal){
        const full=emptyState();Object.assign(full,{R0:r0,R1:r1,R2:r2,R3:r3,R4:r4,Rainbow:rb-consumeEternal});
        const vals=[];
        for(const k of RED_LEVELS)for(let i=0;i<(full[k]||0);i++)vals.push(ENERGY[k]);
        let sum=0,maxK=Math.min(S,vals.length);
        for(let k=0;k<=maxK;k++){
          if(k>0)sum+=vals[k-1];
          const cand={energy:sum,state:cloneState(full)};
          if(betterCand(cand,best[k]))best[k]=cand;
        }
      }

      const nxt=[];
      if(r0>=2)nxt.push([r0-2,r1+1,r2,r3,r4,rb]);
      if(r1>=1&&r0>=1)nxt.push([r0-1,r1-1,r2+1,r3,r4,rb]);
      if(r2>=1&&r0>=1)nxt.push([r0-1,r1,r2-1,r3+1,r4,rb]);
      if(r3>=1&&r0>=1)nxt.push([r0-1,r1,r2,r3-1,r4+1,rb]);
      if(r4>=1&&r0>=2)nxt.push([r0-2,r1,r2,r3,r4-1,rb+1]);
      for(const ns of nxt){const key=ns.join(',');if(!seen.has(key)){seen.add(key);q.push(ns);}}
    }
    redCache.set(extraR0,best);return best;
  }

  function combineLevel(level,count,futureFn){
    const best=Array(S+1).fill(null),parity=count%2,maxL=Math.min(count,S);
    for(let l=parity;l<=maxL;l+=2){
      const m=(count-l)/2,fut=futureFn(m);
      for(let kf=0;kf<=S;kf++){
        const fc=fut[kf];if(!fc)continue;
        const maxKC=Math.min(l,S-kf);
        for(let kc=0;kc<=maxKC;kc++){
          const state=cloneState(fc.state);state[level]=l;
          const cand={energy:fc.energy+kc*ENERGY[level],state},k=kf+kc;
          if(betterCand(cand,best[k]))best[k]=cand;
        }
      }
    }
    return best;
  }

  function y3solve(count){if(y3Cache.has(count))return y3Cache.get(count);const v=combineLevel('Y3',count,m=>solveRed(m));y3Cache.set(count,v);return v;}
  function y2solve(count){if(y2Cache.has(count))return y2Cache.get(count);const v=combineLevel('Y2',count,m=>y3solve((raw.Y3||0)+m));y2Cache.set(count,v);return v;}
  function y1solve(count){if(y1Cache.has(count))return y1Cache.get(count);const v=combineLevel('Y1',count,m=>y2solve((raw.Y2||0)+m));y1Cache.set(count,v);return v;}

  return function(addY0){
    const y0=(raw.Y0||0)+addY0+y0fromp,y0l=y0%2;
    const y1count=(raw.Y1||0)+Math.floor(y0/2),fut=y1solve(y1count);
    const best=Array(S+1).fill(null);
    for(let kf=0;kf<=S;kf++){
      const fc=fut[kf];if(!fc)continue;
      for(let kc=0;kc<=Math.min(y0l,S-kf);kc++){
        const state=cloneState(fc.state);state.Y0=y0l;state.P2=p2l;state.P1=p1l;state.P0=p0l;
        const cand={energy:fc.energy+kc*ENERGY.Y0,state},k=kf+kc;
        if(betterCand(cand,best[k]))best[k]=cand;
      }
    }
    return best;
  };
}

function buildPartOptions(raw,N,S,allow,craftSpec=null){
  const solve=makePartSolver(raw,S,craftSpec?.bonusR0||0,craftSpec?.consumeEternal||0),opts=[];
  for(let k=0;k<=S;k++){
    let bestE=-1,bestTie=-1;
    const maxX=allow?N:0;
    for(let x=0;x<=maxX;x++){
      const cand=solve(x)[k];if(!cand)continue;
      const tie=redTieCode(cand.state);
      if(cand.energy>bestE||(cand.energy===bestE&&tie>bestTie)){
        opts.push({x,k,energy:cand.energy,tie,state:cand.state});
        bestE=cand.energy;bestTie=tie;
      }
    }
  }
  return opts;
}

export function optimizeCore(N,S,inv,targetMap,preferFewerChests=false,craftPair=null){
  const craftSet=new Set(craftPair||[]),partOpts={};
  for(const p of PARTS){
    const craftSpec=craftSet.has(p)?{bonusR0:1,consumeEternal:1}:null;
    partOpts[p]=buildPartOptions(inv[p],N,S,targetMap[p],craftSpec);
  }

  const stride=S+1,W=(N+1)*stride,idx=(c,s)=>c*stride+s;
  let ePrev=new Float64Array(W);ePrev.fill(-1);
  let tPrev=new Float64Array(W);tPrev.fill(-1);
  ePrev[idx(0,0)]=0;tPrev[idx(0,0)]=0;
  const backs=[];

  for(let pi=0;pi<PARTS.length;pi++){
    const p=PARTS[pi],opts=partOpts[p];
    const eNext=new Float64Array(W);eNext.fill(-1);
    const tNext=new Float64Array(W);tNext.fill(-1);
    const bPrevC=new Int16Array(W);bPrevC.fill(-1);
    const bPrevS=new Int8Array(W);bPrevS.fill(-1);
    const bOpt=new Int16Array(W);bOpt.fill(-1);

    for(let c=0;c<=N;c++)for(let s=0;s<=S;s++){
      const ii=idx(c,s),baseE=ePrev[ii];if(baseE<0)continue;
      const baseT=tPrev[ii];
      for(let oi=0;oi<opts.length;oi++){
        const o=opts[oi],nc=c+o.x,ns=s+o.k;if(nc>N||ns>S)continue;
        const jj=idx(nc,ns),ne=baseE+o.energy,nt=baseT+o.tie;
        if(ne>eNext[jj]||(ne===eNext[jj]&&nt>tNext[jj])){
          eNext[jj]=ne;tNext[jj]=nt;bPrevC[jj]=c;bPrevS[jj]=s;bOpt[jj]=oi;
        }
      }
    }
    backs.push({bPrevC,bPrevS,bOpt,opts});ePrev=eNext;tPrev=tNext;
  }

  let best=null;
  for(let c=0;c<=N;c++)for(let s=0;s<=S;s++){
    const ii=idx(c,s),e=ePrev[ii];if(e<0)continue;
    const t=tPrev[ii];
    const tieWin=preferFewerChests
      ? (c<(best?.c??Infinity)||(c===(best?.c??Infinity)&&t>(best?.t??-1)))
      : (t>(best?.t??-1)||(t===(best?.t??-1)&&c<(best?.c??Infinity)));
    if(!best||e>best.e||(e===best.e&&tieWin))best={e,t,c,s};
  }
  if(!best)return null;

  let c=best.c,s=best.s;const alloc=[];
  for(let pi=PARTS.length-1;pi>=0;pi--){
    const b=backs[pi],ii=idx(c,s),oi=b.bOpt[ii];if(oi<0)return null;
    const o=b.opts[oi];alloc.push({p:PARTS[pi],...o});
    c=b.bPrevC[ii];s=b.bPrevS[ii];
  }
  alloc.reverse();return {...best,alloc};
}

export function selectedCounts(state,k){
  let left=k;const counts={};
  for(const lv of SUPPORT_LEVELS){const take=Math.min(left,state[lv]||0);if(take>0){counts[lv]=take;left-=take;}if(left<=0)break;}
  return counts;
}
export function resonanceLoadout(alloc){
  const counts=Object.fromEntries(SUPPORT_LEVELS.map(level=>[level,0]));
  for(const item of alloc||[])for(const [level,count] of Object.entries(selectedCounts(item.state,item.k)))counts[level]+=count;
  return SUPPORT_LEVELS.filter(level=>counts[level]>0).map(level=>({level,count:counts[level],energyEach:ENERGY[level],subtotal:counts[level]*ENERGY[level]}));
}
export function selectedText(state,k){
  const out=Object.entries(selectedCounts(state,k)).map(([lv,count])=>`${levelName(lv)} ×${count}`);
  return out.length?out.join(' · '):'—';
}
export function stateText(state){
  const out=[];for(const lv of TIE_LEVELS){const n=state[lv]||0;if(n>0)out.push(`${levelName(lv)} ×${n}`);}return out.length?out.join(' · '):'—';
}
export function supportEnergy(state,k){
  let left=k,e=0;for(const lv of SUPPORT_LEVELS){const take=Math.min(left,state[lv]||0);e+=take*ENERGY[lv];left-=take;if(left<=0)break;}return e;
}
export function sumFinalState(alloc){let s=emptyState();for(const a of alloc)s=addState(s,a.state);return s;}

export function lowerY0Units(raw,addY0=0){
  let p0=raw.P0||0;
  let p1=(raw.P1||0)+Math.floor(p0/2);
  let p2=(raw.P2||0)+Math.floor(p1/2);
  const y0fromp=Math.floor(p2/2);
  return (raw.Y0||0)+addY0+y0fromp+2*(raw.Y1||0)+4*(raw.Y2||0)+8*(raw.Y3||0);
}

function redAnchorRank(raw){
  if((raw.R4||0)>0)return 5;if((raw.R3||0)>0)return 4;if((raw.R2||0)>0)return 3;
  if((raw.R1||0)>0)return 2;if((raw.R0||0)>0)return 1;return 0;
}
function betterFutureScore(a,b){if(!b)return true;if(a.ready!==b.ready)return a.ready>b.ready;if(a.hist!==b.hist)return a.hist>b.hist;return a.leverage>b.leverage;}

function distributeFutureBank(inv,baseAlloc,leftovers,targetMap){
  const baseX=Object.fromEntries(PARTS.map(p=>[p,0]));for(const a of baseAlloc)baseX[a.p]=a.x||0;
  if(leftovers<=0)return Object.fromEntries(PARTS.map(p=>[p,0]));
  let prev=Array(leftovers+1).fill(null);prev[0]={ready:0,hist:0n,leverage:0};const backs=[];
  for(const p of PARTS){
    const next=Array(leftovers+1).fill(null),back=new Int16Array(leftovers+1);back.fill(-1);
    const baseUnits=lowerY0Units(inv[p],baseX[p]),anchor=redAnchorRank(inv[p]),maxZ=targetMap[p]?leftovers:0;
    for(let used=0;used<=leftovers;used++){const cur=prev[used];if(!cur)continue;
      for(let z=0;z<=Math.min(maxZ,leftovers-used);z++){
        const units=baseUnits+z,ready=Math.floor(units/16),rem=units%16,hist=rem?(1n<<BigInt(rem*4)):0n;
        const cand={ready:cur.ready+ready,hist:cur.hist+hist,leverage:cur.leverage+ready*anchor},nu=used+z;
        if(betterFutureScore(cand,next[nu])){next[nu]=cand;back[nu]=z;}
      }
    }
    backs.push(back);prev=next;
  }
  const out=Object.fromEntries(PARTS.map(p=>[p,0]));let used=leftovers;
  for(let i=PARTS.length-1;i>=0;i--){const z=backs[i][used];if(z<0)throw new Error('Could not allocate every Epic chest.');out[PARTS[i]]=z;used-=z;}
  return out;
}

export function inventoryWithAllocation(inv,allocMap){const out=cloneInventory(inv);for(const p of PARTS)out[p].Y0+=(allocMap[p]||0);return out;}
export function nextR0Distance(raw){const units=lowerY0Units(raw,0),rem=units%16;return rem===0?16:16-rem;}

export function findNextResonanceBreakpoint(inv,S,currentEnergy,targetMap,maxFuture=256){
  const at=d=>optimizeCore(d,S,inv,targetMap);
  let hi=1,res=at(hi);
  while(hi<maxFuture&&(!res||res.e<=currentEnergy)){hi*=2;res=at(Math.min(hi,maxFuture));if(hi>maxFuture)hi=maxFuture;}
  if(!res||res.e<=currentEnergy)return null;
  hi=Math.min(hi,maxFuture);let lo=0,best=res;
  while(lo+1<hi){const mid=Math.floor((lo+hi)/2),r=at(mid);if(r&&r.e>currentEnergy){hi=mid;best=r;}else lo=mid;}
  if(hi!==maxFuture||best.e<=currentEnergy)best=at(hi);
  return best&&best.e>currentEnergy?{chests:hi,result:best}:null;
}

export function allocationSummary(alloc){return alloc.filter(a=>a.x>0).map(a=>`${a.p} +${a.x}`).join(' · ')||'—';}
function zeroAllocMap(){return Object.fromEntries(PARTS.map(p=>[p,0]));}
function chestMapFromResult(result){const m=zeroAllocMap();if(result)for(const a of result.alloc)m[a.p]=a.x||0;return m;}
function addAllocInto(dst,src){for(const p of PARTS)dst[p]=(dst[p]||0)+(src[p]||0);return dst;}
const FUTURE_TARGET_LEVELS=['Rainbow','R4','R3','R2','R1','R0','Y3','Y2','Y1','Y0'];
function byPartResult(result){return Object.fromEntries((result?.alloc||[]).map(a=>[a.p,a]));}
function routeTargetDetails(beforeResult,afterResult){
  const b=byPartResult(beforeResult),a=byPartResult(afterResult),out=[],routed=new Set(PARTS.filter(p=>(a[p]?.x||0)>0));
  const scan=filterToRoute=>{const found=[];for(const p of PARTS){if(filterToRoute&&routed.size&&!routed.has(p))continue;const bs=b[p]?.state||emptyState(),as=a[p]?.state||emptyState();for(let i=0;i<FUTURE_TARGET_LEVELS.length;i++){const lv=FUTURE_TARGET_LEVELS[i],d=(as[lv]||0)-(bs[lv]||0);if(d>0){found.push({p,lv,d,rank:i,label:`${p} → ${levelName(lv)} +${d}`});break;}}}return found;};
  out.push(...scan(true));if(!out.length)out.push(...scan(false));out.sort((x,y)=>x.rank-y.rank||y.d-x.d||x.p.localeCompare(y.p));return out;
}
export function routeTargetSummary(beforeResult,afterResult){const d=routeTargetDetails(beforeResult,afterResult);return d.length?d.slice(0,3).map(x=>x.label).join(' · '):'resonance slot improvement';}
function partialRouteBank(beforeResult,nextBreak,leftovers){
  const out=zeroAllocMap();if(leftovers<=0||!nextBreak)return out;const route=chestMapFromResult(nextBreak.result),targetRanks=Object.fromEntries(PARTS.map(p=>[p,99]));
  for(const d of routeTargetDetails(beforeResult,nextBreak.result))targetRanks[d.p]=d.rank;
  const order=PARTS.filter(p=>route[p]>0).sort((a,b)=>targetRanks[a]-targetRanks[b]||route[b]-route[a]||a.localeCompare(b));let left=leftovers;
  for(const p of order){const take=Math.min(left,route[p]);out[p]+=take;left-=take;if(left<=0)break;}return out;
}
function routeAwareFutureBank(inv,S,currentEnergy,leftovers,targetMap,maxFuture=512){
  const bank=zeroAllocMap(),steps=[];let working=cloneInventory(inv),left=leftovers;
  while(left>0){
    const before=optimizeCore(0,S,working,targetMap,true),next=findNextResonanceBreakpoint(working,S,before.e,targetMap,maxFuture);
    if(!next){const fallback=distributeFutureBank(working,[],left,targetMap);addAllocInto(bank,fallback);working=inventoryWithAllocation(working,fallback);steps.push({kind:'fallback',spent:left,target:'nearest Legend0 fuel'});left=0;break;}
    const target=routeTargetSummary(before,next.result),gain=next.result.e-before.e;
    if(next.chests>left){const partial=partialRouteBank(before,next,left);addAllocInto(bank,partial);working=inventoryWithAllocation(working,partial);steps.push({kind:'bank',spent:left,target,gain,needed:next.chests,route:allocationSummary(next.result.alloc)});left=0;break;}
    const full=chestMapFromResult(next.result);addAllocInto(bank,full);working=inventoryWithAllocation(working,full);steps.push({kind:'reach',spent:next.chests,target,gain,needed:next.chests,route:allocationSummary(next.result.alloc)});left-=next.chests;
  }
  return {bank,steps,working};
}

export function minChestsPartToLegend0(raw){if((raw.R0||0)>0)return 0;const units=lowerY0Units(raw,0);return units>=16?0:16-units;}
export function legendTwinbornFunding(inv,pair){const needs={};let total=0;for(const p of pair){const n=minChestsPartToLegend0(inv[p]);needs[p]=n;total+=n;}return {pair,needs,total,goal:'Legend'};}
function canReachEternalWithExtraR0(raw,extraR0,hasLegendTwinborn){
  const init=[(raw.R0||0)+extraR0+(hasLegendTwinborn?1:0),raw.R1||0,raw.R2||0,raw.R3||0,raw.R4||0,raw.Rainbow||0],q=[init],seen=new Set([init.join(',')]);
  for(let i=0;i<q.length;i++){const [r0,r1,r2,r3,r4,rb]=q[i];if(rb>=1)return true;const nxt=[];
    if(r0>=2)nxt.push([r0-2,r1+1,r2,r3,r4,rb]);if(r1>=1&&r0>=1)nxt.push([r0-1,r1-1,r2+1,r3,r4,rb]);if(r2>=1&&r0>=1)nxt.push([r0-1,r1,r2-1,r3+1,r4,rb]);if(r3>=1&&r0>=1)nxt.push([r0-1,r1,r2,r3-1,r4+1,rb]);if(r4>=1&&r0>=2)nxt.push([r0-2,r1,r2,r3,r4-1,rb+1]);
    for(const ns of nxt){const k=ns.join(',');if(!seen.has(k)){seen.add(k);q.push(ns);}}
  }
  return false;
}
export function minChestsPartToEternal(raw,hasLegendTwinborn,maxFuture=500){let needR0=Infinity;for(let r=0;r<=7;r++){if(canReachEternalWithExtraR0(raw,r,hasLegendTwinborn)){needR0=r;break;}}if(!Number.isFinite(needR0))return Infinity;const lowerUnits=lowerY0Units(raw,0),chests=Math.max(0,needR0*16-lowerUnits);return chests<=maxFuture?chests:Infinity;}
export function pairFunding(inv,pair,ownedMap,maxFuture=500){const owned=!!ownedMap[pairKey(pair)],needs={};let total=0;for(const p of pair){const n=minChestsPartToEternal(inv[p],owned,maxFuture);needs[p]=n;total+=n;}return {pair,needs,total,goal:'Eternal',owned};}
export function twinbornGoalFunding(inv,pair,ownedMap){return ownedMap[pairKey(pair)]?pairFunding(inv,pair,ownedMap):legendTwinbornFunding(inv,pair);}
function twinbornGoalCandidates(inv,targetMap,targetMode,ownedMap,includeFunded=false){
  let pairs=PAIRS.filter(pair=>pair.every(p=>targetMap[p]));if(targetMode!=='AUTO')pairs=pairs.filter(pair=>pairKey(pair)===targetMode);
  let plans=pairs.map(pair=>twinbornGoalFunding(inv,pair,ownedMap)).filter(x=>Number.isFinite(x.total)&&(includeFunded||x.total>0));
  if(targetMode==='AUTO'){const missing=plans.filter(x=>!ownedMap[pairKey(x.pair)]);if(missing.length)plans=missing;}
  plans.sort((a,b)=>a.total-b.total||PAIRS.findIndex(p=>pairKey(p)===pairKey(a.pair))-PAIRS.findIndex(p=>pairKey(p)===pairKey(b.pair)));return plans;
}
function allocateTowardTwinborn(inv,leftovers,targetMap,targetMode,ownedMap){
  const bank=zeroAllocMap(),steps=[];let working=cloneInventory(inv),left=leftovers;const completed=new Set();
  while(left>0){let candidates=twinbornGoalCandidates(working,targetMap,targetMode,ownedMap,false).filter(x=>!completed.has(pairKey(x.pair)));if(!candidates.length)break;
    const plan=candidates[0],take=Math.min(left,plan.total),order=[...plan.pair].sort((a,b)=>plan.needs[a]-plan.needs[b]||a.localeCompare(b));let rem=take;
    for(const p of order){const z=Math.min(rem,plan.needs[p]);bank[p]+=z;working[p].Y0+=z;rem-=z;if(rem<=0)break;}
    const routeParts=[];let rr=take;for(const p of order){const z=Math.min(rr,plan.needs[p]);if(z>0)routeParts.push(`${p} +${z}`);rr-=z;}
    steps.push({pair:plan.pair,goal:plan.goal,spent:take,needed:plan.total,route:routeParts.join(' · ')});left-=take;if(take>=plan.total)completed.add(pairKey(plan.pair));if(targetMode!=='AUTO'&&completed.has(targetMode))break;
  }
  return {bank,steps,working,left};
}
function nearestTwinbornPlan(inv,targetMap,targetMode,ownedMap){return twinbornGoalCandidates(inv,targetMap,targetMode,ownedMap,false)[0]||null;}
function hybridFutureBank(inv,S,leftovers,targetMap,targetMode,mode,ownedMap,maxFuture=512){
  const bank=zeroAllocMap(),steps=[];let working=cloneInventory(inv),left=leftovers;
  while(left>0){
    const before=optimizeCore(0,S,working,targetMap,true),resNext=findNextResonanceBreakpoint(working,S,before.e,targetMap,maxFuture),tbNext=nearestTwinbornPlan(working,targetMap,targetMode,ownedMap);let choose;
    if(mode==='RES')choose=resNext?'RES':(tbNext?'TB':null);else if(mode==='TB')choose=tbNext?'TB':(resNext?'RES':null);else if(resNext&&tbNext)choose=resNext.chests<=tbNext.total?'RES':'TB';else choose=resNext?'RES':(tbNext?'TB':null);
    if(!choose){const fallback=distributeFutureBank(working,[],left,targetMap);addAllocInto(bank,fallback);working=inventoryWithAllocation(working,fallback);steps.push({kind:'fallback',spent:left,label:'generic Legend0 progression'});left=0;break;}
    if(choose==='RES'){const use=Math.min(left,resNext.chests),partial=use<resNext.chests?partialRouteBank(before,resNext,use):chestMapFromResult(resNext.result);addAllocInto(bank,partial);working=inventoryWithAllocation(working,partial);steps.push({kind:'res',spent:use,needed:resNext.chests,label:`Resonance +${resNext.result.e-before.e}`,route:allocationSummary(resNext.result.alloc)});left-=use;if(use<resNext.chests)break;}
    else {const use=Math.min(left,tbNext.total),one=allocateTowardTwinborn(working,use,targetMap,pairKey(tbNext.pair),ownedMap);addAllocInto(bank,one.bank);working=one.working;steps.push({kind:'tb',spent:use,needed:tbNext.total,label:`${pairLabel(tbNext.pair)} ${tbNext.goal} funding`,pair:tbNext.pair,goal:tbNext.goal});left-=use;if(use<tbNext.total)break;}
  }
  return {bank,steps,working,left};
}
function sumAllocMap(m){return PARTS.reduce((n,p)=>n+(m[p]||0),0);}

export function planChestAllocation(N,S,inv,targetMap,targetMode,mode,maxLoss,ownedMap){
  const absolute=optimizeCore(N,S,inv,targetMap,true);if(!absolute)return null;const threshold=absolute.e-maxLoss;let chosenForced=zeroAllocMap(),chosenForcedCount=0;
  if(mode!=='RES'&&N>0){
    let maxForce=N;if(targetMode!=='AUTO'){const pair=PAIRS.find(p=>pairKey(p)===targetMode);if(pair)maxForce=Math.min(N,twinbornGoalFunding(inv,pair,ownedMap).total);}
    const evaluate=k=>{const fp=allocateTowardTwinborn(inv,k,targetMap,targetMode,ownedMap),forced=fp.bank,used=sumAllocMap(forced),w=inventoryWithAllocation(inv,forced),remaining=N-used,r=optimizeCore(remaining,S,w,targetMap,true);return r?{energy:r.e,forced,used,res:r,working:w}:null;};
    if(mode==='TB'){const e=evaluate(maxForce);if(e){chosenForced=e.forced;chosenForcedCount=e.used;}}
    else {let lo=0,hi=maxForce,best=evaluate(0);while(lo<=hi){const mid=Math.floor((lo+hi)/2),e=evaluate(mid);if(e&&e.energy>=threshold){best=e;lo=mid+1;}else hi=mid-1;}if(best){chosenForced=best.forced;chosenForcedCount=best.used;}}
  }
  let working=inventoryWithAllocation(inv,chosenForced),remaining=N-chosenForcedCount;const resPlan=optimizeCore(remaining,S,working,targetMap,true),resMap=chestMapFromResult(resPlan);working=inventoryWithAllocation(working,resMap);remaining-=resPlan.c;
  let future;if(remaining>0){if(mode==='RES')future=routeAwareFutureBank(working,S,optimizeCore(0,S,working,targetMap,true).e,remaining,targetMap,512);else future=hybridFutureBank(working,S,remaining,targetMap,targetMode,mode==='TB'?'TB':'BAL',ownedMap,512);}else future={bank:zeroAllocMap(),steps:[],working,left:0};
  const total=zeroAllocMap();addAllocInto(total,chosenForced);addAllocInto(total,resMap);addAllocInto(total,future.bank);const finalInv=inventoryWithAllocation(inv,total),fixed=optimizeCore(0,S,finalInv,targetMap,true);
  return {absolute,threshold,forcedMap:chosenForced,forcedCount:chosenForcedCount,resPlan,resMap,future,total,finalInv,fixed};
}

export function craftComparison(inv,pair,S,targetMap,ownedMap){
  const before=optimizeCore(0,S,inv,targetMap,true,null);if(!ownedMap[pairKey(pair)])return {craftable:false,before,reason:'Legend Twinborn not owned'};
  const after=optimizeCore(0,S,inv,targetMap,true,pair);if(!after)return {craftable:false,before};return {craftable:true,before,after,loss:before.e-after.e};
}

export function nearestTwinbornGoal(inv,targetMap,targetMode,ownedMap){return twinbornGoalCandidates(inv,targetMap,targetMode,ownedMap,true)[0]||null;}
