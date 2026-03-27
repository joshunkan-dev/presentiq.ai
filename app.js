const STORAGE_KEY = 'presentiq.clone.v5';
const DEFAULT_TEXT = { title: 'Click to add title', subtitle: 'Click to add subtitle', body: 'Click to add body text' };

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function baseTextbox(kind, overrides = {}) {
  const map = {
    title: { x: 70, y: 90, w: 820, h: 112, text: DEFAULT_TEXT.title, className: 'titlebox' },
    subtitle: { x: 70, y: 210, w: 820, h: 94, text: DEFAULT_TEXT.subtitle, className: 'subtitlebox' },
    body: { x: 70, y: 220, w: 820, h: 250, text: DEFAULT_TEXT.body, className: 'bodybox' },
  };
  return { id: uid(), kind, type: 'textbox', className: map[kind].className, x: map[kind].x, y: map[kind].y, w: map[kind].w, h: map[kind].h, rotation: 0, fill: 'transparent', text: map[kind].text, isPlaceholder: true };
}

function createSlide(overrides = {}) {
  return { notes: '', cue: 'next', layout: 'title-subtitle', theme: 'aurora', transition: 'fade', background: '#ffffff', skip: false, elements: [baseTextbox('title'), baseTextbox('subtitle')], ...overrides };
}

const state = { deckTitle: 'Untitled presentation', slides: [createSlide()], active: 0, zoom: 1, history: [], future: [], selectedElementId: null, copiedSlide: null, selectedSlideIndex: 0, presenting: false, listening: false, recognition: null, textEditing: false };

const el = {
  menuRow: document.querySelector('.menu-row'),
  deckTitleInput: document.getElementById('deckTitleInput'),
  searchInput: document.getElementById('searchInput'), addSlideBtn: document.getElementById('addSlideBtn'), undoBtn: document.getElementById('undoBtn'), redoBtn: document.getElementById('redoBtn'),
  zoomSelect: document.getElementById('zoomSelect'), insertTextBtn: document.getElementById('insertTextBtn'), insertShapeBtn: document.getElementById('insertShapeBtn'), insertLineBtn: document.getElementById('insertLineBtn'), commentBtn: document.getElementById('commentBtn'), shapePicker: document.getElementById('shapePicker'),
  slideStyleTools: document.getElementById('slideStyleTools'), textTools: document.getElementById('textTools'),
  bgColorInput: document.getElementById('bgColorInput'), layoutSelect: document.getElementById('layoutSelect'), themeSelect: document.getElementById('themeSelect'), transitionSelect: document.getElementById('transitionSelect'),
  fontFamilySelect: document.getElementById('fontFamilySelect'), fontSizeSelect: document.getElementById('fontSizeSelect'), boldBtn: document.getElementById('boldBtn'), italicBtn: document.getElementById('italicBtn'), underlineBtn: document.getElementById('underlineBtn'), textColorInput: document.getElementById('textColorInput'), highlightColorInput: document.getElementById('highlightColorInput'), alignSelect: document.getElementById('alignSelect'), lineSpacingSelect: document.getElementById('lineSpacingSelect'), bulletsBtn: document.getElementById('bulletsBtn'),
  presentBtn: document.getElementById('presentBtn'), slideList: document.getElementById('slideList'), slideCanvas: document.getElementById('slideCanvas'), speakerNotes: document.getElementById('speakerNotes'), cueInput: document.getElementById('cueInput'), selectedColorInput: document.getElementById('selectedColorInput'), selectedRotateInput: document.getElementById('selectedRotateInput'),
  presentOverlay: document.getElementById('presentOverlay'), presentSlide: document.getElementById('presentSlide'), prevBtn: document.getElementById('prevBtn'), nextBtn: document.getElementById('nextBtn'), listenBtn: document.getElementById('listenBtn'), exitBtn: document.getElementById('exitBtn'), listenStatus: document.getElementById('listenStatus'), presentCue: document.getElementById('presentCue'),
  micDialog: document.getElementById('micDialog'), micYesBtn: document.getElementById('micYesBtn'), micNoBtn: document.getElementById('micNoBtn'), imageDialog: document.getElementById('imageDialog'), imageUrlInput: document.getElementById('imageUrlInput'), imageInsertBtn: document.getElementById('imageInsertBtn'), imageCancelBtn: document.getElementById('imageCancelBtn'),
};

function currentSlide() { return state.slides[state.active]; }
function findElement(id) { return currentSlide().elements.find((x) => x.id === id); }
function snapshot() { return JSON.stringify({ deckTitle: state.deckTitle, slides: state.slides, active: state.active, zoom: state.zoom, selectedElementId: state.selectedElementId }); }
function saveHistory() { state.history.push(snapshot()); if (state.history.length > 120) state.history.shift(); state.future = []; }
function restore(raw) { const d = JSON.parse(raw); Object.assign(state, { deckTitle: d.deckTitle, slides: d.slides, active: d.active, zoom: d.zoom, selectedElementId: d.selectedElementId }); renderAll(); }
function undo() { if (!state.history.length) return; state.future.push(snapshot()); restore(state.history.pop()); }
function redo() { if (!state.future.length) return; state.history.push(snapshot()); restore(state.future.pop()); }
function persist() { localStorage.setItem(STORAGE_KEY, snapshot()); }
function load() { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; try { restore(raw); } catch {} }

function setTextToolbarVisible(visible) {
  state.textEditing = visible;
  el.textTools.classList.toggle('hidden', !visible);
  el.slideStyleTools.classList.toggle('hidden', visible);
}

function applyLayout(layout) {
  const slide = currentSlide();
  slide.layout = layout;
  const bases = [baseTextbox('title'), layout === 'title-body' ? baseTextbox('body') : baseTextbox('subtitle')];
  slide.elements = [...bases, ...slide.elements.filter((e) => !['title', 'subtitle', 'body'].includes(e.kind))];
}

function renderSlideList() {
  el.slideList.innerHTML = '';
  state.slides.forEach((slide, idx) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.index = String(idx);
    li.className = idx === state.active ? 'active' : '';
    const title = slide.elements.find((e) => e.kind === 'title')?.text || 'Untitled';
    li.innerHTML = `<span>${idx + 1}</span><div class="slide-thumb ${slide.skip ? 'skip' : ''}">${title}</div>`;
    li.addEventListener('click', () => { state.active = idx; state.selectedSlideIndex = idx; state.selectedElementId = null; setTextToolbarVisible(false); renderAll(); });
    li.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(idx)));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain')); const to = idx;
      if (from === to) return;
      saveHistory();
      const [moved] = state.slides.splice(from, 1);
      state.slides.splice(to, 0, moved);
      state.active = to;
      state.selectedSlideIndex = to;
      renderAll();
    });
    el.slideList.appendChild(li);
  });
}

function createElementNode(item, present = false) {
  const n = document.createElement('div');
  n.className = `element ${item.type} ${item.className || ''}`;
  if (!present && state.selectedElementId === item.id) n.classList.add('selected');
  n.dataset.id = item.id;
  Object.assign(n.style, { left: `${item.x}px`, top: `${item.y}px`, width: `${item.w}px`, height: `${item.h}px`, transform: `rotate(${item.rotation || 0}deg)` });

  const c = document.createElement('div');
  c.className = 'content';
  c.dataset.id = item.id;

  if (item.type === 'textbox') {
    c.contentEditable = present ? 'false' : 'true';
    c.style.whiteSpace = 'pre-wrap';
    c.textContent = item.text;
    c.style.background = item.fill || 'transparent';
    c.style.lineHeight = item.lineHeight || '1';
    c.style.fontFamily = item.fontFamily || 'Arial';
    c.style.fontSize = item.fontSize || '32px';
    c.style.textAlign = item.align || 'left';
  } else if (item.type === 'shape' || item.type === 'line') {
    c.style.background = item.fill || '#3f8b5a';
  } else if (item.type === 'image') {
    c.innerHTML = `<img src="${item.src}" alt="Inserted" style="width:100%;height:100%;object-fit:cover;"/>`;
  }

  n.appendChild(c);

  if (!present) {
    const handle = document.createElement('div'); handle.className = 'handle'; handle.dataset.handle = 'resize'; n.appendChild(handle);
    const rotate = document.createElement('div'); rotate.className = 'rotate'; rotate.dataset.handle = 'rotate'; n.appendChild(rotate);
  }

  return n;
}

function renderCanvas() {
  const s = currentSlide();
  el.slideCanvas.className = `slide-canvas theme-${s.theme}`;
  el.slideCanvas.style.background = s.background;
  el.slideCanvas.style.transform = `scale(${state.zoom})`;
  el.slideCanvas.innerHTML = '';
  s.elements.forEach((it) => el.slideCanvas.appendChild(createElementNode(it)));
}

function renderInspector() {
  const s = currentSlide();
  el.deckTitleInput.value = state.deckTitle;
  el.zoomSelect.value = String(state.zoom);
  el.bgColorInput.value = s.background;
  el.layoutSelect.value = s.layout;
  el.themeSelect.value = s.theme;
  el.transitionSelect.value = s.transition;
  el.cueInput.value = s.cue;
  el.speakerNotes.value = s.notes;

  const selected = findElement(state.selectedElementId);
  if (selected) {
    el.selectedColorInput.value = selected.fill || '#3f8b5a';
    el.selectedRotateInput.value = `${Math.round(selected.rotation || 0)}`;
  }
}

function renderPresent() {
  const s = currentSlide();
  el.presentSlide.className = `present-slide theme-${s.theme}`;
  if (s.transition !== 'none') el.presentSlide.classList.add(`transition-${s.transition}`);
  el.presentSlide.style.background = s.background;
  el.presentSlide.innerHTML = '';
  s.elements.forEach((it) => el.presentSlide.appendChild(createElementNode(it, true)));
  el.presentCue.textContent = s.cue || '(missing cue)';
}

function renderAll() { renderSlideList(); renderCanvas(); renderInspector(); if (state.presenting) renderPresent(); persist(); }

function addSlide() { saveHistory(); state.slides.splice(state.active + 1, 0, createSlide()); state.active += 1; state.selectedSlideIndex = state.active; state.selectedElementId = null; renderAll(); }
function duplicateSlide() { saveHistory(); const cloned = structuredClone(currentSlide()); cloned.elements = cloned.elements.map((e) => ({ ...e, id: uid() })); state.slides.splice(state.active + 1, 0, cloned); state.active += 1; renderAll(); }
function deleteSlide() { if (state.slides.length === 1) return; saveHistory(); state.slides.splice(state.active, 1); state.active = Math.max(0, state.active - 1); state.selectedSlideIndex = state.active; renderAll(); }

function insertTextbox() { saveHistory(); const item = { id: uid(), type: 'textbox', className: 'textbox', x: 130, y: 120, w: 240, h: 90, rotation: 0, fill: 'transparent', text: 'Text box', isPlaceholder: false, fontFamily: 'Arial', fontSize: '32px', lineHeight: '1', align: 'left' }; currentSlide().elements.push(item); state.selectedElementId = item.id; renderAll(); }
function insertShape(shape='rect'){ saveHistory(); const item={id:uid(),type:'shape',className:`shape ${shape}`,x:160,y:150,w:140,h:100,rotation:0,fill:'#3f8b5a'}; currentSlide().elements.push(item); state.selectedElementId=item.id; renderAll(); }
function insertLine(){ saveHistory(); const item={id:uid(),type:'line',className:'line',x:150,y:230,w:220,h:12,rotation:0,fill:'#202124'}; currentSlide().elements.push(item); state.selectedElementId=item.id; renderAll(); }
function insertImageFromUrl(url){ if(!url.trim())return; saveHistory(); const item={id:uid(),type:'image',className:'image',x:220,y:140,w:320,h:200,rotation:0,src:url.trim()}; currentSlide().elements.push(item); state.selectedElementId=item.id; renderAll(); }

function deleteSelectedElement() {
  if (!state.selectedElementId) return false;
  const idx = currentSlide().elements.findIndex((e) => e.id === state.selectedElementId);
  if (idx === -1) return false;
  saveHistory();
  currentSlide().elements.splice(idx, 1);
  state.selectedElementId = null;
  renderAll();
  return true;
}

function validateCues() { const miss = state.slides.findIndex((s) => !s.cue.trim()); if (miss !== -1) { state.active = miss; renderAll(); alert(`Slide ${miss + 1} is missing a vocal cue.`); return false; } return true; }
function toggleSkipSlide(){ saveHistory(); currentSlide().skip=!currentSlide().skip; renderAll(); }

function startPresentation(){ if(!validateCues())return; state.presenting=true; el.presentOverlay.classList.remove('hidden'); renderPresent(); el.micDialog.showModal(); }
function stopPresentation(){ stopListening(); state.presenting=false; el.presentOverlay.classList.add('hidden'); }
function nextSlide(){ let i=state.active; while(i<state.slides.length-1){i+=1;if(!state.slides[i].skip)break;} if(i!==state.active){state.active=i; renderAll();} else el.listenStatus.textContent='Reached final slide.'; }
function prevSlide(){ let i=state.active; while(i>0){i-=1;if(!state.slides[i].skip)break;} if(i!==state.active){state.active=i; renderAll();} }

function initSpeech(){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){el.listenStatus.textContent='Speech recognition unavailable in this browser.';return false;} const rec=new SR(); rec.continuous=true; rec.interimResults=false; rec.lang='en-US'; rec.onresult=(e)=>{const t=e.results[e.results.length-1][0].transcript.toLowerCase().trim(); const cue=currentSlide().cue.toLowerCase().trim(); el.listenStatus.textContent=`Heard: "${t}"`; if(cue&&t.includes(cue))nextSlide();}; rec.onerror=(e)=>{el.listenStatus.textContent=`Speech error: ${e.error}`;}; rec.onend=()=>{ if(state.listening) rec.start();}; state.recognition=rec; return true; }
function startListening(){ if(!state.recognition && !initSpeech())return; state.listening=true; state.recognition.start(); el.listenBtn.textContent='Stop listening'; el.listenStatus.textContent='Listening for cue…'; }
function stopListening(){ if(!state.recognition)return; state.listening=false; state.recognition.stop(); el.listenBtn.textContent='Cue listening'; el.listenStatus.textContent='Mic idle'; }

function resetDeck(){ if(!confirm('Delete this presentation and all history? This cannot be undone.'))return; saveHistory(); state.deckTitle='Untitled presentation'; state.slides=[createSlide()]; state.active=0; state.selectedSlideIndex=0; state.selectedElementId=null; renderAll(); }
function downloadDeck(){ const blob=new Blob([JSON.stringify({app:'PresentIQ',version:5,deckTitle:state.deckTitle,slides:state.slides},null,2)],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${state.deckTitle.replace(/\s+/g,'_')||'presentation'}.pptx`; a.click(); URL.revokeObjectURL(a.href); }
function emailDeck(){ window.location.href=`mailto:?subject=${encodeURIComponent(`PresentIQ Deck: ${state.deckTitle}`)}&body=${encodeURIComponent('I exported the deck as a .pptx file from PresentIQ.')}`; }
function renameDeck(){ const next=prompt('Rename presentation',state.deckTitle); if(!next)return; state.deckTitle=next.trim(); renderInspector(); persist(); }

function runAction(action){ const map={ undo, redo, download:downloadDeck, email:emailDeck, rename:renameDeck, deleteDeck:resetDeck, insertTextbox, insertShape:()=>insertShape('rect'), insertLine, newSlide:addSlide, duplicateSlide, deleteSlide, toggleSkipSlide, focusTransition:()=>el.transitionSelect.focus(), insertImageSearch:()=>el.imageDialog.showModal(), paste:()=>pasteSlide() }; if(map[action]) map[action](); }
function searchAction(text){ const q=text.trim().toLowerCase(); if(!q)return; const entries=[['text box',insertTextbox],['shape',()=>insertShape('rect')],['line',insertLine],['undo',undo],['redo',redo],['new slide',addSlide],['duplicate',duplicateSlide],['delete slide',deleteSlide],['transition',()=>el.transitionSelect.focus()],['theme',()=>el.themeSelect.focus()]]; const f=entries.find(([k])=>k.includes(q)); if(f){f[1](); el.searchInput.value='';} else alert('No quick action found.'); }

function copySlide(){ state.copiedSlide = structuredClone(state.slides[state.selectedSlideIndex]); }
function pasteSlide(){ if(!state.copiedSlide) return; saveHistory(); const pasted = structuredClone(state.copiedSlide); pasted.elements = pasted.elements.map((e)=>({ ...e, id: uid() })); state.slides.splice(state.active+1,0,pasted); state.active += 1; state.selectedSlideIndex = state.active; renderAll(); }

function applyExec(command, value=null) { document.execCommand(command, false, value); }
function updateSelectedTextStyle() {
  const selected = findElement(state.selectedElementId);
  if (!selected || selected.type !== 'textbox') return;
  selected.fontFamily = el.fontFamilySelect.value;
  selected.fontSize = `${el.fontSizeSelect.value}px`;
  selected.align = el.alignSelect.value;
  selected.lineHeight = el.lineSpacingSelect.value;
}

function bindCanvasInteractions(){
  let drag=null;
  el.slideCanvas.addEventListener('pointerdown',(e)=>{
    const node=e.target.closest('.element');
    if(!node){ state.selectedElementId=null; setTextToolbarVisible(false); renderCanvas(); return; }
    state.selectedElementId=node.dataset.id;
    const handle=e.target.dataset.handle;
    const item=findElement(node.dataset.id); if(!item) return;
    const rect=el.slideCanvas.getBoundingClientRect(); const sx=(e.clientX-rect.left)/state.zoom; const sy=(e.clientY-rect.top)/state.zoom;
    drag={mode:handle==='resize'?'resize':handle==='rotate'?'rotate':'move', id:item.id, startX:sx,startY:sy, initial:{...item}};
    el.slideCanvas.setPointerCapture(e.pointerId);
    renderCanvas();
  });

  el.slideCanvas.addEventListener('pointermove',(e)=>{
    if(!drag) return;
    const item=findElement(drag.id); if(!item) return;
    const rect=el.slideCanvas.getBoundingClientRect(); const x=(e.clientX-rect.left)/state.zoom; const y=(e.clientY-rect.top)/state.zoom;
    if(drag.mode==='move'){ item.x=Math.max(0,drag.initial.x+(x-drag.startX)); item.y=Math.max(0,drag.initial.y+(y-drag.startY)); }
    else if(drag.mode==='resize'){ item.w=Math.max(40,drag.initial.w+(x-drag.startX)); item.h=Math.max(20,drag.initial.h+(y-drag.startY)); }
    else { const cx=drag.initial.x+drag.initial.w/2; const cy=drag.initial.y+drag.initial.h/2; item.rotation=(Math.atan2(y-cy,x-cx)*180)/Math.PI; }
    renderCanvas(); renderInspector();
  });

  el.slideCanvas.addEventListener('pointerup',()=>{ if(drag){ saveHistory(); drag=null; persist(); }});

  el.slideCanvas.addEventListener('focusin',(e)=>{
    const content=e.target.closest('.content'); if(!content) return;
    const item=findElement(content.dataset.id); if(!item||item.type!=='textbox') return;
    state.selectedElementId=item.id;
    setTextToolbarVisible(true);
    if(item.isPlaceholder && content.textContent.trim()===item.text){ content.textContent=''; item.text=''; item.isPlaceholder=false; }
  });

  el.slideCanvas.addEventListener('focusout',(e)=>{
    const content=e.target.closest('.content'); if(!content) return;
    const item=findElement(content.dataset.id); if(!item||item.type!=='textbox') return;
    const value=content.textContent.trim();
    if(!value && ['title','subtitle','body'].includes(item.kind)){ item.text=DEFAULT_TEXT[item.kind]; item.isPlaceholder=true; renderCanvas(); }
    setTimeout(()=>{ if(!el.slideCanvas.contains(document.activeElement)) setTextToolbarVisible(false); },0);
    persist();
  });

  el.slideCanvas.addEventListener('input',(e)=>{
    const content=e.target.closest('.content'); if(!content) return;
    const item=findElement(content.dataset.id); if(!item||item.type!=='textbox') return;
    item.text=content.innerText;
    item.isPlaceholder=false;
    updateSelectedTextStyle();
    renderSlideList();
    persist();
  });

  el.slideCanvas.addEventListener('keydown',(e)=>{
    if(e.key==='Delete' || e.key==='Backspace') {
      const active = document.activeElement;
      const inTextbox = active && active.classList && active.classList.contains('content');
      if(!inTextbox && deleteSelectedElement()) e.preventDefault();
    }
    if(e.key==='Enter' && document.activeElement?.classList.contains('content')) {
      const text = document.activeElement.innerText;
      const lines = text.split('\n');
      if(lines.length && lines[lines.length-1].trim().startsWith('* ')) {
        e.preventDefault();
        applyExec('insertHTML', '<br>• ');
      }
    }
  });
}

function bindTextTools(){
  el.boldBtn.addEventListener('click',()=>applyExec('bold'));
  el.italicBtn.addEventListener('click',()=>applyExec('italic'));
  el.underlineBtn.addEventListener('click',()=>applyExec('underline'));
  el.textColorInput.addEventListener('input',(e)=>applyExec('foreColor',e.target.value));
  el.highlightColorInput.addEventListener('input',(e)=>applyExec('hiliteColor',e.target.value));
  el.bulletsBtn.addEventListener('click',()=>applyExec('insertUnorderedList'));
  el.fontFamilySelect.addEventListener('change',(e)=>{ applyExec('fontName',e.target.value); updateSelectedTextStyle(); });
  el.fontSizeSelect.addEventListener('change',(e)=>{ const px=e.target.value; applyExec('fontSize',7); const active=document.activeElement; if(active?.classList.contains('content')) active.style.fontSize=`${px}px`; updateSelectedTextStyle(); });
  el.alignSelect.addEventListener('change',(e)=>{ const map={left:'justifyLeft',center:'justifyCenter',right:'justifyRight',justify:'justifyFull'}; applyExec(map[e.target.value]); updateSelectedTextStyle(); });
  el.lineSpacingSelect.addEventListener('change',(e)=>{ const active=document.activeElement; if(active?.classList.contains('content')) active.style.lineHeight=e.target.value; updateSelectedTextStyle(); });
}

function bindEvents(){
  el.menuRow.addEventListener('click',(e)=>{ const action=e.target.dataset.action; if(action) runAction(action); });
  el.addSlideBtn.addEventListener('click',addSlide); el.undoBtn.addEventListener('click',undo); el.redoBtn.addEventListener('click',redo);
  el.insertTextBtn.addEventListener('click',insertTextbox); el.insertLineBtn.addEventListener('click',insertLine); el.commentBtn.addEventListener('click',()=>alert('Comments panel coming next.'));
  el.insertShapeBtn.addEventListener('click',()=>el.shapePicker.classList.toggle('hidden'));
  el.shapePicker.addEventListener('click',(e)=>{ const shape=e.target.dataset.shape; if(shape){ insertShape(shape); el.shapePicker.classList.add('hidden'); }});
  document.addEventListener('click',(e)=>{ if(!e.target.closest('.shape-dropdown-wrap')) el.shapePicker.classList.add('hidden'); });

  el.zoomSelect.addEventListener('change',(e)=>{ state.zoom=Number(e.target.value); renderCanvas(); persist(); });
  el.bgColorInput.addEventListener('input',(e)=>{ saveHistory(); currentSlide().background=e.target.value; renderAll(); });
  el.layoutSelect.addEventListener('change',(e)=>{ saveHistory(); applyLayout(e.target.value); renderAll(); });
  el.themeSelect.addEventListener('change',(e)=>{ saveHistory(); currentSlide().theme=e.target.value; renderAll(); });
  el.transitionSelect.addEventListener('change',(e)=>{ saveHistory(); currentSlide().transition=e.target.value; renderAll(); });

  el.deckTitleInput.addEventListener('input',(e)=>{ state.deckTitle=e.target.value; persist(); });
  el.cueInput.addEventListener('input',(e)=>{ currentSlide().cue=e.target.value; persist(); });
  el.speakerNotes.addEventListener('input',(e)=>{ currentSlide().notes=e.target.value; persist(); });
  el.selectedColorInput.addEventListener('input',(e)=>{ const s=findElement(state.selectedElementId); if(!s)return; s.fill=e.target.value; renderCanvas(); persist(); });
  el.selectedRotateInput.addEventListener('input',(e)=>{ const s=findElement(state.selectedElementId); if(!s)return; s.rotation=Number(e.target.value); renderCanvas(); persist(); });

  el.searchInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter') searchAction(e.target.value); });

  el.presentBtn.addEventListener('click',startPresentation); el.exitBtn.addEventListener('click',stopPresentation); el.prevBtn.addEventListener('click',prevSlide); el.nextBtn.addEventListener('click',nextSlide);
  el.listenBtn.addEventListener('click',()=>state.listening?stopListening():startListening());
  el.micYesBtn.addEventListener('click',()=>{ el.micDialog.close(); startListening(); });
  el.micNoBtn.addEventListener('click',()=>{ el.micDialog.close(); el.listenStatus.textContent='Mic off (manual mode).'; });
  el.imageInsertBtn.addEventListener('click',()=>{ insertImageFromUrl(el.imageUrlInput.value); el.imageUrlInput.value=''; el.imageDialog.close(); });
  el.imageCancelBtn.addEventListener('click',()=>el.imageDialog.close());

  document.addEventListener('keydown',(e)=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { copySlide(); return; }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); pasteSlide(); return; }
    if((e.key==='Delete'||e.key==='Backspace') && !state.textEditing) { if(deleteSelectedElement()) return; if(state.selectedSlideIndex===state.active) deleteSlide(); }
    if(!state.presenting) return;
    if(e.key==='Escape') stopPresentation();
    if(e.key==='ArrowRight') nextSlide();
    if(e.key==='ArrowLeft') prevSlide();
  });

  bindCanvasInteractions();
  bindTextTools();
}

load();
bindEvents();
renderAll();
