(function(){
  'use strict';

  const PHONE = window.matchMedia('(max-width:760px)');
  const SAFARI_EDGE = 28;
  const PAGE_OPEN_ZONE_RATIO = 0.60;
  const LOCK_DISTANCE = 12;
  const COMMIT_RATIO = 0.34;
  const FAST_SWIPE_VELOCITY = 0.52; // px/ms
  const SETTLE_MS = 220;

  const body = document.body;
  const sidebar = document.getElementById('pageSidebar');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  const editorPane = document.getElementById('editorPane');
  const previewPane = document.getElementById('previewPane');
  const previewFrame = document.getElementById('previewFrame');
  const mobilePreviewBtn = document.getElementById('mobilePreviewBtn');
  const mobileReturnEdit = document.getElementById('mobileReturnEdit');
  const mobilePageMenuBtn = document.getElementById('mobilePageMenuBtn');
  const mobilePageMenuClose = document.getElementById('mobilePageMenuClose');

  let gesture = null;
  let suppressClickUntil = 0;

  function isPhone(){ return PHONE.matches; }
  function standalone(){
    return document.documentElement.classList.contains('pwa-standalone') ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
  function viewportWidth(){ return Math.max(1, window.innerWidth || document.documentElement.clientWidth || 390); }
  function drawerWidth(){ return Math.max(1, sidebar?.getBoundingClientRect().width || Math.min(viewportWidth()*.88,360)); }
  function safeWebStart(x,width){ return standalone() || (x >= SAFARI_EDGE && x <= width-SAFARI_EDGE); }
  function isInteractive(target){
    if(!(target instanceof Element)) return false;
    return !!target.closest('input,textarea,select,button,a,summary,[contenteditable=true],.file-btn,.route-flag-picker,.modal,.icon-library-modal,.rich-toolbar,.infobox-mini-toolbar');
  }
  function animationFrame(){ return new Promise(resolve=>requestAnimationFrame(resolve)); }
  function delay(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

  function stopSyntheticClick(){ suppressClickUntil = Date.now() + 420; }
  document.addEventListener('click',e=>{
    if(Date.now() > suppressClickUntil) return;
    if(e.target instanceof Element && e.target.closest('#mobileDrawerBackdrop,#pageSidebar')){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },true);

  function drawerStyles(active){
    if(!sidebar || !backdrop) return;
    if(active){
      body.classList.add('mobile-pages-gesture');
      sidebar.classList.add('mobile-gesture-dragging');
      backdrop.classList.add('mobile-gesture-visible','mobile-gesture-dragging');
      sidebar.style.transition='none';
      backdrop.style.transition='none';
    }else{
      body.classList.remove('mobile-pages-gesture');
      sidebar.classList.remove('mobile-gesture-dragging');
      backdrop.classList.remove('mobile-gesture-visible','mobile-gesture-dragging');
      sidebar.style.removeProperty('transition');
      sidebar.style.removeProperty('transform');
      backdrop.style.removeProperty('transition');
      backdrop.style.removeProperty('opacity');
    }
  }

  function setDrawerProgress(progress,opening){
    if(!sidebar || !backdrop) return;
    const w=drawerWidth();
    const p=clamp(progress);
    const x = opening ? (-w * (1-p)) : (-w * p);
    sidebar.style.transform=`translate3d(${x}px,0,0)`;
    backdrop.style.opacity=String(.58 * (opening ? p : (1-p)));
  }

  async function settleDrawer(opening,commit,currentProgress){
    if(!sidebar || !backdrop) return;
    stopSyntheticClick();
    sidebar.style.transition=`transform ${SETTLE_MS}ms cubic-bezier(.22,.78,.2,1)`;
    backdrop.style.transition=`opacity ${Math.max(150,SETTLE_MS-35)}ms ease`;

    const shouldOpen = opening ? commit : !commit;
    if(shouldOpen && !body.classList.contains('mobile-pages-open')) mobilePageMenuBtn?.click();
    if(!shouldOpen && body.classList.contains('mobile-pages-open')) mobilePageMenuClose?.click();

    await animationFrame();
    setDrawerProgress(shouldOpen ? 1 : 0, true);
    await delay(SETTLE_MS + 35);
    drawerStyles(false);
  }

  function beginDrawer(opening){
    drawerStyles(true);
    setDrawerProgress(opening ? 0 : 0, opening);
  }

  function modeLayerStyles(kind,active){
    if(!editorPane || !previewPane) return;
    if(active){
      body.classList.add(kind==='to-preview'?'mobile-gesture-to-preview':'mobile-gesture-from-preview');
      body.classList.add('mobile-mode-gesture');
      previewPane.hidden=false;
      if(kind==='from-preview') editorPane.hidden=false;
      previewPane.style.transition='none';
      editorPane.style.transition='none';
      previewPane.style.willChange='transform';
      editorPane.style.willChange='transform,opacity';
    }else{
      body.classList.remove('mobile-gesture-to-preview','mobile-gesture-from-preview','mobile-mode-gesture');
      previewPane.style.removeProperty('transition');
      previewPane.style.removeProperty('transform');
      previewPane.style.removeProperty('will-change');
      editorPane.style.removeProperty('transition');
      editorPane.style.removeProperty('transform');
      editorPane.style.removeProperty('opacity');
      editorPane.style.removeProperty('will-change');
      const inPreview=body.classList.contains('mobile-preview-active');
      editorPane.hidden=inPreview;
      previewPane.hidden=!inPreview;
    }
  }

  function setModeProgress(kind,progress){
    if(!editorPane || !previewPane) return;
    const p=clamp(progress),w=viewportWidth();
    if(kind==='to-preview'){
      previewPane.style.transform=`translate3d(${w*(1-p)}px,0,0)`;
      editorPane.style.transform=`translate3d(${-w*.16*p}px,0,0)`;
      editorPane.style.opacity=String(1-.08*p);
    }else{
      previewPane.style.transform=`translate3d(${w*p}px,0,0)`;
      editorPane.style.transform=`translate3d(${-w*.07*(1-p)}px,0,0)`;
      editorPane.style.opacity=String(.92+.08*p);
    }
  }

  function beginMode(kind){
    modeLayerStyles(kind,true);
    setModeProgress(kind,0);
  }

  async function waitForPreviewMode(expected,timeout=1350){
    const started=performance.now();
    while(performance.now()-started<timeout){
      if(body.classList.contains('mobile-preview-active')===expected) return true;
      await delay(25);
    }
    return false;
  }

  async function settleMode(kind,commit){
    if(!editorPane || !previewPane) return;
    previewPane.style.transition=`transform ${SETTLE_MS}ms cubic-bezier(.22,.78,.2,1)`;
    editorPane.style.transition=`transform ${SETTLE_MS}ms cubic-bezier(.22,.78,.2,1),opacity ${SETTLE_MS}ms ease`;

    if(kind==='to-preview'){
      await animationFrame();
      setModeProgress(kind,commit?1:0);
      await delay(SETTLE_MS+20);
      if(commit){
        mobilePreviewBtn?.click();
        await waitForPreviewMode(true);
      }
      modeLayerStyles(kind,false);
      return;
    }

    await animationFrame();
    setModeProgress(kind,commit?1:0);
    await delay(SETTLE_MS+20);
    if(commit){
      mobileReturnEdit?.click();
      await waitForPreviewMode(false);
    }
    modeLayerStyles(kind,false);
  }

  function velocity(g,currentX){
    const dt=Math.max(16,performance.now()-g.startedAt);
    return (currentX-g.x)/dt;
  }

  function decideEditorKind(g,dx,dy){
    if(g.kind) return g.kind;
    if(Math.abs(dx)<LOCK_DISTANCE && Math.abs(dy)<LOCK_DISTANCE) return null;
    if(Math.abs(dy)>Math.abs(dx)*1.08){ g.cancelled=true; return null; }
    if(Math.abs(dx)<=Math.abs(dy)*1.08) return null;
    if(dx>0 && g.canOpenPages) return (g.kind='open-pages');
    if(dx<0 && g.canPreview) return (g.kind='to-preview');
    g.cancelled=true;
    return null;
  }

  document.addEventListener('touchstart',e=>{
    gesture=null;
    if(!isPhone() || e.touches.length!==1) return;
    const t=e.touches[0];
    const drawerOpen=body.classList.contains('mobile-pages-open');

    if(drawerOpen){
      // The dimmed backdrop and panel border are both valid close-swipe starts.
      // Inputs/buttons inside the panel stay usable normally, but the backdrop
      // itself is a button element and must still accept a drag-to-close.
      const onBackdrop=e.target instanceof Element && !!e.target.closest('#mobileDrawerBackdrop');
      if(!onBackdrop && isInteractive(e.target)) return;
      gesture={kind:'close-pages',x:t.clientX,y:t.clientY,startedAt:performance.now(),started:false,moved:false};
      return;
    }

    if(body.classList.contains('mobile-preview-active')) return; // iframe owns Preview -> Edit.
    if(isInteractive(e.target)) return;

    const width=viewportWidth();
    const safe=safeWebStart(t.clientX,width);
    gesture={
      kind:null,
      x:t.clientX,
      y:t.clientY,
      startedAt:performance.now(),
      started:false,
      moved:false,
      cancelled:false,
      canOpenPages:safe && t.clientX<=width*PAGE_OPEN_ZONE_RATIO,
      canPreview:safe
    };
  },{passive:true});

  document.addEventListener('touchmove',e=>{
    if(!gesture || !e.touches.length || gesture.cancelled) return;
    const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
    const kind=gesture.kind==='close-pages' ? 'close-pages' : decideEditorKind(gesture,dx,dy);
    if(!kind) return;

    if(!gesture.started){
      if(kind==='open-pages') beginDrawer(true);
      else if(kind==='close-pages') beginDrawer(false);
      else if(kind==='to-preview') beginMode('to-preview');
      gesture.started=true;
    }

    gesture.moved=gesture.moved || Math.abs(dx)>LOCK_DISTANCE;
    e.preventDefault();

    if(kind==='open-pages') setDrawerProgress(Math.max(0,dx)/drawerWidth(),true);
    else if(kind==='close-pages') setDrawerProgress(Math.max(0,-dx)/drawerWidth(),false);
    else if(kind==='to-preview') setModeProgress('to-preview',Math.max(0,-dx)/viewportWidth());
  },{passive:false});

  document.addEventListener('touchend',e=>{
    if(!gesture || !e.changedTouches.length){ gesture=null; return; }
    const g=gesture; gesture=null;
    if(!g.started) return;
    const t=e.changedTouches[0],dx=t.clientX-g.x;
    const v=velocity(g,t.clientX);

    if(g.kind==='open-pages'){
      const p=clamp(Math.max(0,dx)/drawerWidth());
      settleDrawer(true,p>=COMMIT_RATIO || (v>FAST_SWIPE_VELOCITY && p>.10),p);
    }else if(g.kind==='close-pages'){
      const p=clamp(Math.max(0,-dx)/drawerWidth());
      settleDrawer(false,p>=COMMIT_RATIO || (v<-FAST_SWIPE_VELOCITY && p>.10),p);
    }else if(g.kind==='to-preview'){
      const p=clamp(Math.max(0,-dx)/viewportWidth());
      settleMode('to-preview',p>=COMMIT_RATIO || (v<-FAST_SWIPE_VELOCITY && p>.10));
    }
  },{passive:true});

  document.addEventListener('touchcancel',()=>{
    if(!gesture) return;
    const g=gesture; gesture=null;
    if(!g.started) return;
    if(g.kind==='open-pages') settleDrawer(true,false,0);
    else if(g.kind==='close-pages') settleDrawer(false,false,0);
    else if(g.kind==='to-preview') settleMode('to-preview',false);
  },{passive:true});

  // Preview is a same-origin srcdoc iframe. Keep its gesture interactive as
  // well: dragging right physically moves Preview and reveals the editor below.
  function wirePreview(){
    const doc=previewFrame?.contentDocument;
    if(!doc || doc.__tfrGestureV36) return;
    doc.__tfrGestureV36=true;
    let pg=null;

    function blocked(target){
      return !!target?.closest?.('input,textarea,select,[contenteditable=true],.tfr-search-wrap,.tfr-media-tabs,button,a,summary,label');
    }

    doc.addEventListener('touchstart',e=>{
      pg=null;
      if(!isPhone() || e.touches.length!==1 || blocked(e.target)) return;
      const t=e.touches[0];
      const width=Math.max(1,previewFrame.contentWindow?.innerWidth||viewportWidth());
      if(!safeWebStart(t.clientX,width)) return;
      pg={x:t.clientX,y:t.clientY,startedAt:performance.now(),started:false,cancelled:false};
    },{passive:true});

    doc.addEventListener('touchmove',e=>{
      if(!pg || !e.touches.length || pg.cancelled) return;
      const t=e.touches[0],dx=t.clientX-pg.x,dy=t.clientY-pg.y;
      if(!pg.started){
        if(Math.abs(dx)<LOCK_DISTANCE && Math.abs(dy)<LOCK_DISTANCE) return;
        if(Math.abs(dy)>Math.abs(dx)*1.08 || dx<=0){ pg.cancelled=true; return; }
        beginMode('from-preview');
        pg.started=true;
      }
      e.preventDefault();
      setModeProgress('from-preview',Math.max(0,dx)/viewportWidth());
    },{passive:false});

    doc.addEventListener('touchend',e=>{
      if(!pg || !e.changedTouches.length){ pg=null; return; }
      const g=pg; pg=null;
      if(!g.started) return;
      const t=e.changedTouches[0],dx=t.clientX-g.x;
      const dt=Math.max(16,performance.now()-g.startedAt),v=dx/dt;
      const p=clamp(Math.max(0,dx)/viewportWidth());
      settleMode('from-preview',p>=COMMIT_RATIO || (v>FAST_SWIPE_VELOCITY && p>.10));
    },{passive:true});

    doc.addEventListener('touchcancel',()=>{
      if(pg?.started) settleMode('from-preview',false);
      pg=null;
    },{passive:true});
  }

  previewFrame?.addEventListener('load',wirePreview);
  if(previewFrame?.contentDocument?.readyState==='complete') wirePreview();
})();
