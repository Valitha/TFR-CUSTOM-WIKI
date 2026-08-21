(function(){
  'use strict';

  const PHONE = window.matchMedia('(max-width:760px)');
  const SAFARI_EDGE = 28;
  const PAGE_OPEN_ZONE_RATIO = 0.92;
  const LOCK_DISTANCE = 10;
  const COMMIT_RATIO = 0.12;
  const FAST_SWIPE_VELOCITY = 0.20; // px/ms
  const FAST_SWIPE_MIN_PROGRESS = 0.03;
  const MAX_SETTLE_MS = 155;

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
  let visualFrame = 0;
  let pendingVisual = null;

  function isPhone(){ return PHONE.matches; }
  function standalone(){
    return document.documentElement.classList.contains('pwa-standalone') ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
  function viewportWidth(){ return Math.max(1,window.innerWidth || document.documentElement.clientWidth || 390); }
  function measureDrawer(){ return Math.max(1,sidebar?.getBoundingClientRect().width || Math.min(viewportWidth()*.88,360)); }
  function safeWebStart(x,width){ return standalone() || (x>=SAFARI_EDGE && x<=width-SAFARI_EDGE); }
  function isInteractive(target){
    if(!(target instanceof Element)) return false;
    return !!target.closest('input,textarea,select,button,a,summary,[contenteditable=true],.file-btn,.route-flag-picker,.modal,.icon-library-modal,.rich-toolbar,.infobox-mini-toolbar');
  }
  function delay(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
  function nextFrame(){ return new Promise(resolve=>requestAnimationFrame(resolve)); }

  function scheduleVisual(fn){
    // Touchmove is already paced by WebKit. Applying compositor-only transforms
    // immediately avoids adding an extra frame of latency to slow drags.
    pendingVisual=null;
    if(visualFrame){ cancelAnimationFrame(visualFrame); visualFrame=0; }
    fn();
  }
  function flushVisual(){
    if(visualFrame){ cancelAnimationFrame(visualFrame); visualFrame=0; }
    pendingVisual=null;
  }

  function stopSyntheticClick(){ suppressClickUntil=Date.now()+420; }
  document.addEventListener('click',e=>{
    if(!e.isTrusted || Date.now()>suppressClickUntil) return;
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
      sidebar.style.setProperty('transition','none','important');
      backdrop.style.setProperty('transition','none','important');
      return;
    }
    body.classList.remove('mobile-pages-gesture');
    sidebar.classList.remove('mobile-gesture-dragging','mobile-gesture-settling');
    backdrop.classList.remove('mobile-gesture-visible','mobile-gesture-dragging','mobile-gesture-settling');
    sidebar.style.removeProperty('transition');
    sidebar.style.removeProperty('transform');
    backdrop.style.removeProperty('transition');
    backdrop.style.removeProperty('opacity');
  }

  function applyDrawerAmount(amount,width){
    if(!sidebar || !backdrop) return;
    const p=clamp(amount);
    const x=-width*(1-p);
    // The normal drawer rules use !important, so the live gesture must too.
    sidebar.style.setProperty('transform',`translate3d(${x}px,0,0)`,'important');
    backdrop.style.setProperty('opacity',String(.58*p),'important');
  }

  function beginDrawer(g,opening){
    g.drawerWidth=measureDrawer();
    g.progress=opening?0:1;
    drawerStyles(true);
    applyDrawerAmount(g.progress,g.drawerWidth);
  }

  async function settleDrawer(g,commit){
    if(!sidebar || !backdrop) return;
    flushVisual();
    stopSyntheticClick();

    const opening=g.kind==='open-pages';
    const target=opening ? (commit?1:0) : (commit?0:1);
    const current=clamp(g.progress ?? (opening?0:1));
    const distance=Math.abs(target-current);
    const ms=Math.round(Math.min(MAX_SETTLE_MS,95+distance*100));

    sidebar.classList.remove('mobile-gesture-dragging');
    backdrop.classList.remove('mobile-gesture-dragging');
    sidebar.classList.add('mobile-gesture-settling');
    backdrop.classList.add('mobile-gesture-settling');
    sidebar.style.setProperty('transition',`transform ${ms}ms cubic-bezier(.22,.78,.2,1)`,'important');
    backdrop.style.setProperty('transition',`opacity ${Math.max(90,ms-20)}ms ease`,'important');

    await nextFrame();
    applyDrawerAmount(target,g.drawerWidth || measureDrawer());
    await delay(ms+25);

    if(target===1 && !body.classList.contains('mobile-pages-open')){
      mobilePageMenuBtn?.click();
      await nextFrame();
    }
    if(target===0 && body.classList.contains('mobile-pages-open')){
      mobilePageMenuClose?.click();
      await nextFrame();
    }
    drawerStyles(false);
  }

  function modeLayerStyles(kind,active){
    if(!editorPane || !previewPane) return;
    if(active){
      body.classList.add(kind==='to-preview'?'mobile-gesture-to-preview':'mobile-gesture-from-preview');
      body.classList.add('mobile-mode-gesture');
      previewPane.hidden=false;
      if(kind==='from-preview') editorPane.hidden=false;
      previewPane.style.setProperty('transition','none','important');
      previewPane.style.setProperty('will-change','transform','important');
      return;
    }
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

  function applyModeProgress(kind,progress,width){
    if(!previewPane) return;
    const p=clamp(progress);
    // Only move the foreground surface. Moving both full application trees was
    // unnecessarily expensive on iOS and made slow drags look low-framerate.
    const x=kind==='to-preview' ? width*(1-p) : width*p;
    previewPane.style.setProperty('transform',`translate3d(${x}px,0,0)`,'important');
  }

  function beginMode(g,kind){
    g.viewportWidth=viewportWidth();
    g.progress=0;
    modeLayerStyles(kind,true);
    applyModeProgress(kind,0,g.viewportWidth);
  }

  async function waitForPreviewMode(expected,timeout=1200){
    const started=performance.now();
    while(performance.now()-started<timeout){
      if(body.classList.contains('mobile-preview-active')===expected) return true;
      await delay(20);
    }
    return false;
  }

  async function settleMode(g,kind,commit){
    if(!previewPane) return;
    flushVisual();
    const current=clamp(g.progress||0);
    const target=commit?1:0;
    const distance=Math.abs(target-current);
    const ms=Math.round(Math.min(MAX_SETTLE_MS,95+distance*95));
    previewPane.style.setProperty('transition',`transform ${ms}ms cubic-bezier(.22,.78,.2,1)`,'important');

    await nextFrame();
    applyModeProgress(kind,target,g.viewportWidth || viewportWidth());
    await delay(ms+20);

    if(commit){
      if(kind==='to-preview'){
        mobilePreviewBtn?.click();
        await waitForPreviewMode(true);
      }else{
        mobileReturnEdit?.click();
        await waitForPreviewMode(false);
      }
    }
    modeLayerStyles(kind,false);
  }

  function velocity(g,currentX){
    const dt=Math.max(16,performance.now()-g.startedAt);
    return (currentX-g.x)/dt;
  }
  function shouldCommit(progress,velocityValue,direction){
    if(progress>=COMMIT_RATIO) return true;
    return progress>=FAST_SWIPE_MIN_PROGRESS && (direction<0 ? velocityValue<=-FAST_SWIPE_VELOCITY : velocityValue>=FAST_SWIPE_VELOCITY);
  }

  function decideEditorKind(g,dx,dy){
    if(g.kind) return g.kind;
    if(Math.abs(dx)<LOCK_DISTANCE && Math.abs(dy)<LOCK_DISTANCE) return null;
    if(Math.abs(dy)>Math.abs(dx)*1.12){ g.cancelled=true; return null; }
    if(Math.abs(dx)<=Math.abs(dy)*1.08) return null;
    if(g.drawerOpen){
      if(dx<0) return (g.kind='close-pages');
      g.cancelled=true;
      return null;
    }
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
      const onBackdrop=e.target instanceof Element && !!e.target.closest('#mobileDrawerBackdrop');
      // Backdrop/edges are always draggable. Keep form controls inside the panel
      // usable, but any non-control area of the drawer can start the close drag.
      if(!onBackdrop && isInteractive(e.target)) return;
      gesture={kind:null,drawerOpen:true,x:t.clientX,y:t.clientY,startedAt:performance.now(),started:false,cancelled:false,progress:1};
      return;
    }

    if(body.classList.contains('mobile-preview-active')) return; // iframe owns Preview -> Edit.
    if(isInteractive(e.target)) return;

    const width=viewportWidth();
    const safe=safeWebStart(t.clientX,width);
    gesture={
      kind:null,
      drawerOpen:false,
      x:t.clientX,
      y:t.clientY,
      startedAt:performance.now(),
      started:false,
      cancelled:false,
      progress:0,
      canOpenPages:safe && t.clientX<=width*PAGE_OPEN_ZONE_RATIO,
      canPreview:safe
    };
  },{passive:true});

  document.addEventListener('touchmove',e=>{
    if(!gesture || !e.touches.length || gesture.cancelled) return;
    const t=e.touches[0];
    const dx=t.clientX-gesture.x;
    const dy=t.clientY-gesture.y;
    const kind=decideEditorKind(gesture,dx,dy);
    if(!kind) return;

    if(!gesture.started){
      if(kind==='open-pages') beginDrawer(gesture,true);
      else if(kind==='close-pages') beginDrawer(gesture,false);
      else if(kind==='to-preview') beginMode(gesture,'to-preview');
      gesture.started=true;
    }

    e.preventDefault();

    if(kind==='open-pages'){
      gesture.progress=clamp(Math.max(0,dx)/(gesture.drawerWidth||1));
      const p=gesture.progress,w=gesture.drawerWidth;
      scheduleVisual(()=>applyDrawerAmount(p,w));
    }else if(kind==='close-pages'){
      gesture.progress=clamp(1+Math.min(0,dx)/(gesture.drawerWidth||1));
      const p=gesture.progress,w=gesture.drawerWidth;
      scheduleVisual(()=>applyDrawerAmount(p,w));
    }else if(kind==='to-preview'){
      gesture.progress=clamp(Math.max(0,-dx)/(gesture.viewportWidth||1));
      const p=gesture.progress,w=gesture.viewportWidth;
      scheduleVisual(()=>applyModeProgress('to-preview',p,w));
    }
  },{passive:false});

  document.addEventListener('touchend',e=>{
    if(!gesture || !e.changedTouches.length){ gesture=null; return; }
    const g=gesture;
    gesture=null;
    if(!g.started) return;
    const t=e.changedTouches[0];
    const v=velocity(g,t.clientX);

    if(g.kind==='open-pages') settleDrawer(g,shouldCommit(g.progress,v,1));
    else if(g.kind==='close-pages') settleDrawer(g,shouldCommit(1-g.progress,v,-1));
    else if(g.kind==='to-preview') settleMode(g,'to-preview',shouldCommit(g.progress,v,-1));
  },{passive:true});

  document.addEventListener('touchcancel',()=>{
    if(!gesture) return;
    const g=gesture;
    gesture=null;
    if(!g.started) return;
    if(g.kind==='open-pages' || g.kind==='close-pages') settleDrawer(g,false);
    else if(g.kind==='to-preview') settleMode(g,'to-preview',false);
  },{passive:true});

  // Preview is a same-origin srcdoc iframe. Dragging right moves the Preview
  // surface itself, so the editor is visible underneath and the gesture can be
  // reversed before release.
  function wirePreview(){
    const doc=previewFrame?.contentDocument;
    if(!doc || doc.__tfrGestureV38) return;
    doc.__tfrGestureV38=true;
    let pg=null;

    function blocked(target){
      return !!target?.closest?.('input,textarea,select,[contenteditable=true],.tfr-search-wrap,.tfr-media-tabs,button,a,summary,label');
    }

    doc.addEventListener('touchstart',e=>{
      pg=null;
      if(!isPhone() || e.touches.length!==1 || blocked(e.target)) return;
      const t=e.touches[0];
      const width=Math.max(1,previewFrame.contentWindow?.innerWidth || viewportWidth());
      if(!safeWebStart(t.clientX,width)) return;
      pg={x:t.clientX,y:t.clientY,startedAt:performance.now(),started:false,cancelled:false,progress:0,viewportWidth:width};
    },{passive:true});

    doc.addEventListener('touchmove',e=>{
      if(!pg || !e.touches.length || pg.cancelled) return;
      const t=e.touches[0];
      const dx=t.clientX-pg.x;
      const dy=t.clientY-pg.y;
      if(!pg.started){
        if(Math.abs(dx)<LOCK_DISTANCE && Math.abs(dy)<LOCK_DISTANCE) return;
        if(Math.abs(dy)>Math.abs(dx)*1.12 || dx<=0){ pg.cancelled=true; return; }
        beginMode(pg,'from-preview');
        pg.started=true;
      }
      e.preventDefault();
      pg.progress=clamp(Math.max(0,dx)/(pg.viewportWidth||1));
      const p=pg.progress,w=pg.viewportWidth;
      scheduleVisual(()=>applyModeProgress('from-preview',p,w));
    },{passive:false});

    doc.addEventListener('touchend',e=>{
      if(!pg || !e.changedTouches.length){ pg=null; return; }
      const g=pg;
      pg=null;
      if(!g.started) return;
      const t=e.changedTouches[0];
      const dt=Math.max(16,performance.now()-g.startedAt);
      const v=(t.clientX-g.x)/dt;
      settleMode(g,'from-preview',shouldCommit(g.progress,v,1));
    },{passive:true});

    doc.addEventListener('touchcancel',()=>{
      if(pg?.started) settleMode(pg,'from-preview',false);
      pg=null;
    },{passive:true});
  }

  previewFrame?.addEventListener('load',wirePreview);
  if(previewFrame?.contentDocument?.readyState==='complete') wirePreview();
})();
