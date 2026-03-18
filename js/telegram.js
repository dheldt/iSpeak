'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Telegram Bot API — direct browser client
//
// api.telegram.org returns Access-Control-Allow-Origin: * so no proxy is
// needed. All data (token, contacts, messages) stays in the browser only.
// ─────────────────────────────────────────────────────────────────────────

const TG = {
  BASE:         'https://api.telegram.org',
  lastUpdateId: 0,
  pollTimer:    null,
  messages:     [],      // up to MAX_TG_MESSAGES, newest first
  lastSenderId: null,    // chatId of most recent incoming message
};

// ── Contact-selection modal state ─────────────────────────────────────────
let tgModalOpen     = false;
let tgModalItems    = [];   // [{name, chatId}] + cancel entry
let tgModalIdx      = 0;
let tgModalText     = '';
let tgModalCallback = null;

const MAX_TG_MESSAGES  = 100;
const TG_MESSAGES_KEY  = 'ispeak_tg_messages';
const TG_OFFSET_KEY    = 'ispeak_tg_offset';

function tgSaveMessages() {
  try {
    localStorage.setItem(TG_MESSAGES_KEY, JSON.stringify(TG.messages));
    localStorage.setItem(TG_OFFSET_KEY,   String(TG.lastUpdateId));
  } catch (_) {}
}

function tgLoadMessages() {
  try {
    const raw = localStorage.getItem(TG_MESSAGES_KEY);
    if (raw) TG.messages = JSON.parse(raw);
  } catch (_) { TG.messages = []; }
  try {
    const off = localStorage.getItem(TG_OFFSET_KEY);
    if (off) TG.lastUpdateId = parseInt(off) || 0;
  } catch (_) {}
}

// ── Low-level API call ────────────────────────────────────────────────────
async function tgApi(method, params = {}) {
  const token = (cfg.tgToken || '').trim();
  if (!token) return null;
  try {
    const res = await fetch(`${TG.BASE}/bot${token}/${method}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });
    if (!res.ok) { tgSetStatus('HTTP ' + res.status, 'err'); return null; }
    const data = await res.json();
    if (!data.ok) { tgSetStatus(data.description || 'API-Fehler', 'err'); return null; }
    return data.result;
  } catch (e) {
    tgSetStatus('Verbindungsfehler', 'err');
    return null;
  }
}

// ── Telegram mode — contact list + conversation wheel ─────────────────────
const TM_BACK  = '← Zurück';
const TM_EMPTY = '(Keine Kontakte)';

let tmLevel   = 0;
let tmContact = null;
let tmItems   = [];
let tmIdx     = 0;

function tmItemLabel(item) {
  if (typeof item === 'string') return item;
  if (item.direction !== undefined) {
    const arrow = item.direction === 'in' ? '◀' : '▶';
    const body  = item.voiceId ? '[Sprachnachricht]' : (item.text || '');
    return arrow + ' ' + (body.length > 38 ? body.slice(0, 38) + '…' : body);
  }
  return item.name;  // contact
}

function tmReset() {
  tmLevel   = 0;
  tmContact = null;
  if (cfg.tgContacts.length) {
    tmItems = [...cfg.tgContacts];
    const lastIdx = cfg.tgContacts.findIndex(c => c.chatId === TG.lastSenderId);
    tmIdx = lastIdx >= 0 ? lastIdx : 0;
  } else {
    tmItems = [TM_EMPTY];
    tmIdx   = 0;
  }
  renderTelegram();
  updateTmBreadcrumb();
}

function tmSelectCurrent() {
  const chosen = tmItems[tmIdx];
  if (chosen === TM_BACK)  { tmReset(); return; }
  if (chosen === TM_EMPTY) { return; }
  if (typeof chosen === 'string') return;

  if (chosen.direction !== undefined) {
    // It's a message — speak or play
    if (chosen.voiceId) {
      tgPlayVoice(chosen.voiceId);
    } else if (chosen.text) {
      const when = new Date(chosen.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const who  = chosen.direction === 'in' ? chosen.fromName : 'Ich';
      tts(`${who} um ${when}: ${chosen.text}`);
    }
    return;
  }

  // It's a contact — open conversation
  tmContact = chosen;
  tmLevel   = 1;
  const msgs = TG.messages.filter(m => m.chatId === chosen.chatId);
  tmItems = [TM_BACK, ...msgs];
  tmIdx   = 0;
  renderTelegram();
  updateTmBreadcrumb();
}

function renderTelegram() {
  const total = tmItems.length;
  if (!total) return;
  tmIdx = ((tmIdx % total) + total) % total;
  const itemAt = off => tmItems[((tmIdx + off) % total + total) % total];

  document.getElementById('tm-p2').textContent = tmItemLabel(itemAt(-2));
  document.getElementById('tm-p1').textContent = tmItemLabel(itemAt(-1));

  const mainEl  = document.getElementById('tm-main');
  const current = itemAt(0);
  mainEl.textContent = tmItemLabel(current);
  mainEl.classList.toggle('wt-back', current === TM_BACK);

  document.getElementById('tm-n1').textContent = tmItemLabel(itemAt(+1));
  document.getElementById('tm-n2').textContent = tmItemLabel(itemAt(+2));

  // Smaller font in conversation view to fit message text
  const panel = document.getElementById('wheel-telegram');
  if (panel) panel.classList.toggle('tm-conv', tmLevel === 1);
}

function updateTmBreadcrumb() {
  const el = document.getElementById('wt-breadcrumb');
  if (el) el.textContent = tmLevel === 0 ? 'Telegram' : `Telegram › ${tmContact?.name || ''}`;
}

// ── Polling ───────────────────────────────────────────────────────────────
function tgStartPolling() {
  tgStopPolling();
  if (cfg.tgPollMode !== 'auto' || !(cfg.tgToken || '').trim()) return;
  if (cfg.enabledModes?.telegram === false) return;
  const ms = (cfg.tgPollSeconds || 60) * 1000;
  TG.pollTimer = setInterval(tgPoll, ms);
}

function tgStopPolling() {
  clearInterval(TG.pollTimer);
  TG.pollTimer = null;
}

async function tgPoll() {
  if (!(cfg.tgToken || '').trim()) return;
  tgSetStatus('Abruf…', 'busy');
  const updates = await tgApi('getUpdates', {
    offset:          TG.lastUpdateId + 1,
    timeout:         0,
    allowed_updates: ['message'],
  });
  if (!updates) return;
  for (const u of updates) {
    if (u.update_id > TG.lastUpdateId) TG.lastUpdateId = u.update_id;
    if (u.message) tgHandleMessage(u.message);
  }
  tgSetStatus('Bereit', 'ok');
}

// ── Incoming messages ─────────────────────────────────────────────────────
function tgHandleMessage(msg) {
  const chatId   = String(msg.chat.id);
  const fromName = msg.from?.first_name
    ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
    : msg.chat?.title || chatId;

  TG.lastSenderId = chatId;

  // Auto-add unknown senders to contacts
  if (!cfg.tgContacts.find(c => c.chatId === chatId)) {
    cfg.tgContacts.push({ name: fromName, chatId });
    saveCfg();
    tgRenderContacts();
  }

  const entry = {
    id:        msg.message_id,
    chatId,
    fromName,
    text:      msg.text  || null,
    voiceId:   msg.voice?.file_id || msg.audio?.file_id || null,
    date:      msg.date * 1000,
    direction: 'in',
  };

  TG.messages.unshift(entry);
  if (TG.messages.length > MAX_TG_MESSAGES) TG.messages.pop();
  tgSaveMessages();
  tgRenderMessages();
  tgUpdateBadge(true);

  // Refresh conversation wheel if currently viewing this contact
  if (typeof mode !== 'undefined' && mode === 'telegram' && tmLevel === 1 && tmContact?.chatId === chatId) {
    const msgs = TG.messages.filter(m => m.chatId === chatId);
    tmItems = [TM_BACK, ...msgs];
    tmIdx   = 0;
    renderTelegram();
  }

  // Auto-play with sender announcement
  const timeStr = new Date(entry.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (entry.voiceId) {
    tts(`Sprachnachricht von ${entry.fromName} um ${timeStr}.`);
    tgPlayVoice(entry.voiceId);
  } else if (entry.text) {
    tts(`Nachricht von ${entry.fromName} um ${timeStr}: ${entry.text}`);
  }
}

// ── Send message ──────────────────────────────────────────────────────────
async function tgSend(text, chatId) {
  const id      = chatId || cfg.tgActiveContact;
  const contact = cfg.tgContacts.find(c => c.chatId === id);
  if (!contact) { tgSetStatus('Kein Kontakt gewählt', 'err'); return false; }
  tgSetStatus('Sende…', 'busy');
  tts(`Sende ${text} an ${contact.name}.`);
  const result = await tgApi('sendMessage', { chat_id: contact.chatId, text });
  if (!result) return false;

  const entry = {
    id:        result.message_id,
    chatId:    contact.chatId,
    fromName:  'Ich',
    text,
    voiceId:   null,
    date:      Date.now(),
    direction: 'out',
  };
  TG.messages.unshift(entry);
  if (TG.messages.length > MAX_TG_MESSAGES) TG.messages.pop();
  tgSaveMessages();
  tgRenderMessages();
  tgSetStatus('Gesendet ✓', 'ok');
  return true;
}

// ── Voice playback ────────────────────────────────────────────────────────
async function tgPlayVoice(fileId) {
  const token = (cfg.tgToken || '').trim();
  if (!token) return;
  const file = await tgApi('getFile', { file_id: fileId });
  if (!file?.file_path) return;
  const url   = `${TG.BASE}/file/bot${token}/${file.file_path}`;
  const audio = new Audio(url);
  audio.play().catch(() => {});
}

// ── Status indicator ──────────────────────────────────────────────────────
function tgSetStatus(text, state) {
  const el = document.getElementById('tg-status');
  if (!el) return;
  el.textContent = text;
  el.className   = 'tg-status' + (state ? ' tg-' + state : '');
}

// ── Unread badge on the Telegram button ───────────────────────────────────
let tgHasUnread = false;
function tgUpdateBadge(hasNew) {
  if (hasNew) tgHasUnread = true;
  const btn  = document.getElementById('tg-btn');
  const open = document.getElementById('tg-overlay')?.classList.contains('open');
  if (open) tgHasUnread = false;
  if (!btn) return;
  btn.classList.toggle('unread',     tgHasUnread);
  btn.classList.toggle('connected', !!(cfg.tgToken || '').trim());
}

// ── Render message list ───────────────────────────────────────────────────
function tgRenderMessages() {
  const el = document.getElementById('tg-msg-list');
  if (!el) return;
  if (!TG.messages.length) {
    el.innerHTML = '<div class="tg-empty">Keine Nachrichten</div>';
    return;
  }
  el.innerHTML = TG.messages.map(m => {
    const time = new Date(m.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const dir  = m.direction === 'out' ? 'tg-out' : 'tg-in';
    const body = m.voiceId
      ? `<button class="tg-play-btn" data-fid="${tgEsc(m.voiceId)}">▶ Abspielen</button>`
      : `<span class="tg-bubble">${tgEsc(m.text || '')}</span>`;
    return `<div class="tg-msg ${dir}">
      <span class="tg-meta">${tgEsc(m.fromName)} · ${time}</span>
      ${body}
    </div>`;
  }).join('');

  el.querySelectorAll('.tg-play-btn').forEach(btn =>
    btn.addEventListener('click', () => tgPlayVoice(btn.dataset.fid))
  );
}

function tgEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Render contact list in settings ──────────────────────────────────────
function tgRenderContacts() {
  // Active contact selector
  const sel = document.getElementById('tg-active-contact');
  if (sel) {
    const prev = sel.value || cfg.tgActiveContact;
    sel.innerHTML = cfg.tgContacts.length
      ? cfg.tgContacts.map(c =>
          `<option value="${tgEsc(c.chatId)}">${tgEsc(c.name)}</option>`
        ).join('')
      : '<option value="">— kein Kontakt —</option>';
    const keep = cfg.tgContacts.find(c => c.chatId === prev);
    sel.value = keep ? prev : (cfg.tgContacts[0]?.chatId || '');
    cfg.tgActiveContact = sel.value;
    saveCfg();
  }

  // Contact list with remove buttons
  const list = document.getElementById('tg-contact-list');
  if (!list) return;
  if (!cfg.tgContacts.length) {
    list.innerHTML = '<div class="tg-empty-contacts">Noch keine Kontakte – schreib dem Bot zuerst eine Nachricht, um dich automatisch hinzuzufügen, oder füge einen manuell hinzu.</div>';
    return;
  }
  list.innerHTML = cfg.tgContacts.map((c, i) =>
    `<div class="tg-contact-row">
      <span class="tg-contact-name">${tgEsc(c.name)}</span>
      <span class="tg-contact-id">${tgEsc(c.chatId)}</span>
      <button class="tg-rm-btn" data-idx="${i}" title="Entfernen">✕</button>
    </div>`
  ).join('');

  list.querySelectorAll('.tg-rm-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      cfg.tgContacts.splice(parseInt(btn.dataset.idx), 1);
      if (!cfg.tgContacts.find(c => c.chatId === cfg.tgActiveContact)) {
        cfg.tgActiveContact = cfg.tgContacts[0]?.chatId || '';
      }
      saveCfg();
      tgRenderContacts();
    })
  );
}

// ── Format poll interval label ────────────────────────────────────────────
function tgFmtInterval(sec) {
  if (sec < 60)   return `${sec} s`;
  if (sec < 3600) return `${sec / 60} min`;
  return `${sec / 3600} h`;
}

// ── Update send button visibility ─────────────────────────────────────────
function tgUpdateSendBtn() {
  const btn = document.getElementById('tg-send-btn');
  if (btn) btn.style.display = (cfg.tgToken || '').trim() ? '' : 'none';
}

// ── tgInitiateSend — entry point for all "send to Telegram" actions ────────
// text    : the string to send
// callback: called (no args) on successful send (e.g. clear buffer)
function tgInitiateSend(text, callback) {
  if (!(cfg.tgToken || '').trim()) { tgSetStatus('Kein Token konfiguriert', 'err'); return; }
  if (!cfg.tgContacts.length)      { tgSetStatus('Keine Kontakte konfiguriert', 'err'); return; }

  if (cfg.tgContacts.length === 1) {
    // Single contact — send immediately, no modal needed
    tgSend(text, cfg.tgContacts[0].chatId).then(ok => { if (ok && callback) callback(); });
    return;
  }

  // Multiple contacts — open selection wheel
  tgModalText     = text;
  tgModalCallback = callback;
  tgModalItems    = [
    ...cfg.tgContacts,
    { name: '✕ Abbrechen', chatId: null },
  ];

  // Default to the contact who last sent a message, otherwise first contact
  const lastIdx = tgModalItems.findIndex(c => c.chatId === TG.lastSenderId);
  tgModalIdx = lastIdx >= 0 ? lastIdx : 0;

  tgModalOpen = true;
  document.getElementById('tg-contact-modal').classList.add('open');
  renderTgModal();
}

function tgModalClose() {
  tgModalOpen = false;
  document.getElementById('tg-contact-modal').classList.remove('open');
}

function tgModalScroll(dir) {
  tgModalIdx = ((tgModalIdx + dir) % tgModalItems.length + tgModalItems.length) % tgModalItems.length;
  renderTgModal();
}

function tgModalSelect() {
  const chosen = tgModalItems[tgModalIdx];
  tgModalClose();
  if (!chosen || chosen.chatId === null) return;   // Abbrechen
  tgSend(tgModalText, chosen.chatId).then(ok => {
    if (ok && tgModalCallback) tgModalCallback();
  });
}

function renderTgModal() {
  const total  = tgModalItems.length;
  const itemAt = off => tgModalItems[((tgModalIdx + off) % total + total) % total];

  const prev = document.getElementById('tgcw-prev');
  const main = document.getElementById('tgcw-main');
  const next = document.getElementById('tgcw-next');
  if (!main) return;

  prev.textContent = itemAt(-1).name;
  main.textContent = itemAt( 0).name;
  next.textContent = itemAt(+1).name;
  main.classList.toggle('tg-cancel', itemAt(0).chatId === null);
}

// ── Init (runs after telegram.js is fully loaded) ─────────────────────────
function initTelegram() {
  // Ensure contacts is always an array (guard against corrupted localStorage)
  if (!Array.isArray(cfg.tgContacts)) cfg.tgContacts = [];

  // ── Token ──────────────────────────────────────────────────────────────
  const tokenEl = document.getElementById('tg-token');
  if (tokenEl) {
    tokenEl.value = cfg.tgToken || '';
    tokenEl.addEventListener('change', () => {
      cfg.tgToken = tokenEl.value.trim();
      saveCfg();
      tgStopPolling();
      tgStartPolling();
      tgUpdateSendBtn();
      tgUpdateBadge(false);
      tgSetStatus(cfg.tgToken ? 'Bereit' : 'Nicht konfiguriert', cfg.tgToken ? 'ok' : '');
    });
  }

  // ── Poll mode ──────────────────────────────────────────────────────────
  const pollModeEl  = document.getElementById('tg-poll-mode');
  const intervalRow = document.getElementById('tg-poll-interval-row');
  if (pollModeEl) {
    pollModeEl.value = cfg.tgPollMode || 'auto';
    const syncRow = () => {
      if (intervalRow) intervalRow.style.display = cfg.tgPollMode === 'auto' ? '' : 'none';
    };
    syncRow();
    pollModeEl.addEventListener('change', () => {
      cfg.tgPollMode = pollModeEl.value;
      saveCfg();
      tgStopPolling();
      tgStartPolling();
      syncRow();
    });
  }

  // ── Poll interval slider ───────────────────────────────────────────────
  const pollSecEl = document.getElementById('tg-poll-sec');
  const pollValEl = document.getElementById('tg-poll-val');
  if (pollSecEl && pollValEl) {
    pollSecEl.value       = cfg.tgPollSeconds || 60;
    pollValEl.textContent = tgFmtInterval(cfg.tgPollSeconds || 60);
    pollSecEl.addEventListener('input', () => {
      cfg.tgPollSeconds     = parseInt(pollSecEl.value);
      pollValEl.textContent = tgFmtInterval(cfg.tgPollSeconds);
      saveCfg();
      tgStopPolling();
      tgStartPolling();
    });
  }

  // ── Poll now button ────────────────────────────────────────────────────
  document.getElementById('tg-poll-now')
    ?.addEventListener('click', tgPoll);

  // ── Active contact selector ────────────────────────────────────────────
  document.getElementById('tg-active-contact')
    ?.addEventListener('change', e => {
      cfg.tgActiveContact = e.target.value;
      saveCfg();
    });

  // ── Add contact manually ───────────────────────────────────────────────
  document.getElementById('tg-add-btn')?.addEventListener('click', () => {
    const nameEl   = document.getElementById('tg-new-name');
    const chatIdEl = document.getElementById('tg-new-chatid');
    const name     = nameEl.value.trim();
    const chatId   = chatIdEl.value.trim();
    if (!name || !chatId) return;
    if (!cfg.tgContacts.find(c => c.chatId === chatId)) {
      cfg.tgContacts.push({ name, chatId });
      saveCfg();
      tgRenderContacts();
    }
    nameEl.value = chatIdEl.value = '';
  });

  // ── Overlay open / close ───────────────────────────────────────────────
  document.getElementById('tg-btn')?.addEventListener('click', () => {
    document.getElementById('tg-overlay').classList.toggle('open');
    tgUpdateBadge(false);
  });
  document.getElementById('tg-close-btn')?.addEventListener('click', () => {
    document.getElementById('tg-overlay').classList.remove('open');
  });

  // ── Send button in text panel ──────────────────────────────────────────
  document.getElementById('tg-send-btn')?.addEventListener('click', () => {
    if (!buf.trim()) return;
    tgInitiateSend(buf, () => { addHistory(buf, 'spoken'); buf = ''; renderText(); });
  });

  tgLoadMessages();
  tgRenderContacts();
  tgRenderMessages();
  tgUpdateSendBtn();
  tgUpdateBadge(false);
  tgSetStatus((cfg.tgToken || '').trim() ? 'Bereit' : 'Nicht konfiguriert',
              (cfg.tgToken || '').trim() ? 'ok'     : '');
  tgStartPolling();
}

initTelegram();
