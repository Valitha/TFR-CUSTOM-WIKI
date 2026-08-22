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
    powerBalancePercent: '100.0%',
    powerBalanceLevels: '1/1',
    powerBalanceEnabled: true,
    focusPreset: '',
    spiritPresets: { spirit1: '', spirit2: '', spirit3: '', spirit4: '' },
    economyText: 'Capitalist Economy',
    governmentText: 'Semi Presidential System',
    textSizes: {
      country: 16,
      faction: 14,
      leader: 15,
      party: 15,
      ideology: 15,
      election: 14,
      economy: 12,
      government: 12,
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
    factionIconMode: 'builtin',
    economyIcon: './assets/icon-library/economy/ZZZ_capitalist_economy.png',
    economyIconName: 'Capitalist Economy',
    economyIconMode: 'builtin',
    governmentIcon: './assets/icon-library/government/ZZZ_semi_presidential_system.png',
    governmentIconName: 'Semi Presidential System',
    governmentIconMode: 'builtin',
    bopIcon: '../assets/icon-library/ideology/right_populism_USA.webp',
    bopIconName: 'Same as ideology',
    bopIconMode: 'builtin'
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
  super: placeholder('super_event.png'),
  spirit1: placeholder('focus_unknown.png'),
  spirit2: placeholder('focus_unknown.png'),
  spirit3: placeholder('focus_unknown.png'),
  spirit4: placeholder('focus_unknown.png')
};
const objectUrls = new Map();
const customIconUrls = new Map();
const COUNTRY_ICON_MODES = ['ideology','faction','economy','government','bop'];
const CUSTOM_ICON_DB_KEYS = {ideology:'custom-ideology-icon', faction:'custom-faction-icon', economy:'custom-economy-icon', government:'custom-government-icon', bop:'custom-bop-icon'};
const PRESET_ASSET_KEYS = new Set(['focus','spirit1','spirit2','spirit3','spirit4']);

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
function animatedSourceForKey(key){
  if(Object.prototype.hasOwnProperty.call(assetUrls,key))return assetUrls[key]||'';
  if(key.endsWith('Icon'))return customIconUrls.get(key.slice(0,-4))||'';
  return '';
}

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
function savedPresetForAsset(key){
  if(key==='focus')return state.country?.focusPreset||'';
  return state.country?.spiritPresets?.[key]||'';
}
function setSavedPresetForAsset(key,value){
  if(key==='focus')state.country.focusPreset=value;
  else{
    if(!state.country.spiritPresets||typeof state.country.spiritPresets!=='object')state.country.spiritPresets={spirit1:'',spirit2:'',spirit3:'',spirit4:''};
    state.country.spiritPresets[key]=value;
  }
}
function applySavedPresetAssets(){
  for(const key of PRESET_ASSET_KEYS){
    const saved=savedPresetForAsset(key);
    if(saved==='__none__')assetUrls[key]='';
    else if(saved)assetUrls[key]=saved;
  }
}
async function restoreAssets(){
  applySavedPresetAssets();
  for(const key of Object.keys(assetUrls)){
    try{ const blob=await dbGet(key); if(blob){setObjectUrl(key,blob);await noteAssetAnimation(key,blob)} }catch(e){ console.warn('asset restore failed',key,e); }
  }
  for(const mode of COUNTRY_ICON_MODES){
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
  try{
    if(PRESET_ASSET_KEYS.has(key))setSavedPresetForAsset(key,'');
    await dbSet(key,file); setObjectUrl(key,file); await noteAssetAnimation(key,file); saveState(); imageCache.clear(); updateThumbs(); scheduleRender();
  }
  catch(e){ alert('Could not store that image locally.'); console.error(e); }
  input.value='';
}

const assetDefaults={
  flag:placeholder('flag_eu.png'), leader:placeholder('leader_unknown.png'), focus:placeholder('focus_unknown.png'),
  event:placeholder('major_news.png'), news:placeholder('local_news.png'), super:placeholder('super_event.png'),
  spirit1:placeholder('focus_unknown.png'), spirit2:placeholder('focus_unknown.png'), spirit3:placeholder('focus_unknown.png'), spirit4:placeholder('focus_unknown.png')
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
async function emptySpirit(key){
  if(!/^spirit[1-4]$/.test(key))return;
  await removeStoredAsset(key);
  setSavedPresetForAsset(key,'__none__');
  assetUrls[key]='';
  saveState();imageCache.clear();updateThumbs();scheduleRender();
}

function updateThumbs(){
  const map={leader:'leaderThumb',focus:'focusThumb',event:'eventThumb',news:'newsThumb',super:'superThumb',spirit1:'spirit1Thumb',spirit2:'spirit2Thumb',spirit3:'spirit3Thumb',spirit4:'spirit4Thumb'};
  for(const [key,id] of Object.entries(map)){
    const img=$('#'+id),src=assetUrls[key]||'';
    if(img){
      if(src){img.src=src;img.hidden=false}
      else{img.removeAttribute('src');img.hidden=true}
    }
    const clear=$(`[data-clear-asset="${key}"]`); if(clear)clear.hidden=!objectUrls.has(key);
  }
  const labels={ideology:'Ideology',faction:'Faction',economy:'Economy',government:'Government',bop:'Bop'};
  for(const mode of COUNTRY_ICON_MODES){
    const img=$('#'+mode+'Thumb'),name=$('#'+mode+'Name'),button=$('#choose'+labels[mode]),src=countryIconSrc(mode);
    if(img){if(src){img.src=src;img.hidden=false}else{img.removeAttribute('src');img.hidden=true}}
    button?.classList.toggle('no-icon',!src);
    if(name)name.textContent=countryIconMode(mode)==='none'?'No icon':(state.country[mode+'IconName']||`Selected ${mode}`);
  }
  const bopToggle=$('#powerBalanceEnabled');
  if(bopToggle)bopToggle.checked=state.country.powerBalanceEnabled!==false;
  $$('.bop-field').forEach(label=>label.classList.toggle('disabled-field',state.country.powerBalanceEnabled===false));
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

function setCanvas(w,h,title,scale=1){
  const pixelWidth=Math.round(w*scale),pixelHeight=Math.round(h*scale);
  if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  $('#previewTitle').textContent=title; $('#previewSize').textContent=`${pixelWidth} × ${pixelHeight}`;
}

async function renderCountry(seq){
  setCanvas(719,394,'Country',2);
  ctx.clearRect(0,0,719,394);
  ctx.fillStyle='#000';ctx.fillRect(0,0,719,394);
  const imgs=await Promise.all([
    loadImage('./assets/country/pol_view_bg_new.png'),
    loadImage('./assets/country/pol_leader_frame.png'),
    loadImage('./assets/country/pol_goal_bg.png'),
    loadImage('./assets/country/pol_goal_progress_bg.png'),
    loadImage('./assets/country/pol_goal_progress_frame.png'),
    loadImage('./assets/country/pol_goal_progress.png'),
    loadImage('./assets/country/pol_piechart_overlay_63x63.png'),
    loadImage('./assets/country/leading_pol_party_bg.png'),
    loadImage('./assets/country/pol_party_colour_bg.png'),
    loadImage('./assets/country/icon_occupied_territories.png'),
    loadImage('./assets/country/icon_exiled_governments.png'),
    loadImage('./assets/country/icon_manage_subjects.png'),
    loadImage(template('closebutton_small.png')),
    loadAssetImage('leader',assetUrls.leader),
    loadAssetImage('focus',assetUrls.focus),
    loadAssetImage('ideologyIcon',countryIconSrc('ideology')),
    loadAssetImage('factionIcon',countryIconSrc('faction')),
    loadAssetImage('economyIcon',countryIconSrc('economy')),
    loadAssetImage('governmentIcon',countryIconSrc('government')),
    loadAssetImage('bopIcon',countryIconSrc('bop')),
    loadAssetImage('spirit1',assetUrls.spirit1),
    loadAssetImage('spirit2',assetUrls.spirit2),
    loadAssetImage('spirit3',assetUrls.spirit3),
    loadAssetImage('spirit4',assetUrls.spirit4)
  ]); if(seq!==renderSeq)return;
  const [panel,leaderFrame,goalBg,progressBg,progressFrame,progress,pieOverlay,partyRow,partyColour,occupiedBtn,exileBtn,subjectsBtn,closeBtn,leader,focus,ideology,faction,economy,government,bop,...spirits]=imgs;

  if(panel)ctx.drawImage(panel,0,0,719,394);

  drawCoverTransform(leader,9,12,160,213,state.country.transforms?.leader);
  if(leaderFrame)ctx.drawImage(leaderFrame,4,9,172,258);

  if(goalBg)ctx.drawImage(goalBg,185,12,359,107);
  if(closeBtn)ctx.drawImage(closeBtn,519,14,26,26);
  if(progressBg)ctx.drawImage(progressBg,292,92,237,6);
  if(progress){
    const amount=Math.max(0,Math.min(100,Number(state.country.focusProgress)||0))/100;
    const width=Math.round(237*amount);
    if(width>0)ctx.drawImage(progress,0,0,width,Math.min(6,progress.height||6),292,92,width,6);
  }
  if(progressFrame)ctx.drawImage(progressFrame,291,91,239,8);
  drawCenteredTransform(focus,236,65,1,76,76,state.country.transforms?.focus);

  drawCentered(faction,632,62,1,86,86);
  drawCentered(ideology,224,166,1,76,76);
  const spiritX=[312,380,448,516];
  spirits.forEach((spirit,index)=>drawCentered(spirit,spiritX[index],166,1,62,62));

  drawCentered(economy,47,319,1,68,68);
  drawCentered(faction,137,322,1,68,68);
  drawCentered(government,212,334,1,68,68);

  const slices=(state.country.ideologySlices||[]).filter(x=>Number(x.value)>0);
  const total=slices.reduce((sum,x)=>sum+Math.max(0,Number(x.value)||0),0)||1;
  const pieCx=441,pieCy=335,pieR=31.5;
  let angle=-Math.PI/2;
  for(const slice of slices){
    const amount=Math.max(0,Number(slice.value)||0)/total;
    ctx.beginPath();ctx.moveTo(pieCx,pieCy);ctx.arc(pieCx,pieCy,pieR,angle,angle+Math.PI*2*amount);ctx.closePath();ctx.fillStyle=slice.color||'#777';ctx.fill();angle+=Math.PI*2*amount;
  }
  if(pieOverlay)ctx.drawImage(pieOverlay,396,292,90,87);

  const ts=state.country.textSizes||DEFAULTS.country.textSizes;
  ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
  ctx.fillStyle='#e7e7e7';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=textFont(fitText(state.country.leader,148,Number(ts.leader)||15,8,true),true);
  ctx.fillText(state.country.leader,90,245,148);

  ctx.font=textFont(fitText(state.country.focusText,230,Number(ts.focus)||14,8,true),true);
  ctx.fillText(state.country.focusText,407,58,230);

  ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#e7e7e7';
  ctx.font=textFont(fitText(state.country.ideologyText,174,Number(ts.ideology)||15,8,true),true);
  ctx.fillText(state.country.ideologyText,188,230,174);
  const election=String(state.country.election||'');
  const split=election.match(/^([^:]+:)(.*)$/);
  ctx.font=textFont(Number(ts.election)||12,true);
  if(split){ctx.fillStyle='#d8d8d8';ctx.fillText(split[1],188,265,175);const labelW=ctx.measureText(split[1]+' ').width;ctx.fillStyle='#e5b025';ctx.fillText(split[2].trim(),188+labelW,265,175-labelW)}
  else{ctx.fillStyle='#e5b025';ctx.fillText(election,188,265,175)}

  if(state.country.powerBalanceEnabled!==false){
    ctx.fillStyle='#f0f0f0';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=textFont(13,true);ctx.fillText(String(state.country.powerBalancePercent||''),458,238,72);ctx.fillText(String(state.country.powerBalanceLevels||''),458,260,72);
    drawCentered(bop,405,248,1,48,48);
  }

  ctx.font=textFont(fitText(state.country.economyText,154,Number(ts.economy)||12,8,true),true);
  ctx.fillStyle='#e5b025';ctx.fillText(state.country.economyText,90,372,154);
  ctx.font=textFont(fitText(state.country.governmentText,118,Number(ts.government)||12,8,true),true);
  ctx.fillStyle='#e7e7e7';
  const governmentLines=wrapLines(state.country.governmentText,118,ctx.font,3);
  governmentLines.forEach((line,index)=>ctx.fillText(line,314,326+index*15,118));

  ctx.textAlign='left';ctx.textBaseline='middle';
  const rowHeight=17,partyX=508,partyY=222,partyW=196;
  const shown=slices.slice(0,10);
  shown.forEach((slice,index)=>{
    const y=partyY+index*rowHeight;
    if(index===0&&partyRow)ctx.drawImage(partyRow,partyX,y-7,partyW,15);
    if(partyColour)ctx.drawImage(partyColour,partyX,y-7,14,14);
    ctx.fillStyle=slice.color||'#777';ctx.fillRect(partyX+3,y-4,8,8);
    ctx.fillStyle='#e8e8e8';ctx.font=textFont(Number(ts.party)||11,true);
    const amount=Math.max(0,Number(slice.value)||0);
    ctx.fillText(`${slice.label||`Party ${index+1}`} (${amount})`,partyX+18,y,178);
  });

  if(occupiedBtn)ctx.drawImage(occupiedBtn,258,358,34,33);
  if(exileBtn)ctx.drawImage(exileBtn,294,358,34,33);
  if(subjectsBtn)ctx.drawImage(subjectsBtn,330,358,34,33);
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
  if(slices.length>=10)return;
  const colors=['#d94f91','#e3c94f','#58bfcf','#4f70d9','#7ccf67','#b978d6','#d77a4f','#8c8c8c'];
  slices.push({label:`Slice ${slices.length+1}`,value:10,color:colors[slices.length%colors.length]});
  saveState();renderPieEditor();scheduleRender();
}

function animatedKeysForTool(tool=activeTool){return({country:['leader','focus','spirit1','spirit2','spirit3','spirit4','ideologyIcon','factionIcon','economyIcon','governmentIcon','bopIcon'],event:['event'],news:['news'],super:['super']}[tool]||[])}
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
  try{
    const [shared,extra]=await Promise.all([
      fetch('../assets/icon-library/manifest.json').then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch('./assets/icon-library/catalog.json').then(r=>r.ok?r.json():[]).catch(()=>[])
    ]);
    manifest=[...shared,...extra];
  }catch{manifest=[]}
  return manifest;
}
function normalizeIconSrc(src){ if(src.startsWith('./'))return '../'+src.slice(2); if(src.startsWith('/'))return '..'+src; return src; }
const ICON_PICKER_INFO={
  ideology:{title:'Choose ideology icon',category:'ideology',kind:'icon',emptyLabel:'No icon'},
  faction:{title:'Choose alliance / faction icon',category:'factions',kind:'icon',emptyLabel:'No icon'},
  economy:{title:'Choose economy type',category:'economy',kind:'icon',emptyLabel:'No icon'},
  government:{title:'Choose government type',category:'government',kind:'icon',emptyLabel:'No icon'},
  bop:{title:'Choose balance of power icon',category:'bop',kind:'icon',emptyLabel:'No icon'},
  focus:{title:'Choose national focus image',category:'focus',kind:'asset',emptyLabel:'No image'},
  spirit1:{title:'Choose national spirit',category:'ideas',kind:'asset',emptyLabel:'Empty'},
  spirit2:{title:'Choose national spirit',category:'ideas',kind:'asset',emptyLabel:'Empty'},
  spirit3:{title:'Choose national spirit',category:'ideas',kind:'asset',emptyLabel:'Empty'},
  spirit4:{title:'Choose national spirit',category:'ideas',kind:'asset',emptyLabel:'Empty'}
};
async function openIconPicker(mode){
  iconMode=mode;
  const info=ICON_PICKER_INFO[mode]||ICON_PICKER_INFO.ideology;
  $('#iconDialogTitle').textContent=info.title;
  $('#iconNoIconBtn').textContent=info.emptyLabel||'No icon';
  $('#iconSearch').value='';
  await renderIconGrid('');
  $('#iconDialog').showModal();
  setTimeout(()=>$('#iconSearch').focus(),50);
}
async function removeStoredCustomIcon(mode){
  await dbDelete(CUSTOM_ICON_DB_KEYS[mode]).catch(()=>{});
  if(customIconUrls.has(mode)){URL.revokeObjectURL(customIconUrls.get(mode));customIconUrls.delete(mode)}
  clearAssetAnimation(mode+'Icon');
}
async function removeStoredAsset(key){
  await dbDelete(key).catch(()=>{});
  if(objectUrls.has(key)){URL.revokeObjectURL(objectUrls.get(key));objectUrls.delete(key)}
  clearAssetAnimation(key);
}
async function chooseBuiltInAsset(key,src){
  await removeStoredAsset(key);
  setSavedPresetForAsset(key,src||'__none__');
  assetUrls[key]=src||'';
  saveState();imageCache.clear();updateThumbs();$('#iconDialog').close();scheduleRender();
}
async function chooseBuiltInIcon(mode,src,name){
  const info=ICON_PICKER_INFO[mode];
  if(info?.kind==='asset'){await chooseBuiltInAsset(mode,src);return}
  await removeStoredCustomIcon(mode);
  state.country[mode+'IconMode']='builtin';
  state.country[mode+'Icon']=src;
  state.country[mode+'IconName']=name;
  if(mode==='economy')state.country.economyText=name;
  if(mode==='government')state.country.governmentText=name;
  saveState();updateThumbs();bindValuesOnly();imageCache.clear();$('#iconDialog').close();scheduleRender();
}
async function chooseNoIcon(mode){
  const info=ICON_PICKER_INFO[mode];
  if(info?.kind==='asset'){await chooseBuiltInAsset(mode,'');return}
  await removeStoredCustomIcon(mode);
  state.country[mode+'IconMode']='none';
  state.country[mode+'Icon']='';
  state.country[mode+'IconName']='No icon';
  saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();
}
function readableUploadName(file){
  return (file.name||'Custom icon').replace(/\.[^.]+$/,'').replace(/^(?:ZZZ_|USC_|GFX_|bop_|generic_)/i,'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
async function handlePickerUpload(input){
  const file=input.files?.[0],mode=iconMode;
  input.value='';
  if(!file)return;
  if(!looksLikeImageFile(file)){alert('Please choose an image file.');return}
  const info=ICON_PICKER_INFO[mode];
  if(info?.kind==='asset'){
    try{
      setSavedPresetForAsset(mode,'');
      await dbSet(mode,file);setObjectUrl(mode,file);await noteAssetAnimation(mode,file);
      saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();
    }catch(e){alert('Could not store that image locally.');console.error(e)}
    return;
  }
  try{
    await dbSet(CUSTOM_ICON_DB_KEYS[mode],file);
    setCustomIconObjectUrl(mode,file);
    await noteAssetAnimation(mode+'Icon',file);
    state.country[mode+'IconMode']='custom';
    state.country[mode+'IconName']=file.name||'Custom icon';
    const readable=readableUploadName(file);
    if(mode==='economy')state.country.economyText=readable;
    if(mode==='government')state.country.governmentText=readable;
    saveState();updateThumbs();bindValuesOnly();imageCache.clear();$('#iconDialog').close();scheduleRender();
  }catch(e){alert('Could not store that image locally.');console.error(e)}
}
async function renderIconGrid(search){
  const list=await loadManifest();
  const cat=ICON_PICKER_INFO[iconMode]?.category||'ideology';
  const q=search.trim().toLowerCase();
  const filtered=list.filter(x=>x.category===cat && (!q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q))).slice(0,500);
  const grid=$('#iconGrid');
  grid.innerHTML='';
  const frag=document.createDocumentFragment();
  for(const item of filtered){
    const b=document.createElement('button');
    b.type='button';b.className='icon-option';
    const src=normalizeIconSrc(item.src);
    b.innerHTML=`<img loading="lazy" src="${src}" alt=""><span>${escapeHtml(item.name)}</span>`;
    b.onclick=()=>chooseBuiltInIcon(iconMode,src,item.name);
    frag.appendChild(b);
  }
  grid.appendChild(frag);
  if(!filtered.length)grid.innerHTML='<div class="empty">No matching images.</div>';
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
function gifColorKey(r,g,b){return((r>>3)<<10)|((g>>3)<<5)|(b>>3)}
function gifPaletteItems(frames){
  const counts=new Uint32Array(32768),sumR=new Uint32Array(32768),sumG=new Uint32Array(32768),sumB=new Uint32Array(32768);
  let previous=null;
  for(let frameIndex=0;frameIndex<frames.length;frameIndex++){
    const rgba=frames[frameIndex],first=frameIndex===0,step=first?4:4;
    for(let p=0;p<rgba.length;p+=step){
      if(rgba[p+3]<128)continue;
      if(previous){
        const change=Math.abs(rgba[p]-previous[p])+Math.abs(rgba[p+1]-previous[p+1])+Math.abs(rgba[p+2]-previous[p+2])+Math.abs(rgba[p+3]-previous[p+3]);
        if(change<10)continue;
      }
      const key=gifColorKey(rgba[p],rgba[p+1],rgba[p+2]),weight=first?1:3;
      counts[key]+=weight;sumR[key]+=rgba[p]*weight;sumG[key]+=rgba[p+1]*weight;sumB[key]+=rgba[p+2]*weight;
    }
    previous=rgba;
  }
  const items=[];
  for(let key=0;key<counts.length;key++)if(counts[key])items.push({r:sumR[key]/counts[key],g:sumG[key]/counts[key],b:sumB[key]/counts[key],count:counts[key]});
  return items;
}
function gifColorBox(items){
  let r0=255,r1=0,g0=255,g1=0,b0=255,b1=0,weight=0;
  for(const item of items){if(item.r<r0)r0=item.r;if(item.r>r1)r1=item.r;if(item.g<g0)g0=item.g;if(item.g>g1)g1=item.g;if(item.b<b0)b0=item.b;if(item.b>b1)b1=item.b;weight+=item.count}
  return{items,r0,r1,g0,g1,b0,b1,weight,range:Math.max(r1-r0,g1-g0,b1-b0)};
}
function splitGifColorBox(box){
  if(box.items.length<2||box.range<1)return null;
  const rr=box.r1-box.r0,gr=box.g1-box.g0,br=box.b1-box.b0,channel=rr>=gr&&rr>=br?'r':gr>=br?'g':'b';
  const sorted=box.items.slice().sort((a,b)=>a[channel]-b[channel]);let running=0,split=1,half=box.weight/2;
  for(let i=0;i<sorted.length-1;i++){running+=sorted[i].count;if(running>=half){split=i+1;break}}
  return[gifColorBox(sorted.slice(0,split)),gifColorBox(sorted.slice(split))];
}
function buildGifPalette(frames){
  const items=gifPaletteItems(frames);if(!items.length)items.push({r:0,g:0,b:0,count:1});
  const boxes=[gifColorBox(items)];
  while(boxes.length<255){
    let best=-1,bestScore=-1;
    for(let i=0;i<boxes.length;i++){const box=boxes[i];if(box.items.length<2||box.range<1)continue;const score=box.range*Math.sqrt(box.weight);if(score>bestScore){best=i;bestScore=score}}
    if(best<0)break;const parts=splitGifColorBox(boxes[best]);if(!parts)break;boxes.splice(best,1,...parts);
  }
  const palette=new Uint8Array(768),colors=[];
  for(let i=0;i<boxes.length;i++){
    const box=boxes[i];let r=0,g=0,b=0,total=0;
    for(const item of box.items){r+=item.r*item.count;g+=item.g*item.count;b+=item.b*item.count;total+=item.count}
    const color=[Math.round(r/total),Math.round(g/total),Math.round(b/total)],index=i+1;colors.push(color);palette[index*3]=color[0];palette[index*3+1]=color[1];palette[index*3+2]=color[2];
  }
  const fill=colors[colors.length-1]||[0,0,0];for(let index=colors.length+1;index<256;index++){palette[index*3]=fill[0];palette[index*3+1]=fill[1];palette[index*3+2]=fill[2]}
  const lookup=new Uint16Array(32768);lookup.fill(65535);
  return{palette,colors,lookup};
}
function gifNearestIndex(r,g,b,paletteInfo){
  const key=gifColorKey(r,g,b),saved=paletteInfo.lookup[key];if(saved!==65535)return saved;
  let best=1,bestDistance=Infinity;
  for(let i=0;i<paletteInfo.colors.length;i++){
    const color=paletteInfo.colors[i],dr=r-color[0],dg=g-color[1],db=b-color[2],distance=dr*dr*2+dg*dg*3+db*db;
    if(distance<bestDistance){bestDistance=distance;best=i+1;if(!distance)break}
  }
  paletteInfo.lookup[key]=best;return best;
}
function gifIndexPixels(rgba,paletteInfo){
  const out=new Uint8Array(rgba.length/4);
  for(let p=0,o=0;p<rgba.length;p+=4,o++)out[o]=rgba[p+3]<128?0:gifNearestIndex(rgba[p],rgba[p+1],rgba[p+2],paletteInfo);
  return out;
}
function gifLzw(indexed,minCodeSize=8){
  const clear=1<<minCodeSize,end=clear+1,bytes=[],blocks=[];let current=0,bits=0,codeSize=minCodeSize+1,next=end+1,dict=new Map();
  const write=code=>{current|=code<<bits;bits+=codeSize;while(bits>=8){bytes.push(current&255);current>>>=8;bits-=8}};
  const reset=()=>{dict=new Map();codeSize=minCodeSize+1;next=end+1};
  write(clear);
  if(indexed.length){let prefix=indexed[0];for(let i=1;i<indexed.length;i++){const value=indexed[i],key=prefix*256+value,found=dict.get(key);if(found!==undefined){prefix=found;continue}write(prefix);if(next<4096){dict.set(key,next++);if(next>(1<<codeSize)&&codeSize<12)codeSize++}else{write(clear);reset()}prefix=value}write(prefix)}
  write(end);if(bits>0)bytes.push(current&255);
  for(let i=0;i<bytes.length;i+=255){const count=Math.min(255,bytes.length-i);blocks.push(count,...bytes.slice(i,i+count))}blocks.push(0);return new Uint8Array(blocks);
}
function createGifEncoder(width,height,paletteInfo){
  const chunks=[],palette=paletteInfo.palette;let started=false,finished=false;const push=(...xs)=>chunks.push(Uint8Array.from(xs)),u16=n=>[n&255,(n>>8)&255],ascii=text=>Uint8Array.from([...text].map(c=>c.charCodeAt(0)));
  chunks.push(ascii('GIF89a'));push(...u16(width),...u16(height),0xF7,0,0);chunks.push(palette);push(0x21,0xFF,0x0B);chunks.push(ascii('NETSCAPE2.0'));push(3,1,0,0,0);
  return{addFrame(rgba,delayMs=100){if(finished)throw new Error('GIF is already finished.');const indexed=gifIndexPixels(rgba,paletteInfo),delay=Math.max(2,Math.min(65535,Math.round(delayMs/10)));push(0x21,0xF9,4,0x05,...u16(delay),0,0);push(0x2C,0,0,0,0,...u16(width),...u16(height),0);push(8);chunks.push(gifLzw(indexed,8));started=true},finish(){if(!started)throw new Error('No GIF frames were added.');if(!finished){push(0x3B);finished=true}return new Blob(chunks,{type:'image/gif'})}};
}
function exportFrameTimes(){
  const duration=activeAnimationDuration();let step=125;
  for(const key of animatedKeysForTool()){const animation=decodedAnimations.get(key);if(!animation)continue;for(const frame of animation.frames)step=Math.min(step,Math.max(80,frame.delay))}
  step=Math.max(100,Math.min(140,step));let count=Math.max(2,Math.ceil(duration/step));const maxFrames=activeTool==='country'?24:32;if(count>maxFrames){count=maxFrames;step=duration/count}return{duration,step,count};
}
async function exportPNG(){
  const mode=activeToolHasAnimation()?await exportModePopup():'static';if(!mode)return;const safe=activeTool.replace(/[^a-z0-9_-]+/gi,'-');
  if(mode==='static'){await renderActiveNow();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)downloadImageBlob(blob,`tfr-${safe}-gfx.png`);return}
  const progress=openExportProgress();exportInProgress=true;if(animationLoopId){cancelAnimationFrame(animationLoopId);animationLoopId=0}
  try{
    await nextPaint();const timing=exportFrameTimes(),frames=[];
    for(let i=0;i<timing.count;i++){
      await renderActiveNow(i*timing.step);frames.push(new Uint8ClampedArray(canvasRgba()));progress.update(i+1,timing.count,'Rendering animation…');if(i%4===3)await nextPaint();
    }
    progress.update(0,1,'Choosing GIF colours…');await nextPaint();const palette=buildGifPalette(frames),gif=createGifEncoder(canvas.width,canvas.height,palette);
    for(let i=0;i<frames.length;i++){gif.addFrame(frames[i],timing.step);progress.update(i+1,frames.length,'Building GIF…');if(i%4===3)await nextPaint()}
    progress.update(1,1,'Finishing GIF…');await nextPaint();downloadImageBlob(gif.finish(),`tfr-${safe}-gfx-animated.gif`);
  }catch(error){console.error(error);alert('Could not export the animated image.')}finally{progress.close();exportInProgress=false;animationStartedAt=performance.now();scheduleRender()}
}
async function resetTool(){
  const fresh=cloneDefaults(); state[activeTool]=fresh[activeTool];
  const keys={country:['flag','leader','focus','spirit1','spirit2','spirit3','spirit4'],event:['event'],news:['news'],super:['super']}[activeTool]||[];
  for(const k of keys) await clearAsset(k);
  if(activeTool==='country')for(const mode of COUNTRY_ICON_MODES)await removeStoredCustomIcon(mode);
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
  $('#leaderFile').onchange=e=>handleAssetInput('leader',e.target); $('#focusFile').onchange=e=>handleAssetInput('focus',e.target); $('#eventFile').onchange=e=>handleAssetInput('event',e.target); $('#newsFile').onchange=e=>handleAssetInput('news',e.target); $('#superFile').onchange=e=>handleAssetInput('super',e.target);
  for(const key of ['spirit1','spirit2','spirit3','spirit4'])$('#'+key+'File').onchange=e=>handleAssetInput(key,e.target);
  $$('[data-clear-asset]').forEach(b=>b.onclick=()=>clearAsset(b.dataset.clearAsset));
  $$('[data-spirit-preset]').forEach(b=>b.onclick=()=>openIconPicker(b.dataset.spiritPreset));
  $$('[data-empty-spirit]').forEach(b=>b.onclick=()=>emptySpirit(b.dataset.emptySpirit));
  $('#chooseIdeology').onclick=()=>openIconPicker('ideology'); $('#chooseFaction').onclick=()=>openIconPicker('faction'); $('#chooseEconomy').onclick=()=>openIconPicker('economy'); $('#chooseGovernment').onclick=()=>openIconPicker('government'); $('#chooseBop').onclick=()=>openIconPicker('bop'); $('#chooseFocus').onclick=()=>openIconPicker('focus');
  $('#iconSearch').oninput=e=>renderIconGrid(e.target.value); $('#iconUploadInput').onchange=e=>handlePickerUpload(e.target); $('#iconNoIconBtn').onclick=()=>chooseNoIcon(iconMode); $('#addPieSlice').onclick=addPieSlice;
  $('#powerBalanceEnabled').onchange=e=>{state.country.powerBalanceEnabled=!!e.target.checked;saveState();updateThumbs();scheduleRender();};
  $('#exportBtn').onclick=exportPNG; $('#resetToolBtn').onclick=()=>{if(confirm('Reset this GFX to its defaults?')) resetTool();};
  switchTool(activeTool); restoreAssets();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>scheduleRender()).catch(()=>{});
}

init();
})();
