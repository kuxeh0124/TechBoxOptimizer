let openCvPromise;

function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}

function dominantFrameHue(imageData){
  const counts={Legend:0,Epic:0,Purple:0};
  const {data}=imageData;
  for(let index=0;index<data.length;index+=4){
    const r=data[index]/255,g=data[index+1]/255,b=data[index+2]/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    if(max<.26||!delta||delta/max<.42)continue;
    let hue;
    if(max===r)hue=((g-b)/delta)%6;
    else if(max===g)hue=(b-r)/delta+2;
    else hue=(r-g)/delta+4;
    hue/=6;if(hue<0)hue+=1;
    if(hue>.70&&hue<.94)counts.Purple++;
    else if(hue>.045&&hue<.19)counts.Epic++;
    else if(hue>.93||hue<.055)counts.Legend++;
  }
  const [name,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return count>imageData.width*imageData.height*.045?name:null;
}

export function alignmentTransform(rect,outWidth=100,outHeight=103){
  if(!rect||rect.width<=0||rect.height<=0)return null;
  const target={x:outWidth*.06,y:outHeight*.02,width:outWidth*.88,height:outHeight*.94};
  const scale=Math.min(target.width/rect.width,target.height/rect.height);
  const tx=target.x+(target.width-rect.width*scale)/2-rect.x*scale;
  const ty=target.y+(target.height-rect.height*scale)/2-rect.y*scale;
  const aspect=rect.width/rect.height,aspectQuality=clamp(1-Math.abs(aspect-.90)/.90);
  const confidence=clamp(aspectQuality*.72+clamp(rect.width/outWidth)*.14+clamp(rect.height/outHeight)*.14);
  return {scale,tx,ty,confidence,target};
}

export async function loadOpenCv(){
  if(openCvPromise)return openCvPromise;
  openCvPromise=(async()=>{
    const imported=await import('@techstark/opencv-js');
    let cv=imported.default??imported;
    if(cv instanceof Promise)cv=await cv;
    if(cv.Mat)return cv;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('OpenCV.js initialization timed out')),20000);
      const prior=cv.onRuntimeInitialized;
      cv.onRuntimeInitialized=()=>{clearTimeout(timer);prior?.();resolve();};
    });
    return cv;
  })();
  return openCvPromise;
}

export function normalizeCardWithOpenCv(imageData,cv,outWidth=100,outHeight=103){
  if(!cv?.Mat||typeof ImageData==='undefined')return null;
  const mats=[];
  const keep=mat=>{mats.push(mat);return mat;};
  try{
    const source=keep(cv.matFromImageData(imageData));
    const rgb=keep(new cv.Mat()),hsv=keep(new cv.Mat()),mask=keep(new cv.Mat());
    cv.cvtColor(source,rgb,cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);
    const frameHue=dominantFrameHue(imageData);
    const ranges=frameHue==='Legend'?[[0,10],[168,180]]:frameHue==='Epic'?[[8,34]]:frameHue==='Purple'?[[126,169]]:[[0,180]];
    for(const [index,[minHue,maxHue]] of ranges.entries()){
      const low=keep(new cv.Mat(hsv.rows,hsv.cols,hsv.type(),new cv.Scalar(minHue,65,65,0)));
      const high=keep(new cv.Mat(hsv.rows,hsv.cols,hsv.type(),new cv.Scalar(maxHue,255,255,255)));
      const rangeMask=index===0?mask:keep(new cv.Mat());
      cv.inRange(hsv,low,high,rangeMask);
      if(index>0)cv.bitwise_or(mask,rangeMask,mask);
    }

    // The role/Twinborn marker and tech badge overlap the card at the top.
    // Remove those corners so the large central hex controls alignment.
    const cornerWidth=Math.round(mask.cols*.22),cornerHeight=Math.round(mask.rows*.40);
    const left=mask.roi(new cv.Rect(0,0,cornerWidth,cornerHeight));
    const right=mask.roi(new cv.Rect(mask.cols-cornerWidth,0,cornerWidth,cornerHeight));
    left.setTo(new cv.Scalar(0));right.setTo(new cv.Scalar(0));left.delete();right.delete();

    const kernel=keep(cv.Mat.ones(3,3,cv.CV_8U));
    cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,kernel);
    const contours=keep(new cv.MatVector()),hierarchy=keep(new cv.Mat());
    cv.findContours(mask,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);

    let best=null;
    for(let index=0;index<contours.size();index++){
      const contour=contours.get(index),area=cv.contourArea(contour,false),rect=cv.boundingRect(contour);
      contour.delete();
      if(rect.width<mask.cols*.38||rect.height<mask.rows*.42)continue;
      const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
      const offset=Math.hypot((cx-mask.cols/2)/mask.cols,(cy-mask.rows*.52)/mask.rows);
      const score=area*(1-clamp(offset)*.55);
      if(!best||score>best.score)best={score,rect};
    }
    if(!best)return null;

    const {rect}=best;
    const edgeHits=Number(rect.x<=1)+Number(rect.y<=1)+Number(rect.x+rect.width>=mask.cols-1)+Number(rect.y+rect.height>=mask.rows-1);
    // A contour locked to several crop edges is usually spill from adjacent
    // cards or overlays, not a reliable outline to normalize against.
    if(edgeHits>=2||rect.width>mask.cols*.95||rect.height>mask.rows*.98)return null;

    const transform=alignmentTransform(rect,outWidth,outHeight);
    if(!transform||transform.confidence<.42)return null;
    const matrix=keep(cv.matFromArray(2,3,cv.CV_64FC1,[transform.scale,0,transform.tx,0,transform.scale,transform.ty]));
    const normalized=keep(new cv.Mat());
    cv.warpAffine(source,normalized,matrix,new cv.Size(outWidth,outHeight),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(0,0,0,255));
    return {
      imageData:new ImageData(new Uint8ClampedArray(normalized.data),normalized.cols,normalized.rows),
      alignment:{method:'opencv',confidence:transform.confidence,sourceRect:rect,scale:transform.scale,frameHue},
    };
  }catch{
    return null;
  }finally{
    for(let index=mats.length-1;index>=0;index--)mats[index]?.delete?.();
  }
}
