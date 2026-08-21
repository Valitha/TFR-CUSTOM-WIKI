(() => {
'use strict';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const canvas = $('#gfxCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const STORAGE_KEY = 'tfr-gfx-maker-state-v1';
const DISCLAIMER_KEY = 'tfr-fan-disclaimer-v1';
const DB_NAME = 'tfr-gfx-maker-assets';
const DB_STORE = 'assets';

const template = (name) => `./assets/template/${name}`;
const placeholder = (name) => `./assets/placeholders/${name}`;

const DEFAULTS = {
  activeTool: 'country',
  country: {
    country: 'European Union',
    leader: 'Unknown Leader',
    faction: 'North Atlantic Treaty Organization',
    party: 'Democratic Coalition',
    ideologyText: 'Liberal Democracy',
    election: 'Next election: Unknown',
    focusText: 'Unknown National Focus',
    focusProgress: 35,
    textSizes: {
      country: 16,
      faction: 14,
      leader: 15,
      party: 15,
      ideology: 15,
      election: 14,
      focus: 14
    },
    transforms: {
      flag: { x: 0, y: 0, size: 100 },
      leader: { x: 0, y: 0, size: 100 },
      focus: { x: 0, y: 0, size: 100 }
    },
    ideologySlices: [
      { label: 'Primary', value: 45, color: '#d94f91' },
      { label: 'Secondary', value: 25, color: '#e3c94f' },
      { label: 'Third', value: 20, color: '#58bfcf' },
      { label: 'Other', value: 10, color: '#4f70d9' }
    ],
    ideologyIcon: '../assets/icon-library/ideology/right_populism_USA.webp',
    ideologyIconName: 'right populism USA',
    ideologyIconMode: 'builtin',
    factionIcon: '../assets/icon-library/factions/GFX_NATO_Member.webp',
    factionIconName: 'NATO Member',
    factionIconMode: 'builtin'
  },
  event: {
    title: 'Major Event',
    body: 'Type event text here...',
    button: 'We will remember this.',
    transform: { x: 0, y: 0, size: 100 }
  },
  news: {
    title: 'Breaking News',
    body: 'Type news text here...',
    button: 'The world watches.',
    transform: { x: 0, y: 0, size: 100 }
  },
  super: {
    title: 'A New Era',
    motto: 'Type quote or motto here...\n— Attribution',
    button: 'Continue',
    transform: { x: 0, y: 0, size: 100 }
  }
};

let state = loadState();
let activeTool = state.activeTool || 'country';
let renderSeq = 0;
let manifest = null;
let iconMode = 'ideology';
const imageCache = new Map();
const animatedAssets=new Set();
const animatedDurations=new Map();
const decodedAnimations=new Map();
let animationLoopId=0,animationRenderBusy=false,animationLastPaint=0;
let animationStartedAt=performance.now();
let forcedAnimationTime=null;
let exportInProgress=false;
const assetUrls = {
  flag: placeholder('flag_eu.png'),
  leader: placeholder('leader_unknown.png'),
  focus: placeholder('focus_unknown.png'),
  event: placeholder('major_news.png'),
  news: placeholder('local_news.png'),
  super: placeholder('super_event.png')
};
const objectUrls = new Map();
const customIconUrls = new Map();
const CUSTOM_ICON_DB_KEYS = {ideology:'custom-ideology-icon', faction:'custom-faction-icon'};

const SOUND_PREF_KEY = 'tfr-sound-muted-v1';
const SOUND_URLS = {
  province: '../assets/click_province_01.wav',
  open: '../assets/click_window_open.wav',
  close: '../assets/click_close.wav'
};
const soundPools = Object.fromEntries(Object.entries(SOUND_URLS).map(([name,src]) => [name, Array.from({length:4}, () => {
  const audio = new Audio(src); audio.volume = .72; return audio;
})]));
let soundMuted = readSoundPreference();
function readSoundPreference(){
  try {
    const saved = localStorage.getItem(SOUND_PREF_KEY);
    if(saved !== null) return saved === '1';
  } catch {}
  return matchMedia('(max-width: 760px)').matches;
}
function playSound(name='province'){
  if(soundMuted)return;
  const pool=soundPools[name]||soundPools.province; if(!pool)return;
  const audio=pool.find(a=>a.paused||a.ended)||pool[0];
  try{audio.currentTime=0;audio.play().catch(()=>{});}catch{}
}
function isWritableTarget(el){
  if(!(el instanceof Element))return false;
  if(el.closest('[contenteditable=true]'))return true;
  const input=el.closest('input,textarea');
  if(!input)return false;
  const type=(input.type||'text').toLowerCase();
  return !['button','file','checkbox','radio','range','color','submit','reset'].includes(type);
}
function soundForTarget(target){
  const el=target instanceof Element?target:null;
  if(!el)return null;
  if(isWritableTarget(el))return 'province';
  const control=el.closest('button,a,summary,select,.file-btn,label');
  if(!control)return null;
  const text=(control.textContent||'').trim().toLowerCase();
  if(control.matches('.danger,[value=cancel]') || control.closest('.dialog-head') && /×|close|cancel/.test(text) || /remove|delete|cancel|close|hide|×/.test(text))return 'close';
  return 'open';
}
document.addEventListener('pointerdown',e=>{const name=soundForTarget(e.target);if(name)playSound(name)},true);
window.addEventListener('storage',e=>{if(e.key===SOUND_PREF_KEY)soundMuted=readSoundPreference()});
window.addEventListener('pageshow',()=>{soundMuted=readSoundPreference()});

function cloneDefaults(){ return JSON.parse(JSON.stringify(DEFAULTS)); }
function mergeDeep(base, incoming){
  if(!incoming || typeof incoming !== 'object') return base;
  for(const [k,v] of Object.entries(incoming)){
    if(v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') mergeDeep(base[k], v);
    else base[k] = v;
  }
  return base;
}
function loadState(){
  try { return mergeDeep(cloneDefaults(), JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')); }
  catch { return cloneDefaults(); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function dbGet(key){ const db=await openDB(); return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readonly');const q=tx.objectStore(DB_STORE).get(key);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);}); }
async function dbSet(key,val){ const db=await openDB(); return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);}); }
async function dbDelete(key){ const db=await openDB(); return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);}); }

function hasGifHeader(bytes){return bytes?.length>=6&&bytes[0]===71&&bytes[1]===73&&bytes[2]===70&&bytes[3]===56&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97}
async function gifBytesFromBlob(blob){try{const head=new Uint8Array(await blob.slice(0,6).arrayBuffer());if(!hasGifHeader(head))return null;return new Uint8Array(await blob.arrayBuffer())}catch{return null}}
function looksLikeImageFile(file){return !!file&&(file.type?.startsWith('image/')||/\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name||''))}
function animatedSourceForKey(key){if(Object.prototype.hasOwnProperty.call(assetUrls,key))return assetUrls[key]||'';if(key==='ideologyIcon')return customIconUrls.get('ideology')||'';if(key==='factionIcon')return customIconUrls.get('faction')||'';return ''}

function readGifSubBlocks(bytes,pos){
  const parts=[];let total=0;
  while(pos<bytes.length){const size=bytes[pos++];if(!size)break;const part=bytes.subarray(pos,pos+size);parts.push(part);total+=part.length;pos+=size}
  const data=new Uint8Array(total);let at=0;for(const part of parts){data.set(part,at);at+=part.length}
  return{data,pos};
}
function decodeGifLzw(minCodeSize,data,expectedSize){
  const clear=1<<minCodeSize,end=clear+1,dictPrefix=new Int16Array(4096),dictSuffix=new Uint8Array(4096),stack=new Uint8Array(4097),out=new Uint8Array(expectedSize);
  let codeSize=minCodeSize+1,next=end+1,bitPos=0,outPos=0,old=-1,first=0;
  const readCode=()=>{let code=0;for(let bit=0;bit<codeSize;bit++){const byte=data[bitPos>>3]||0;code|=((byte>>(bitPos&7))&1)<<bit;bitPos++}return code};
  const reset=()=>{codeSize=minCodeSize+1;next=end+1;old=-1};
  reset();
  while(bitPos<data.length*8&&outPos<expectedSize){
    let code=readCode();
    if(code===clear){reset();continue}
    if(code===end)break;
    if(old<0){out[outPos++]=code;old=code;first=code;continue}
    const input=code;let top=0;
    if(code>=next){stack[top++]=first;code=old}
    while(code>=clear){stack[top++]=dictSuffix[code];code=dictPrefix[code]}
    first=code;stack[top++]=first;
    while(top&&outPos<expectedSize)out[outPos++]=stack[--top];
    if(next<4096){dictPrefix[next]=old;dictSuffix[next]=first;next++;if(next===(1<<codeSize)&&codeSize<12)codeSize++}
    old=input;
  }
  return out;
}
function deinterlaceGifPixels(pixels,width,height){
  const out=new Uint8Array(pixels.length),starts=[0,4,2,1],steps=[8,8,4,2];let row=0;
  for(let pass=0;pass<4;pass++)for(let y=starts[pass];y<height;y+=steps[pass]){out.set(pixels.subarray(row*width,(row+1)*width),y*width);row++}
  return out;
}
function decodeGif(bytes){
  if(!hasGifHeader(bytes))return null;
  let pos=6;
  const u16=()=>{const n=bytes[pos]|(bytes[pos+1]<<8);pos+=2;return n};
  const width=u16(),height=u16(),packed=bytes[pos++],backgroundIndex=bytes[pos++];pos++;
  const readTable=size=>{const table=new Array(size);for(let i=0;i<size;i++)table[i]=[bytes[pos++],bytes[pos++],bytes[pos++]];return table};
  const globalTable=(packed&0x80)?readTable(1<<((packed&7)+1)):null;
  let gce={delay:100,disposal:0,transparentIndex:-1};
  const frames=[];
  while(pos<bytes.length){
    const marker=bytes[pos++];
    if(marker===0x3B)break;
    if(marker===0x21){
      const label=bytes[pos++];
      if(label===0xF9){
        const size=bytes[pos++];
        if(size>=4){const flags=bytes[pos++],delay=(bytes[pos]|(bytes[pos+1]<<8))*10;pos+=2;const transparent=bytes[pos++];gce={delay:delay<20?100:delay,disposal:(flags>>2)&7,transparentIndex:(flags&1)?transparent:-1};pos+=Math.max(0,size-4);if(bytes[pos]===0)pos++}
        else{pos+=size;if(bytes[pos]===0)pos++}
      }else{const skipped=readGifSubBlocks(bytes,pos);pos=skipped.pos}
      continue;
    }
    if(marker!==0x2C)continue;
    const left=u16(),top=u16(),frameWidth=u16(),frameHeight=u16(),imagePacked=bytes[pos++];
    const localTable=(imagePacked&0x80)?readTable(1<<((imagePacked&7)+1)):null;
    const minCodeSize=bytes[pos++],blocks=readGifSubBlocks(bytes,pos);pos=blocks.pos;
    let pixels=decodeGifLzw(minCodeSize,blocks.data,frameWidth*frameHeight);
    if(imagePacked&0x40)pixels=deinterlaceGifPixels(pixels,frameWidth,frameHeight);
    frames.push({left,top,width:frameWidth,height:frameHeight,pixels,colorTable:localTable||globalTable,delay:gce.delay,disposal:gce.disposal,transparentIndex:gce.transparentIndex});
    gce={delay:100,disposal:0,transparentIndex:-1};
  }
  if(!frames.length)return null;
  let totalDuration=0;for(const frame of frames){frame.start=totalDuration;totalDuration+=frame.delay;frame.end=totalDuration}
  const work=document.createElement('canvas');work.width=width;work.height=height;const workCtx=work.getContext('2d',{willReadFrequently:true});
  const backup=document.createElement('canvas');backup.width=width;backup.height=height;const backupCtx=backup.getContext('2d');
  return{width,height,backgroundIndex,frames,totalDuration:Math.max(1,totalDuration),canvas:work,ctx:workCtx,backup,backupCtx,currentIndex:-1,currentCycle:-1,restoreReady:false};
}
function resetDecodedAnimation(animation){animation.ctx.clearRect(0,0,animation.width,animation.height);animation.backupCtx.clearRect(0,0,animation.width,animation.height);animation.currentIndex=-1;animation.currentCycle=-1;animation.restoreReady=false}
function drawDecodedGifPatch(animation,frame){
  const table=frame.colorTable;if(!table)return;
  const rgba=new Uint8ClampedArray(frame.width*frame.height*4);
  for(let i=0,j=0;i<frame.pixels.length;i++,j+=4){const index=frame.pixels[i],color=table[index]||[0,0,0];rgba[j]=color[0];rgba[j+1]=color[1];rgba[j+2]=color[2];rgba[j+3]=index===frame.transparentIndex?0:255}
  animation.ctx.putImageData(new ImageData(rgba,frame.width,frame.height),frame.left,frame.top);
}
function applyDecodedGifDisposal(animation,frame){
  if(frame.disposal===2)animation.ctx.clearRect(frame.left,frame.top,frame.width,frame.height);
  else if(frame.disposal===3&&animation.restoreReady){animation.ctx.clearRect(0,0,animation.width,animation.height);animation.ctx.drawImage(animation.backup,0,0)}
}
function decodedGifFrameAt(animation,timeMs){
  const cycle=Math.floor(Math.max(0,timeMs)/animation.totalDuration),local=Math.max(0,timeMs)%animation.totalDuration;
  let target=animation.frames.length-1;for(let i=0;i<animation.frames.length;i++)if(local<animation.frames[i].end){target=i;break}
  if(animation.currentCycle!==cycle||target<animation.currentIndex)resetDecodedAnimation(animation);
  animation.currentCycle=cycle;
  while(animation.currentIndex<target){
    if(animation.currentIndex>=0)applyDecodedGifDisposal(animation,animation.frames[animation.currentIndex]);
    const next=animation.frames[animation.currentIndex+1];
    if(next.disposal===3){animation.backupCtx.clearRect(0,0,animation.width,animation.height);animation.backupCtx.drawImage(animation.canvas,0,0);animation.restoreReady=true}else animation.restoreReady=false;
    drawDecodedGifPatch(animation,next);animation.currentIndex++;
  }
  return animation.canvas;
}
function currentAnimationTime(){return forcedAnimationTime===null?performance.now()-animationStartedAt:forcedAnimationTime}
function clearAssetAnimation(key){animatedAssets.delete(key);animatedDurations.delete(key);decodedAnimations.delete(key)}
async function noteAssetAnimation(key,blob){
  const bytes=blob?await gifBytesFromBlob(blob):null;
  if(!bytes){clearAssetAnimation(key);return}
  try{
    const decoded=decodeGif(bytes);
    if(decoded&&decoded.frames.length>1){animatedAssets.add(key);animatedDurations.set(key,decoded.totalDuration);decodedAnimations.set(key,decoded);animationStartedAt=performance.now()}
    else clearAssetAnimation(key);
  }catch(error){console.warn('Could not read animated image.',error);clearAssetAnimation(key)}
  ensureAnimationLoop();
}
function setObjectUrl(key, blob){
  if(objectUrls.has(key)) URL.revokeObjectURL(objectUrls.get(key));
  const url=URL.createObjectURL(blob); objectUrls.set(key,url); assetUrls[key]=url;
}
function setCustomIconObjectUrl(mode,blob){
  if(customIconUrls.has(mode))URL.revokeObjectURL(customIconUrls.get(mode));
  const url=URL.createObjectURL(blob);customIconUrls.set(mode,url);return url;
}
function countryIconMode(mode){return state.country?.[mode+'IconMode']||'builtin'}
function countryIconSrc(mode){
  const selected=countryIconMode(mode);
  if(selected==='none')return '';
  if(selected==='custom')return customIconUrls.get(mode)||'';
  return state.country?.[mode+'Icon']||'';
}
async function restoreAssets(){
  for(const key of Object.keys(assetUrls)){
    try{ const blob=await dbGet(key); if(blob){setObjectUrl(key,blob);await noteAssetAnimation(key,blob)} }catch(e){ console.warn('asset restore failed',key,e); }
  }
  for(const mode of ['ideology','faction']){
    if(countryIconMode(mode)!=='custom')continue;
    try{
      const blob=await dbGet(CUSTOM_ICON_DB_KEYS[mode]);
      if(blob){setCustomIconObjectUrl(mode,blob);await noteAssetAnimation(mode+'Icon',blob)}
      else{state.country[mode+'IconMode']='none';state.country[mode+'IconName']='No icon';saveState();}
    }catch(e){console.warn('custom icon restore failed',mode,e)}
  }
  updateThumbs(); scheduleRender();
}

function getPath(obj,path){ return path.split('.').reduce((o,k)=>o?.[k],obj); }
function setPath(obj,path,value){ const bits=path.split('.'); const last=bits.pop(); const target=bits.reduce((o,k)=>o[k],obj); target[last]=value; }

function bindInputs(){
  $$('[data-bind]').forEach(el=>{
    const path=el.dataset.bind; const val=getPath(state,path);
    el.value = val ?? '';
    const evt=el.type==='range'?'input':'input';
    el.addEventListener(evt,()=>{
      let v=el.value; if(el.type==='range') v=Number(v);
      setPath(state,path,v); saveState(); updateOutputs(); scheduleRender();
    });
  });
}
function updateOutputs(){
  $('#focusProgressOut').textContent=`${state.country.focusProgress}%`;
  $$('[data-size-output]').forEach(out=>{
    const value=getPath(state,out.dataset.sizeOutput);
    out.textContent=`${Number(value)||0}px`;
  });
  $$('[data-transform-output]').forEach(out=>{
    const value=Number(getPath(state,out.dataset.transformOutput))||0;
    out.textContent=`${value}%`;
  });
}

async function handleAssetInput(key, input){
  const file=input.files?.[0]; if(!file) return;
  if(!looksLikeImageFile(file)){ alert('Please choose an image file.'); input.value=''; return; }
  try{ await dbSet(key,file); setObjectUrl(key,file); await noteAssetAnimation(key,file); imageCache.clear(); updateThumbs(); scheduleRender(); }
  catch(e){ alert('Could not store that image locally.'); console.error(e); }
  input.value='';
}

const assetDefaults={
  flag:placeholder('flag_eu.png'), leader:placeholder('leader_unknown.png'), focus:placeholder('focus_unknown.png'),
  event:placeholder('major_news.png'), news:placeholder('local_news.png'), super:placeholder('super_event.png')
};
const transformPathByAsset={flag:'country.transforms.flag',leader:'country.transforms.leader',focus:'country.transforms.focus',event:'event.transform',news:'news.transform',super:'super.transform'};
function resetAssetTransform(key){
  const path=transformPathByAsset[key]; if(!path)return;
  const fresh=getPath(DEFAULTS,path); if(fresh)setPath(state,path,JSON.parse(JSON.stringify(fresh)));
}
async function clearAsset(key){
  await dbDelete(key).catch(()=>{});
  if(objectUrls.has(key)){URL.revokeObjectURL(objectUrls.get(key));objectUrls.delete(key);}
  assetUrls[key]=assetDefaults[key]; clearAssetAnimation(key); resetAssetTransform(key); saveState(); imageCache.clear(); updateThumbs(); bindValuesOnly(); updateOutputs(); scheduleRender();
}

function updateThumbs(){
  const map={flag:'flagThumb',leader:'leaderThumb',focus:'focusThumb',event:'eventThumb',news:'newsThumb',super:'superThumb'};
  for(const [key,id] of Object.entries(map)){
    $('#'+id).src=assetUrls[key];
    const clear=$(`[data-clear-asset="${key}"]`); if(clear)clear.hidden=!objectUrls.has(key);
  }
  for(const mode of ['ideology','faction']){
    const img=$('#'+mode+'Thumb'),name=$('#'+mode+'Name'),button=$('#choose'+(mode==='ideology'?'Ideology':'Faction')),src=countryIconSrc(mode);
    if(src){img.src=src;img.hidden=false}else{img.removeAttribute('src');img.hidden=true}
    button?.classList.toggle('no-icon',!src);
    name.textContent=countryIconMode(mode)==='none'?'No icon':(state.country[mode+'IconName']||(mode==='ideology'?'Selected ideology':'Selected faction'));
  }
}

function loadImage(src){
  if(!src)return Promise.resolve(null);
  if(imageCache.has(src))return imageCache.get(src);
  const p=new Promise(resolve=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src});
  imageCache.set(src,p);return p;
}
function loadAssetImage(key,src){
  const animation=decodedAnimations.get(key);
  if(animation&&animatedAssets.has(key)&&animatedSourceForKey(key)===src)return Promise.resolve(decodedGifFrameAt(animation,currentAnimationTime()));
  return loadImage(src);
}
function cleanTransform(t){return{x:Number(t?.x)||0,y:Number(t?.y)||0,size:Math.max(10,Number(t?.size)||100)}}
function imageDimensions(im){const w=Number(im?.naturalWidth||im?.videoWidth||im?.width)||1,h=Number(im?.naturalHeight||im?.videoHeight||im?.height)||1;return{w,h}}
function drawCover(im,x,y,w,h){if(!im)return;const size=imageDimensions(im),s=Math.max(w/size.w,h/size.h),sw=w/s,sh=h/s,sx=(size.w-sw)/2,sy=(size.h-sh)/2;ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h)}
function drawCoverTransform(im,x,y,w,h,t){
  if(!im)return;const size=imageDimensions(im),tr=cleanTransform(t),base=Math.max(w/size.w,h/size.h),s=base*(tr.size/100),dw=size.w*s,dh=size.h*s,cx=x+w/2+(tr.x/100)*w,cy=y+h/2+(tr.y/100)*h;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(im,cx-dw/2,cy-dh/2,dw,dh);ctx.restore();
}
function drawContain(im,x,y,w,h){if(!im)return;const size=imageDimensions(im),s=Math.min(w/size.w,h/size.h),dw=size.w*s,dh=size.h*s;ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function drawCentered(im,cx,cy,scale=1,maxW=Infinity,maxH=Infinity){if(!im)return;const size=imageDimensions(im);let s=scale;if(size.w*s>maxW)s=Math.min(s,maxW/size.w);if(size.h*s>maxH)s=Math.min(s,maxH/size.h);const w=size.w*s,h=size.h*s;ctx.drawImage(im,cx-w/2,cy-h/2,w,h)}
function drawCenteredTransform(im,cx,cy,scale=1,maxW=Infinity,maxH=Infinity,t){
  if(!im)return;const size=imageDimensions(im),tr=cleanTransform(t);let s=scale;if(size.w*s>maxW)s=Math.min(s,maxW/size.w);if(size.h*s>maxH)s=Math.min(s,maxH/size.h);s*=tr.size/100;const w=size.w*s,h=size.h*s,ox=(tr.x/100)*(Number.isFinite(maxW)?maxW:0),oy=(tr.y/100)*(Number.isFinite(maxH)?maxH:0);ctx.drawImage(im,cx+ox-w/2,cy+oy-h/2,w,h);
}
function textFont(size, display=false, weight=400){ return `${weight} ${size}px ${display?"'VCROSDMONO', monospace":"'Electrolize', Arial, sans-serif"}`; }
function fitText(text,maxWidth,size,min=9,display=false){ let s=size; while(s>min){ctx.font=textFont(s,display); if(ctx.measureText(text).width<=maxWidth) break; s-=.5;} return s; }
function wrapLines(text,maxWidth,font,lineLimit=999){
  ctx.font=font; const paras=String(text||'').split(/\n/); const out=[];
  for(const para of paras){
    if(!para){out.push('');continue;}
    const words=para.split(/\s+/); let line='';
    for(const word of words){ const test=line?line+' '+word:word; if(ctx.measureText(test).width>maxWidth && line){out.push(line); line=word;} else line=test; if(out.length>=lineLimit) break; }
    if(out.length<lineLimit && line) out.push(line);
    if(out.length>=lineLimit) break;
  }
  return out;
}
function drawWrapped(text,x,y,maxWidth,lineHeight,font,color='#000',align='left',maxLines=999){
  const lines=wrapLines(text,maxWidth,font,maxLines); ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';
  const tx=align==='center'?x+maxWidth/2:x;
  lines.forEach((line,i)=>ctx.fillText(line,tx,y+i*lineHeight,maxWidth)); return lines.length*lineHeight;
}

function setCanvas(w,h,title){
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
  $('#previewTitle').textContent=title; $('#previewSize').textContent=`${w} × ${h}`;
}

async function renderCountry(seq){
  setCanvas(524,248,'Country');
  ctx.clearRect(0,0,524,248);
  // The CSS background is only for the screen. Fill the canvas with black so exported PNGs keep the black panel.
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,524,248);
  const imgs=await Promise.all([
    loadImage(template('diplo_upper_win_bg.png')),loadImage(template('diplo_top_bg_diplo_tab.png')),loadImage(template('Leader_Background.png')),loadImage(template('diplo_leader_frame.png')),loadImage(template('flag_overlay.png')),loadImage(template('pol_goal_progress_frame.png')),loadImage(template('pol_goal_progress.png')),loadImage(template('diplo_goal_button.png')),loadImage(template('bck_shadow.png')),loadImage(template('pol_piechart_overlay.png')),
    loadAssetImage('flag',assetUrls.flag),loadAssetImage('leader',assetUrls.leader),loadAssetImage('focus',assetUrls.focus),loadAssetImage('ideologyIcon',countryIconSrc('ideology')),loadAssetImage('factionIcon',countryIconSrc('faction'))
  ]); if(seq!==renderSeq)return;
  const [upper,tab,leaderBg,leaderFrame,flagOverlay,progressFrame,progress,goalButton,shadow,pieOverlay,flag,leader,focus,ideology,faction]=imgs;

  if(leaderBg)ctx.drawImage(leaderBg,7,79,120,160);
  drawCoverTransform(leader,7,79,120,160,state.country.transforms?.leader);
  if(leaderFrame)ctx.drawImage(leaderFrame,0,70);

  drawCoverTransform(flag,22,15,90,55,state.country.transforms?.flag);
  if(flagOverlay)ctx.drawImage(flagOverlay,8.5,6.75,117,71.5);

  if(upper)ctx.drawImage(upper,125,4);
  if(tab)ctx.drawImage(tab,125,76);

  drawCentered(ideology,177,42,1,70,70);
  drawCentered(faction,485,40,1,72,72);

  const pieCx=183,pieCy=122,pieR=31.5;
  if(shadow)drawCentered(shadow,pieCx,pieCy,.6);
  const slices=(state.country.ideologySlices||[]).filter(x=>Number(x.value)>0);
  const total=slices.reduce((sum,x)=>sum+Math.max(0,Number(x.value)||0),0)||1;
  let angle=-Math.PI/2;
  for(const slice of slices){
    const amount=Math.max(0,Number(slice.value)||0)/total;
    ctx.beginPath();ctx.moveTo(pieCx,pieCy);ctx.arc(pieCx,pieCy,pieR,angle,angle+Math.PI*2*amount);ctx.closePath();
    ctx.fillStyle=slice.color||'#777';ctx.fill();angle+=Math.PI*2*amount;
  }
  if(pieOverlay)drawCentered(pieOverlay,pieCx,pieCy,1);

  if(goalButton)ctx.drawImage(goalButton,230.5,170,285,64);
  drawCenteredTransform(focus,182,202,.9,92,94,state.country.transforms?.focus);
  if(progressFrame)ctx.drawImage(progressFrame,253.5,216);
  if(progress){
    const pw=Math.round(237*Math.max(0,Math.min(100,Number(state.country.focusProgress)||0))/100);
    if(pw>0)ctx.drawImage(progress,0,0,pw,18,255,217,pw,6);
  }

  ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
  const ts=state.country.textSizes||DEFAULTS.country.textSizes;
  ctx.fillStyle='#d7d7d7';ctx.textAlign='left';ctx.textBaseline='top';
  // Leave room for the faction icon on the right side of the top text.
  let size=fitText(state.country.country,210,Number(ts.country)||16,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.country,230,8);
  size=fitText(state.country.faction,210,Number(ts.faction)||14,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.faction,230,28);
  size=fitText(state.country.leader,210,Number(ts.leader)||15,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.leader,230,48);
  ctx.font=textFont(fitText(state.country.party,270,Number(ts.party)||15,8,true),true);ctx.fillText(state.country.party,238,91);
  ctx.font=textFont(fitText(state.country.ideologyText,270,Number(ts.ideology)||15,8,true),true);ctx.fillText(state.country.ideologyText,238,113);
  ctx.font=textFont(fitText(state.country.election,270,Number(ts.election)||14,8,true),true);ctx.fillStyle='#e7b676';ctx.fillText(state.country.election,238,135);

  // Center the focus name on the pink box inside the button image, not the whole image.
  // The button starts at (230.5, 170). Its inner box center is (141, 30.5), so the text center is (371.5, 200.5).
  ctx.fillStyle='#d7d7d7';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=textFont(fitText(state.country.focusText,238,Number(ts.focus)||14,8,true),true);
  ctx.fillText(state.country.focusText,371.5,200.5,238);
  ctx.shadowColor='transparent';
}
async function renderEvent(seq){
  const bodyFont=textFont(17,false); ctx.font=bodyFont; const bodyLines=wrapLines(state.event.body,520,bodyFont,18); const bodyH=bodyLines.length*21;
  const tileCount=Math.max(2,Math.min(5,Math.ceil(Math.max(120,bodyH-30)/80)));
  const h=123+tileCount*80+450; setCanvas(605,h,'Major Event');ctx.clearRect(0,0,605,h);
  const [top,mid,bottom,picOverlay,buttonBg,pic]=await Promise.all([loadImage(template('news/event_report_top_win.png')),loadImage(template('news/event_report_tileable_midsection.png')),loadImage(template('news/event_report_bottom_win.png')),loadImage(template('news/event_pic_overlay.png')),loadImage(template('news/event_option_entry.png')),loadAssetImage('event',assetUrls.event)]); if(seq!==renderSeq)return;
  if(top)ctx.drawImage(top,0,0); for(let i=0;i<tileCount;i++)if(mid)ctx.drawImage(mid,0,123+i*80); const bottomY=123+tileCount*80;if(bottom)ctx.drawImage(bottom,0,bottomY);
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';ctx.font=textFont(fitText(state.event.title,500,23,14),true);ctx.fillText(state.event.title,302,78,500);
  drawWrapped(state.event.body,43,120,520,21,bodyFont,'#000','left',18);
  const buttonY=190+tileCount*80;if(buttonBg)ctx.drawImage(buttonBg,130,buttonY);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=textFont(fitText(state.event.button,320,17,11),false);ctx.fillText(state.event.button,306,buttonY+13,320);
  const picY=bottomY+170;drawCoverTransform(pic,52,picY,500,250,state.event.transform);if(picOverlay)ctx.drawImage(picOverlay,52,picY,500,250);
}

async function renderNews(seq){
  setCanvas(713,935,'Local News');ctx.clearRect(0,0,713,935);
  const [bg,picOverlay,buttonBg,pic]=await Promise.all([loadImage(template('news/event_news_bg.png')),loadImage(template('news/event_news_pic_overlay.png')),loadImage(template('news/event_option_entry.png')),loadAssetImage('news',assetUrls.news)]); if(seq!==renderSeq)return;
  if(bg)ctx.drawImage(bg,0,0); drawCoverTransform(pic,150,164,400,150,state.news.transform); if(picOverlay)ctx.drawImage(picOverlay,142,157,415,155);
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';ctx.font=textFont(fitText(state.news.title,500,28,16),true);ctx.fillText(state.news.title,356,119,500);
  drawWrapped(state.news.body,75,330,560,22,textFont(17,false),'#000','left',16);
  if(buttonBg)ctx.drawImage(buttonBg,180,700);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=textFont(fitText(state.news.button,320,17,11),false);ctx.fillText(state.news.button,356,713,320);
}

async function renderSuper(seq){
  setCanvas(1001,639,'Super Event');ctx.clearRect(0,0,1001,639);
  const [frame,space,pic]=await Promise.all([loadImage(template('super_frame.png')),loadImage(template('spacebar.png')),loadAssetImage('super',assetUrls.super)]); if(seq!==renderSeq)return;
  drawCoverTransform(pic,5,30,982,594,state.super.transform);
  if(frame)ctx.drawImage(frame,0,0);

  ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;ctx.fillStyle='#fff';ctx.textAlign='center';
  ctx.textBaseline='middle';ctx.font=textFont(fitText(state.super.title,570,24,14),true);ctx.fillText(state.super.title,515,36,570);

  ctx.textBaseline='top';
  const mottoFont=textFont(18,true);
  const lines=wrapLines(state.super.motto,580,mottoFont,5);
  const lineHeight=22;
  const mottoTop=490-(Math.min(lines.length,5)*lineHeight)/2;
  ctx.font=mottoFont;ctx.fillStyle='#ddd';ctx.textAlign='center';
  lines.forEach((line,i)=>ctx.fillText(line,500,mottoTop+i*lineHeight,580));

  if(space)ctx.drawImage(space,350,585);
  ctx.fillStyle='#ddd';ctx.textBaseline='middle';ctx.font=textFont(fitText(state.super.button,260,18,11),true);ctx.fillText(state.super.button,500,602.5,260);
  ctx.shadowColor='transparent';
}
function renderPieEditor(){
  const wrap=$('#pieEditorRows'); if(!wrap)return;
  const slices=state.country.ideologySlices||(state.country.ideologySlices=[]);
  wrap.innerHTML='';
  slices.forEach((slice,index)=>{
    const row=document.createElement('div');row.className='pie-slice-row';
    const validColor=/^#[0-9a-f]{6}$/i.test(slice.color||'')?slice.color:'#777777';
    row.innerHTML=`<input class="pie-label" type="text" value="${escapeHtml(slice.label||`Slice ${index+1}`)}" aria-label="Slice label"><input class="pie-value" type="number" min="0" max="1000" step="1" value="${Number(slice.value)||0}" aria-label="Slice share"><input class="pie-color" type="color" value="${validColor}" aria-label="Slice colour"><button class="mini-btn pie-remove" type="button" aria-label="Remove ideology slice">×</button>`;
    row.querySelector('.pie-label').oninput=e=>{slice.label=e.target.value;saveState();};
    row.querySelector('.pie-value').oninput=e=>{slice.value=Math.max(0,Number(e.target.value)||0);saveState();updatePieTotal();scheduleRender();};
    row.querySelector('.pie-color').oninput=e=>{slice.color=e.target.value;saveState();scheduleRender();};
    row.querySelector('.pie-remove').onclick=()=>{if(slices.length<=1)return;slices.splice(index,1);saveState();renderPieEditor();scheduleRender();};
    wrap.appendChild(row);
  });
  updatePieTotal();
}
function updatePieTotal(){
  const out=$('#pieTotal'); if(!out)return;
  const total=(state.country.ideologySlices||[]).reduce((n,s)=>n+(Number(s.value)||0),0);
  out.textContent=`Total weight: ${total}`;
}
function addPieSlice(){
  const slices=state.country.ideologySlices||(state.country.ideologySlices=[]);
  if(slices.length>=8)return;
  const colors=['#d94f91','#e3c94f','#58bfcf','#4f70d9','#7ccf67','#b978d6','#d77a4f','#8c8c8c'];
  slices.push({label:`Slice ${slices.length+1}`,value:10,color:colors[slices.length%colors.length]});
  saveState();renderPieEditor();scheduleRender();
}

function animatedKeysForTool(tool=activeTool){return({country:['flag','leader','focus','ideologyIcon','factionIcon'],event:['event'],news:['news'],super:['super']}[tool]||[])}
function activeToolHasAnimation(){return animatedKeysForTool().some(k=>animatedAssets.has(k))}
function activeAnimationDuration(){let duration=0;for(const key of animatedKeysForTool())if(animatedAssets.has(key))duration=Math.max(duration,animatedDurations.get(key)||1000);return Math.max(100,Math.min(15000,duration||1000))}
function ensureAnimationLoop(){if(animationLoopId||!activeToolHasAnimation()||exportInProgress)return;const tick=now=>{animationLoopId=0;if(!activeToolHasAnimation()||exportInProgress)return;if(!document.hidden&&now-animationLastPaint>=50&&!animationRenderBusy){animationLastPaint=now;animationRenderBusy=true;const seq=++renderSeq,fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];Promise.resolve(fn?.(seq)).catch(console.error).finally(()=>{animationRenderBusy=false})}animationLoopId=requestAnimationFrame(tick)};animationLoopId=requestAnimationFrame(tick)}
function scheduleRender(){
  const seq=++renderSeq;
  requestAnimationFrame(()=>{
    if(seq!==renderSeq)return;
    const fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];
    fn?.(seq).catch(console.error).finally(ensureAnimationLoop);
  });
  ensureAnimationLoop();
}

function switchTool(tool){
  activeTool=tool; state.activeTool=tool; saveState();
  $$('.tool-tab').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  $$('.tool-controls').forEach(p=>p.classList.toggle('active',p.dataset.controls===tool));
  $('#mobileToolSelect').value=tool; scheduleRender();
}

async function loadManifest(){
  if(manifest)return manifest;
  try{ const r=await fetch('../assets/icon-library/manifest.json'); manifest=await r.json(); }
  catch{ manifest=[]; }
  return manifest;
}
function normalizeIconSrc(src){ if(src.startsWith('./'))return '../'+src.slice(2); if(src.startsWith('/'))return '..'+src; return src; }
async function openIconPicker(mode){
  iconMode=mode; $('#iconDialogTitle').textContent=mode==='ideology'?'Choose ideology icon':'Choose alliance / faction icon'; $('#iconSearch').value=''; await renderIconGrid(''); $('#iconDialog').showModal(); setTimeout(()=>$('#iconSearch').focus(),50);
}
async function removeStoredCustomIcon(mode){
  await dbDelete(CUSTOM_ICON_DB_KEYS[mode]).catch(()=>{});
  if(customIconUrls.has(mode)){URL.revokeObjectURL(customIconUrls.get(mode));customIconUrls.delete(mode)}
  clearAssetAnimation(mode+'Icon');
}
async function chooseBuiltInIcon(mode,src,name){
  await removeStoredCustomIcon(mode);state.country[mode+'IconMode']='builtin';state.country[mode+'Icon']=src;state.country[mode+'IconName']=name;saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();
}
async function chooseNoIcon(mode){
  await removeStoredCustomIcon(mode);state.country[mode+'IconMode']='none';state.country[mode+'Icon']='';state.country[mode+'IconName']='No icon';saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();
}
async function handleCustomIconInput(input){
  const file=input.files?.[0],mode=iconMode;input.value='';if(!file)return;
  if(!looksLikeImageFile(file)){alert('Please choose an image file.');return}
  try{
    await dbSet(CUSTOM_ICON_DB_KEYS[mode],file);setCustomIconObjectUrl(mode,file);await noteAssetAnimation(mode+'Icon',file);state.country[mode+'IconMode']='custom';state.country[mode+'IconName']=file.name||'Custom icon';saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();
  }catch(e){alert('Could not store that image locally.');console.error(e)}
}
async function renderIconGrid(search){
  const list=await loadManifest(); const cat=iconMode==='ideology'?'ideology':'factions'; const q=search.trim().toLowerCase();
  const filtered=list.filter(x=>x.category===cat && (!q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q))).slice(0,500);
  const grid=$('#iconGrid'); grid.innerHTML=''; const frag=document.createDocumentFragment();
  for(const item of filtered){ const b=document.createElement('button'); b.type='button';b.className='icon-option'; const src=normalizeIconSrc(item.src); b.innerHTML=`<img loading="lazy" src="${src}" alt=""><span>${escapeHtml(item.name)}</span>`; b.onclick=()=>chooseBuiltInIcon(iconMode,src,item.name); frag.appendChild(b); }
  grid.appendChild(frag); if(!filtered.length)grid.innerHTML='<div class="empty">No matching icons.</div>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function exportModePopup(){return new Promise(resolve=>{const dlg=document.createElement('dialog');dlg.className='disclaimer-dialog';dlg.innerHTML='<div class="disclaimer-card"><h2>Export image</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="ui-btn" type="button" data-mode="static">Static image</button><button class="ui-btn primary" type="button" data-mode="animated">Animated image</button></div></div>';document.body.appendChild(dlg);const done=v=>{dlg.close();dlg.remove();resolve(v)};dlg.querySelector('[data-mode="static"]').onclick=()=>done('static');dlg.querySelector('[data-mode="animated"]').onclick=()=>done('animated');dlg.addEventListener('cancel',e=>{e.preventDefault();done(null)});dlg.addEventListener('click',e=>{if(e.target===dlg)done(null)});dlg.showModal()})}
function downloadImageBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=filename;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function renderActiveNow(time=null){forcedAnimationTime=time;try{const seq=++renderSeq,fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];if(fn)await fn(seq)}finally{forcedAnimationTime=null}}
function canvasRgba(){return ctx.getImageData(0,0,canvas.width,canvas.height).data}
function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>resolve()))}
function openExportProgress(){
  const layer=document.createElement('div');layer.className='export-progress-layer';layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');
  layer.innerHTML='<div class="export-progress-card"><strong>Exporting…</strong><span class="export-progress-text">Preparing animated image…</span><div class="export-progress-track"><i></i></div></div>';
  document.body.appendChild(layer);const text=layer.querySelector('.export-progress-text'),bar=layer.querySelector('.export-progress-track i');
  return{update(done,total,label){const pct=total?Math.round(done/total*100):0;text.textContent=label||`Rendering frames… ${pct}%`;bar.style.width=`${Math.max(0,Math.min(100,pct))}%`},close(){layer.remove()}};
}
let pngCrcTable=null;
function pngCrc32(bytes){
  if(!pngCrcTable){pngCrcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;pngCrcTable[n]=c>>>0}}
  let c=0xFFFFFFFF;for(const byte of bytes)c=pngCrcTable[(c^byte)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;
}
function u32be(value){return Uint8Array.of((value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255)}
function pngChunk(type,data){
  const name=new TextEncoder().encode(type),length=u32be(data.length),crcInput=new Uint8Array(4+data.length);crcInput.set(name);crcInput.set(data,4);const crc=u32be(pngCrc32(crcInput)),out=new Uint8Array(12+data.length);out.set(length);out.set(name,4);out.set(data,8);out.set(crc,8+data.length);return out;
}
async function readPngParts(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer()),signature=bytes.subarray(0,8),chunks=[];let pos=8;
  while(pos+12<=bytes.length){const length=(bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3],type=String.fromCharCode(...bytes.subarray(pos+4,pos+8)),data=bytes.subarray(pos+8,pos+8+length);chunks.push({type,data:new Uint8Array(data)});pos+=12+length;if(type==='IEND')break}
  return{signature:new Uint8Array(signature),chunks};
}
function rgbaChangedRect(now,previous,width,height){
  if(!previous)return{x:0,y:0,w:width,h:height};let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0,p=0;y<height;y++)for(let x=0;x<width;x++,p+=4){if(now[p]===previous[p]&&now[p+1]===previous[p+1]&&now[p+2]===previous[p+2]&&now[p+3]===previous[p+3])continue;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  return maxX<0?null:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}
function cropRgba(rgba,rect,fullWidth){
  const out=new Uint8ClampedArray(rect.w*rect.h*4),rowBytes=rect.w*4;
  for(let y=0;y<rect.h;y++){const from=((rect.y+y)*fullWidth+rect.x)*4;out.set(rgba.subarray(from,from+rowBytes),y*rowBytes)}
  return out;
}
async function rgbaToPngBlob(rgba,rect,fullWidth){
  const c=document.createElement('canvas');c.width=rect.w;c.height=rect.h;const cctx=c.getContext('2d');cctx.putImageData(new ImageData(cropRgba(rgba,rect,fullWidth),rect.w,rect.h),0,0);return new Promise(resolve=>c.toBlob(resolve,'image/png'));
}
function apngFrameControl(sequence,rect,delayMs){
  const data=new Uint8Array(26),view=new DataView(data.buffer);view.setUint32(0,sequence);view.setUint32(4,rect.w);view.setUint32(8,rect.h);view.setUint32(12,rect.x);view.setUint32(16,rect.y);view.setUint16(20,Math.max(1,Math.min(65535,Math.round(delayMs))));view.setUint16(22,1000);data[24]=0;data[25]=0;return data;
}
async function createAnimatedPng(frames,width,height){
  if(!frames.length)throw new Error('No animation frames were rendered.');
  const parsed=[];for(const frame of frames){const blob=await rgbaToPngBlob(frame.rgba,frame.rect,width);if(!blob)throw new Error('Could not prepare an animation frame.');parsed.push(await readPngParts(blob))}
  const first=parsed[0],ihdr=first.chunks.find(c=>c.type==='IHDR');if(!ihdr)throw new Error('Could not read the PNG frame.');
  const out=[first.signature,pngChunk('IHDR',ihdr.data)],actl=new Uint8Array(8),actlView=new DataView(actl.buffer);actlView.setUint32(0,frames.length);actlView.setUint32(4,0);out.push(pngChunk('acTL',actl));
  let sequence=0;
  for(let i=0;i<frames.length;i++){
    const frame=frames[i],parts=parsed[i],idats=parts.chunks.filter(c=>c.type==='IDAT');out.push(pngChunk('fcTL',apngFrameControl(sequence++,frame.rect,frame.delay)));
    if(i===0){for(const chunk of idats)out.push(pngChunk('IDAT',chunk.data))}
    else for(const chunk of idats){const data=new Uint8Array(4+chunk.data.length);data.set(u32be(sequence++));data.set(chunk.data,4);out.push(pngChunk('fdAT',data))}
  }
  out.push(pngChunk('IEND',new Uint8Array(0)));return new Blob(out,{type:'image/png'});
}
function exportFrameTimes(){
  const duration=activeAnimationDuration();let step=110;
  for(const key of animatedKeysForTool()){const animation=decodedAnimations.get(key);if(!animation)continue;for(const frame of animation.frames)step=Math.min(step,Math.max(80,frame.delay))}
  step=Math.max(100,Math.min(160,step));let count=Math.max(2,Math.ceil(duration/step));if(count>30){count=30;step=duration/count}return{duration,step,count};
}
async function exportPNG(){
  const mode=activeToolHasAnimation()?await exportModePopup():'static';if(!mode)return;const safe=activeTool.replace(/[^a-z0-9_-]+/gi,'-');
  if(mode==='static'){await renderActiveNow();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)downloadImageBlob(blob,`tfr-${safe}-gfx.png`);return}
  const progress=openExportProgress();exportInProgress=true;if(animationLoopId){cancelAnimationFrame(animationLoopId);animationLoopId=0}
  try{
    await nextPaint();const timing=exportFrameTimes(),frames=[];let previous=null;
    for(let i=0;i<timing.count;i++){
      await renderActiveNow(i*timing.step);const rgba=new Uint8ClampedArray(canvasRgba()),rect=rgbaChangedRect(rgba,previous,canvas.width,canvas.height);
      if(!rect&&frames.length){frames[frames.length-1].delay+=timing.step}else{frames.push({rgba,rect:rect||{x:0,y:0,w:1,h:1},delay:timing.step});previous=rgba}
      progress.update(i+1,timing.count);if(i%3===2)await nextPaint();
    }
    progress.update(timing.count,timing.count,'Compressing animation…');await nextPaint();const blob=await createAnimatedPng(frames,canvas.width,canvas.height);downloadImageBlob(blob,`tfr-${safe}-gfx-animated.png`);
  }catch(error){console.error(error);alert('Could not export the animated image.')}finally{progress.close();exportInProgress=false;animationStartedAt=performance.now();scheduleRender()}
}
async function resetTool(){
  const fresh=cloneDefaults(); state[activeTool]=fresh[activeTool];
  const keys={country:['flag','leader','focus'],event:['event'],news:['news'],super:['super']}[activeTool]||[];
  for(const k of keys) await clearAsset(k);
  if(activeTool==='country')for(const mode of ['ideology','faction'])await removeStoredCustomIcon(mode);
  saveState(); bindValuesOnly(); updateThumbs(); updateOutputs(); renderPieEditor(); scheduleRender();
}
function bindValuesOnly(){ $$('[data-bind]').forEach(el=>{const val=getPath(state,el.dataset.bind);el.value=val??'';}); }

function setupDisclaimer(){
  const dlg=$('#disclaimerDialog'); const open=()=>{ if(!dlg.open)dlg.showModal(); };
  $('#disclaimerBtn').onclick=open; $('#acceptDisclaimer').onclick=()=>{localStorage.setItem(DISCLAIMER_KEY,'accepted');dlg.close();};
  if(localStorage.getItem(DISCLAIMER_KEY)!=='accepted') setTimeout(open,120);
}

function init(){
  bindInputs(); updateOutputs(); updateThumbs(); renderPieEditor(); setupDisclaimer();
  $$('.tool-tab').forEach(b=>b.onclick=()=>switchTool(b.dataset.tool)); $('#mobileToolSelect').onchange=e=>switchTool(e.target.value);
  $('#flagFile').onchange=e=>handleAssetInput('flag',e.target); $('#leaderFile').onchange=e=>handleAssetInput('leader',e.target); $('#focusFile').onchange=e=>handleAssetInput('focus',e.target); $('#eventFile').onchange=e=>handleAssetInput('event',e.target); $('#newsFile').onchange=e=>handleAssetInput('news',e.target); $('#superFile').onchange=e=>handleAssetInput('super',e.target);
  $$('[data-clear-asset]').forEach(b=>b.onclick=()=>clearAsset(b.dataset.clearAsset));
  $('#chooseIdeology').onclick=()=>openIconPicker('ideology'); $('#chooseFaction').onclick=()=>openIconPicker('faction'); $('#iconSearch').oninput=e=>renderIconGrid(e.target.value); $('#iconUploadInput').onchange=e=>handleCustomIconInput(e.target); $('#iconNoIconBtn').onclick=()=>chooseNoIcon(iconMode); $('#addPieSlice').onclick=addPieSlice;
  $('#exportBtn').onclick=exportPNG; $('#resetToolBtn').onclick=()=>{if(confirm('Reset this GFX to its defaults?')) resetTool();};
  switchTool(activeTool); restoreAssets();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>scheduleRender()).catch(()=>{});
}

init();
})();
