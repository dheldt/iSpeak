'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Spelling mode — two-level T9 wheel
// ─────────────────────────────────────────────────────────────────────────
// WT_DATA is defined in js/words.js, loaded before this file.

const T9_GROUPS = [
  { key: 'abc',  chars: ['A','B','C','Ä'] },
  { key: 'def',  chars: ['D','E','F'] },
  { key: 'ghi',  chars: ['G','H','I'] },
  { key: 'jkl',  chars: ['J','K','L'] },
  { key: 'mno',  chars: ['M','N','O','Ö'] },
  { key: 'pqrs', chars: ['P','Q','R','S'] },
  { key: 'tuv',  chars: ['T','U','V','Ü'] },
  { key: 'wxyz', chars: ['W','X','Y','Z','ß'] },
];
const T9_MAP      = Object.fromEntries(T9_GROUPS.map(g => [g.key, g.chars]));
const T9_KEYS     = T9_GROUPS.map(g => g.key);
const SP_SPECIALS = ['␣', 'DEL', 'CLR', 'Sprechen', 'Speichern'];
const SP_TOP      = [...T9_KEYS, ...SP_SPECIALS];
const SP_BACK     = '← Zurück';

let spLevel = 0;
let spGroup = null;
let spItems = [...SP_TOP];
let spIdx   = 0;

function spReset() {
  spLevel = 0;
  spGroup = null;
  spItems = [...SP_TOP];
  spIdx   = 0;
  renderSpelling();
}

function spSelectCurrent() {
  const chosen = spItems[spIdx];
  if (chosen === SP_BACK) { spReset(); return; }
  if (spLevel === 0) {
    if (SP_SPECIALS.includes(chosen)) {
      spExecuteSpecial(chosen); return;
    }
    spGroup = chosen;
    spLevel = 1;
    spItems = [SP_BACK, ...T9_MAP[spGroup]];
    spIdx   = 0;
    renderSpelling();
  } else {
    buf += chosen;
    renderText();
    flashLetter();
    spReset();
  }
}

function spExecuteSpecial(c) {
  if (c === 'Sprechen') {
    if (buf.trim()) { addHistory(buf, 'spoken'); tts(buf); buf = ''; renderText(); }
  } else if (c === 'Speichern') {
    if (buf.trim()) { savePhrase(buf); }
  } else if (c === 'DEL') {
    buf = buf.slice(0, -1); renderText();
  } else if (c === 'CLR') {
    addHistory(buf, 'cleared'); buf = ''; renderText();
  } else if (c === '␣') {
    buf += ' '; renderText();
  }
  flashLetter();
}

// ─────────────────────────────────────────────────────────────────────────
// Text buffer
// ─────────────────────────────────────────────────────────────────────────
let buf = '';
const MAX_HISTORY = 8;
const history = [];

function addHistory(text, type) {
  if (!text.trim()) return;
  history.unshift({ text, type });
  if (history.length > MAX_HISTORY) history.pop();
  const el = document.getElementById('text-history');
  if (!el) return;
  el.innerHTML = history.map(h =>
    `<div class="hist-entry ${h.type}">${h.text}</div>`
  ).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// Saved phrases  (persisted to localStorage)
// ─────────────────────────────────────────────────────────────────────────
const SAVED_KEY     = 'ispeak_saved';
const WT_SAVED_CAT  = 'Gespeichert';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
}

function savePhrase(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const saved = loadSaved().filter(s => s !== trimmed); // dedup
  saved.unshift(trimmed);
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
}

// Return the T9 bucket key for the first character of a phrase, or null.
function phraseT9Key(phrase) {
  const first = (phrase[0] || '').toUpperCase();
  return T9_GROUPS.find(g => g.chars.includes(first))?.key ?? null;
}

// Ordered list of T9 bucket keys that actually have saved phrases.
function savedBucketKeys(saved) {
  const seen = new Set(saved.map(phraseT9Key).filter(Boolean));
  return T9_KEYS.filter(k => seen.has(k));
}

// Saved phrases whose first character falls in the given T9 bucket.
function savedForBucket(saved, bucketKey) {
  return saved.filter(p => phraseT9Key(p) === bucketKey);
}

// ─────────────────────────────────────────────────────────────────────────
// TTS
// ─────────────────────────────────────────────────────────────────────────
function tts(text) {
  if (!window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'de-DE';
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────
const cfg = {
  gazeDebounce:   700,   // ms between wheel steps
  blinkMin:        400,   // ms — min short blink (select)
  blinkMax:        800,   // ms — max short blink (select)
  longHoldMs:     3000,   // ms eye must stay closed to trigger mode-switch modal
  gazeZone:      0.06,   // manual symmetric fallback (updated by slider)
  gazeUpThresh:  -0.06,  // calibrated: fire when gazeVal < this (negative = up)
  gazeDownThresh: 0.06,  // calibrated: fire when gazeVal > this (positive = down)
  earThresh:        0.18,  // EAR below this → eye closed
  closeDebounceMs:  200,  // ms EAR must stay below threshold before "closed" fires
  gazeDownEnabled:  false,  // look-down scrolling on/off
  eyeSide:        'right',  // which eye to track: 'right' or 'left'
  soundOn:          true,   // play audio feedback
  calibrated:     false, // set true after first successful calibration
  showCamera:     false,  // show live video feed in overlay
  enabledModes:   { inactive: true, wordtree: false, spelling: true, sätze: false },
};

(function loadCfg() {
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('ispeak') || '{}')); } catch {}
})();

function saveCfg() {
  localStorage.setItem('ispeak', JSON.stringify(cfg));
}

// ─────────────────────────────────────────────────────────────────────────
// Mode state machine
// Cycles on double-blink: inactive → spelling → wordtree → inactive
// ─────────────────────────────────────────────────────────────────────────
const MODES = ['inactive', 'wordtree', 'spelling', 'sätze'];
let mode = 'inactive';

function activeModes() {
  return MODES.filter(m => m !== 'inactive' && cfg.enabledModes[m] !== false);
}

function buildCycle() {
  const active = activeModes();
  return cfg.enabledModes.inactive !== false ? ['inactive', ...active] : active;
}

function modeSwitchingEnabled() {
  return buildCycle().length > 1;
}

function cycleMode() {
  const cycle = buildCycle();
  if (cycle.length <= 1) return;
  // indexOf returns -1 when current mode is not in cycle → lands on index 0
  mode = cycle[(cycle.indexOf(mode) + 1) % cycle.length];
  applyMode();
  lastGazeTime = Date.now();
}

function applyMode() {
  const wheel = document.getElementById('wheel');
  const badge = document.getElementById('mode-badge');

  wheel.classList.toggle('inactive', mode === 'inactive');

  badge.classList.remove('active', 'inactive', 'wordtree', 'sätze');
  if (mode === 'inactive') {
    badge.textContent = 'INAKTIV';
    badge.classList.add('inactive');
  } else if (mode === 'spelling') {
    badge.textContent = 'BUCHSTABEN';
    badge.classList.add('active');
  } else if (mode === 'sätze') {
    badge.textContent = 'SÄTZE';
    badge.classList.add('sätze');
  } else {
    badge.textContent = 'WORTBAUM';
    badge.classList.add('wordtree');
  }

  // Show/hide sub-panels
  const spellPanel = document.getElementById('wheel-spelling');
  const wtPanel    = document.getElementById('wheel-wordtree');
  const stPanel    = document.getElementById('wheel-sätze');
  const crumb      = document.getElementById('wt-breadcrumb');
  if (mode === 'wordtree') {
    spellPanel.style.display = 'none';
    wtPanel.style.display    = 'flex';
    stPanel.style.display    = 'none';
    crumb.style.display      = 'block';
    wtReset();
  } else if (mode === 'sätze') {
    spellPanel.style.display = 'none';
    wtPanel.style.display    = 'none';
    stPanel.style.display    = 'flex';
    crumb.style.display      = 'block';
    stReset();
  } else {
    spellPanel.style.display = '';
    wtPanel.style.display    = 'none';
    stPanel.style.display    = 'none';
    crumb.style.display      = 'none';
    if (mode === 'spelling') spReset();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Word tree navigation
// ─────────────────────────────────────────────────────────────────────────
const WT_BACK = '← Zurück';

let wtLevel    = 0;      // 0 = categories, 1 = letter groups, 2 = words
let wtCategory = null;   // selected category key e.g. 'Verb'
let wtBucket   = null;   // selected bucket key e.g. 'A – D'
let wtItems    = [];     // current list displayed in the wheel
let wtIdx      = 0;      // current scroll position

const WT_SPEAK = '↵ Sprechen';

function wtReset() {
  wtLevel    = 0;
  wtCategory = null;
  wtBucket   = null;
  wtItems    = [...Object.keys(WT_DATA), WT_SAVED_CAT, WT_SPEAK];
  wtIdx      = 0;
  renderWordTree();
  renderBreadcrumb();
}

function wtSelectCurrent() {
  const chosen = wtItems[wtIdx];
  if (chosen === WT_BACK) {
    wtGoBack(); return;
  }
  if (chosen === WT_SPEAK) {
    if (buf.trim()) { addHistory(buf, 'spoken'); tts(buf); buf = ''; renderText(); }
    flashWordTree();
    wtReset();
    return;
  }
  if (wtLevel === 0) {
    wtCategory = chosen;
    if (chosen === WT_SAVED_CAT) {
      const saved = loadSaved();
      if (!saved.length) return;           // nothing saved yet — stay put
      if (saved.length <= 10) {
        wtBucket = WT_SAVED_CAT;
        wtLevel  = 2;
        wtItems  = [WT_BACK, ...saved];
      } else {
        wtLevel  = 1;
        wtItems  = [WT_BACK, ...savedBucketKeys(saved)];
      }
    } else {
      const buckets = Object.keys(WT_DATA[wtCategory]);
      if (buckets.length === 1) {
        // Skip bucket level — go straight to words
        wtBucket = buckets[0];
        wtLevel  = 2;
        wtItems  = [WT_BACK, ...WT_DATA[wtCategory][wtBucket]];
      } else {
        wtLevel  = 1;
        wtItems  = [WT_BACK, ...buckets];
      }
    }
    wtIdx = 0;
  } else if (wtLevel === 1) {
    wtBucket = chosen;
    wtLevel  = 2;
    wtItems  = wtCategory === WT_SAVED_CAT
      ? [WT_BACK, ...savedForBucket(loadSaved(), chosen)]
      : [WT_BACK, ...WT_DATA[wtCategory][wtBucket]];
    wtIdx    = 0;
  } else {
    // Level 2: actual word — append to buffer, then return to top level
    buf += (buf.length > 0 && buf.slice(-1) !== ' ') ? ' ' + chosen : chosen;
    renderText();
    flashWordTree();
    wtReset();
    return;
  }
  renderWordTree();
  renderBreadcrumb();
}

function wtGoBack() {
  const rootItems = () => [...Object.keys(WT_DATA), WT_SAVED_CAT, WT_SPEAK];
  if (wtLevel === 2) {
    // For Gespeichert with ≤10 entries we skipped level 1 — go straight to root.
    if (wtCategory === WT_SAVED_CAT && loadSaved().length <= 10) {
      wtLevel    = 0;
      wtCategory = null;
      wtItems    = rootItems();
    } else {
      wtLevel  = 1;
      wtBucket = null;
      wtItems  = wtCategory === WT_SAVED_CAT
        ? [WT_BACK, ...savedBucketKeys(loadSaved())]
        : [WT_BACK, ...Object.keys(WT_DATA[wtCategory])];
    }
    wtIdx = 0;
  } else if (wtLevel === 1) {
    wtLevel    = 0;
    wtCategory = null;
    wtItems    = rootItems();
    wtIdx      = 0;
  }
  renderWordTree();
  renderBreadcrumb();
}


function renderWordTree() {
  const total = wtItems.length;
  wtIdx = Math.max(0, Math.min(wtIdx, total - 1));

  const itemAt = off => wtItems[((wtIdx + off) % total + total) % total];

  document.getElementById('wt-p2').textContent = itemAt(-2);
  document.getElementById('wt-p1').textContent = itemAt(-1);

  const mainEl  = document.getElementById('wt-main');
  const current = itemAt(0);
  mainEl.textContent = current;
  mainEl.classList.toggle('wt-back', current === WT_BACK);
  mainEl.style.fontSize = ''; // always let CSS control the size

  document.getElementById('wt-n1').textContent = itemAt(+1);
  document.getElementById('wt-n2').textContent = itemAt(+2);
}

function renderBreadcrumb() {
  const el = document.getElementById('wt-breadcrumb');
  if (wtLevel === 0) {
    el.textContent = 'Wortbaum';
  } else if (wtLevel === 1) {
    el.textContent = `Wortbaum › ${wtCategory}`;
  } else {
    el.textContent = `Wortbaum › ${wtCategory} › ${wtBucket}`;
  }
}

function flashWordTree() {
  const el = document.getElementById('wt-main');
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 150);
}

// ─────────────────────────────────────────────────────────────────────────
// Sätze mode — browse and speak saved phrases
// ─────────────────────────────────────────────────────────────────────────
const ST_BACK  = '← Zurück';
const ST_EMPTY = '(Keine Sätze)';

let stLevel  = 0;
let stBucket = null;
let stItems  = [];
let stIdx    = 0;

function stReset() {
  stLevel  = 0;
  stBucket = null;
  const saved = loadSaved();
  if (saved.length === 0) {
    stItems = [ST_EMPTY];
  } else if (saved.length <= 10) {
    stItems = [...saved];
  } else {
    stItems = savedBucketKeys(saved);
  }
  stIdx = 0;
  renderSätze();
  updateStBreadcrumb();
}

function stSelectCurrent() {
  const chosen = stItems[stIdx];
  if (chosen === ST_EMPTY) return;
  if (chosen === ST_BACK) { stReset(); return; }
  const saved = loadSaved();
  if (stLevel === 0 && saved.length > 10) {
    // chosen is a T9 bucket key — drill in
    stBucket = chosen;
    stLevel  = 1;
    stItems  = [ST_BACK, ...savedForBucket(saved, chosen)];
    stIdx    = 0;
    renderSätze();
    updateStBreadcrumb();
  } else {
    // chosen is a phrase — speak it
    addHistory(chosen, 'spoken');
    tts(chosen);
    flashSätze();
  }
}

function renderSätze() {
  const total = stItems.length;
  if (total === 0) return;
  stIdx = ((stIdx % total) + total) % total;
  const itemAt = off => stItems[((stIdx + off) % total + total) % total];

  document.getElementById('st-p2').textContent = itemAt(-2);
  document.getElementById('st-p1').textContent = itemAt(-1);

  const mainEl  = document.getElementById('st-main');
  const current = itemAt(0);
  mainEl.textContent = current;
  mainEl.classList.toggle('st-back',  current === ST_BACK);
  mainEl.classList.toggle('st-empty', current === ST_EMPTY);

  document.getElementById('st-n1').textContent = itemAt(+1);
  document.getElementById('st-n2').textContent = itemAt(+2);
}

function updateStBreadcrumb() {
  const el = document.getElementById('wt-breadcrumb');
  el.textContent = stLevel === 0 ? 'Sätze' : `Sätze › ${stBucket}`;
}

function flashSätze() {
  const el = document.getElementById('st-main');
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 150);
}

// ─────────────────────────────────────────────────────────────────────────
// Render — spelling mode
// ─────────────────────────────────────────────────────────────────────────
function renderSpelling() {
  const total = spItems.length;
  spIdx = ((spIdx % total) + total) % total;
  const itemAt = off => spItems[((spIdx + off) % total + total) % total];
  document.getElementById('l-p2').textContent = itemAt(-2);
  document.getElementById('l-p1').textContent = itemAt(-1);
  const mainEl = document.getElementById('letter-main');
  const cur = itemAt(0);
  mainEl.textContent = cur;
  mainEl.classList.toggle('ctrl', spLevel === 0 || cur === SP_BACK);
  document.getElementById('l-n1').textContent = itemAt(+1);
  document.getElementById('l-n2').textContent = itemAt(+2);
}

function renderText() {
  document.getElementById('text-out').textContent = buf;
}

function flashLetter() {
  const el = document.getElementById('letter-main');
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 150);
}

function setStatus(msg, color = '#555') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = color;
}

let gazeHideTimer = null;
function showGaze(dir) {
  const ind = document.getElementById('gaze-ind');
  ind.classList.add('show');
  document.querySelectorAll('.gdot').forEach(d => d.classList.remove('lit'));
  const id = dir === 'up' ? 'dot-up' : dir === 'dn' ? 'dot-dn' : 'dot-mid';
  document.getElementById(id).classList.add('lit');
  clearTimeout(gazeHideTimer);
  gazeHideTimer = setTimeout(() => ind.classList.remove('show'), 600);
}

// ─────────────────────────────────────────────────────────────────────────
// Canvas overlay drawing
// ─────────────────────────────────────────────────────────────────────────
//
// Left eye key landmarks:
//   EAR corners : 33 (inner), 133 (outer)
//   EAR top lids: 159, 160, 158
//   EAR bot lids: 145, 144, 153
//   Iris centre : 468  (requires refineLandmarks:true)

// Landmark sets for each eye.
// MediaPipe FaceMesh: "left" landmarks = user's RIGHT eye (camera-left side).
const EYE_LM = {
  right: {
    c0: 33, c1: 133,                         // corners (inner/outer)
    t0: 159, t1: 160, t2: 158,               // top lids
    b0: 145, b1: 144, b2: 153,               // bottom lids
    iris: 468, irisR: 469,                   // iris centre + edge
    contour: [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],
  },
  left: {
    c0: 362, c1: 263,
    t0: 386, t1: 385, t2: 384,
    b0: 374, b1: 373, b2: 380,
    iris: 473, irisR: 474,
    contour: [263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249],
  },
};
function eLM() { return EYE_LM[cfg.eyeSide] || EYE_LM.right; }

const canvas  = document.getElementById('overlay');
const ctx     = canvas.getContext('2d');
const videoEl = document.getElementById('cam');

function resizeCanvas() {
  const wrap = document.getElementById('cam-wrap');
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}
new ResizeObserver(resizeCanvas).observe(document.getElementById('cam-wrap'));
resizeCanvas();

function lmPx(lm) {
  return {
    x: (1 - lm.x) * canvas.width,
    y: lm.y * canvas.height,
  };
}

let lastEarVal    = 1;
let lastGazeVal   = 0.5;
let lastEyeClosed = false;

function drawOverlay(lm) {
  if (!cfg.showCamera) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, W, H);
  ctx.restore();

  if (!lm) return;

  const e      = eLM();
  const eyeTop = lmPx(lm[e.t0]);
  const eyeBot = lmPx(lm[e.b0]);
  const eyeL   = lmPx(lm[e.c0]);
  const eyeR   = lmPx(lm[e.c1]);
  const eyeW   = Math.abs(eyeR.x - eyeL.x) * 2.2;
  const eyeH   = Math.abs(eyeBot.y - eyeTop.y) * 4.5;
  const eyeCX  = (eyeL.x + eyeR.x) / 2;
  const eyeCY  = (eyeTop.y + eyeBot.y) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(eyeCX, eyeCY, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const eyeWidthPx = Math.abs(lmPx(lm[e.c0]).x - lmPx(lm[e.c1]).x);
  const threshPx   = cfg.gazeZone * eyeWidthPx;
  const zoneTop    = (lm[e.c0].y + lm[e.c1].y) / 2 * canvas.height - threshPx;
  const zoneBot    = (lm[e.c0].y + lm[e.c1].y) / 2 * canvas.height + threshPx;
  const lineX1     = eyeCX - eyeW * 0.7;
  const lineX2     = eyeCX + eyeW * 0.7;

  ctx.strokeStyle = 'rgba(80,200,255,0.5)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(lineX1, zoneTop); ctx.lineTo(lineX2, zoneTop);
  ctx.moveTo(lineX1, zoneBot); ctx.lineTo(lineX2, zoneBot);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = lastEyeClosed ? 'rgba(255,80,80,0.8)' : 'rgba(100,220,255,0.7)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  e.contour.forEach((li, i) => {
    const p = lmPx(lm[li]);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();

  const iris       = lmPx(lm[e.iris]);
  const irisR      = lmPx(lm[e.irisR]);
  const irisRadius = Math.max(3, Math.abs(iris.x - irisR.x) * 2.5);

  let irisColor = '#ffffff';
  if (lastEyeClosed)                    irisColor = '#ff5050';
  else if (lastGazeVal < -cfg.gazeZone) irisColor = '#4af';
  else if (lastGazeVal >  cfg.gazeZone) irisColor = '#fa4';

  ctx.beginPath();
  ctx.arc(iris.x, iris.y, irisRadius, 0, Math.PI * 2);
  ctx.strokeStyle = irisColor;
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(iris.x, iris.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = irisColor;
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(4, 4, 88, 36);
  ctx.fillStyle = '#888';
  ctx.font = `${Math.max(10, W * 0.038)}px monospace`;
  ctx.fillText(`EAR  ${lastEarVal.toFixed(3)}`, 8, 18);
  ctx.fillText(`gaze ${lastGazeVal.toFixed(2)}`, 8, 34);
}

// ─────────────────────────────────────────────────────────────────────────
// Eye tracking
// ─────────────────────────────────────────────────────────────────────────
function d2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeEar(lm) {
  const e  = eLM();
  const v1 = d2(lm[e.t0], lm[e.b0]);
  const v2 = d2(lm[e.t1], lm[e.b1]);
  const v3 = d2(lm[e.t2], lm[e.b2]);
  const h  = d2(lm[e.c0], lm[e.c1]);
  return h < 1e-7 ? 1 : (v1 + v2 + v3) / (3 * h);
}

function computeGazeRatio(lm) {
  const e          = eLM();
  const cornerMidY = (lm[e.c0].y + lm[e.c1].y) / 2;
  const eyeWidth   = d2(lm[e.c0], lm[e.c1]);
  return eyeWidth < 1e-7 ? 0 : (lm[e.iris].y - cornerMidY) / eyeWidth;
}

// ── Smoothing ring buffer (gaze only, 6 frames) ──────────────────────────
const SMOOTH_N = 6;
const gazeBuf  = new Array(SMOOTH_N).fill(0.00);
let   bufPtr   = 0;

// ── Mode-change confirmation modal ───────────────────────────────────────
// Long blink #1 → show modal "Modus wechseln?"
// Long blink #2 (while modal open) → confirm: cycle mode
// Gaze up/down or 5 s timeout → dismiss modal

const MODE_MODAL_TIMEOUT = 5000;
let modeModalOpen  = false;
let modeModalTimer = null;
let modeModalStart = null;  // for countdown bar animation

function openModeModal() {
  modeModalOpen  = true;
  modeModalStart = Date.now();
  const modal = document.getElementById('mode-modal');
  const bar   = document.getElementById('mode-modal-bar');
  modal.classList.add('open');
  bar.style.width = '100%';
  // Animate bar shrinking to 0 over MODE_MODAL_TIMEOUT
  requestAnimationFrame(() => {
    bar.style.transition = `width ${MODE_MODAL_TIMEOUT}ms linear`;
    bar.style.width = '0%';
  });
  modeModalTimer = setTimeout(closeModeModal, MODE_MODAL_TIMEOUT);
}

function closeModeModal() {
  modeModalOpen = false;
  clearTimeout(modeModalTimer);
  const modal = document.getElementById('mode-modal');
  const bar   = document.getElementById('mode-modal-bar');
  modal.classList.remove('open');
  bar.style.transition = '';
  bar.style.width = '100%';
}

// ── Blink dispatch ────────────────────────────────────────────────────────
// Short blink (blinkMin–blinkMax ms) → select current item
// Long blink  (≥ longBlinkMin ms)    → open modal (1st) or confirm mode change (2nd)

function handleBlink(dur) {
  // Long holds are handled mid-frame (see onResults); ignore them here.
  if (dur >= cfg.blinkMin && dur <= cfg.blinkMax) {
    if (modeModalOpen) {
      closeModeModal();
      cycleMode();
      sndModeChange();
    } else if (mode === 'spelling') {
      spSelectCurrent();
      showGaze('mid'); sndSelect();
    } else if (mode === 'wordtree') {
      wtSelectCurrent();
      showGaze('mid'); sndSelect();
    } else if (mode === 'sätze') {
      stSelectCurrent();
      showGaze('mid'); sndSelect();
    }
  }
}

// ── Calibration wizard ────────────────────────────────────────────────────
// Step 1 – Look straight : collect 60 frames → neutral gaze + open EAR
// Step 2 – Close eye     : collect 40 frames → closed EAR → compute earThresh
// Step 3 – Look up       : collect 60 frames → up gaze threshold
// Step 4 – Look down     : collect 60 frames → down gaze threshold

const CALIB_CLOSE_THRESH = 0.32;
const CALIB_FRAMES_CLOSE = 40;
const CALIB_FRAMES_GAZE  = 60;

let wizardStep            = 0;
let wizardWaitingForClick = false;
let wizardReady           = false;
let wizardSamples         = [];
let closedEarMean         = 0;
let straightGazeMean      = 0;

function arrMean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

function wizardProgress(n, total) {
  document.getElementById('calib-ov-bar').style.width = (n / total * 100) + '%';
}

function wizardShow(step) {
  const ov       = document.getElementById('calib-overlay');
  const title    = document.getElementById('calib-ov-title');
  const instr    = document.getElementById('calib-ov-instr');
  const bar      = document.getElementById('calib-ov-bar');
  const startBtn = document.getElementById('calib-ov-start');
  const track    = document.getElementById('calib-ov-track');
  ov.style.display    = 'flex';
  bar.style.width     = '0%';
  track.style.opacity = '0';
  startBtn.classList.remove('hidden');
  wizardWaitingForClick = true;
  const STEPS = {
    1: ['Schritt 1 / 4', 'Geradeaus schauen'],
    2: ['Schritt 2 / 4', 'Auge schließen und geschlossen halten'],
    3: ['Schritt 3 / 4', 'Nach OBEN schauen und halten'],
    4: ['Schritt 4 / 4', 'Nach UNTEN schauen und halten'],
  };
  [title.textContent, instr.textContent] = STEPS[step];
}

function wizardClose() {
  document.getElementById('calib-overlay').style.display = 'none';
  document.getElementById('calib-btn').textContent = 'Kalibrieren ✓';
  cfg.calibrated = true;
  saveCfg();
}

function startCalibration() {
  wizardStep    = 1;
  wizardReady   = false;
  wizardSamples = [];
  wizardShow(1);
}

let blinkStart    = null;
let eyeWasClosed  = false;
let lastGazeTime  = 0;
let earCloseStart = null;   // timestamp when EAR first dropped below threshold
let longHoldFired = false;  // true once the 3 s hold has triggered this closure

function onResults(results) {
  if (!results.multiFaceLandmarks?.length) {
    setStatus('Kein Gesicht erkannt', '#f84');
    drawOverlay(null);
    return;
  }
  setStatus('Tracking aktiv ●', '#4a4');

  const lm  = results.multiFaceLandmarks[0];
  const now = Date.now();

  // EAR with hysteresis — strict threshold for blink detection
  const rawEar       = computeEar(lm);
  const earBelowThresh = eyeWasClosed
    ? rawEar < (cfg.earThresh + 0.07)
    : rawEar < cfg.earThresh;

  // Time-based debounce: eye counts as closed only after EAR stays below
  // threshold for closeDebounceMs — filters out involuntary micro-closures.
  if (earBelowThresh) {
    if (earCloseStart === null) earCloseStart = now;
  } else {
    earCloseStart = null;
  }
  const eyeClosed = earBelowThresh && (now - earCloseStart) >= cfg.closeDebounceMs;

  // Lenient gate for gaze navigation — 65% of earThresh.
  // Natural eyelid droop during downward gaze doesn't block the wheel.
  const eyeOpenForGaze = rawEar > cfg.earThresh * 0.65;

  // Smoothed gaze
  gazeBuf[bufPtr % SMOOTH_N] = computeGazeRatio(lm);
  bufPtr++;
  const gazeVal = gazeBuf.reduce((a, b) => a + b) / SMOOTH_N;

  lastEarVal    = rawEar;
  lastGazeVal   = gazeVal;
  lastEyeClosed = eyeClosed;

  // ── Calibration wizard ───────────────────────────────────────
  if (wizardStep > 0 && wizardWaitingForClick) { /* waiting for click */ }
  else if (wizardStep === 1) {
    if (rawEar > CALIB_CLOSE_THRESH) {
      wizardSamples.push({ g: gazeVal, e: rawEar });
      wizardProgress(wizardSamples.length, CALIB_FRAMES_GAZE);
      if (wizardSamples.length >= CALIB_FRAMES_GAZE) {
        straightGazeMean = arrMean(wizardSamples.map(s => s.g));
        closedEarMean    = arrMean(wizardSamples.map(s => s.e)); // open EAR, stored temporarily
        wizardStep = 2; wizardSamples = []; wizardShow(2);
      }
    }
  } else if (wizardStep === 2) {
    if (!wizardReady) {
      if (rawEar < CALIB_CLOSE_THRESH) { wizardReady = true; wizardSamples = []; }
    } else {
      if (rawEar < CALIB_CLOSE_THRESH) {
        wizardSamples.push(rawEar);
        wizardProgress(wizardSamples.length, CALIB_FRAMES_CLOSE);
        if (wizardSamples.length >= CALIB_FRAMES_CLOSE) {
          const openEarMean  = closedEarMean;
          const closedEarNow = arrMean(wizardSamples);
          cfg.earThresh = parseFloat(((openEarMean + closedEarNow) / 2).toFixed(3));
          document.getElementById('s-ear').value = cfg.earThresh;
          document.getElementById('v-ear').textContent = cfg.earThresh.toFixed(2);
          closedEarMean = closedEarNow;
          wizardStep = 3; wizardSamples = []; wizardShow(3);
        }
      }
    }
  } else if (wizardStep === 3) {
    if (rawEar > closedEarMean) {
      wizardSamples.push(gazeVal);
      wizardProgress(wizardSamples.length, CALIB_FRAMES_GAZE);
      if (wizardSamples.length >= CALIB_FRAMES_GAZE) {
        const upMean = arrMean(wizardSamples);
        cfg.gazeUpThresh = parseFloat(((straightGazeMean + upMean) / 2).toFixed(4));
        wizardStep = 4; wizardSamples = []; wizardShow(4);
      }
    }
  } else if (wizardStep === 4) {
    if (rawEar > closedEarMean) {
      wizardSamples.push(gazeVal);
      wizardProgress(wizardSamples.length, CALIB_FRAMES_GAZE);
      if (wizardSamples.length >= CALIB_FRAMES_GAZE) {
        const downMean = arrMean(wizardSamples);
        cfg.gazeDownThresh = parseFloat(((straightGazeMean + downMean) / 2).toFixed(4));
        cfg.gazeZone = parseFloat(((Math.abs(cfg.gazeUpThresh) + cfg.gazeDownThresh) / 2).toFixed(4));
        document.getElementById('s-gz').value = cfg.gazeZone;
        document.getElementById('v-gz').textContent = cfg.gazeZone.toFixed(3);
        wizardStep = 0; wizardClose();
      }
    }
  }

  // Update eye indicator
  const ind = document.getElementById('eye-indicator');
  const lbl = document.getElementById('eye-label');
  if (eyeClosed) {
    ind.className = 'closed'; lbl.textContent = 'GESCHLOSSEN';
  } else {
    ind.className = 'open';   lbl.textContent = 'OFFEN';
  }

  drawOverlay(lm);

  // ── Blink / hold detection (suppressed during calibration) ──────────
  if (wizardStep !== 0) { eyeWasClosed = earBelowThresh; return; }
  if (earBelowThresh && !eyeWasClosed) {
    blinkStart    = now;
    longHoldFired = false;
  }
  // While closed: update hold-progress bar and fire modal at threshold
  if (earBelowThresh && blinkStart !== null) {
    const holdPct = Math.min((now - blinkStart) / cfg.longHoldMs * 100, 100);
    const hi = document.getElementById('hold-indicator');
    const hb = document.getElementById('hold-bar');
    hi.classList.add('active');
    hb.style.width = holdPct + '%';
    if (!longHoldFired && holdPct >= 100) {
      longHoldFired = true;
      hi.classList.add('done');
      playToneEl('hold');
      if (modeModalOpen) {
        closeModeModal();
        cycleMode();
        sndModeChange();
      } else if (modeSwitchingEnabled()) {
        openModeModal();
      }
    }
  }
  // Eye opened: reset bar; process as short blink only if hold never fired
  if (!earBelowThresh && eyeWasClosed) {
    const hi = document.getElementById('hold-indicator');
    const hb = document.getElementById('hold-bar');
    hi.classList.remove('active', 'done');
    hb.style.width = '0%';
    if (blinkStart !== null && !longHoldFired) {
      handleBlink(now - blinkStart);
    }
    blinkStart    = null;
    longHoldFired = false;
  }
  eyeWasClosed = earBelowThresh;

  // ── Gaze detection ───────────────────────────────────────────────────
  // While mode modal is open, a deliberate gaze dismisses it.
  // Grace period of 1500 ms after modal opens: ignore gaze so that the
  // eye naturally opening after the hold doesn't immediately close the modal.
  const MODAL_GAZE_GRACE = 1500;
  if (modeModalOpen && eyeOpenForGaze && !earBelowThresh && (now - modeModalStart) > MODAL_GAZE_GRACE) {
    const anyGaze = gazeVal < cfg.gazeUpThresh || gazeVal > cfg.gazeDownThresh;
    if (anyGaze && now - lastGazeTime > cfg.gazeDebounce) {
      closeModeModal();
      lastGazeTime = now;
    }
  } else if (mode !== 'inactive' && eyeOpenForGaze && now - lastGazeTime > cfg.gazeDebounce) {
    if (gazeVal < cfg.gazeUpThresh) {
      if (mode === 'spelling') {
        spIdx = ((spIdx - 1) % spItems.length + spItems.length) % spItems.length;
        renderSpelling();
      } else if (mode === 'sätze') {
        stIdx = ((stIdx - 1) % stItems.length + stItems.length) % stItems.length;
        renderSätze();
      } else {
        wtIdx = ((wtIdx - 1) % wtItems.length + wtItems.length) % wtItems.length;
        renderWordTree();
      }
      showGaze('up'); sndUp();
      lastGazeTime = now;
    } else if (cfg.gazeDownEnabled && gazeVal > cfg.gazeDownThresh) {
      if (mode === 'spelling') {
        spIdx = (spIdx + 1) % spItems.length;
        renderSpelling();
      } else if (mode === 'sätze') {
        stIdx = (stIdx + 1) % stItems.length;
        renderSätze();
      } else {
        wtIdx = (wtIdx + 1) % wtItems.length;
        renderWordTree();
      }
      showGaze('dn'); sndDown();
      lastGazeTime = now;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Audio feedback — HTMLAudioElement + WAV data-URIs
//
// Web Audio API (AudioContext) gets permanently suspended on iOS Safari once
// the camera-permission dialog appears, and resume() outside a user gesture
// is silently ignored — there is no recovery path.
// HTMLAudioElement.play() does NOT have this problem: once unlocked via a
// tap in the start-splash handler it stays playable for the lifetime of the
// page without needing further user gestures.
// ─────────────────────────────────────────────────────────────────────────

/** Build a mono 16-bit PCM WAV and return it as a data: URI. */
function makeSineWav(freq, durationMs, vol) {
  const SR     = 22050;
  const frames = Math.ceil(SR * durationMs / 1000);
  const fade   = Math.ceil(frames * 0.15);
  const pcm    = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    const env = i < fade ? i / fade : Math.min(1, (frames - i) / fade);
    pcm[i] = Math.round(Math.sin(2 * Math.PI * freq * i / SR) * vol * 32767 * env);
  }
  const out  = new Uint8Array(44 + frames * 2);
  const view = new DataView(out.buffer);
  // RIFF/WAVE/fmt/data header
  [0x52,0x49,0x46,0x46].forEach((b,i) => { out[i]    = b; }); // 'RIFF'
  view.setUint32( 4, 36 + frames * 2, true);
  [0x57,0x41,0x56,0x45].forEach((b,i) => { out[8+i]  = b; }); // 'WAVE'
  [0x66,0x6d,0x74,0x20].forEach((b,i) => { out[12+i] = b; }); // 'fmt '
  view.setUint32(16, 16,       true);   // subchunk size
  view.setUint16(20,  1,       true);   // PCM
  view.setUint16(22,  1,       true);   // mono
  view.setUint32(24, SR,       true);   // sample rate
  view.setUint32(28, SR * 2,   true);   // byte rate
  view.setUint16(32,  2,       true);   // block align
  view.setUint16(34, 16,       true);   // bits per sample
  [0x64,0x61,0x74,0x61].forEach((b,i) => { out[36+i] = b; }); // 'data'
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, pcm[i], true);
  // base64 encode without btoa length limit
  let bin = '';
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

// All tones pre-baked as Audio elements at load time.
const TONES = (() => {
  const defs = {
    up:    [1050,  70, 0.18],
    down:  [ 520,  70, 0.18],
    sel1:  [ 600,  90, 0.18],
    sel2:  [1000, 130, 0.18],
    mode1: [ 400, 100, 0.18],
    mode2: [ 600, 100, 0.18],
    mode3: [ 900, 160, 0.18],
    hold:  [ 440, 250, 0.30],
  };
  const map = {};
  for (const [k, [f, d, v]] of Object.entries(defs)) {
    map[k] = new Audio(makeSineWav(f, d, v));
  }
  return map;
})();

/**
 * Call synchronously inside a user-gesture handler (start-splash tap) to
 * unlock all Audio elements on iOS.  Each element must be individually
 * play()-ed inside the gesture; we mute them so the user hears nothing.
 */
function unlockAudio() {
  for (const audio of Object.values(TONES)) {
    audio.volume = 0;
    const p = audio.play();
    if (p) p.catch(() => {});
  }
  // Restore volume after the silent plays have started.
  setTimeout(() => {
    for (const audio of Object.values(TONES)) audio.volume = 1;
  }, 300);
}

function playToneEl(key) {
  if (!cfg.soundOn) return;
  const audio = TONES[key];
  if (!audio) return;
  try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (_) {}
}

function sndUp()         { playToneEl('up'); }
function sndDown()       { playToneEl('down'); }
function sndSelect()     { playToneEl('sel1'); setTimeout(() => playToneEl('sel2'), 75); }
function sndModeChange() { playToneEl('mode1'); setTimeout(() => playToneEl('mode2'), 110); setTimeout(() => playToneEl('mode3'), 220); }

// ─────────────────────────────────────────────────────────────────────────
// Settings panel
// ─────────────────────────────────────────────────────────────────────────
function bindSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('open');
  });

  const rows = [
    ['s-gd',   'v-gd',   'gazeDebounce', v => v + 'ms'],
    ['s-bmin',   'v-bmin',   'blinkMin',      v => v + 'ms'],
    ['s-bmax',   'v-bmax',   'blinkMax',      v => v + 'ms'],
    ['s-lblink', 'v-lblink', 'longHoldMs',    v => v + 'ms'],
    ['s-gz',   'v-gz',   'gazeZone',     v => parseFloat(v).toFixed(3)],
    ['s-ear',  'v-ear',  'earThresh',       v => parseFloat(v).toFixed(2)],
    ['s-cdeb', 'v-cdeb', 'closeDebounceMs', v => v + 'ms'],
  ];

  const eyeSel = document.getElementById('s-eye');
  eyeSel.value = cfg.eyeSide;
  eyeSel.addEventListener('change', () => {
    cfg.eyeSide = eyeSel.value;
    saveCfg();
  });

  const gdownCb = document.getElementById('s-gdown');
  gdownCb.checked = cfg.gazeDownEnabled;
  gdownCb.addEventListener('change', () => {
    cfg.gazeDownEnabled = gdownCb.checked;
    saveCfg();
  });

  for (const [sid, vid, key, fmt] of rows) {
    const slider = document.getElementById(sid);
    const label  = document.getElementById(vid);
    slider.value      = cfg[key];
    label.textContent = fmt(cfg[key]);
    slider.addEventListener('input', () => {
      cfg[key] = parseFloat(slider.value);
      label.textContent = fmt(slider.value);
      if (key === 'gazeZone') {
        cfg.gazeUpThresh   = -cfg.gazeZone;
        cfg.gazeDownThresh =  cfg.gazeZone;
      }
      saveCfg();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Keyboard fallback
// ─────────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cycleMode(); e.preventDefault();
  } else if (e.key === 'ArrowUp' && mode !== 'inactive') {
    if (mode === 'spelling') { spIdx = ((spIdx - 1) % spItems.length + spItems.length) % spItems.length; renderSpelling(); }
    else if (mode === 'sätze') { stIdx = ((stIdx - 1) % stItems.length + stItems.length) % stItems.length; renderSätze(); }
    else { wtIdx = ((wtIdx - 1) % wtItems.length + wtItems.length) % wtItems.length; renderWordTree(); }
    showGaze('up'); e.preventDefault();
  } else if (e.key === 'ArrowDown' && mode !== 'inactive') {
    if (mode === 'spelling') { spIdx = (spIdx + 1) % spItems.length; renderSpelling(); }
    else if (mode === 'sätze') { stIdx = (stIdx + 1) % stItems.length; renderSätze(); }
    else { wtIdx = (wtIdx + 1) % wtItems.length; renderWordTree(); }
    showGaze('dn'); e.preventDefault();
  } else if ((e.key === 'Enter' || e.key === ' ') && mode !== 'inactive') {
    if (mode === 'spelling') spSelectCurrent();
    else if (mode === 'sätze') stSelectCurrent();
    else wtSelectCurrent();
    showGaze('mid'); e.preventDefault();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────
(function init() {
  spReset();
  renderText();
  bindSettings();
  applyMode();

  document.getElementById('speak-btn').addEventListener('click', () => {
    if (buf.trim()) { addHistory(buf, 'spoken'); tts(buf); buf = ''; renderText(); }
  });

  document.getElementById('calib-btn').addEventListener('click', startCalibration);

  const soundBtn = document.getElementById('sound-btn');
  function updateSoundBtn() {
    soundBtn.textContent = cfg.soundOn ? '🔔 Sound AN' : '🔕 Sound AUS';
    soundBtn.classList.toggle('off', !cfg.soundOn);
  }
  updateSoundBtn();
  soundBtn.addEventListener('click', () => {
    cfg.soundOn = !cfg.soundOn;
    updateSoundBtn();
    saveCfg();
  });

  ['inactive', 'wordtree', 'spelling', 'sätze'].forEach(m => {
    const cb = document.getElementById(`s-m-${m}`);
    cb.checked = cfg.enabledModes[m] !== false;
    cb.addEventListener('change', () => {
      cfg.enabledModes[m] = cb.checked;
      if (mode === m && !cfg.enabledModes[m]) {
        // Current mode disabled — jump to first available mode, or inactive if none
        mode = activeModes()[0] ?? 'inactive';
        applyMode();
      }
      saveCfg();
    });
  });

  const camBtn = document.getElementById('cam-btn');
  function updateCamBtn() {
    camBtn.textContent = cfg.showCamera ? '📷 Kamera AN' : '📷 Kamera AUS';
    camBtn.classList.toggle('off', !cfg.showCamera);
    const display = cfg.showCamera ? '' : 'none';
    canvas.style.display = display;
    document.getElementById('cam-wrap').style.display = display;
  }
  updateCamBtn();
  camBtn.addEventListener('click', () => {
    cfg.showCamera = !cfg.showCamera;
    updateCamBtn();
    saveCfg();
  });

  document.getElementById('calib-ov-start').addEventListener('click', () => {
    wizardWaitingForClick = false;
    wizardReady   = false;
    wizardSamples = [];
    document.getElementById('calib-ov-start').classList.add('hidden');
    document.getElementById('calib-ov-track').style.opacity = '1';
  });

  document.getElementById('calib-ov-cancel').addEventListener('click', () => {
    wizardStep = 0;
    document.getElementById('calib-overlay').style.display = 'none';
  });

  document.getElementById('mode-badge').addEventListener('click', cycleMode);

  // Start button: unlocks Web Audio + Speech Synthesis synchronously (iOS
  // requires both to be triggered directly inside a user-gesture handler),
  // then starts the camera.
  document.getElementById('start-btn').addEventListener('click', () => {
    // Unlock all Audio elements — must happen synchronously inside this gesture.
    unlockAudio();

    // Unlock Speech Synthesis — silent utterance in the same gesture.
    try {
      const utt = new SpeechSynthesisUtterance('');
      utt.volume = 0;
      speechSynthesis.speak(utt);
    } catch (_) {}

    document.getElementById('start-splash').classList.add('hidden');

    startCamera();
    if (!cfg.calibrated) startCalibration();
  });
})();

async function startCamera() {
  if (typeof FaceMesh === 'undefined' || typeof Camera === 'undefined') {
    setStatus('MediaPipe nicht geladen — Tastatur-Modus aktiv', '#fa4');
    return;
  }

  const faceMesh = new FaceMesh({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  faceMesh.setOptions({
    maxNumFaces:            1,
    refineLandmarks:        true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });

  faceMesh.onResults(onResults);

  const cam = new Camera(videoEl, {
    onFrame: async () => { await faceMesh.send({ image: videoEl }); },
    width:  320,
    height: 240,
  });

  try {
    await cam.start();
    setStatus('Kamera bereit', '#4a4');
  } catch (err) {
    setStatus('Kamera-Fehler: ' + err.message + ' — Tastatur-Modus aktiv', '#f84');
  }
}
