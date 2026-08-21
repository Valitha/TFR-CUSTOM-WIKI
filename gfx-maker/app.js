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
let animationLoopId=0,animationRenderBusy=false,animationLastPaint=0;
const animatedImageElements=new Map();
const animatedImagesBySrc=new Map();
let animationImageHost=null;
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

function gifDurationMsFromBytes(bytes){let total=0,frames=0;if(bytes)for(let i=0;i+7<bytes.length;i++)if(bytes[i]===0x21&&bytes[i+1]===0xF9&&bytes[i+2]===0x04){let delay=(bytes[i+4]|(bytes[i+5]<<8))*10;if(delay<20)delay=100;total+=delay;frames++}return Math.max(1200,Math.min(6000,frames&&total?total:3000))}
function hasGifHeader(bytes){return bytes?.length>=6&&bytes[0]===71&&bytes[1]===73&&bytes[2]===70&&bytes[3]===56&&(bytes[4]===55||bytes[4]===57)&&bytes[5]===97}
async function gifBytesFromBlob(blob){try{const head=new Uint8Array(await blob.slice(0,6).arrayBuffer());if(!hasGifHeader(head))return null;return new Uint8Array(await blob.arrayBuffer())}catch{return null}}
function looksLikeImageFile(file){return !!file&&(file.type?.startsWith('image/')||/\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name||''))}
function animatedSourceForKey(key){if(Object.prototype.hasOwnProperty.call(assetUrls,key))return assetUrls[key]||'';if(key==='ideologyIcon')return customIconUrls.get('ideology')||'';if(key==='factionIcon')return customIconUrls.get('faction')||'';return ''}
function ensureAnimationImageHost(){if(animationImageHost?.isConnected)return animationImageHost;const host=document.createElement('div');host.setAttribute('aria-hidden','true');Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',overflow:'hidden',opacity:'.01',pointerEvents:'none',zIndex:'2147483646'});document.body.appendChild(host);animationImageHost=host;return host}
function removeAnimatedImage(key){const old=animatedImageElements.get(key);if(!old)return;old.img.remove();if(animatedImagesBySrc.get(old.src)===old.img)animatedImagesBySrc.delete(old.src);animatedImageElements.delete(key);imageCache.delete(old.src)}
function keepAnimatedImagePlaying(key){const src=animatedSourceForKey(key);if(!src)return;const old=animatedImageElements.get(key);if(old?.src===src)return;removeAnimatedImage(key);const img=new Image();img.alt='';img.loading='eager';img.decoding='auto';Object.assign(img.style,{position:'absolute',left:'0',top:'0',maxWidth:'none',maxHeight:'none'});ensureAnimationImageHost().appendChild(img);img.src=src;animatedImageElements.set(key,{src,img});animatedImagesBySrc.set(src,img);imageCache.delete(src)}
function clearAssetAnimation(key){animatedAssets.delete(key);animatedDurations.delete(key);removeAnimatedImage(key)}
async function noteAssetAnimation(key,blob){const bytes=blob?await gifBytesFromBlob(blob):null;if(bytes){animatedAssets.add(key);animatedDurations.set(key,gifDurationMsFromBytes(bytes));keepAnimatedImagePlaying(key)}else clearAssetAnimation(key);ensureAnimationLoop()}
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
  if(!src) return Promise.resolve(null);
  const live=animatedImagesBySrc.get(src);
  if(live){if(live.complete&&live.naturalWidth)return Promise.resolve(live);return new Promise(resolve=>{const done=()=>resolve(live.naturalWidth?live:null);live.addEventListener('load',done,{once:true});live.addEventListener('error',done,{once:true});setTimeout(done,3000)})}
  if(imageCache.has(src)) return imageCache.get(src);
  const p=new Promise(resolve=>{ const im=new Image(); im.decoding='async'; im.onload=()=>resolve(im); im.onerror=()=>resolve(null); im.src=src; });
  imageCache.set(src,p); return p;
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
    loadImage(assetUrls.flag),loadImage(assetUrls.leader),loadImage(assetUrls.focus),loadImage(countryIconSrc('ideology')),loadImage(countryIconSrc('faction'))
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
  const [top,mid,bottom,picOverlay,buttonBg,pic]=await Promise.all([loadImage(template('news/event_report_top_win.png')),loadImage(template('news/event_report_tileable_midsection.png')),loadImage(template('news/event_report_bottom_win.png')),loadImage(template('news/event_pic_overlay.png')),loadImage(template('news/event_option_entry.png')),loadImage(assetUrls.event)]); if(seq!==renderSeq)return;
  if(top)ctx.drawImage(top,0,0); for(let i=0;i<tileCount;i++)if(mid)ctx.drawImage(mid,0,123+i*80); const bottomY=123+tileCount*80;if(bottom)ctx.drawImage(bottom,0,bottomY);
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';ctx.font=textFont(fitText(state.event.title,500,23,14),true);ctx.fillText(state.event.title,302,78,500);
  drawWrapped(state.event.body,43,120,520,21,bodyFont,'#000','left',18);
  const buttonY=190+tileCount*80;if(buttonBg)ctx.drawImage(buttonBg,130,buttonY);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=textFont(fitText(state.event.button,320,17,11),false);ctx.fillText(state.event.button,306,buttonY+13,320);
  const picY=bottomY+170;drawCoverTransform(pic,52,picY,500,250,state.event.transform);if(picOverlay)ctx.drawImage(picOverlay,52,picY,500,250);
}

async function renderNews(seq){
  setCanvas(713,935,'Local News');ctx.clearRect(0,0,713,935);
  const [bg,picOverlay,buttonBg,pic]=await Promise.all([loadImage(template('news/event_news_bg.png')),loadImage(template('news/event_news_pic_overlay.png')),loadImage(template('news/event_option_entry.png')),loadImage(assetUrls.news)]); if(seq!==renderSeq)return;
  if(bg)ctx.drawImage(bg,0,0); drawCoverTransform(pic,150,164,400,150,state.news.transform); if(picOverlay)ctx.drawImage(picOverlay,142,157,415,155);
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='top';ctx.font=textFont(fitText(state.news.title,500,28,16),true);ctx.fillText(state.news.title,356,119,500);
  drawWrapped(state.news.body,75,330,560,22,textFont(17,false),'#000','left',16);
  if(buttonBg)ctx.drawImage(buttonBg,180,700);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=textFont(fitText(state.news.button,320,17,11),false);ctx.fillText(state.news.button,356,713,320);
}

async function renderSuper(seq){
  setCanvas(1001,639,'Super Event');ctx.clearRect(0,0,1001,639);
  const [frame,space,pic]=await Promise.all([loadImage(template('super_frame.png')),loadImage(template('spacebar.png')),loadImage(assetUrls.super)]); if(seq!==renderSeq)return;
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
function activeAnimationDuration(){let d=0;for(const k of animatedKeysForTool())if(animatedAssets.has(k))d=Math.max(d,animatedDurations.get(k)||3000);return Math.max(1200,Math.min(6000,d||3000))}
function ensureAnimationLoop(){if(animationLoopId||!activeToolHasAnimation())return;const tick=now=>{animationLoopId=0;if(!activeToolHasAnimation())return;if(!document.hidden&&now-animationLastPaint>=70&&!animationRenderBusy){animationLastPaint=now;animationRenderBusy=true;const seq=++renderSeq,fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];Promise.resolve(fn?.(seq)).catch(console.error).finally(()=>{animationRenderBusy=false})}animationLoopId=requestAnimationFrame(tick)};animationLoopId=requestAnimationFrame(tick)}
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
let __gifPaletteCache=null,__gifLevelCache=null;
function gifColorLevels(){if(__gifLevelCache)return __gifLevelCache;const r=new Uint8Array(256),g=new Uint8Array(256),b=new Uint8Array(256);for(let i=0;i<256;i++){r[i]=Math.round(i*5/255);g[i]=Math.round(i*6/255);b[i]=Math.round(i*5/255)}return __gifLevelCache={r,g,b}}
function gifPalette(){if(__gifPaletteCache)return __gifPaletteCache;const out=new Uint8Array(768);for(let rl=0;rl<6;rl++)for(let gl=0;gl<7;gl++)for(let bl=0;bl<6;bl++){const idx=1+(rl*42)+(gl*6)+bl;out[idx*3]=Math.round(rl*255/5);out[idx*3+1]=Math.round(gl*255/6);out[idx*3+2]=Math.round(bl*255/5)}return __gifPaletteCache=out}
function gifIndexPixels(rgba){const out=new Uint8Array(rgba.length>>2),levels=gifColorLevels();for(let i=0,j=0;i<rgba.length;i+=4,j++)out[j]=rgba[i+3]<128?0:1+levels.r[rgba[i]]*42+levels.g[rgba[i+1]]*6+levels.b[rgba[i+2]];return out}
function gifLzw(indexed,minCodeSize=8){const clear=1<<minCodeSize,end=clear+1,bytes=[],blocks=[];let cur=0,bits=0,codeSize=minCodeSize+1,next=end+1,dict=new Map();const write=code=>{cur|=code<<bits;bits+=codeSize;while(bits>=8){bytes.push(cur&255);cur>>>=8;bits-=8}};const reset=()=>{dict=new Map();codeSize=minCodeSize+1;next=end+1};write(clear);if(indexed.length){let prefix=indexed[0];for(let i=1;i<indexed.length;i++){const k=indexed[i],key=prefix*256+k,found=dict.get(key);if(found!==undefined){prefix=found;continue}write(prefix);if(next<4096){dict.set(key,next++);if(next>(1<<codeSize)&&codeSize<12)codeSize++}else{write(clear);reset()}prefix=k}write(prefix)}write(end);if(bits>0)bytes.push(cur&255);for(let i=0;i<bytes.length;i+=255){const n=Math.min(255,bytes.length-i);blocks.push(n,...bytes.slice(i,i+n))}blocks.push(0);return new Uint8Array(blocks)}
function gifChangedRect(now,prev,w,h){if(!prev)return{x:0,y:0,w,h,pixels:now};let minX=w,minY=h,maxX=-1,maxY=-1;for(let y=0,p=0;y<h;y++)for(let x=0;x<w;x++,p++)if(now[p]!==prev[p]){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}if(maxX<0)return{x:0,y:0,w:1,h:1,pixels:now.subarray(0,1)};const rw=maxX-minX+1,rh=maxY-minY+1,out=new Uint8Array(rw*rh);for(let y=0;y<rh;y++)out.set(now.subarray((minY+y)*w+minX,(minY+y)*w+minX+rw),y*rw);return{x:minX,y:minY,w:rw,h:rh,pixels:out}}
function createGifEncoder(width,height){const chunks=[],palette=gifPalette();let previous=null,started=false,finished=false;const push=(...xs)=>chunks.push(Uint8Array.from(xs));const u16=n=>[n&255,(n>>8)&255];const ascii=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));chunks.push(ascii('GIF89a'));push(...u16(width),...u16(height),0xF7,0,0);chunks.push(palette);push(0x21,0xFF,0x0B);chunks.push(ascii('NETSCAPE2.0'));push(3,1,0,0,0);return{addFrame(rgba,delayMs=120){if(finished)throw new Error('GIF is already finished.');const indexed=gifIndexPixels(rgba),rect=gifChangedRect(indexed,previous,width,height);previous=indexed;const delay=Math.max(2,Math.min(65535,Math.round(delayMs/10)));push(0x21,0xF9,4,5,...u16(delay),0,0);push(0x2C,...u16(rect.x),...u16(rect.y),...u16(rect.w),...u16(rect.h),0);push(8);chunks.push(gifLzw(rect.pixels,8));started=true},finish(){if(!started)throw new Error('No GIF frames were added.');if(!finished){push(0x3B);finished=true}return new Blob(chunks,{type:'image/gif'})}}}
function downloadImageBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=filename;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function renderActiveNow(){const seq=++renderSeq,fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];if(fn)await fn(seq)}
function canvasRgba(c=canvas){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data}
async function exportPNG(){
  const mode=activeToolHasAnimation()?await exportModePopup():'static';if(!mode)return;const safe=activeTool.replace(/[^a-z0-9_-]+/gi,'-');
  await renderActiveNow();
  if(mode==='static'){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)downloadImageBlob(blob,`tfr-${safe}-gfx.png`);return}
  const delay=100,duration=activeAnimationDuration(),frameCount=Math.max(2,Math.min(60,Math.ceil(duration/delay))),gif=createGifEncoder(canvas.width,canvas.height);await new Promise(r=>setTimeout(r,120));
  for(let i=0;i<frameCount;i++){if(i)await new Promise(r=>setTimeout(r,delay));await renderActiveNow();gif.addFrame(canvasRgba(),delay);if(i%4===3)await new Promise(r=>setTimeout(r,0))}
  downloadImageBlob(gif.finish(),`tfr-${safe}-gfx-animated.gif`);
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
