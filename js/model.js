export const FORMAT='tfr-lore-project';
export const VERSION=5;
export const IMAGE_OPT_VERSION=1;
export const uid=(p='id')=>`${p}-${crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2)}`;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const textRow=(label='Field',value='',opts={})=>({id:uid('row'),label,type:'text',value,icon:opts.icon||'',valueColor:opts.valueColor||'inherit'});
export const listItem=()=>({id:uid('item'),icon:'',text:''});
export const traitBonus=()=>({id:uid('bonus'),icon:'',stat:'',statColor:'green'});
export const traitItem=()=>({id:uid('item'),text:'',bonuses:[traitBonus()]});
export const listRow=(label='Field')=>({id:uid('row'),label,type:'list',icon:'',items:[listItem()]});
export const traitRow=(label='Traits')=>({id:uid('row'),label,type:'trait',icon:'',items:[traitItem()]});
export const group=(title='Basic Information',rows=[textRow()])=>({id:uid('group'),title,rows});
export const mediaTab=(label='Portrait')=>({id:uid('tab'),label,src:'',caption:'',width:156});
export const section=(title='New Section',level=2,type='text',parentId=null)=>({id:uid('sec'),title,level,type,parentId,html:'',media:[],gallery:[]});
export const media=()=>({id:uid('media'),src:'',caption:'',width:260});
export const galleryItem=()=>({id:uid('gallery'),src:'',caption:''});
export const countryPathItem=()=>({id:uid('path'),title:'',flag:'',pageId:''});
export const countryPaths=()=>({enabled:false,quote:'',root:{title:'',flag:'',pageId:''},paths:[]});

function characterGroups(){return [
 group('Basic Information',[textRow('Birth',''),listRow('Country')]),
 group('Character Information',[textRow('Role',''),textRow('Title',''),listRow('Ideology'),listRow('Political Party'),traitRow('Traits')])
]}
function countryGroups(){return [
 group('Basic Information',[textRow('Official Name',''),textRow('Capital',''),textRow('Population','')]),
 group('In-game Information',[textRow('Country Tag',''),listRow('Government/Party'),listRow('Ideology'),listRow('Faction'),listRow('Head of State'),listRow('Head of Government')]),
 group('Economic Information',[textRow('GDP','',{valueColor:'green'}),textRow('Debt','',{valueColor:'red'}),textRow('Inflation','',{valueColor:'orange'})])
]}
function genericGroups(){return [group('Basic Information',[textRow('Field','')])]}

export function makePage(type='character'){
 const tab=mediaTab(type==='country'?'Initial':'Portrait'); tab.width=type==='country'?250:156;
 return {id:uid('page'),type,title:'Untitled Entry',introHtml:'',leadImage:{src:'',caption:'',width:350},countryPaths:countryPaths(),infobox:{title:'Untitled Entry',tabs:[tab],activeTabId:tab.id,secondary:{src:'',caption:'',width:420},groups:type==='country'?countryGroups():type==='generic'?genericGroups():characterGroups()},sections:[section('New Section')],categories:[]};
}
export function makeProject(){const p=makePage('character');return {format:FORMAT,version:VERSION,imageOptimizationVersion:IMAGE_OPT_VERSION,activePageId:p.id,title:'Untitled Lore Project',settings:{showEditLinks:true},pages:[p],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}

function normalizeTraitBonus(b){b=b&&typeof b==='object'?b:{};b.id||=uid('bonus');b.icon||='';b.stat??=b.value??='';b.statColor=['green','red'].includes(b.statColor)?b.statColor:'green';delete b.value;return b}
function normalizeItem(i,isTrait){i=i&&typeof i==='object'?i:{};i.id||=uid('item');i.text??='';if(isTrait){let bonuses=Array.isArray(i.bonuses)?i.bonuses:null;if(!bonuses){bonuses=[];if(i.icon||i.stat)bonuses.push({id:uid('bonus'),icon:i.icon||'',stat:i.stat||'',statColor:i.statColor||'green'})}i.bonuses=bonuses.map(normalizeTraitBonus);if(!i.bonuses.length)i.bonuses=[traitBonus()];delete i.icon;delete i.stat;delete i.statColor}else{i.icon||=''}return i}
function normalizeRow(r){
 r.id||=uid('row');r.label??='Field';r.icon||='';
 const oldType=r.type;
 if(oldType==='trait'||(oldType==='list'&&/^traits?$/i.test(String(r.label).trim())))r.type='trait';
 else r.type=oldType==='list'?'list':'text';
 if(r.type==='list'||r.type==='trait'){
   r.items=Array.isArray(r.items)?r.items:[];
   if(!r.items.length)r.items=[r.type==='trait'?traitItem():listItem()];
   r.items=r.items.map(i=>normalizeItem(i,r.type==='trait'));
 }else{
   r.value??='';
   r.valueColor=['green','red','orange','#DE47A3','#B75DCC','inherit'].includes(r.valueColor)?r.valueColor:'inherit';
 }
 return r;
}
function normalizeCountryPaths(p){
 p.countryPaths=p.countryPaths&&typeof p.countryPaths==='object'?p.countryPaths:countryPaths();
 const c=p.countryPaths;c.enabled=!!c.enabled;c.quote??='';c.root=c.root&&typeof c.root==='object'?c.root:{title:'',flag:'',pageId:''};c.root.title??='';c.root.flag||='';c.root.pageId||='';
 c.paths=Array.isArray(c.paths)?c.paths:[];for(const x of c.paths){x.id||=uid('path');x.title??='';x.flag||='';x.pageId||=''}
 return c;
}
function normalizePage(p){
 p.id||=uid('page');p.type||='character';p.title||='Untitled Entry';p.introHtml||='';
 p.leadImage||={src:'',caption:'',width:350};p.leadImage.src||=p.leadImage.image||p.leadImage.url||'';p.leadImage.caption||='';p.leadImage.width=Number(p.leadImage.width)||350;
 normalizeCountryPaths(p);
 p.infobox||={};p.infobox.title||=p.title;p.infobox.tabs=Array.isArray(p.infobox.tabs)?p.infobox.tabs:(p.infobox.portraits||[]).map(x=>({...x,src:x.src||x.image||x.url||''}));
 if(!p.infobox.tabs.length)p.infobox.tabs=[mediaTab(p.type==='country'?'Initial':'Portrait')];
 for(const t of p.infobox.tabs){t.id||=uid('tab');t.label||='Image';t.src||=t.image||t.url||'';t.caption||='';t.width=Number(t.width)||156}
 p.infobox.activeTabId||=p.infobox.tabs[0].id;p.infobox.secondary||=p.infobox.secondaryMedia||{src:'',caption:'',width:420};p.infobox.secondary.src||=p.infobox.secondary.image||p.infobox.secondary.url||'';p.infobox.secondary.caption||='';p.infobox.secondary.width=Number(p.infobox.secondary.width)||420;
 p.infobox.groups=Array.isArray(p.infobox.groups)?p.infobox.groups:[];for(const g of p.infobox.groups){g.id||=uid('group');g.title||='Group';g.rows=Array.isArray(g.rows)?g.rows.map(normalizeRow):[]}
 p.sections=Array.isArray(p.sections)?p.sections:[];for(const s of p.sections){s.id||=uid('sec');s.title||='New Section';s.level=Number(s.level)||2;s.type=s.type==='gallery'?'gallery':'text';s.parentId||=null;s.html||=s.body||'';s.media=Array.isArray(s.media)?s.media:[];for(const m of s.media){m.id||=uid('media');m.src||=m.image||m.url||'';m.caption||='';m.width=Number(m.width)||260}s.gallery=Array.isArray(s.gallery)?s.gallery:[];for(const g of s.gallery){g.id||=uid('gallery');g.src||=g.image||g.url||'';g.caption||=''}}
 p.categories=Array.isArray(p.categories)?p.categories:[];return p;
}
export function normalizeProject(p){if(!p||!Array.isArray(p.pages)||!p.pages.length)throw new Error('This file does not contain a valid lore project.');p.format=FORMAT;p.version=VERSION;p.title||=p.meta?.title||'Untitled Lore Project';p.settings||={};if(p.settings.showEditLinks===undefined)p.settings.showEditLinks=true;p.pages=p.pages.map(normalizePage);p.activePageId=p.activePageId||p.meta?.activePageId||p.pages[0].id;return p}
