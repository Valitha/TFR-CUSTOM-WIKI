const tags=new Set(['P','BR','B','STRONG','I','EM','U','A','SPAN','UL','OL','LI','BLOCKQUOTE','IMG']);
function isPurple(value){
  const v=String(value||'').toLowerCase().replace(/\s+/g,'');
  return v.includes('#b75dcc')||v.includes('rgb(183,93,204)')||v.includes('rgb(183, 93, 204)');
}
export function sanitize(html){
  const t=document.createElement('template');
  t.innerHTML=String(html||'');
  const walk=n=>{
    for(const c of [...n.children]){
      if(c.tagName==='FONT'){
        const span=document.createElement('span');
        if(isPurple(c.getAttribute('color')))span.className='purple-text';
        while(c.firstChild)span.appendChild(c.firstChild);
        c.replaceWith(span);
        walk(span);
        continue;
      }
      if(c.tagName==='SPAN'&&isPurple(c.getAttribute('style'))){
        c.className='purple-text';
      }
      if(!tags.has(c.tagName)){
        c.replaceWith(...c.childNodes);
        continue;
      }
      for(const a of [...c.attributes]){
        if(c.tagName==='A'&&['href','title'].includes(a.name))continue;
        if(c.tagName==='SPAN'&&a.name==='class'&&a.value==='purple-text')continue;
        if(c.tagName==='IMG'&&['src','alt','class'].includes(a.name))continue;
        c.removeAttribute(a.name);
      }
      if(c.tagName==='A'){
        const h=c.getAttribute('href')||'';
        if(!/^(https?:|mailto:|#)/i.test(h))c.removeAttribute('href');
      }
      if(c.tagName==='IMG'){
        const s=c.getAttribute('src')||'';
        if(!/^data:image\//i.test(s)){c.remove();continue}
        c.className='inline-icon';
      }
      walk(c);
    }
  };
  walk(t.content);
  return t.innerHTML;
}
