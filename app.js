const defaultSlides = [
  {
    title: 'Welcome to PresentIQ',
    body: 'An AI-first presentation workflow.\nEvery slide has a vocal cue to go hands-free.',
    cue: 'next',
  },
];

const state = {
  slides: structuredClone(defaultSlides),
  activeIndex: 0,
  presenting: false,
  listening: false,
  recognition: null,
};

const slideList = document.getElementById('slideList');
const titleInput = document.getElementById('titleInput');
const bodyInput = document.getElementById('bodyInput');
const cueInput = document.getElementById('cueInput');
const slidePreview = document.getElementById('slidePreview');

const addSlideBtn = document.getElementById('addSlideBtn');
const duplicateSlideBtn = document.getElementById('duplicateSlideBtn');
const deleteSlideBtn = document.getElementById('deleteSlideBtn');
const presentBtn = document.getElementById('presentBtn');

const presentOverlay = document.getElementById('presentOverlay');
const presentSlide = document.getElementById('presentSlide');
const presentCue = document.getElementById('presentCue');
const listenStatus = document.getElementById('listenStatus');
const listenBtn = document.getElementById('listenBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const exitBtn = document.getElementById('exitBtn');

function currentSlide() {
  return state.slides[state.activeIndex];
}

function renderSlideList() {
  slideList.innerHTML = '';
  state.slides.forEach((slide, index) => {
    const li = document.createElement('li');
    const label = slide.title?.trim() || `Untitled slide ${index + 1}`;
    li.textContent = `${index + 1}. ${label}`;
    if (index === state.activeIndex) {
      li.classList.add('active');
    }
    li.addEventListener('click', () => {
      state.activeIndex = index;
      renderEditor();
    });
    slideList.appendChild(li);
  });
}

function renderEditor() {
  const slide = currentSlide();
  titleInput.value = slide.title;
  bodyInput.value = slide.body;
  cueInput.value = slide.cue;

  slidePreview.innerHTML = `
    <h2>${escapeHtml(slide.title || 'Untitled slide')}</h2>
    <p>${escapeHtml(slide.body || 'No content yet.')}</p>
  `;

  renderSlideList();
}

function renderPresentSlide() {
  const slide = currentSlide();
  presentSlide.innerHTML = `
    <h2>${escapeHtml(slide.title || 'Untitled slide')}</h2>
    <p>${escapeHtml(slide.body || 'No content yet.')}</p>
  `;
  presentCue.textContent = slide.cue || '(missing cue)';
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br>');
}

function persistField(field, value) {
  state.slides[state.activeIndex][field] = value;
  renderEditor();
  if (state.presenting) {
    renderPresentSlide();
  }
}

function addSlide() {
  state.slides.push({ title: 'New slide', body: '', cue: 'next' });
  state.activeIndex = state.slides.length - 1;
  renderEditor();
}

function duplicateSlide() {
  const clone = structuredClone(currentSlide());
  state.slides.splice(state.activeIndex + 1, 0, clone);
  state.activeIndex += 1;
  renderEditor();
}

function deleteSlide() {
  if (state.slides.length === 1) {
    alert('At least one slide is required.');
    return;
  }
  state.slides.splice(state.activeIndex, 1);
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  renderEditor();
}

function validateAllCues() {
  const firstMissingCue = state.slides.findIndex((s) => !s.cue.trim());
  if (firstMissingCue !== -1) {
    state.activeIndex = firstMissingCue;
    renderEditor();
    alert(`Slide ${firstMissingCue + 1} is missing a vocal cue.`);
    return false;
  }
  return true;
}

function startPresentation() {
  if (!validateAllCues()) return;
  state.presenting = true;
  presentOverlay.classList.remove('hidden');
  presentOverlay.setAttribute('aria-hidden', 'false');
  renderPresentSlide();
  initSpeechRecognition();
}

function exitPresentation() {
  stopListening();
  state.presenting = false;
  presentOverlay.classList.add('hidden');
  presentOverlay.setAttribute('aria-hidden', 'true');
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    listenStatus.textContent = 'Speech recognition not available in this browser.';
    listenBtn.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .toLowerCase()
      .trim();
    const cue = currentSlide().cue.toLowerCase().trim();

    listenStatus.textContent = `Heard: "${transcript}"`; 

    if (cue && transcript.includes(cue)) {
      nextSlide();
    }
  };

  recognition.onend = () => {
    if (state.listening) {
      recognition.start();
    }
  };

  recognition.onerror = (event) => {
    listenStatus.textContent = `Speech error: ${event.error}`;
  };

  state.recognition = recognition;
  listenBtn.disabled = false;
}

function startListening() {
  if (!state.recognition) return;
  state.listening = true;
  state.recognition.start();
  listenStatus.textContent = 'Listening for cue…';
  listenBtn.textContent = 'Stop listening';
}

function stopListening() {
  if (!state.recognition) return;
  state.listening = false;
  state.recognition.stop();
  listenStatus.textContent = 'Mic idle';
  listenBtn.textContent = 'Start listening';
}

function nextSlide() {
  if (state.activeIndex < state.slides.length - 1) {
    state.activeIndex += 1;
    renderEditor();
    renderPresentSlide();
  } else {
    listenStatus.textContent = 'Reached final slide.';
  }
}

function prevSlide() {
  if (state.activeIndex > 0) {
    state.activeIndex -= 1;
    renderEditor();
    renderPresentSlide();
  }
}

addSlideBtn.addEventListener('click', addSlide);
duplicateSlideBtn.addEventListener('click', duplicateSlide);
deleteSlideBtn.addEventListener('click', deleteSlide);
presentBtn.addEventListener('click', startPresentation);

listenBtn.addEventListener('click', () => {
  if (state.listening) {
    stopListening();
  } else {
    startListening();
  }
});
prevBtn.addEventListener('click', prevSlide);
nextBtn.addEventListener('click', nextSlide);
exitBtn.addEventListener('click', exitPresentation);

titleInput.addEventListener('input', (event) => persistField('title', event.target.value));
bodyInput.addEventListener('input', (event) => persistField('body', event.target.value));
cueInput.addEventListener('input', (event) => persistField('cue', event.target.value));

document.addEventListener('keydown', (event) => {
  if (!state.presenting) return;
  if (event.key === 'Escape') exitPresentation();
  if (event.key === 'ArrowRight') nextSlide();
  if (event.key === 'ArrowLeft') prevSlide();
});

renderEditor();
