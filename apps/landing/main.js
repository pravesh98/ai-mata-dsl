/**
 * Aimata DSL Landing Page — main.js
 * Inlined browser-compatible compiler + live demo + copy handlers.
 */

// ─── Inlined compiler (browser shim) ─────────────────────────────────────────
// (Same recursive-descent logic from @aimata-dsl/core, browser-compatible)

function tokenize(source) {
  const tokens = []; let i = 0;
  while (i < source.length) {
    if (source[i] === '<') {
      if (source[i+1] === '/') {
        const end = source.indexOf('>', i);
        if (end===-1) throw new SyntaxError(`Unclosed tag at ${i}`);
        const raw=source.slice(i,end+1);
        tokens.push({type:'TAG_CLOSE',value:raw.slice(2,-1).trim(),raw});
        i=end+1;
      } else if (source[i+1]==='!') {
        const end=source.indexOf('>',i); i=end===-1?source.length:end+1;
      } else {
        const start=i; i++;
        let tag='';
        while(i<source.length&&!/[\s\/>]/.test(source[i]))tag+=source[i++];
        const attrs=[];
        while(i<source.length&&source[i]!=='>'&&!(source[i]==='/'&&source[i+1]==='>')){
          while(i<source.length&&/\s/.test(source[i]))i++;
          if(source[i]==='>'||(source[i]==='/'&&source[i+1]==='>'))break;
          let n='';
          while(i<source.length&&!/[\s=\/>]/.test(source[i]))n+=source[i++];
          if(!n){i++;continue;}
          while(i<source.length&&/\s/.test(source[i]))i++;
          if(source[i]==='='){
            i++;
            while(i<source.length&&/\s/.test(source[i]))i++;
            let v='';
            if(source[i]==='"'||source[i]==="'"){const q=source[i++];while(i<source.length&&source[i]!==q)v+=source[i++];i++;}
            else if(source[i]==='{'){let d=0;while(i<source.length){if(source[i]==='{')d++;else if(source[i]==='}'){d--;if(d===0){i++;break;}}v+=source[i++];}v=v.slice(1);}
            else{while(i<source.length&&!/[\s\/>]/.test(source[i]))v+=source[i++];}
            attrs.push({name:n,value:v});
          } else {attrs.push({name:n,value:'true'});}
        }
        let sc=false;
        if(source[i]==='/'&&source[i+1]==='>'){sc=true;i+=2;}else if(source[i]==='>'){i++;}
        tokens.push({type:'TAG_OPEN',value:tag,attrs,sc,raw:source.slice(start,i)});
      }
    } else {
      let t='';
      while(i<source.length&&source[i]!=='<')t+=source[i++];
      const tr=t.trim();
      if(tr)tokens.push({type:'TEXT',value:tr,raw:t});
    }
  }
  tokens.push({type:'EOF',value:'',raw:''});
  return tokens;
}

function parse(source) {
  const tokens=tokenize(source.trim());
  let c=0;
  const peek=()=>tokens[c];
  const eat=()=>tokens[c++];
  function node(){
    const t=peek();
    if(t.type==='TEXT'){eat();return{type:'text',value:t.value};}
    if(t.type==='TAG_OPEN'){
      eat();
      const sc=t.sc;
      let id=null;const classes=[];const props={};
      for(const a of(t.attrs||[])){
        if(a.name==='id')id=a.value;
        else if(a.name==='className'||a.name==='class')classes.push(...a.value.split(/\s+/).filter(Boolean));
        else props[a.name]=a.value;
      }
      const children=[];
      if(!sc){
        while(peek().type!=='EOF'&&!(peek().type==='TAG_CLOSE'&&peek().value===t.value)){
          const ch=node();if(ch)children.push(ch);
        }
        if(peek().type==='TAG_CLOSE')eat();
      }
      return{type:/^[A-Z]/.test(t.value)?'component':'element',tag:t.value,id,classes,props,children};
    }
    eat();return null;
  }
  const nodes=[];
  while(peek().type!=='EOF'){const n=node();if(n)nodes.push(n);}
  return nodes;
}

function toDSL(n){
  if(n.type==='text')return n.value;
  let s='['+n.tag;
  if(n.id)s+='#'+n.id;
  if(n.classes?.length)s+='.'+n.classes.join('.');
  if(n.props&&Object.keys(n.props).length)s+='{'+Object.entries(n.props).map(([k,v])=>`${k}=${v}`).join(',')+'}';
  if(n.children?.length)s+='|'+n.children.map(toDSL).join('');
  return s+']';
}

function compressToDSL(code){
  const ast=parse(code);
  if(!ast.length)return'';
  return ast.length===1?toDSL(ast[0]):ast.map(toDSL).join('\n');
}

function parseDSLNode(dsl){
  let inner=dsl.slice(1,-1);
  let cr='',depth=0,pi=-1;
  for(let i=0;i<inner.length;i++){
    if(inner[i]==='[')depth++;else if(inner[i]===']')depth--;
    else if(inner[i]==='|'&&depth===0){pi=i;break;}
  }
  if(pi!==-1){cr=inner.slice(pi+1);inner=inner.slice(0,pi);}
  let pr='';
  const pm=inner.match(/\{([^}]*)\}$/);
  if(pm){pr=pm[1];inner=inner.slice(0,inner.lastIndexOf('{'));}
  const idm=inner.match(/#([^.]+)/);
  const id=idm?idm[1]:null;
  if(idm)inner=inner.replace(/#[^.]+/,'');
  const pts=inner.split('.');
  const tag=pts[0];const classes=pts.slice(1).filter(Boolean);
  const props={};
  if(pr)pr.split(',').forEach(e=>{const ei=e.indexOf('=');if(ei===-1)props[e.trim()]='true';else{props[e.slice(0,ei).trim()]=e.slice(ei+1).trim();}});
  return{tag,id,classes,props,childrenRaw:cr};
}

function splitCh(raw){
  const parts=[];let i=0;let t='';
  while(i<raw.length){
    if(raw[i]==='['){if(t){parts.push({type:'text',value:t});t='';}
      let d=0,s=i;
      while(i<raw.length){if(raw[i]==='[')d++;else if(raw[i]===']'){d--;if(d===0){i++;break;}}i++;}
      parts.push({type:'dsl',value:raw.slice(s,i)});
    } else {t+=raw[i++];}
  }
  if(t.trim())parts.push({type:'text',value:t.trim()});
  return parts;
}

function expandDSL(dsl,target='react',indent=0){
  const pad='  '.repeat(indent);
  const {tag,id,classes,props,childrenRaw}=parseDSLNode(dsl);
  const ht=target==='html'&&/^[A-Z]/.test(tag)?'div':tag;
  const clsAttr=target==='react'?'className':'class';
  let out=`${pad}<${ht}`;
  if(id)out+=` id="${id}"`;
  if(classes.length)out+=` ${clsAttr}="${classes.join(' ')}"`;
  for(const[k,v]of Object.entries(props)){
    if(target==='html'&&k.startsWith('on'))out+=` data-${k.toLowerCase()}="${v}"`;
    else if(v==='true')out+=` ${k}`;
    else if(target==='react'&&/^[a-zA-Z_$]/.test(v)&&!/"'/.test(v))out+=` ${k}={${v}}`;
    else out+=` ${k}="${v}"`;
  }
  const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  if(!childrenRaw){out+=VOID.has(ht)?' />':`/>`;return out;}
  out+='>';
  const ch=splitCh(childrenRaw);
  if(!ch.some(c=>c.type==='dsl')){out+=ch.map(c=>c.value).join('')+`</${ht}>`;}
  else{out+='\n';ch.forEach(c=>{if(c.type==='dsl')out+=expandDSL(c.value,target,indent+1)+'\n';else if(c.value.trim())out+='  '.repeat(indent+1)+c.value.trim()+'\n';});out+=pad+`</${ht}>`;}
  return out;
}

function expandFromDSL(dsl,target='react'){
  const lines=dsl.trim().split('\n').map(l=>l.trim()).filter(l=>l.startsWith('['));
  return (lines.length?lines:[dsl]).map(n=>expandDSL(n,target,0)).join('\n');
}

// ─── DSL Syntax Highlighter ───────────────────────────────────────────────────
function highlight(dsl){
  if(!dsl)return'';
  let s=dsl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s=s.replace(/(\[)/g,'<span class="dsl-bracket">$1</span>');
  s=s.replace(/(\])/g,'<span class="dsl-bracket">$1</span>');
  s=s.replace(/(\|)/g,'<span class="dsl-pipe">$1</span>');
  s=s.replace(/(<span class="dsl-bracket">\[<\/span>)([A-Za-z][A-Za-z0-9-]*)/, '$1<span class="dsl-tag">$2</span>');
  s=s.replace(/(#[A-Za-z][A-Za-z0-9_-]*)/g,'<span class="dsl-id">$1</span>');
  s=s.replace(/(\.[A-Za-z][A-Za-z0-9:_/-]*)/g,'<span class="dsl-class">$1</span>');
  s=s.replace(/\{([^}]+)\}/g,(m,inner)=>{
    const si=inner.replace(/([^,=]+)(=)([^,]+)/g,'<span class="dsl-prop-key">$1</span><span class="dsl-prop-eq">$2</span><span class="dsl-prop-val">$3</span>');
    return`<span class="dsl-bracket">{</span>${si}<span class="dsl-bracket">}</span>`;
  });
  return s;
}

// ─── Examples ─────────────────────────────────────────────────────────────────
const EXAMPLES = {
  button: `<button
  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg"
  onClick={handleSubmit}
  type="submit"
>
  Get Started
</button>`,

  card: `<div id="feature-card" className="rounded-2xl border border-gray-100 bg-white shadow-md p-8 hover:shadow-xl transition-shadow">
  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
    <span className="text-blue-600 text-xl">⬡</span>
  </div>
  <h3 className="text-xl font-bold text-gray-900 mb-2">Token Compression</h3>
  <p className="text-gray-500 leading-relaxed">Reduce JSX verbosity by 2-3× before sending to AI models.</p>
</div>`,

  nav: `<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
  <a href="/" className="text-white font-bold text-lg tracking-tight">aimata<span className="text-blue-400">dsl</span></a>
  <div className="flex items-center gap-6">
    <a href="/docs" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Docs</a>
    <a href="/studio" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">Studio</a>
  </div>
</nav>`,
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const demoInput  = document.getElementById('demo-input');
const demoDSL    = document.getElementById('demo-dsl');
const demoRatio  = document.getElementById('demo-ratio');
const tabs       = document.querySelectorAll('.demo-tab');
const copyInstall = document.getElementById('copy-install');
const pkgCopies  = document.querySelectorAll('.pkg-copy');

// ─── Demo live compile ────────────────────────────────────────────────────────
let demoTimer = null;

function runDemo() {
  const code = demoInput.value.trim();
  if (!code) { demoDSL.innerHTML = ''; demoRatio.textContent = ''; return; }
  try {
    const dsl = compressToDSL(code);
    demoDSL.innerHTML = highlight(dsl);
    const ratio = (code.length / dsl.length).toFixed(1);
    const saving = Math.round((1 - dsl.length / code.length) * 100);
    demoRatio.textContent = `${ratio}× — ${saving}% smaller`;
  } catch(e) {
    demoDSL.innerHTML = `<span style="color:var(--red)">// ${e.message}</span>`;
    demoRatio.textContent = '';
  }
}

demoInput.addEventListener('input', () => {
  clearTimeout(demoTimer);
  demoTimer = setTimeout(runDemo, 200);
});

// ─── Example tabs ─────────────────────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected','true');
    demoInput.value = EXAMPLES[tab.dataset.example] || '';
    runDemo();
  });
});

// ─── Copy handlers ────────────────────────────────────────────────────────────
async function copyText(text, btn, originalLabel) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = originalLabel; }, 1500);
  } catch { /* clipboard blocked */ }
}

copyInstall?.addEventListener('click', () => {
  copyText('npm install @aimata-dsl/core', copyInstall, '⎘');
});

pkgCopies.forEach(btn => {
  btn.addEventListener('click', () => {
    copyText(btn.dataset.copy, btn, '⎘');
  });
});

// ─── Init ────────────────────────────────────────────────────────────────────
demoInput.value = EXAMPLES.button;
runDemo();
