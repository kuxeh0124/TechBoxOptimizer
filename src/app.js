import {
  PARTS,FIELDS,ENERGY,PAIRS,pairKey,pairLabel,levelName,blankInventory,cloneInventory,
  screenshotPreset,defaultTwinbornOwned,emptyTargets,rarityLevelToField
} from './game-data.js';
import {
  optimizeCore,planChestAllocation,findNextResonanceBreakpoint,sumFinalState,totalEternals,
  selectedText,stateText,supportEnergy,routeTargetSummary,allocationSummary,nextR0Distance,
  twinbornGoalFunding,pairFunding,legendTwinbornFunding,craftComparison,nearestTwinbornGoal
} from './optimizer.js';
import { parseScreenshotFiles,parsedResultsToInventory } from './vision.js';

const $=id=>document.getElementById(id);
const STORAGE_KEY='survivorIoTechOptimizerProjectV1';
let inventory=screenshotPreset();
let twinbornOwned=defaultTwinbornOwned();
let targets=emptyTargets();
let selectedFiles=[];
let previewUrls=[];
let parsedResults=[];

function n(v,def=0){const x=Number(v);return Number.isFinite(x)?x:def;}
function addInventory(dst,src){for(const p of PARTS)for(const f of FIELDS)dst[p][f]=(dst[p][f]||0)+(src[p][f]||0);return dst;}
function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({inventory,twinbornOwned,targets,chests:$('chestCount').value,slots:$('slotCount').value,mode:$('planMode').value,target:$('tbTarget').value,maxLoss:$('maxLoss').value}));}catch{}
}
function load(){
  try{
    const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!x)return;
    if(x.inventory)inventory=addInventory(blankInventory(),x.inventory);
    twinbornOwned={...defaultTwinbornOwned(),...(x.twinbornOwned||{})};targets={...emptyTargets(),...(x.targets||{})};
    $('chestCount').value=x.chests??0;$('slotCount').value=x.slots??18;$('planMode').value=x.mode||'BAL';$('maxLoss').value=x.maxLoss??0;
    renderTargetOptions(x.target||'AUTO');
  }catch{}
}

function renderTargetOptions(preferred){
  const current=preferred||$('tbTarget')?.value||'AUTO';
  $('tbTarget').innerHTML='<option value="AUTO">Auto: missing Twinborn first, then nearest Eternal</option>'+PAIRS.map(p=>`<option value="${pairKey(p)}">${pairLabel(p)}</option>`).join('');
  $('tbTarget').value=[...$('tbTarget').options].some(o=>o.value===current)?current:'AUTO';
}

function renderEnergy(){
  const order=['Rainbow','R4','R3','R2','R1','R0','Y3','Y2','Y1','Y0'];
  $('energyList').innerHTML=order.map(k=>`<div class="energy-item"><strong>${levelName(k)}</strong><span>${ENERGY[k].toLocaleString()}</span></div>`).join('');
}

function renderTwinbornOwnership(){
  $('twinbornOwnership').innerHTML=PAIRS.map(pair=>{const key=pairKey(pair),owned=!!twinbornOwned[key];return `<label class="tb-item"><strong>${pairLabel(pair)}</strong><span class="tb-line"><span>${owned?'Legend Twinborn owned':'Missing Twinborn'}</span><input type="checkbox" data-pair="${key}" ${owned?'checked':''}></span></label>`;}).join('');
  $('twinbornOwnership').querySelectorAll('[data-pair]').forEach(el=>el.addEventListener('change',()=>{twinbornOwned[el.dataset.pair]=el.checked;save();renderTwinbornOwnership();renderRoadmap();runOptimizer();}));
}

function fieldHeader(field){
  if(field.startsWith('P'))return `<span class="purple-h">P${field.slice(1)}</span>`;
  if(field.startsWith('Y'))return `<span class="epic-h">Epic ${field.slice(1)}</span>`;
  if(field.startsWith('R'))return `<span class="legend-h">Legend ${field.slice(1)}</span>`;
  return '<span class="eternal-h">Eternal</span>';
}
function renderInventory(){
  const head=`<thead><tr><th>Tech</th><th>Use chests?</th>${FIELDS.map(f=>`<th>${fieldHeader(f)}</th>`).join('')}</tr></thead>`;
  const body=PARTS.map(p=>`<tr><td><strong>${p}</strong></td><td><input type="checkbox" data-target="${p}" ${targets[p]?'checked':''}></td>${FIELDS.map(f=>`<td><div class="counter"><button data-dec="${p}|${f}">−</button><input type="number" min="0" data-count="${p}|${f}" value="${inventory[p][f]||0}"><button data-inc="${p}|${f}">+</button></div></td>`).join('')}</tr>`).join('');
  $('inventoryTable').innerHTML=head+`<tbody>${body}</tbody>`;
  $('inventoryTable').querySelectorAll('[data-inc]').forEach(btn=>btn.addEventListener('click',()=>changeCount(btn.dataset.inc,1)));
  $('inventoryTable').querySelectorAll('[data-dec]').forEach(btn=>btn.addEventListener('click',()=>changeCount(btn.dataset.dec,-1)));
  $('inventoryTable').querySelectorAll('[data-count]').forEach(inp=>inp.addEventListener('change',()=>{const [p,f]=inp.dataset.count.split('|');inventory[p][f]=Math.max(0,Math.floor(n(inp.value)));inp.value=inventory[p][f];save();renderRoadmap();}));
  $('inventoryTable').querySelectorAll('[data-target]').forEach(cb=>cb.addEventListener('change',()=>{targets[cb.dataset.target]=cb.checked;save();runOptimizer();}));
}
function changeCount(key,delta){const [p,f]=key.split('|');inventory[p][f]=Math.max(0,(inventory[p][f]||0)+delta);renderInventory();renderRoadmap();save();}

function renderRoadmap(inv=inventory){
  const slots=Math.max(1,Math.floor(n($('slotCount').value,18))),lossBudget=Math.max(0,n($('maxLoss').value));
  $('roadmap').innerHTML=PAIRS.map(pair=>{
    const key=pairKey(pair),owned=!!twinbornOwned[key];
    if(!owned){const plan=legendTwinbornFunding(inv,pair);return `<div class="tb-item"><strong>${pairLabel(pair)}</strong><div class="tb-line"><span>Ownership</span><span class="bad">MISSING</span></div><div class="tb-line"><span>${pair[0]} → Legend0</span><span>+${plan.needs[pair[0]]} Epic0</span></div><div class="tb-line"><span>${pair[1]} → Legend0</span><span>+${plan.needs[pair[1]]} Epic0</span></div><div class="tb-line"><span>To Legend Twinborn</span><span class="${plan.total===0?'good':'warn'}">${plan.total}</span></div></div>`;}
    const plan=pairFunding(inv,pair,twinbornOwned),comp=plan.total===0?craftComparison(inv,pair,slots,targets,twinbornOwned):null;
    const advice=plan.total>0?`${plan.total} Epic0 to fund`:comp?.craftable?(comp.loss<=lossBudget?`Craft allowed (${comp.loss>0?'−':'+'}${Math.abs(comp.loss)} reso)`:`Wait (${comp.loss} reso loss)`):'Funded';
    return `<div class="tb-item"><strong>${pairLabel(pair)}</strong><div class="tb-line"><span>Ownership</span><span class="good">OWNED</span></div><div class="tb-line"><span>${pair[0]} → Eternal</span><span>+${plan.needs[pair[0]]} Epic0</span></div><div class="tb-line"><span>${pair[1]} → Eternal</span><span>+${plan.needs[pair[1]]} Epic0</span></div><div class="tb-line"><span>Plan</span><span class="${plan.total===0?'good':'warn'}">${advice}</span></div></div>`;
  }).join('');
}

function renderSummaryStats(items){$('summaryStats').innerHTML=items.map(([label,value,cls=''])=>`<div class="stat"><span>${label}</span><b class="${cls}">${value}</b></div>`).join('');}
function sumMap(m){return PARTS.reduce((s,p)=>s+(m?.[p]||0),0);}

function runOptimizer(){
  try{
    const N=Math.max(0,Math.floor(n($('chestCount').value))),S=Math.max(1,Math.floor(n($('slotCount').value,18))),mode=$('planMode').value,targetMode=$('tbTarget').value,maxLoss=Math.max(0,n($('maxLoss').value));
    const baseline=optimizeCore(0,S,inventory,targets,true);const plan=planChestAllocation(N,S,inventory,targets,targetMode,mode,maxLoss,twinbornOwned);
    if(!baseline||!plan)throw new Error('No valid optimization result.');
    const fixed=plan.fixed,finalState=sumFinalState(fixed.alloc),next=findNextResonanceBreakpoint(plan.finalInv,S,fixed.e,targets,512),tb=nearestTwinbornGoal(plan.finalInv,targets,targetMode,twinbornOwned);
    let craftText='—';
    if(tb){const owned=!!twinbornOwned[pairKey(tb.pair)];if(tb.total>0)craftText=`${owned?'Eternal':'Legend'} +${tb.total}`;else if(!owned)craftText='CRAFT LEGEND TB';else{const comp=craftComparison(plan.finalInv,tb.pair,S,targets,twinbornOwned);craftText=comp?.craftable?(comp.loss<=maxLoss?`CRAFT ETERNAL (${comp.loss>0?'−':'+'}${Math.abs(comp.loss)})`:`WAIT (−${comp.loss})`):'FUNDED';}}
    renderSummaryStats([
      ['Resonance',fixed.e.toLocaleString(),'good'],['Gain vs current',`${fixed.e-baseline.e>=0?'+':''}${(fixed.e-baseline.e).toLocaleString()}`],['Slots used',`${fixed.s} / ${S}`],['Chests allocated',`${sumMap(plan.total)} / ${N}`],
      ['Next reso breakpoint',next?`+${next.chests} Epic0`:'>512'],['Eternals after merges',totalEternals(finalState)],['Twinborn goal',tb?`${tb.goal} +${tb.total}`:'—'],['Craft advice',craftText]
    ]);
    const parts=Object.fromEntries(fixed.alloc.map(a=>[a.p,a]));
    const rows=PARTS.map(p=>({p,a:parts[p],x:plan.total[p]||0})).filter(o=>o.x>0||(o.a?.k||0)>0).sort((a,b)=>b.x-a.x||(b.a?.energy||0)-(a.a?.energy||0));
    const futureText=plan.future.steps?.length?plan.future.steps.map(x=>x.label||x.target||x.kind).join(' · '):'No future-only banking required.';
    const intro=`<div class="priority"><b>All ${N} chest${N===1?'':'s'} allocated.</b> Absolute max resonance for this chest count: <b>${plan.absolute.e.toLocaleString()}</b>. Selected plan: <b>${fixed.e.toLocaleString()}</b>${fixed.e<plan.absolute.e?` (−${plan.absolute.e-fixed.e} within loss budget)`:' (no resonance sacrifice)'}. ${next?`Next resonance increase is +${next.chests} Epic0 → +${next.result.e-fixed.e} energy, targeting ${routeTargetSummary(fixed,next.result)}.`:''}<br><b>Future bank:</b> ${futureText}</div>`;
    $('optimizerResult').className='result-list';
    $('optimizerResult').innerHTML=intro+rows.map(({p,a,x})=>`<div class="result-row"><strong>${p}</strong><div class="allocation">${x?`+${x}`:'—'}</div><div class="detail"><b>Use in resonance:</b> ${a?selectedText(a.state,a.k):'—'}<br><span class="hint"><b>Post-merge:</b> ${a?stateText(a.state):'—'}</span><br><span class="warn"><b>Next Legend0 fuel:</b> ${nextR0Distance(plan.finalInv[p])} Epic0</span></div><div class="energy">${a?supportEnergy(a.state,a.k).toLocaleString():0} energy</div></div>`).join('');
    renderRoadmap(plan.finalInv);save();
  }catch(err){$('optimizerResult').className='empty';$('optimizerResult').textContent=err.message||String(err);}
}

function cleanupPreviews(){for(const u of previewUrls)URL.revokeObjectURL(u);previewUrls=[];}
function renderSelectedFiles(){
  cleanupPreviews();$('fileCount').textContent=selectedFiles.length?`${selectedFiles.length} screenshot${selectedFiles.length===1?'':'s'} selected`:'No screenshots selected';
  $('screenshotPreview').innerHTML=selectedFiles.map(f=>{const u=URL.createObjectURL(f);previewUrls.push(u);return `<div class="preview"><img src="${u}" alt="${f.name}"><div class="meta">${f.name}</div></div>`;}).join('');
}

function confidenceClass(v){return v>=.35?'high':v>=.15?'mid':'low';}
function levelsForRarity(r){if(r==='Purple')return [0,1,2];if(r==='Epic')return [0,1,2,3];if(r==='Legend')return [0,1,2,3,4];return [0];}
function renderReview(){
  if(!parsedResults.length){$('reviewPanel').innerHTML='';return;}
  let index=0,rows='';
  for(const res of parsedResults){for(const card of res.cards){const id=index++,conf=Math.round((card.confidence||0)*100),kind=card.kind||'part';
    const kindSel=`<select data-review-kind="${id}"><option value="part" ${kind==='part'?'selected':''}>Part</option><option value="twinborn" ${kind==='twinborn'?'selected':''}>Twinborn</option></select>`;
    let ident,rarity,level;
    if(kind==='twinborn'){
      ident=`<select data-review-pair="${id}">${PAIRS.map(p=>`<option value="${pairKey(p)}" ${pairKey(p)===card.pairKey?'selected':''}>${pairLabel(p)}</option>`).join('')}</select>`;rarity='Legend Twinborn';level='—';
    }else{
      ident=`<select data-review-tech="${id}">${PARTS.map(p=>`<option ${p===card.tech?'selected':''}>${p}</option>`).join('')}</select>`;
      rarity=`<select data-review-rarity="${id}">${['Purple','Epic','Legend','Eternal'].map(r=>`<option ${r===card.rarity?'selected':''}>${r}</option>`).join('')}</select>`;
      level=`<select data-review-level="${id}">${levelsForRarity(card.rarity).map(l=>`<option value="${l}" ${l===card.level?'selected':''}>${l}</option>`).join('')}</select>`;
    }
    rows+=`<tr><td><input type="checkbox" data-review-use="${id}" ${card.ignored?'':'checked'}></td><td>${res.fileName}</td><td>${card.row+1},${card.col+1}</td><td>${kindSel}</td><td>${ident}</td><td>${rarity}</td><td>${level}</td><td class="confidence ${confidenceClass(card.confidence||0)}">${conf}%</td></tr>`;
  }}
  $('reviewPanel').innerHTML=`<div class="button-row"><button id="applyReviewBtn">Apply reviewed detection</button><span class="hint">Low confidence does not block import; correct any wrong guesses here and apply again.</span></div><div class="review-table"><table><thead><tr><th>Use</th><th>Screenshot</th><th>Cell</th><th>Type</th><th>Tech / Twinborn</th><th>Rarity</th><th>Lv</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const flat=parsedResults.flatMap(r=>r.cards);
  $('reviewPanel').querySelectorAll('[data-review-use]').forEach(el=>el.addEventListener('change',()=>{flat[+el.dataset.reviewUse].ignored=!el.checked;}));
  $('reviewPanel').querySelectorAll('[data-review-kind]').forEach(el=>el.addEventListener('change',()=>{const card=flat[+el.dataset.reviewKind];card.kind=el.value;if(el.value==='twinborn'){card.pairKey=card.pairKey||pairKey(PAIRS[0]);delete card.tech;}else{card.tech=card.tech||PARTS[0];card.rarity=card.rarity||'Epic';card.level=card.level||0;}renderReview();}));
  $('reviewPanel').querySelectorAll('[data-review-pair]').forEach(el=>el.addEventListener('change',()=>{flat[+el.dataset.reviewPair].pairKey=el.value;}));
  $('reviewPanel').querySelectorAll('[data-review-tech]').forEach(el=>el.addEventListener('change',()=>{flat[+el.dataset.reviewTech].tech=el.value;}));
  $('reviewPanel').querySelectorAll('[data-review-rarity]').forEach(el=>el.addEventListener('change',()=>{const card=flat[+el.dataset.reviewRarity];card.rarity=el.value;if(!levelsForRarity(card.rarity).includes(card.level))card.level=0;renderReview();}));
  $('reviewPanel').querySelectorAll('[data-review-level]').forEach(el=>el.addEventListener('change',()=>{flat[+el.dataset.reviewLevel].level=+el.value;}));
  $('applyReviewBtn').addEventListener('click',()=>applyParsedResults(false));
}

function filteredParsedResults(){return parsedResults.map(r=>({...r,cards:r.cards.filter(c=>!c.ignored)}));}
function applyParsedResults(auto=false){
  const derived=parsedResultsToInventory(filteredParsedResults(),blankInventory,rarityLevelToField);
  if($('replaceOnImport').checked)inventory=derived.inventory;else inventory=addInventory(cloneInventory(inventory),derived.inventory);
  if($('syncTwinbornsOnImport').checked)for(const [key,val] of Object.entries(derived.twinbornDetected))if(val)twinbornOwned[key]=true;
  renderInventory();renderTwinbornOwnership();renderRoadmap();save();runOptimizer();
  $('visionStatus').textContent=`Applied ${filteredParsedResults().reduce((s,r)=>s+r.cards.length,0)} detected cards from ${parsedResults.length} screenshot${parsedResults.length===1?'':'s'}${auto?' automatically':''}.`;
}

async function analyzeScreens(){
  if(!selectedFiles.length){$('visionStatus').textContent='Choose at least one screenshot first.';return;}
  $('analyzeBtn').disabled=true;$('visionStatus').textContent='Analyzing screenshots…';
  try{
    parsedResults=await parseScreenshotFiles(selectedFiles);const cardCount=parsedResults.reduce((s,r)=>s+r.cards.length,0),low=parsedResults.flatMap(r=>r.cards).filter(c=>(c.confidence||0)<.15).length;
    $('visionStatus').textContent=`Detected ${cardCount} cards across ${parsedResults.length} screenshot${parsedResults.length===1?'':'s'}. ${low?`${low} low-confidence guess${low===1?'':'es'} highlighted for review.`:'All guesses passed the basic confidence threshold.'}`;
    renderReview();applyParsedResults(true);
  }catch(err){$('visionStatus').textContent=`Screenshot analysis failed: ${err.message||err}`;}finally{$('analyzeBtn').disabled=false;}
}

function wireUpload(){
  $('chooseScreensBtn').addEventListener('click',()=>$('screenshotInput').click());
  $('screenshotInput').addEventListener('change',()=>{selectedFiles=[...$('screenshotInput').files];renderSelectedFiles();if(selectedFiles.length)analyzeScreens();});
  const dz=$('dropZone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');}));
  dz.addEventListener('drop',e=>{selectedFiles=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'));renderSelectedFiles();if(selectedFiles.length)analyzeScreens();});
  $('analyzeBtn').addEventListener('click',analyzeScreens);
}

function wireButtons(){
  $('optimizeBtn').addEventListener('click',runOptimizer);
  $('presetBtn').addEventListener('click',()=>{inventory=screenshotPreset();twinbornOwned=defaultTwinbornOwned();targets=emptyTargets();renderAll();save();runOptimizer();});
  $('clearBtn').addEventListener('click',()=>{inventory=blankInventory();targets=emptyTargets();renderInventory();renderRoadmap();save();runOptimizer();});
  ['chestCount','slotCount','planMode','tbTarget','maxLoss'].forEach(id=>$(id).addEventListener('change',()=>{save();renderRoadmap();runOptimizer();}));
}
function renderAll(){renderTargetOptions();renderEnergy();renderTwinbornOwnership();renderInventory();renderRoadmap();}

renderTargetOptions();load();renderAll();wireUpload();wireButtons();runOptimizer();
