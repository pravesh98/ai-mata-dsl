/**
 * Aimata Studio — src/main.js
 *
 * Split-pane DSL playground.
 * Self-contained: imports the compiler from a module shim for the browser.
 */

// ─── Inline compiler shim (browser-compatible) ────────────────────────────────
// We inline the core compiler logic here since the studio is a static app
// without a build step. In production, you'd bundle @aimata-dsl/core.

// ── Parser ──
function tokenize(source) {
  const tokens = [];
  let i = 0;
  const TOKEN = { TAG_OPEN_START:'TAG_OPEN_START', TAG_OPEN_END:'TAG_OPEN_END', TAG_CLOSE:'TAG_CLOSE', ATTR:'ATTR', TEXT:'TEXT', EOF:'EOF' };
  while (i < source.length) {
    if (source[i] === '<') {
      if (source[i+1] === '/') {
        const end = source.indexOf('>', i);
        if (end === -1) throw new SyntaxError(`Unclosed closing tag at ${i}`);
        const raw = source.slice(i, end+1);
        tokens.push({ type: TOKEN.TAG_CLOSE, value: raw.slice(2, -1).trim(), raw });
        i = end + 1;
      } else if (source[i+1] === '!') {
        const end = source.indexOf('>', i);
        i = end === -1 ? source.length : end + 1;
      } else {
        const tagStart = i; i++;
        let tagName = '';
        while (i < source.length && !/[\s\/>]/.test(source[i])) tagName += source[i++];
        const attrs = [];
        while (i < source.length && source[i] !== '>' && !(source[i]==='/' && source[i+1]==='>')) {
          while (i < source.length && /\s/.test(source[i])) i++;
          if (source[i]==='>' || (source[i]==='/' && source[i+1]==='>')) break;
          let attrName = '';
          while (i < source.length && !/[\s=\/>]/.test(source[i])) attrName += source[i++];
          if (!attrName) { i++; continue; }
          while (i < source.length && /\s/.test(source[i])) i++;
          if (source[i] === '=') {
            i++;
            while (i < source.length && /\s/.test(source[i])) i++;
            let attrValue = '';
            if (source[i] === '"' || source[i] === "'") {
              const q = source[i++];
              while (i < source.length && source[i] !== q) attrValue += source[i++];
              i++;
            } else if (source[i] === '{') {
              let depth = 0;
              while (i < source.length) {
                if (source[i]==='{') depth++; else if (source[i]==='}') { depth--; if(depth===0){i++;break;} }
                attrValue += source[i++];
              }
              attrValue = attrValue.slice(1);
            } else {
              while (i < source.length && !/[\s\/>]/.test(source[i])) attrValue += source[i++];
            }
            attrs.push({ type: TOKEN.ATTR, name: attrName, value: attrValue });
          } else {
            attrs.push({ type: TOKEN.ATTR, name: attrName, value: 'true' });
          }
        }
        let selfClosing = false;
        if (source[i]==='/' && source[i+1]==='>') { selfClosing=true; i+=2; } else if (source[i]==='>') i++;
        tokens.push({ type: TOKEN.TAG_OPEN_START, value: tagName, attrs, raw: source.slice(tagStart, i) });
        tokens.push({ type: TOKEN.TAG_OPEN_END, value: selfClosing ? '/>' : '>', raw: selfClosing ? '/>' : '>' });
      }
    } else {
      let text = '';
      while (i < source.length && source[i] !== '<') text += source[i++];
      const trimmed = text.trim();
      if (trimmed) tokens.push({ type: TOKEN.TEXT, value: trimmed, raw: text });
    }
  }
  tokens.push({ type: TOKEN.EOF, value: '', raw: '' });
  return tokens;
}

function parse(source) {
  const tokens = tokenize(source.trim());
  let cursor = 0;
  const TOKEN = { TAG_OPEN_START:'TAG_OPEN_START', TAG_OPEN_END:'TAG_OPEN_END', TAG_CLOSE:'TAG_CLOSE', TEXT:'TEXT', EOF:'EOF' };
  function peek() { return tokens[cursor]; }
  function consume() { return tokens[cursor++]; }
  function parseNode() {
    const token = peek();
    if (token.type === TOKEN.TEXT) { consume(); return { type:'text', value: token.value }; }
    if (token.type === TOKEN.TAG_OPEN_START) {
      consume(); const openEnd = consume(); const selfClosing = openEnd.value === '/>';
      const tagName = token.value; const isComponent = /^[A-Z]/.test(tagName);
      let id = null; const classes = []; const props = {};
      for (const attr of (token.attrs||[])) {
        if (attr.name==='id') { id = attr.value; }
        else if (attr.name==='className'||attr.name==='class') { classes.push(...attr.value.split(/\s+/).filter(Boolean)); }
        else { props[attr.name] = attr.value; }
      }
      const children = [];
      if (!selfClosing) {
        while (peek().type !== TOKEN.EOF && !(peek().type===TOKEN.TAG_CLOSE && peek().value===tagName)) {
          const child = parseNode(); if (child) children.push(child);
        }
        if (peek().type === TOKEN.TAG_CLOSE) consume();
      }
      return { type: isComponent?'component':'element', tag: tagName, id, classes, props, children, raw: token.raw };
    }
    consume(); return null;
  }
  const nodes = [];
  while (peek().type !== TOKEN.EOF) { const n = parseNode(); if (n) nodes.push(n); }
  return nodes;
}

// ── Compiler ──
function nodeToDSL(node) {
  if (node.type==='text') return node.value;
  let dsl = '[' + node.tag;
  if (node.id) dsl += '#' + node.id;
  if (node.classes?.length) dsl += '.' + node.classes.join('.');
  if (node.props && Object.keys(node.props).length) {
    dsl += '{' + Object.entries(node.props).map(([k,v])=>`${k}=${v}`).join(',') + '}';
  }
  if (node.children?.length) dsl += '|' + node.children.map(nodeToDSL).join('');
  dsl += ']';
  return dsl;
}

function compressToDSL(code) {
  const ast = parse(code);
  if (!ast.length) return '';
  return ast.length===1 ? nodeToDSL(ast[0]) : ast.map(nodeToDSL).join('\n');
}

function parseDSLNode(dsl) {
  let inner = dsl.slice(1,-1);
  let childrenRaw=''; let depth=0; let pipeIdx=-1;
  for (let i=0;i<inner.length;i++) {
    if(inner[i]==='[')depth++; else if(inner[i]===']')depth--;
    else if(inner[i]==='|'&&depth===0){pipeIdx=i;break;}
  }
  if(pipeIdx!==-1){childrenRaw=inner.slice(pipeIdx+1);inner=inner.slice(0,pipeIdx);}
  let propsRaw='';
  const pm=inner.match(/\{([^}]*)\}$/);
  if(pm){propsRaw=pm[1];inner=inner.slice(0,inner.lastIndexOf('{'));}
  const idm=inner.match(/#([^.]+)/);
  const id=idm?idm[1]:null;
  if(idm)inner=inner.replace(/#[^.]+/,'');
  const parts=inner.split('.');
  const tag=parts[0]; const classes=parts.slice(1).filter(Boolean);
  const props={};
  if(propsRaw){
    propsRaw.split(',').forEach(e=>{const ei=e.indexOf('=');if(ei===-1)props[e.trim()]='true';else{props[e.slice(0,ei).trim()]=e.slice(ei+1).trim();}});
  }
  return {tag,id,classes,props,childrenRaw};
}

function splitChildren(raw) {
  const parts=[]; let i=0; let text='';
  while(i<raw.length){
    if(raw[i]==='['){if(text){parts.push({type:'text',value:text});text='';}
      let depth=0; let start=i;
      while(i<raw.length){if(raw[i]==='[')depth++;else if(raw[i]===']'){depth--;if(depth===0){i++;break;}}i++;}
      parts.push({type:'dsl',value:raw.slice(start,i)});
    } else { text+=raw[i++]; }
  }
  if(text.trim())parts.push({type:'text',value:text.trim()});
  return parts;
}

function dslToJSX(dsl,indent=0){
  const pad='  '.repeat(indent);
  const {tag,id,classes,props,childrenRaw}=parseDSLNode(dsl);
  let jsx=`${pad}<${tag}`;
  if(id)jsx+=` id="${id}"`;
  if(classes.length)jsx+=` className="${classes.join(' ')}"`;
  for(const[k,v]of Object.entries(props)){
    if(v==='true')jsx+=` ${k}`;
    else if(/^[a-zA-Z_$]/.test(v)&&!/"'/.test(v))jsx+=` ${k}={${v}}`;
    else jsx+=` ${k}="${v}"`;
  }
  const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  if(!childrenRaw){jsx+=VOID.has(tag)?' />':` />`; return jsx;}
  jsx+='>';
  const children=splitChildren(childrenRaw);
  if(!children.some(c=>c.type==='dsl')){jsx+=children.map(c=>c.value).join('')+`</${tag}>`;}
  else{jsx+='\n';children.forEach(c=>{if(c.type==='dsl')jsx+=dslToJSX(c.value,indent+1)+'\n';else if(c.value.trim())jsx+='  '.repeat(indent+1)+c.value.trim()+'\n';});jsx+=pad+`</${tag}>`;}
  return jsx;
}

function dslToHTML(dsl,indent=0){
  const pad='  '.repeat(indent);
  const {tag,id,classes,props,childrenRaw}=parseDSLNode(dsl);
  const htmlTag=/^[A-Z]/.test(tag)?'div':tag;
  let html=`${pad}<${htmlTag}`;
  if(id)html+=` id="${id}"`;
  if(classes.length)html+=` class="${classes.join(' ')}"`;
  for(const[k,v]of Object.entries(props)){
    if(k.startsWith('on'))html+=` data-${k.toLowerCase()}="${v}"`;
    else if(v==='true')html+=` ${k}`;
    else html+=` ${k}="${v}"`;
  }
  const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  if(VOID.has(htmlTag)){html+=' />';return html;}
  if(!childrenRaw){html+=`></${htmlTag}>`;return html;}
  html+='>';
  const children=splitChildren(childrenRaw);
  if(!children.some(c=>c.type==='dsl')){html+=children.map(c=>c.value).join('')+`</${htmlTag}>`;}
  else{html+='\n';children.forEach(c=>{if(c.type==='dsl')html+=dslToHTML(c.value,indent+1)+'\n';else if(c.value.trim())html+='  '.repeat(indent+1)+c.value.trim()+'\n';});html+=pad+`</${htmlTag}>`;}
  return html;
}

function expandFromDSL(dsl, target='react') {
  const lines=dsl.trim().split('\n').map(l=>l.trim()).filter(l=>l.startsWith('['));
  const expand=target==='react'?dslToJSX:dslToHTML;
  return (lines.length?lines:[dsl]).map(n=>expand(n,0)).join('\n');
}

// ─── DSL Syntax Highlighter ───────────────────────────────────────────────────
function highlightDSL(dsl) {
  if (!dsl || !dsl.trim()) return '';
  // Escape HTML entities first
  let escaped = dsl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Highlight bracket notation with regex
  // [tag#id.cls{k=v}|children]
  escaped = escaped.replace(/(\[)/g, '<span class="dsl-bracket">$1</span>');
  escaped = escaped.replace(/(\])/g, '<span class="dsl-bracket">$1</span>');
  escaped = escaped.replace(/(\|)/g, '<span class="dsl-pipe">$1</span>');

  // Tag names after [
  escaped = escaped.replace(
    /(<span class="dsl-bracket">\[<\/span>)([A-Za-z][A-Za-z0-9-]*)/g,
    '$1<span class="dsl-tag">$2</span>'
  );

  // #id
  escaped = escaped.replace(/(#[A-Za-z][A-Za-z0-9_-]*)/g, '<span class="dsl-id">$1</span>');

  // .classes
  escaped = escaped.replace(/(\.[A-Za-z][A-Za-z0-9:_/-]*)/g, '<span class="dsl-class">$1</span>');

  // {props}
  escaped = escaped.replace(/\{([^}]+)\}/g, (match, inner) => {
    const styledInner = inner.replace(
      /([^,=]+)(=)([^,]+)/g,
      '<span class="dsl-prop-key">$1</span><span class="dsl-prop-eq">$2</span><span class="dsl-prop-val">$3</span>'
    );
    return `<span class="dsl-bracket">{</span>${styledInner}<span class="dsl-bracket">}</span>`;
  });

  return escaped;
}

// ─── Stats Calculation ────────────────────────────────────────────────────────
function calcStats(input, dsl) {
  const inLen = input.length;
  const outLen = dsl.length;
  const inTok = input.split(/\s+|(?=[^a-zA-Z0-9])|(?<=[^a-zA-Z0-9])/).filter(Boolean).length;
  const outTok = dsl.split(/\s+|(?=[^a-zA-Z0-9])|(?<=[^a-zA-Z0-9])/).filter(Boolean).length;
  return {
    charRatio: outLen > 0 ? (inLen / outLen).toFixed(2) : '—',
    tokenSaving: outTok > 0 ? `${Math.round((1 - outTok/inTok)*100)}%` : '—',
    inChars: inLen,
    outChars: outLen,
  };
}

// ─── DOM References ───────────────────────────────────────────────────────────
const inputEditor    = document.getElementById('input-editor');
const dslOutput      = document.getElementById('dsl-output');
const expandOutput   = document.getElementById('expand-output');
const errorBanner    = document.getElementById('error-banner');
const statRatio      = document.getElementById('stat-ratio');
const statSaving     = document.getElementById('stat-saving');
const statIn         = document.getElementById('stat-in');
const statOut        = document.getElementById('stat-out');
const statusText     = document.getElementById('status-text');
const frameworkBtns  = document.querySelectorAll('.framework-btn');
const clearBtn       = document.getElementById('btn-clear');
const copyDslBtn     = document.getElementById('btn-copy-dsl');
const workspace      = document.getElementById('workspace');

let currentFramework = 'react';
let currentDSL = '';
let debounceTimer = null;

// ─── Framework Toggle ─────────────────────────────────────────────────────────
frameworkBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    frameworkBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFramework = btn.dataset.fw;
    if (currentDSL) renderExpanded(currentDSL);
  });
});

// ─── Core Compile Pipeline ────────────────────────────────────────────────────
function compile() {
  const code = inputEditor.value.trim();
  errorBanner.classList.remove('visible');
  workspace.classList.remove('processing');

  if (!code) {
    dslOutput.innerHTML = '';
    expandOutput.value = '';
    currentDSL = '';
    updateStats('', '');
    return;
  }

  try {
    workspace.classList.add('processing');
    const dsl = compressToDSL(code);
    currentDSL = dsl;

    // Highlighted DSL
    dslOutput.innerHTML = highlightDSL(dsl);

    // Expanded code
    renderExpanded(dsl);

    // Stats
    const s = calcStats(code, dsl);
    updateStats(s, code);

    statusText.textContent = 'Ready';
  } catch (err) {
    errorBanner.textContent = `⚠ Parse error: ${err.message}`;
    errorBanner.classList.add('visible');
    statusText.textContent = 'Error';
  } finally {
    workspace.classList.remove('processing');
  }
}

function renderExpanded(dsl) {
  try {
    expandOutput.value = expandFromDSL(dsl, currentFramework);
  } catch(e) {
    expandOutput.value = `// Expansion error: ${e.message}`;
  }
}

function updateStats(s, code) {
  if (!code) {
    statRatio.textContent = '—';
    statSaving.textContent = '—';
    statIn.textContent = '0';
    statOut.textContent = '0';
  } else {
    statRatio.textContent = s.charRatio + 'x';
    statSaving.textContent = s.tokenSaving;
    statIn.textContent = s.inChars;
    statOut.textContent = s.outChars;
    const highlight = parseFloat(s.charRatio) > 1.5;
    statRatio.classList.toggle('highlight', highlight);
    statSaving.classList.toggle('highlight', true);
  }
}

// ─── Debounced Input ──────────────────────────────────────────────────────────
inputEditor.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  statusText.textContent = 'Compiling…';
  debounceTimer = setTimeout(compile, 250);
});

// ─── Clear ────────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
  inputEditor.value = '';
  dslOutput.innerHTML = '';
  expandOutput.value = '';
  currentDSL = '';
  updateStats(null, '');
  errorBanner.classList.remove('visible');
  statusText.textContent = 'Ready';
  inputEditor.focus();
});

// ─── Copy DSL ─────────────────────────────────────────────────────────────────
copyDslBtn.addEventListener('click', async () => {
  if (!currentDSL) return;
  try {
    await navigator.clipboard.writeText(currentDSL);
    const orig = copyDslBtn.textContent;
    copyDslBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyDslBtn.textContent = orig; }, 1500);
  } catch { /* clipboard not available */ }
});

// ─── Tab key support in textarea ──────────────────────────────────────────────
inputEditor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = inputEditor.selectionStart;
    const v = inputEditor.value;
    inputEditor.value = v.slice(0, s) + '  ' + v.slice(inputEditor.selectionEnd);
    inputEditor.selectionStart = inputEditor.selectionEnd = s + 2;
  }
});

// ─── Seed with example ───────────────────────────────────────────────────────
const EXAMPLE = `<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
  <div id="hero-card" className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-10 max-w-md w-full">
    <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Aimata DSL</h1>
    <p className="text-slate-300 text-lg mb-8 leading-relaxed">Token-optimized micro-DSL for AI-assisted UI generation.</p>
    <div className="flex gap-3">
      <button className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors" onClick={handleGetStarted}>
        Get Started
      </button>
      <button className="px-6 py-3 border border-white/30 hover:border-white/60 text-white rounded-xl transition-colors" onClick={handleDocs}>
        Docs
      </button>
    </div>
  </div>
</div>`;

inputEditor.value = EXAMPLE;
compile();
