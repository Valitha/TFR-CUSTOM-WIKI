import {esc} from './model.js';
import {sanitize} from './sanitize.js';

const safeColor=c=>['green','red','inherit','#DE47A3','#B75DCC'].includes(c)?c:'inherit';
const secDomId=s=>`section-${s.id}`;
const stripHtml=s=>String(s||'').replace(/<[^>]+>/g,' ');

function renderHeader(project,assets){return `<header class="tfr-site-header">
 <button class="tfr-hamburger" data-toc-toggle aria-label="Contents">☰</button>
 <div class="tfr-brand"><img src="${assets.logo}" alt=""><span>The Fire Rises Wiki</span></div>
 <div class="tfr-search-wrap"><div class="tfr-search-row"><input class="tfr-search" placeholder="Search The Fire Rises Wiki"><button class="tfr-search-button">Search</button></div><div class="tfr-search-results"></div></div>
 <div class="tfr-account"><span>⚑ English</span><span class="fake">Create account</span><span class="fake">Log in</span><span>•••</span></div>
 </header>`}

function renderToc(page){let n=0;return `<ul class="tfr-toc-list"><li><a href="#article-top" data-scroll="article-top">Beginning</a></li>${page.sections.map(s=>{if(s.level===2)n++;return `<li class="${s.level===3?'sub':''}"><a href="#${secDomId(s)}" data-scroll="${secDomId(s)}">${s.level===2?esc(s.title):esc(s.title)}</a></li>`}).join('')}</ul>`}

function renderAppearance(){return `<div class="tfr-side-inner"><div class="tfr-side-heading"><strong>Appearance</strong><button data-appearance-hide>hide</button></div>
 <div class="tfr-appearance-section"><span>Text</span><label><input type="radio" name="text-size" value="small"> Small</label><label><input type="radio" name="text-size" value="standard" checked> Standard</label><label><input type="radio" name="text-size" value="large"> Large</label></div>
 <div class="tfr-appearance-section"><span>Width</span><label><input type="radio" name="page-width" value="standard" checked> Standard</label><label><input type="radio" name="page-width" value="wide"> Wide</label></div></div>`}

function renderInfobox(page){const groups=page.infobox.groups.map(g=>`<tr><th colspan="2" class="group-title">${esc(g.title)}</th></tr>${g.rows.map(r=>r.type==='list'?`<tr><th>${esc(r.label)}</th><td><ul class="tfr-ib-list">${r.items.map(i=>`<li>${i.icon?`<img class="tfr-ib-icon" src="${i.icon}" alt="">`:''}<span>${sanitize(i.text||'')}</span>${i.stat?`<span class="tfr-stat" style="color:${safeColor(i.statColor)}">${esc(i.stat)}</span>`:''}</li>`).join('')}</ul></td></tr>`:`<tr><th>${esc(r.label)}</th><td>${sanitize(r.value||'')}</td></tr>`).join('')}`).join('');const sec=page.infobox.secondary;return `<table class="tfr-infobox"><tbody><tr><th colspan="2" class="title">${esc(page.infobox.title||page.title)}</th></tr>${renderInfoboxMediaTabs(page)}${sec?.src?`<tr><td colspan="2" class="tfr-secondary"><img src="${sec.src}" alt="" style="width:${Math.max(40,Number(sec.width)||420)}px">${sec.caption?`<div class="tfr-caption">${esc(sec.caption)}</div>`:''}</td></tr>`:''}${groups}</tbody></table>`}

function renderLead(page){const m=page.leadImage;return m?.src?`<figure class="tfr-lead"><img src="${m.src}" alt="" style="width:${Math.max(40,Number(m.width)||350)}px">${m.caption?`<figcaption class="tfr-caption">${esc(m.caption)}</figcaption>`:''}</figure>`:''}
function renderSection(page,s,showEditLinks){const medias=(s.media||[]).map(m=>m.src?`<figure class="tfr-section-media" style="width:${Math.max(80,Number(m.width)||260)}px"><img src="${m.src}" alt="">${m.caption?`<figcaption>${esc(m.caption)}</figcaption>`:''}</figure>`:'').join('');const headTag=s.level===3?'h3':'h2';const edit=showEditLinks?`<span class="tfr-edit-links">[ <a href="#" data-edit-section="${esc(s.id)}">edit</a> | <a href="#" data-edit-section="${esc(s.id)}">edit source</a> ]</span>`:'';if(s.type==='gallery'){return `<section id="${secDomId(s)}"><div class="tfr-heading"><${headTag}>${esc(s.title)}</${headTag}>${edit}</div><div class="tfr-gallery">${(s.gallery||[]).map(g=>`<figure><div class="tfr-gallery-image">${g.src?`<img src="${g.src}" alt="">`:''}</div><figcaption>${esc(g.caption||'')}</figcaption></figure>`).join('')}</div></section>`}return `<section id="${secDomId(s)}"><div class="tfr-heading"><${headTag}>${esc(s.title)}</${headTag}>${edit}</div>${medias}<div class="tfr-section-body">${sanitize(s.html)}</div></section>`}
function renderBody(project,page){return `${renderInfobox(page)}${renderLead(page)}<div class="tfr-intro">${sanitize(page.introHtml)}</div>${page.sections.map(s=>renderSection(page,s,project.settings.showEditLinks)).join('')}${page.categories.length?`<div class="tfr-catlinks">Categories: ${page.categories.map(c=>`<a href="#">${esc(c)}</a>`).join(' | ')}</div>`:''}`}

export function pageMarkup(project,page,assets){return `<div class="tfr-reader text-standard width-standard" data-page-root="${esc(page.id)}">${renderHeader(project,assets)}<div class="tfr-layout"><aside class="tfr-side tfr-toc"><div class="tfr-side-inner"><div class="tfr-side-heading"><strong>Contents</strong><button data-toc-hide>hide</button></div>${renderToc(page)}</div></aside><main class="tfr-main" id="article-top"><div class="tfr-title-row"><div class="tfr-toc-inline-wrap"><button class="tfr-toc-inline" data-toc-menu-toggle aria-label="Contents" aria-expanded="false">☷</button><div class="tfr-toc-popover" hidden>${renderToc(page)}</div></div><h1>${esc(page.title)}</h1></div><div class="tfr-tabs"><div class="tfr-tab-group"><a class="tfr-tab active" href="#">Page</a><a class="tfr-tab discussion" href="#" data-edit-page>Discussion</a></div><div class="tfr-tab-group right"><a class="tfr-tab active desktop-only" href="#">Read</a><a class="tfr-tab desktop-only" href="#" data-edit-page>Edit</a><a class="tfr-tab desktop-only" href="#" data-edit-page>Edit source</a><a class="tfr-tab desktop-only" href="#">View history</a><details class="tfr-tools"><summary>Tools</summary><div class="tfr-tools-menu"><button data-tool="toc">Contents</button><button data-tool="appearance">Appearance</button><button data-tool="sound">Sound: on</button></div></details></div></div><article class="tfr-article">${renderBody(project,page)}</article></main><aside class="tfr-side tfr-appearance">${renderAppearance()}</aside></div></div>`}

function runtime(project,mode,sounds){
  const data=JSON.stringify(project).replace(/</g,'\\u003c');
  const snd=JSON.stringify(sounds).replace(/</g,'\\u003c');
  return `<script>(function(){
const PROJECT=${data},MODE=${JSON.stringify(mode)},SOUNDS=${snd};
let muted=false;
const pools={};
for(const [k,src] of Object.entries(SOUNDS)){pools[k]=Array.from({length:4},()=>{const a=new Audio(src);a.volume=.7;return a})}
function play(n){if(muted||!pools[n])return;const a=pools[n].find(x=>x.paused||x.ended)||pools[n][0];try{a.currentTime=0;a.play().catch(()=>{})}catch{}}
function strip(s){return String(s||'').replace(/<[^>]+>/g,' ')}
function soundFor(t){if(t.closest('input,textarea,[contenteditable=true]'))return'province';if(t.closest('[data-toc-hide],[data-appearance-hide]'))return'close';if(t.closest('button,a,summary,select,label'))return'open';return null}
document.addEventListener('pointerdown',e=>{const s=soundFor(e.target);if(s)play(s)},true);
function activeRoot(){return document.querySelector('.export-page:not([hidden]) .tfr-reader')||document.querySelector('.tfr-reader')}
function showPage(id){if(MODE!=='export'){parent.postMessage({type:'navigate-page',id},'*');return}document.querySelectorAll('.export-page').forEach(x=>{x.hidden=x.dataset.page!==id});history.replaceState(null,'','#page='+encodeURIComponent(id));scrollTo(0,0)}
function search(input){const q=input.value.trim().toLowerCase(),box=input.closest('.tfr-search-wrap').querySelector('.tfr-search-results');if(!q){box.innerHTML='';return}const arr=PROJECT.pages.map(p=>{const hay=(p.title+' '+strip(p.introHtml)+' '+p.sections.map(s=>s.title+' '+strip(s.html)).join(' ')).toLowerCase();const title=p.title.toLowerCase();return{p,score:title.startsWith(q)?0:title.includes(q)?1:hay.includes(q)?2:99}}).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||a.p.title.localeCompare(b.p.title)).slice(0,8);box.innerHTML=arr.map(x=>'<button class="tfr-search-result" data-result="'+x.p.id+'"><strong>'+x.p.title+'</strong><small>'+(x.score===2?'Content match':'Page')+'</small></button>').join('')}
document.addEventListener('input',e=>{if(e.target.matches('.tfr-search'))search(e.target)});
document.addEventListener('click',e=>{
 const r=e.target.closest('[data-result]');if(r){showPage(r.dataset.result);return}
 const mt=e.target.closest('[data-media-tab]');if(mt){const box=mt.closest('.tfr-infobox');box.querySelectorAll('[data-media-tab]').forEach(x=>x.classList.toggle('active',x===mt));box.querySelectorAll('[data-media-panel]').forEach(x=>{x.hidden=x.dataset.mediaPanel!==mt.dataset.mediaTab});return}
 const ed=e.target.closest('[data-edit-section]');if(ed){e.preventDefault();if(MODE==='preview')parent.postMessage({type:'edit-section',id:ed.dataset.editSection},'*');return}
 if(e.target.closest('[data-edit-page]')){e.preventDefault();if(MODE==='preview')parent.postMessage({type:'edit-page'},'*');return}
 const root=e.target.closest('.tfr-reader')||activeRoot();if(!root)return;
 if(e.target.closest('[data-toc-hide]')){root.querySelector('.tfr-layout').classList.add('toc-collapsed');return}
 if(e.target.closest('[data-toc-toggle]')){root.querySelector('.tfr-layout').classList.toggle('toc-collapsed');return}
 if(e.target.closest('[data-appearance-hide]')){root.querySelector('.tfr-layout').classList.add('appearance-collapsed');return}
 const tool=e.target.closest('[data-tool]');if(tool){const layout=root.querySelector('.tfr-layout');if(tool.dataset.tool==='toc')layout.classList.toggle('toc-collapsed');if(tool.dataset.tool==='appearance')layout.classList.toggle('appearance-collapsed');if(tool.dataset.tool==='sound'){muted=!muted;tool.textContent='Sound: '+(muted?'off':'on')}return}
 const sc=e.target.closest('[data-scroll]');if(sc){e.preventDefault();root.querySelector('#'+CSS.escape(sc.dataset.scroll))?.scrollIntoView({behavior:'smooth'});return}
});
document.addEventListener('change',e=>{const root=e.target.closest('.tfr-reader')||activeRoot();if(!root)return;if(e.target.name==='text-size'){root.classList.remove('text-small','text-standard','text-large');root.classList.add('text-'+e.target.value)}if(e.target.name==='page-width'){root.classList.remove('width-standard','width-wide');root.classList.add('width-'+e.target.value)}});
if(MODE==='export'){const id=new URLSearchParams(location.hash.slice(1)).get('page');if(id&&PROJECT.pages.some(p=>p.id===id))showPage(id)}
})();<\/script>`
}

export function previewDocument(project,page,themeCss,assets,sounds){const cursor=`url('${assets.cursor}'), pointer`;const pointer=`url('${assets.pointer}'), pointer`;return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Electrolize&display=swap" rel="stylesheet"><link href="https://fonts.cdnfonts.com/css/vcr-osd-mono" rel="stylesheet"><style>${themeCss}</style><style>:root{--cursor-normal:${cursor};--cursor-pointer:${pointer}}</style></head><body class="tfr-page">${pageMarkup(project,page,assets)}${runtime(project,'preview',sounds)}</body></html>`}

export function exportDocument(project,themeCss,assets,sounds){const pages=project.pages.map(p=>`<section class="export-page" data-page="${esc(p.id)}" ${p.id===project.activePageId?'':'hidden'}>${pageMarkup(project,p,assets)}</section>`).join('');const data=JSON.stringify(project).replace(/</g,'\\u003c');return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>The Fire Rises Wiki</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Electrolize&display=swap" rel="stylesheet"><link href="https://fonts.cdnfonts.com/css/vcr-osd-mono" rel="stylesheet"><style>${themeCss}</style><style>:root{--cursor-normal:url('${assets.cursor}'),pointer;--cursor-pointer:url('${assets.pointer}'),pointer}.export-page[hidden]{display:none!important}</style></head><body class="tfr-page">${pages}<script id="lore-project-data" type="application/json">${data}</script>${runtime(project,'export',sounds)}</body></html>`}
