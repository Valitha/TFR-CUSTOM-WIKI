(function(){
  'use strict';

  const PHONE = window.matchMedia('(max-width:760px)');
  const MIN_SWIPE = 82;
  const MAX_VERTICAL = 72;
  const SAFARI_EDGE = 28;
  const PWA_PAGE_EDGE = 54;
  const WEB_PAGE_ZONE_END = 92;
  let gesture = null;

  function isPhone(){ return PHONE.matches; }
  function standalone(){
    return document.documentElement.classList.contains('pwa-standalone') ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function writable(target){
    if(!(target instanceof Element)) return false;
    if(target.closest('[contenteditable=true]')) return true;
    const field=target.closest('input,textarea,select');
    if(!field) return false;
    const type=(field.type||'text').toLowerCase();
    return !['button','file','checkbox','radio','range','color','submit','reset'].includes(type);
  }
  function insideBlockingControl(target){
    return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable=true],.modal,.icon-library-modal');
  }
  function horizontalEnough(dx,dy){
    return Math.abs(dx)>=MIN_SWIPE && Math.abs(dy)<=MAX_VERTICAL && Math.abs(dx)>Math.abs(dy)*1.2;
  }
  function safeWebStart(x,width){
    return standalone() || (x>=SAFARI_EDGE && x<=width-SAFARI_EDGE);
  }
  function click(id){ document.getElementById(id)?.click(); }

  // Parent/editor gestures.
  document.addEventListener('touchstart',function(e){
    gesture=null;
    if(!isPhone() || e.touches.length!==1) return;
    const t=e.touches[0];
    const drawerOpen=document.body.classList.contains('mobile-pages-open');

    // When Pages is open, accept a close-swipe from the drawer, its edge,
    // or the dimmed outside backdrop. Do this before writable checks so the
    // whole drawer layer feels draggable.
    if(drawerOpen){
      gesture={kind:'close-pages',x:t.clientX,y:t.clientY};
      return;
    }

    if(writable(e.target) || insideBlockingControl(e.target)) return;
    if(document.body.classList.contains('mobile-preview-active')) return; // iframe owns Preview gesture

    const width=Math.max(1,window.innerWidth||document.documentElement.clientWidth||390);
    const isPwa=standalone();

    // Pages: rightward swipe from a left-side gesture zone. In ordinary
    // Safari the first 28px are intentionally left to Safari's history swipe.
    if(isPwa ? t.clientX<=PWA_PAGE_EDGE : (t.clientX>=SAFARI_EDGE && t.clientX<=WEB_PAGE_ZONE_END)){
      gesture={kind:'open-pages',x:t.clientX,y:t.clientY};
      return;
    }

    // Editor -> Preview: deliberate leftward swipe across the editor surface.
    // Normal Safari keeps both extreme edges free for browser navigation.
    if(safeWebStart(t.clientX,width)) gesture={kind:'to-preview',x:t.clientX,y:t.clientY};
  },{passive:true});

  document.addEventListener('touchmove',function(e){
    if(!gesture || !standalone() || !e.touches.length) return;
    const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
    if(Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)*1.2) e.preventDefault();
  },{passive:false});

  document.addEventListener('touchend',function(e){
    if(!gesture || !e.changedTouches.length) return;
    const g=gesture; gesture=null;
    const t=e.changedTouches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(!horizontalEnough(dx,dy)) return;
    if(g.kind==='close-pages' && dx<0) click('mobilePageMenuClose');
    else if(g.kind==='open-pages' && dx>0) click('mobilePageMenuBtn');
    else if(g.kind==='to-preview' && dx<0) click('mobilePreviewBtn');
  },{passive:true});
  document.addEventListener('touchcancel',function(){ gesture=null; },{passive:true});

  // Preview is rendered inside a same-origin srcdoc iframe, so its swipe has
  // to be installed inside that document. A rightward article swipe returns
  // to the editor. Search/media controls are excluded so their touch UX wins.
  const frame=document.getElementById('previewFrame');
  function wirePreview(){
    const doc=frame?.contentDocument;
    if(!doc || doc.__tfrGestureV35) return;
    doc.__tfrGestureV35=true;
    let pg=null;

    function blocked(target){
      return !!target?.closest?.(
        'input,textarea,select,[contenteditable=true],.tfr-search-wrap,.tfr-media-tabs,button,summary'
      );
    }
    doc.addEventListener('touchstart',function(e){
      pg=null;
      if(!isPhone() || e.touches.length!==1 || blocked(e.target)) return;
      const t=e.touches[0];
      const width=Math.max(1,frame.contentWindow?.innerWidth||window.innerWidth||390);
      if(!safeWebStart(t.clientX,width)) return;
      pg={x:t.clientX,y:t.clientY};
    },{passive:true});
    doc.addEventListener('touchmove',function(e){
      if(!pg || !standalone() || !e.touches.length) return;
      const t=e.touches[0],dx=t.clientX-pg.x,dy=t.clientY-pg.y;
      if(Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)*1.2) e.preventDefault();
    },{passive:false});
    doc.addEventListener('touchend',function(e){
      if(!pg || !e.changedTouches.length) return;
      const start=pg; pg=null;
      const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
      if(horizontalEnough(dx,dy) && dx>0) click('mobileReturnEdit');
    },{passive:true});
    doc.addEventListener('touchcancel',function(){ pg=null; },{passive:true});
  }
  frame?.addEventListener('load',wirePreview);
  if(frame?.contentDocument?.readyState==='complete') wirePreview();
})();
