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
    factionIcon: '../assets/icon-library/factions/GFX_NATO_Member.webp',
    factionIconName: 'NATO Member'
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
const assetUrls = {
  flag: placeholder('flag_eu.png'),
  leader: placeholder('leader_unknown.png'),
  focus: placeholder('focus_unknown.png'),
  event: placeholder('major_news.png'),
  news: placeholder('local_news.png'),
  super: placeholder('super_event.png')
};
const objectUrls = new Map();

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
async function noteAssetAnimation(key,blob){if(blob?.type?.toLowerCase()==='image/gif'){animatedAssets.add(key);try{animatedDurations.set(key,gifDurationMsFromBytes(new Uint8Array(await blob.arrayBuffer())))}catch{animatedDurations.set(key,3000)}}else{animatedAssets.delete(key);animatedDurations.delete(key)}ensureAnimationLoop()}
function setObjectUrl(key, blob){
  if(objectUrls.has(key)) URL.revokeObjectURL(objectUrls.get(key));
  const url=URL.createObjectURL(blob); objectUrls.set(key,url); assetUrls[key]=url;
}
async function restoreAssets(){
  for(const key of Object.keys(assetUrls)){
    try{ const blob=await dbGet(key); if(blob){setObjectUrl(key,blob);await noteAssetAnimation(key,blob)} }catch(e){ console.warn('asset restore failed',key,e); }
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
  if(!file.type.startsWith('image/')){ alert('Please choose an image file.'); input.value=''; return; }
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
  assetUrls[key]=assetDefaults[key]; animatedAssets.delete(key);animatedDurations.delete(key); resetAssetTransform(key); saveState(); imageCache.clear(); updateThumbs(); bindValuesOnly(); updateOutputs(); scheduleRender();
}

function updateThumbs(){
  const map={flag:'flagThumb',leader:'leaderThumb',focus:'focusThumb',event:'eventThumb',news:'newsThumb',super:'superThumb'};
  for(const [key,id] of Object.entries(map)){
    $('#'+id).src=assetUrls[key];
    const clear=$(`[data-clear-asset="${key}"]`); if(clear)clear.hidden=!objectUrls.has(key);
  }
  $('#ideologyThumb').src=state.country.ideologyIcon; $('#ideologyName').textContent=state.country.ideologyIconName||'Selected ideology';
  $('#factionThumb').src=state.country.factionIcon; $('#factionName').textContent=state.country.factionIconName||'Selected faction';
}

function loadImage(src){
  if(!src) return Promise.resolve(null);
  if(imageCache.has(src)) return imageCache.get(src);
  const p=new Promise(resolve=>{ const im=new Image(); im.decoding='async'; im.onload=()=>resolve(im); im.onerror=()=>resolve(null); im.src=src; });
  imageCache.set(src,p); return p;
}
function cleanTransform(t){return{x:Number(t?.x)||0,y:Number(t?.y)||0,size:Math.max(10,Number(t?.size)||100)}}
function drawCover(im,x,y,w,h){ if(!im)return; const s=Math.max(w/im.width,h/im.height); const sw=w/s,sh=h/s,sx=(im.width-sw)/2,sy=(im.height-sh)/2; ctx.drawImage(im,sx,sy,sw,sh,x,y,w,h); }
function drawCoverTransform(im,x,y,w,h,t){
  if(!im)return; const tr=cleanTransform(t),base=Math.max(w/im.width,h/im.height),s=base*(tr.size/100),dw=im.width*s,dh=im.height*s,cx=x+w/2+(tr.x/100)*w,cy=y+h/2+(tr.y/100)*h;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(im,cx-dw/2,cy-dh/2,dw,dh);ctx.restore();
}
function drawContain(im,x,y,w,h){ if(!im)return; const s=Math.min(w/im.width,h/im.height); const dw=im.width*s,dh=im.height*s; ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh); }
function drawCentered(im,cx,cy,scale=1,maxW=Infinity,maxH=Infinity){ if(!im)return; let s=scale; if(im.width*s>maxW)s=Math.min(s,maxW/im.width); if(im.height*s>maxH)s=Math.min(s,maxH/im.height); const w=im.width*s,h=im.height*s; ctx.drawImage(im,cx-w/2,cy-h/2,w,h); }
function drawCenteredTransform(im,cx,cy,scale=1,maxW=Infinity,maxH=Infinity,t){
  if(!im)return; const tr=cleanTransform(t); let s=scale; if(im.width*s>maxW)s=Math.min(s,maxW/im.width); if(im.height*s>maxH)s=Math.min(s,maxH/im.height); s*=tr.size/100; const w=im.width*s,h=im.height*s,ox=(tr.x/100)*(Number.isFinite(maxW)?maxW:0),oy=(tr.y/100)*(Number.isFinite(maxH)?maxH:0); ctx.drawImage(im,cx+ox-w/2,cy+oy-h/2,w,h);
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
  // The CSS canvas background is not part of an exported PNG. Paint the
  // country canvas itself so exports remain an opaque black HOI4 panel.
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,524,248);
  const imgs=await Promise.all([
    loadImage(template('diplo_upper_win_bg.png')),loadImage(template('diplo_top_bg_diplo_tab.png')),loadImage(template('Leader_Background.png')),loadImage(template('diplo_leader_frame.png')),loadImage(template('flag_overlay.png')),loadImage(template('pol_goal_progress_frame.png')),loadImage(template('pol_goal_progress.png')),loadImage(template('diplo_goal_button.png')),loadImage(template('bck_shadow.png')),loadImage(template('pol_piechart_overlay.png')),
    loadImage(assetUrls.flag),loadImage(assetUrls.leader),loadImage(assetUrls.focus),loadImage(state.country.ideologyIcon),loadImage(state.country.factionIcon)
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
  // Keep the three top lines clear of the faction emblem at the right edge.
  let size=fitText(state.country.country,210,Number(ts.country)||16,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.country,230,8);
  size=fitText(state.country.faction,210,Number(ts.faction)||14,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.faction,230,28);
  size=fitText(state.country.leader,210,Number(ts.leader)||15,8,true);ctx.font=textFont(size,true);ctx.fillText(state.country.leader,230,48);
  ctx.font=textFont(fitText(state.country.party,270,Number(ts.party)||15,8,true),true);ctx.fillText(state.country.party,238,91);
  ctx.font=textFont(fitText(state.country.ideologyText,270,Number(ts.ideology)||15,8,true),true);ctx.fillText(state.country.ideologyText,238,113);
  ctx.font=textFont(fitText(state.country.election,270,Number(ts.election)||14,8,true),true);ctx.fillStyle='#e7b676';ctx.fillText(state.country.election,238,135);

  // Center against the actual magenta inner focus rectangle (not the full asset).
  // diplo_goal_button.png is drawn at x=230.5,y=170 and its inner box center is
  // x=141,y=30.5 inside the source image -> canvas center 371.5,200.5.
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

function animatedKeysForTool(tool=activeTool){return({country:['flag','leader','focus'],event:['event'],news:['news'],super:['super']}[tool]||[])}
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
async function renderIconGrid(search){
  const list=await loadManifest(); const cat=iconMode==='ideology'?'ideology':'factions'; const q=search.trim().toLowerCase();
  const filtered=list.filter(x=>x.category===cat && (!q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q))).slice(0,500);
  const grid=$('#iconGrid'); grid.innerHTML=''; const frag=document.createDocumentFragment();
  for(const item of filtered){ const b=document.createElement('button'); b.type='button';b.className='icon-option'; const src=normalizeIconSrc(item.src); b.innerHTML=`<img loading="lazy" src="${src}" alt=""><span>${escapeHtml(item.name)}</span>`; b.onclick=()=>{ if(iconMode==='ideology'){state.country.ideologyIcon=src;state.country.ideologyIconName=item.name;}else{state.country.factionIcon=src;state.country.factionIconName=item.name;} saveState();updateThumbs();imageCache.clear();$('#iconDialog').close();scheduleRender();}; frag.appendChild(b); }
  grid.appendChild(frag); if(!filtered.length)grid.innerHTML='<div class="empty">No matching icons.</div>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function exportModePopup(){return new Promise(resolve=>{const dlg=document.createElement('dialog');dlg.className='disclaimer-dialog';dlg.innerHTML='<div class="disclaimer-card"><h2>Export image</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="ui-btn" type="button" data-mode="static">Static image</button><button class="ui-btn primary" type="button" data-mode="animated">Animated image</button></div></div>';document.body.appendChild(dlg);const done=v=>{dlg.close();dlg.remove();resolve(v)};dlg.querySelector('[data-mode="static"]').onclick=()=>done('static');dlg.querySelector('[data-mode="animated"]').onclick=()=>done('animated');dlg.addEventListener('cancel',e=>{e.preventDefault();done(null)});dlg.addEventListener('click',e=>{if(e.target===dlg)done(null)});dlg.showModal()})}
let __apngCrcTable=null;
function apngCrcTable(){if(__apngCrcTable)return __apngCrcTable;const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return __apngCrcTable=t}
function apngCrc32(bytes){let c=0xFFFFFFFF,t=apngCrcTable();for(const b of bytes)c=t[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function apngU32(n){return new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255])}
function apngU16(n){return new Uint8Array([(n>>>8)&255,n&255])}
function apngJoin(...parts){const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);let off=0;for(const part of parts){out.set(part,off);off+=part.length}return out}
function apngChunk(type,data=new Uint8Array()){const t=new TextEncoder().encode(type),crc=apngU32(apngCrc32(apngJoin(t,data)));return apngJoin(apngU32(data.length),t,data,crc)}
async function apngDeflate(bytes){if(typeof CompressionStream==='undefined')throw new Error('Animated image export is unavailable in this browser.');return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())}
async function encodeApngFromCanvas(firstCanvas,frameCount,delayMs,getFrame){const w=firstCanvas.width,h=firstCanvas.height,chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),apngChunk('IHDR',apngJoin(apngU32(w),apngU32(h),new Uint8Array([8,6,0,0,0]))),apngChunk('acTL',apngJoin(apngU32(frameCount),apngU32(0)))];let seq=0;for(let i=0;i<frameCount;i++){const c=i===0?firstCanvas:await getFrame(i),rgba=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,row=w*4,raw=new Uint8Array((row+1)*h);for(let y=0;y<h;y++){const o=y*(row+1);raw[o]=0;raw.set(rgba.subarray(y*row,(y+1)*row),o+1)}const compressed=await apngDeflate(raw),delay=Math.max(1,Math.min(65535,Math.round(delayMs)));chunks.push(apngChunk('fcTL',apngJoin(apngU32(seq++),apngU32(w),apngU32(h),apngU32(0),apngU32(0),apngU16(delay),apngU16(1000),new Uint8Array([0,0]))));if(i===0)chunks.push(apngChunk('IDAT',compressed));else chunks.push(apngChunk('fdAT',apngJoin(apngU32(seq++),compressed)))}chunks.push(apngChunk('IEND'));return new Blob(chunks,{type:'image/png'})}
function downloadImageBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=filename;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function renderActiveNow(){const seq=++renderSeq,fn={country:renderCountry,event:renderEvent,news:renderNews,super:renderSuper}[activeTool];if(fn)await fn(seq)}
async function exportPNG(){
  const mode=activeToolHasAnimation()?await exportModePopup():'static';if(!mode)return;const safe=activeTool.replace(/[^a-z0-9_-]+/gi,'-');
  await renderActiveNow();
  if(mode==='static'){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)downloadImageBlob(blob,`tfr-${safe}-gfx.png`);return}
  const delay=100,duration=activeAnimationDuration(),frameCount=Math.max(2,Math.min(60,Math.ceil(duration/delay))),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);const started=performance.now();const blob=await encodeApngFromCanvas(copy,frameCount,delay,async i=>{const target=started+i*delay,wait=target-performance.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));await renderActiveNow();const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);return c});downloadImageBlob(blob,`tfr-${safe}-gfx-animated.png`);
}
async function resetTool(){
  const fresh=cloneDefaults(); state[activeTool]=fresh[activeTool];
  const keys={country:['flag','leader','focus'],event:['event'],news:['news'],super:['super']}[activeTool]||[];
  for(const k of keys) await clearAsset(k);
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
  $('#chooseIdeology').onclick=()=>openIconPicker('ideology'); $('#chooseFaction').onclick=()=>openIconPicker('faction'); $('#iconSearch').oninput=e=>renderIconGrid(e.target.value); $('#addPieSlice').onclick=addPieSlice;
  $('#exportBtn').onclick=exportPNG; $('#resetToolBtn').onclick=()=>{if(confirm('Reset this GFX to its defaults?')) resetTool();};
  switchTool(activeTool); restoreAssets();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>scheduleRender()).catch(()=>{});
}

init();
})();
