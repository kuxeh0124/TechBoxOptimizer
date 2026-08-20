import { PARTS, PAIRS, pairKey } from './game-data.js';

let templateCache = null;

function clamp(v,a=0,b=1){ return Math.max(a,Math.min(b,v)); }
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d){
    if(max===r)h=((g-b)/d)%6;
    else if(max===g)h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h/=6;if(h<0)h+=1;
  }
  return [h,max===0?0:d/max,max];
}

function canvasFor(width,height){ const c=document.createElement('canvas');c.width=width;c.height=height;return c; }
function imageDataFromImage(img){ const c=canvasFor(img.naturalWidth||img.width,img.naturalHeight||img.height);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height); }

async function loadImage(src){
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
}

async function fileToImage(file){
  const url=URL.createObjectURL(file);
  try{return await loadImage(url);}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

function cropImageData(source,x,y,w,h,outW,outH){
  const c=canvasFor(outW,outH),ctx=c.getContext('2d',{willReadFrequently:true});
  const tmp=canvasFor(source.width,source.height),tctx=tmp.getContext('2d');tctx.putImageData(source,0,0);
  ctx.drawImage(tmp,x,y,w,h,0,0,outW,outH);
  return ctx.getImageData(0,0,outW,outH);
}

function mse(a,b){
  const A=a.data,B=b.data,n=Math.min(A.length,B.length);let s=0,c=0;
  for(let i=0;i<n;i+=4){
    // RGB only. Alpha is always opaque.
    let d=A[i]-B[i];s+=d*d;d=A[i+1]-B[i+1];s+=d*d;d=A[i+2]-B[i+2];s+=d*d;c+=3;
  }
  return s/Math.max(1,c);
}

async function pathToImageData(path,w,h){const img=await loadImage(path);const c=canvasFor(w,h),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);return ctx.getImageData(0,0,w,h);}
function asPaths(value){return Array.isArray(value)?value:[value];}

export async function loadVisionTemplates(){
  if(templateCache)return templateCache;
  const manifest=await fetch('./vision/manifest.json').then(r=>r.json());
  const tech={},twinborn={},levels={};
  await Promise.all(Object.entries(manifest.tech).map(async([name,paths])=>{tech[name]=await Promise.all(asPaths(paths).map(p=>pathToImageData(p,32,32)));}));
  await Promise.all(Object.entries(manifest.twinborn).map(async([key,paths])=>{twinborn[key]=await Promise.all(asPaths(paths).map(p=>pathToImageData(p,64,66)));}));
  for(const [rarity,byLevel] of Object.entries(manifest.levels)){
    levels[rarity]={};
    for(const [lv,paths] of Object.entries(byLevel)){
      levels[rarity][lv]=await Promise.all(asPaths(paths).map(p=>pathToImageData(p,40,40)));
    }
  }
  templateCache={tech,twinborn,levels};return templateCache;
}

function buildRarityMask(imageData){
  const {data,width,height}=imageData,mask=new Uint8Array(width*height);
  for(let p=0,i=0;p<data.length;p+=4,i++){
    const [h,s,v]=rgbToHsv(data[p],data[p+1],data[p+2]);
    const rarityHue=(h>.72&&h<.92)||(h>.05&&h<.18)||h>.93||h<.04;
    if(rarityHue&&s>.55&&v>.50)mask[i]=1;
  }
  return mask;
}

function dilate(mask,w,h){
  const out=new Uint8Array(mask.length);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    let hit=0;
    for(let yy=-1;yy<=1&&!hit;yy++)for(let xx=-1;xx<=1;xx++)if(mask[(y+yy)*w+x+xx]){hit=1;break;}
    out[y*w+x]=hit;
  }
  return out;
}
function erode(mask,w,h){
  const out=new Uint8Array(mask.length);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    let ok=1;
    for(let yy=-1;yy<=1&&ok;yy++)for(let xx=-1;xx<=1;xx++)if(!mask[(y+yy)*w+x+xx]){ok=0;break;}
    out[y*w+x]=ok;
  }
  return out;
}
function closeMask(mask,w,h){return erode(erode(dilate(dilate(mask,w,h),w,h),w,h),w,h);}

function connectedComponents(mask,w,h){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),out=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;
    let head=0,tail=0;queue[tail++]=start;seen[start]=1;let area=0,minX=w,minY=h,maxX=0,maxY=0;
    while(head<tail){
      const idx=queue[head++],y=Math.floor(idx/w),x=idx-y*w;area++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      const n1=idx-1,n2=idx+1,n3=idx-w,n4=idx+w;
      if(x>0&&mask[n1]&&!seen[n1]){seen[n1]=1;queue[tail++]=n1;}
      if(x<w-1&&mask[n2]&&!seen[n2]){seen[n2]=1;queue[tail++]=n2;}
      if(y>0&&mask[n3]&&!seen[n3]){seen[n3]=1;queue[tail++]=n3;}
      if(y<h-1&&mask[n4]&&!seen[n4]){seen[n4]=1;queue[tail++]=n4;}
    }
    out.push({area,minX,minY,maxX:maxX+1,maxY:maxY+1,width:maxX-minX+1,height:maxY-minY+1});
  }
  return out;
}

function clusterValues(values,tol){
  const vals=[...values].sort((a,b)=>a-b),groups=[];
  for(const v of vals){
    if(!groups.length){groups.push([v]);continue;}
    const g=groups[groups.length-1],med=g[Math.floor(g.length/2)];
    if(Math.abs(v-med)>tol)groups.push([v]);else g.push(v);
  }
  return groups.map(g=>g.sort((a,b)=>a-b)[Math.floor(g.length/2)]);
}
function median(arr){const a=[...arr].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0;}

function fallbackGrid(width,height){
  const pitchX=width*.1975,startX=width*.012;
  const pitchY=width*.212,startY=width*.026;
  const xs=Array.from({length:5},(_,i)=>Math.round(startX+i*pitchX));
  const ys=[];for(let y=startY;y+width*.12<height;y+=pitchY)ys.push(Math.round(y));
  return {xs,ys,pitchX,pitchY,source:'fallback'};
}

function inferGrid(imageData){
  const {width,height}=imageData;
  let mask=buildRarityMask(imageData);mask=closeMask(mask,width,height);
  const comps=connectedComponents(mask,width,height).filter(c=>c.area>900&&c.width>=60&&c.width<=145&&c.height>=35&&c.height<=135);
  let xs=clusterValues(comps.filter(c=>c.width>=80).map(c=>c.minX),18);
  let ys=clusterValues(comps.filter(c=>c.width>=80).map(c=>c.minY),20);
  if(xs.length!==5)return fallbackGrid(width,height);
  if(ys.length<1)return fallbackGrid(width,height);
  // Drop accidental intermediate clusters by preferring a regular ~118px pitch.
  if(ys.length>1){
    const expected=width*.212;
    const kept=[ys[0]];
    for(let i=1;i<ys.length;i++)if(ys[i]-kept[kept.length-1]>expected*.65)kept.push(ys[i]);
    ys=kept;
  }
  const pitchX=median(xs.slice(1).map((x,i)=>x-xs[i]))||width*.1975;
  const pitchY=ys.length>1?(median(ys.slice(1).map((y,i)=>y-ys[i]))||width*.212):width*.212;
  return {xs,ys,pitchX,pitchY,source:'detected'};
}

function rarityCounts(imageData,x0,y0,w,h){
  const {data,width,height}=imageData,counts={Purple:0,Epic:0,Legend:0};
  const xa=Math.max(0,Math.floor(x0)),ya=Math.max(0,Math.floor(y0)),xb=Math.min(width,Math.ceil(x0+w)),yb=Math.min(height,Math.ceil(y0+h));
  for(let y=ya;y<yb;y++)for(let x=xa;x<xb;x++){
    const p=(y*width+x)*4,[hh,s,v]=rgbToHsv(data[p],data[p+1],data[p+2]);if(s<.55||v<.5)continue;
    if(hh>.72&&hh<.92)counts.Purple++;
    if(hh>.05&&hh<.18)counts.Epic++;
    if(hh>.93||hh<.04)counts.Legend++;
  }
  return counts;
}

function shiftedMse(a,b,maxShift=4,mode='rect'){
  const aw=a.width,ah=a.height,bw=b.width,bh=b.height;
  if(aw!==bw||ah!==bh)return mse(a,b);
  const A=a.data,B=b.data,w=aw,h=ah;
  let best=Infinity;
  const cx=(w-1)/2,cy=(h-1)/2,r=Math.min(w,h)*.45,r2=r*r;
  for(let dy=-maxShift;dy<=maxShift;dy++)for(let dx=-maxShift;dx<=maxShift;dx++){
    const ax0=Math.max(0,dx),ay0=Math.max(0,dy),bx0=Math.max(0,-dx),by0=Math.max(0,-dy);
    const ww=w-Math.abs(dx),hh=h-Math.abs(dy);
    let sum=0,count=0;
    for(let yy=0;yy<hh;yy++){
      const ay=ay0+yy,by=by0+yy;
      for(let xx=0;xx<ww;xx++){
        const ax=ax0+xx,bx=bx0+xx;
        if(mode==='circle'){const qx=ax-cx,qy=ay-cy;if(qx*qx+qy*qy>r2)continue;}
        else if(mode==='inner'&&(ax<4||ay<4||ax>=w-4||ay>=h-4))continue;
        const ai=(ay*w+ax)*4,bi=(by*w+bx)*4;
        let d=A[ai]-B[bi];sum+=d*d;d=A[ai+1]-B[bi+1];sum+=d*d;d=A[ai+2]-B[bi+2];sum+=d*d;count+=3;
      }
    }
    if(count)best=Math.min(best,sum/count);
  }
  return best;
}

function nearestTemplate(patch,templates,{maxShift=0,mode='rect',refineBelow=.12}={}){
  const direct=[];
  for(const [name,value] of Object.entries(templates)){
    const samples=Array.isArray(value)?value:[value];
    let best=Infinity;for(const sample of samples)best=Math.min(best,mse(patch,sample));
    direct.push([best,name,samples]);
  }
  direct.sort((a,b)=>a[0]-b[0]);
  const dBest=direct[0]||[Infinity,null,[]],dSecond=direct[1]||[dBest[0]*1.5,null,[]];
  let confidence=clamp((dSecond[0]-dBest[0])/Math.max(1,dSecond[0]));
  if(!maxShift||confidence>=refineBelow)return {name:dBest[1],score:dBest[0],secondScore:dSecond[0],confidence};

  // Only refine the three closest direct candidates. This keeps multi-screenshot
  // import fast while still tolerating a few pixels of crop/scale drift.
  const refined=direct.slice(0,3).map(([_,name,samples])=>{
    let best=Infinity;for(const sample of samples)best=Math.min(best,shiftedMse(patch,sample,maxShift,mode));
    return [best,name];
  }).sort((a,b)=>a[0]-b[0]);
  const best=refined[0]||[Infinity,null],second=refined[1]||[best[0]*1.5,null];
  confidence=clamp((second[0]-best[0])/Math.max(1,second[0]));
  return {name:best[1],score:best[0],secondScore:second[0],confidence};
}

function classifyRarity(imageData,x0,y0,w,h){
  const counts=rarityCounts(imageData,x0,y0,w,h),entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]),best=entries[0],second=entries[1];
  const total=Math.max(1,best[1]+second[1]);
  return {rarity:best[0],count:best[1],confidence:clamp((best[1]-second[1])/total),counts};
}

function cardCrop(imageData,x0,y0,w,h,kind){
  if(kind==='tech')return cropImageData(imageData,x0+w*.75,y0+h*.07,w*.30,h*.30,32,32);
  if(kind==='level')return cropImageData(imageData,x0+w*.36,y0+h*.75,w*.28,h*.28,40,40);
  if(kind==='twinborn')return cropImageData(imageData,x0+w*.18,y0+h*.20,w*.64,h*.66,64,66);
  return null;
}

function classifyCard(imageData,x0,y0,cardW,cardH,templates){
  const rr=classifyRarity(imageData,x0,y0,cardW,cardH);
  if(rr.count<450)return null;

  // Twinborn detection is currently calibrated for the known Legend Twinborn artwork.
  if(rr.rarity==='Legend'){
    const tbPatch=cardCrop(imageData,x0,y0,cardW,cardH,'twinborn'),tb=nearestTemplate(tbPatch,templates.twinborn,{maxShift:6,mode:'inner'});
    if(tb.score<2500&&tb.confidence>.10){
      return {kind:'twinborn',pairKey:tb.name,rarity:'Legend',level:0,confidence:clamp(.45+tb.confidence*.55),scores:{twinborn:tb,rarity:rr}};
    }
  }

  const techPatch=cardCrop(imageData,x0,y0,cardW,cardH,'tech'),tech=nearestTemplate(techPatch,templates.tech,{maxShift:4,mode:'circle'});
  const levelPatch=cardCrop(imageData,x0,y0,cardW,cardH,'level'),levelSet=templates.levels[rr.rarity]||{};
  const lv=nearestTemplate(levelPatch,levelSet,{maxShift:4,mode:'rect'});
  const level=Number(lv.name||0);
  const confidence=clamp(rr.confidence*.35+tech.confidence*.40+lv.confidence*.25);
  return {kind:'part',tech:tech.name,rarity:rr.rarity,level,confidence,scores:{tech,level:lv,rarity:rr}};
}

export async function parseScreenshotFile(file){
  const templates=await loadVisionTemplates(),img=await fileToImage(file),imageData=imageDataFromImage(img),grid=inferGrid(imageData);
  const cardW=Math.max(90,grid.pitchX*.91),cardH=Math.max(92,grid.pitchY*.87),cards=[];
  for(let r=0;r<grid.ys.length;r++)for(let c=0;c<grid.xs.length;c++){
    const x0=grid.xs[c],y0=grid.ys[r];if(y0+cardH>imageData.height+8)continue;
    const card=classifyCard(imageData,x0,y0,cardW,cardH,templates);if(!card)continue;
    cards.push({...card,id:`${file.name}:${r}:${c}`,row:r,col:c,x0,y0});
  }
  return {fileName:file.name,width:imageData.width,height:imageData.height,grid,cards};
}

export async function parseScreenshotFiles(files){
  const results=[];for(const file of files)results.push(await parseScreenshotFile(file));return results;
}

export function parsedResultsToInventory(results,blankInventoryFn,rarityLevelToField){
  const inv=blankInventoryFn(),owned={};
  for(const result of results)for(const card of result.cards){
    if(card.kind==='twinborn'){owned[card.pairKey]=true;continue;}
    if(!card.tech)continue;const field=rarityLevelToField(card.rarity,card.level);if(field&&inv[card.tech]?.[field]!==undefined)inv[card.tech][field]++;
  }
  return {inventory:inv,twinbornDetected:owned};
}
