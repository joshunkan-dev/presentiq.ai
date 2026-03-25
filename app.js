const STORAGE_KEY = 'presentiq.deck.v2';

const themes = {
  evergreen: { name: 'Evergreen', bg: '#ffffff', text: '#18271e', accent: '#2f7d52' },
  moss: { name: 'Moss', bg: '#ecf6ef', text: '#1e3428', accent: '#3b8f63' },
  nightforest: { name: 'Night Forest', bg: '#14251b', text: '#f1fff6', accent: '#7ad89d' },
  clay: { name: 'Clay', bg: '#f7f3ef', text: '#3b2f2a', accent: '#9a6d49' },
};

const templates = {
  'roadmap-template': { layout: 'title-body', title: 'Project Roadmap', subtitle: 'Q2–Q4 priorities', body: '• Milestone 1\n• Milestone 2\n• Milestone 3' },
  'quote-template': { layout: 'quote', title: 'Quote', body: '"Great presentations are stories, not bullet dumps."', body2: '— PresentIQ' },
  'launch-template': { layout: 'image-focus', title: 'Product Launch', subtitle: 'Key value in one sentence', imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80' },
};

function newSlide(overrides = {}) {
  return {
    title: 'New slide',
    subtitle: '',
    body: '',
    body2: '',
    imageUrl: '',
    notes: '',
    cue: 'next',
    layout: 'title-body',
    theme: 'evergreen',
    transition: 'fade',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 36,
    align: 'left',
    boldTitle: false,
    italicBody: false,
    showFooter: false,
    footer: '',
    ...overrides,
  };
}

const state = {
  slides: [newSlide({ title: 'Welcome to PresentIQ', subtitle: 'Voice-first presentation control', body: 'Build decks fast, present hands-free with cue words.' })],
  activeIndex: 0,
  presenting: false,
  listening: false,
  recognition: null,
};

const ids = [
  'slideList', 'slideCounter', 'canvas', 'titleInput', 'subtitleInput', 'bodyInput', 'body2Input', 'imageUrlInput', 'notesInput',
  'cueInput', 'layoutSelect', 'themeSelect', 'transitionSelect', 'fontFamilySelect', 'fontSizeInput', 'alignSelect', 'boldInput',
  'italicInput', 'footerToggle', 'footerInput', 'presentBtn', 'newDeckBtn', 'saveDeckBtn', 'exportDeckBtn', 'importDeckInput',
  'addSlideBtn', 'duplicateSlideBtn', 'deleteSlideBtn', 'moveUpBtn', 'moveDownBtn', 'applyTemplateBtn', 'presentOverlay',
  'presentSlide', 'presentCue', 'presentNotes', 'presentIndex', 'listenStatus', 'listenBtn', 'prevBtn', 'nextBtn', 'exitBtn',
];

const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function currentSlide() {
  return state.slides[state.activeIndex];
}

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br>');
}

function setThemeOptions() {
  el.themeSelect.innerHTML = Object.entries(themes)
    .map(([key, theme]) => `<option value="${key}">${theme.name}</option>`)
    .join('');
}

function applyTemplate() {
  const keys = Object.keys(templates);
  const key = keys[(keys.indexOf(el.applyTemplateBtn.dataset.lastTemplate || keys[0]) + 1) % keys.length];
  Object.assign(currentSlide(), templates[key]);
  el.applyTemplateBtn.dataset.lastTemplate = key;
  renderAll();
}

function renderSlideList() {
  el.slideList.innerHTML = '';
  state.slides.forEach((slide, index) => {
    const li = document.createElement('li');
    li.className = index === state.activeIndex ? 'active' : '';
    li.innerHTML = `<div class="thumb-title">${index + 1}. ${escapeHtml(slide.title || 'Untitled')}</div>
      <div class="thumb-meta">${escapeHtml(slide.layout)} · cue: ${escapeHtml(slide.cue || 'missing')}</div>`;
    li.addEventListener('click', () => {
      state.activeIndex = index;
      renderAll();
    });
    el.slideList.appendChild(li);
  });
  el.slideCounter.textContent = `${state.slides.length} slide${state.slides.length === 1 ? '' : 's'}`;
}

function slideMarkup(slide) {
  const theme = themes[slide.theme] || themes.evergreen;
  const titleStyle = `font-family:${slide.fontFamily};font-size:${slide.fontSize}px;text-align:${slide.align};${slide.boldTitle ? 'font-weight:700;' : 'font-weight:500;'}`;
  const bodyStyle = `font-family:${slide.fontFamily};text-align:${slide.align};${slide.italicBody ? 'font-style:italic;' : ''}`;

  const title = `<h2 class="slide-title" style="${titleStyle}">${escapeHtml(slide.title || 'Untitled slide')}</h2>`;
  const subtitle = slide.subtitle ? `<p class="slide-subtitle" style="text-align:${slide.align}">${escapeHtml(slide.subtitle)}</p>` : '';
  const footer = slide.showFooter && slide.footer ? `<footer class="footer">${escapeHtml(slide.footer)}</footer>` : '';

  let content = '';
  if (slide.layout === 'title') {
    content = `${title}${subtitle}`;
  } else if (slide.layout === 'two-column') {
    content = `${title}${subtitle}<div class="split"><p class="slide-body" style="${bodyStyle}">${escapeHtml(slide.body)}</p><p class="slide-body" style="${bodyStyle}">${escapeHtml(slide.body2)}</p></div>`;
  } else if (slide.layout === 'quote') {
    content = `<div class="quote-layout">${title}<p class="slide-body" style="${bodyStyle}">${escapeHtml(slide.body || 'Type your quote')}</p><p class="slide-subtitle">${escapeHtml(slide.body2 || '')}</p></div>`;
  } else if (slide.layout === 'image-focus') {
    const image = slide.imageUrl ? `<img alt="Slide visual" src="${slide.imageUrl}" />` : '<div class="slide-body">Add image URL in Inspector.</div>';
    content = `${title}${subtitle}<div class="image-focus"><div><p class="slide-body" style="${bodyStyle}">${escapeHtml(slide.body || 'Supporting content')}</p></div><div>${image}</div></div>`;
  } else {
    content = `${title}${subtitle}<p class="slide-body" style="${bodyStyle}">${escapeHtml(slide.body || 'Write content')}</p>`;
  }

  return `<section style="background:${theme.bg};color:${theme.text};height:100%;padding:0.2rem 0.1rem;border-radius:8px;border-left:8px solid ${theme.accent};">${content}${footer}</section>`;
}

function renderInputs() {
  const s = currentSlide();
  el.titleInput.value = s.title;
  el.subtitleInput.value = s.subtitle;
  el.bodyInput.value = s.body;
  el.body2Input.value = s.body2;
  el.imageUrlInput.value = s.imageUrl;
  el.notesInput.value = s.notes;
  el.cueInput.value = s.cue;
  el.layoutSelect.value = s.layout;
  el.themeSelect.value = s.theme;
  el.transitionSelect.value = s.transition;
  el.fontFamilySelect.value = s.fontFamily;
  el.fontSizeInput.value = s.fontSize;
  el.alignSelect.value = s.align;
  el.boldInput.checked = s.boldTitle;
  el.italicInput.checked = s.italicBody;
  el.footerToggle.checked = s.showFooter;
  el.footerInput.value = s.footer;
}

function renderCanvas() {
  el.canvas.innerHTML = slideMarkup(currentSlide());
}

function renderPresent() {
  const slide = currentSlide();
  el.presentSlide.className = 'present-slide';
  if (slide.transition !== 'none') {
    el.presentSlide.classList.add(`transition-${slide.transition}`);
  }
  el.presentSlide.innerHTML = slideMarkup(slide);
  el.presentCue.textContent = slide.cue || '(missing cue)';
  el.presentNotes.textContent = `Notes: ${slide.notes || 'No speaker notes'}`;
  el.presentIndex.textContent = `${state.activeIndex + 1} / ${state.slides.length}`;
}

function renderAll() {
  renderSlideList();
  renderInputs();
  renderCanvas();
  if (state.presenting) renderPresent();
}

function updateField(field, value) {
  currentSlide()[field] = value;
  renderAll();
}

function addSlide() {
  state.slides.splice(state.activeIndex + 1, 0, newSlide());
  state.activeIndex += 1;
  renderAll();
}

function duplicateSlide() {
  state.slides.splice(state.activeIndex + 1, 0, structuredClone(currentSlide()));
  state.activeIndex += 1;
  renderAll();
}

function deleteSlide() {
  if (state.slides.length === 1) return alert('At least one slide is required.');
  state.slides.splice(state.activeIndex, 1);
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  renderAll();
}

function moveSlide(dir) {
  const i = state.activeIndex;
  const j = i + dir;
  if (j < 0 || j >= state.slides.length) return;
  [state.slides[i], state.slides[j]] = [state.slides[j], state.slides[i]];
  state.activeIndex = j;
  renderAll();
}

function validateCues() {
  const idx = state.slides.findIndex((s) => !s.cue || !s.cue.trim());
  if (idx !== -1) {
    state.activeIndex = idx;
    renderAll();
    alert(`Slide ${idx + 1} is missing a vocal cue.`);
    return false;
  }
  return true;
}

function startPresentation() {
  if (!validateCues()) return;
  state.presenting = true;
  el.presentOverlay.classList.remove('hidden');
  el.presentOverlay.setAttribute('aria-hidden', 'false');
  renderPresent();
  initRecognition();
}

function stopPresentation() {
  stopListening();
  state.presenting = false;
  el.presentOverlay.classList.add('hidden');
  el.presentOverlay.setAttribute('aria-hidden', 'true');
}

function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.listenStatus.textContent = 'Speech recognition unavailable in this browser.';
    el.listenBtn.disabled = true;
    return;
  }

  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
    const cue = currentSlide().cue.toLowerCase().trim();
    el.listenStatus.textContent = `Heard: "${transcript}"`;
    if (cue && transcript.includes(cue)) nextSlide();
  };

  recognition.onerror = (event) => {
    el.listenStatus.textContent = `Speech error: ${event.error}`;
  };

  recognition.onend = () => {
    if (state.listening) recognition.start();
  };

  state.recognition = recognition;
  el.listenBtn.disabled = false;
}

function startListening() {
  if (!state.recognition) return;
  state.listening = true;
  state.recognition.start();
  el.listenBtn.textContent = 'Stop listening';
  el.listenStatus.textContent = 'Listening for cue…';
}

function stopListening() {
  if (!state.recognition) return;
  state.listening = false;
  state.recognition.stop();
  el.listenBtn.textContent = 'Start listening';
  el.listenStatus.textContent = 'Mic idle';
}

function nextSlide() {
  if (state.activeIndex < state.slides.length - 1) {
    state.activeIndex += 1;
    renderAll();
  } else {
    el.listenStatus.textContent = 'Reached final slide.';
  }
}

function prevSlide() {
  if (state.activeIndex > 0) {
    state.activeIndex -= 1;
    renderAll();
  }
}

function saveDeck() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ slides: state.slides, activeIndex: state.activeIndex }));
  el.saveDeckBtn.textContent = 'Saved';
  setTimeout(() => {
    el.saveDeckBtn.textContent = 'Save';
  }, 800);
}

function loadDeck() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return;
    state.slides = parsed.slides.map((slide) => newSlide(slide));
    state.activeIndex = Math.min(parsed.activeIndex || 0, state.slides.length - 1);
  } catch {
    // ignore malformed storage
  }
}

function exportDeck() {
  const blob = new Blob([JSON.stringify({ app: 'PresentIQ', version: 2, slides: state.slides }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'presentiq-deck.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importDeck(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.slides) || !parsed.slides.length) throw new Error('Invalid deck format');
      state.slides = parsed.slides.map((slide) => newSlide(slide));
      state.activeIndex = 0;
      renderAll();
    } catch (err) {
      alert(`Could not import deck: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function resetDeck() {
  state.slides = [newSlide({ title: 'Untitled presentation', subtitle: 'Start building your narrative' })];
  state.activeIndex = 0;
  renderAll();
}

function bindEvents() {
  el.titleInput.addEventListener('input', (e) => updateField('title', e.target.value));
  el.subtitleInput.addEventListener('input', (e) => updateField('subtitle', e.target.value));
  el.bodyInput.addEventListener('input', (e) => updateField('body', e.target.value));
  el.body2Input.addEventListener('input', (e) => updateField('body2', e.target.value));
  el.imageUrlInput.addEventListener('input', (e) => updateField('imageUrl', e.target.value));
  el.notesInput.addEventListener('input', (e) => updateField('notes', e.target.value));
  el.cueInput.addEventListener('input', (e) => updateField('cue', e.target.value));
  el.layoutSelect.addEventListener('change', (e) => updateField('layout', e.target.value));
  el.themeSelect.addEventListener('change', (e) => updateField('theme', e.target.value));
  el.transitionSelect.addEventListener('change', (e) => updateField('transition', e.target.value));
  el.fontFamilySelect.addEventListener('change', (e) => updateField('fontFamily', e.target.value));
  el.fontSizeInput.addEventListener('input', (e) => updateField('fontSize', Number(e.target.value)));
  el.alignSelect.addEventListener('change', (e) => updateField('align', e.target.value));
  el.boldInput.addEventListener('change', (e) => updateField('boldTitle', e.target.checked));
  el.italicInput.addEventListener('change', (e) => updateField('italicBody', e.target.checked));
  el.footerToggle.addEventListener('change', (e) => updateField('showFooter', e.target.checked));
  el.footerInput.addEventListener('input', (e) => updateField('footer', e.target.value));

  el.addSlideBtn.addEventListener('click', addSlide);
  el.duplicateSlideBtn.addEventListener('click', duplicateSlide);
  el.deleteSlideBtn.addEventListener('click', deleteSlide);
  el.moveUpBtn.addEventListener('click', () => moveSlide(-1));
  el.moveDownBtn.addEventListener('click', () => moveSlide(1));
  el.applyTemplateBtn.addEventListener('click', applyTemplate);

  el.newDeckBtn.addEventListener('click', resetDeck);
  el.saveDeckBtn.addEventListener('click', saveDeck);
  el.exportDeckBtn.addEventListener('click', exportDeck);
  el.importDeckInput.addEventListener('change', (e) => importDeck(e.target.files[0]));

  el.presentBtn.addEventListener('click', startPresentation);
  el.exitBtn.addEventListener('click', stopPresentation);
  el.prevBtn.addEventListener('click', prevSlide);
  el.nextBtn.addEventListener('click', nextSlide);
  el.listenBtn.addEventListener('click', () => (state.listening ? stopListening() : startListening()));

  document.addEventListener('keydown', (event) => {
    if (!state.presenting) return;
    if (event.key === 'Escape') stopPresentation();
    if (event.key === 'ArrowRight') nextSlide();
    if (event.key === 'ArrowLeft') prevSlide();
  });

  window.addEventListener('beforeunload', saveDeck);
}

setThemeOptions();
loadDeck();
bindEvents();
renderAll();
