# iSpeak — Architecture

## Overview

iSpeak is a single-page, client-side web application. It enables people with severely limited motor control (e.g. post-stroke locked-in syndrome, ALS) to compose and speak text using only eye movements captured by a standard webcam. No server is required at runtime; all processing, persistence, and UI rendering run entirely in the browser.

The application is intentionally built without frameworks, bundlers, or build tools. Four plain JavaScript files loaded via `<script>` tags contain the entire application logic.

---

## Runtime modes

iSpeak cycles through up to seven distinct modes. The active set is configurable; disabled modes are skipped in the cycle.

| Mode | ID | Default | Purpose |
|---|---|---|---|
| Inaktiv | `inactive` | on | Resting state — wheel dimmed, no input processed |
| Wortbaum | `wordtree` | on | Hierarchical curated-word navigator |
| Buchstaben | `spelling` | on | T9 two-level letter wheel |
| Ergänzung | `autocomplete` | off | T9 wheel + live word-completion suggestions |
| Sätze | `sätze` | on | Saved-phrase browser |
| Telegram | `telegram` | off | Messaging via Telegram Bot API |
| Verwalten | `manage` | off | Eye-controlled word-tree editor |

Mode transitions are triggered by holding the eye closed for a configurable duration (~3 s) and confirming with a blink.

---

## File structure

```
ispeak/
├── index.html                  — all markup: panels, modals, settings, splash, overlays
├── about.html                  — project info, technology, acknowledgements
├── anleitung.html              — user manual
├── storage.html                — localStorage inspector, backup export/import
├── impressum.html              — legal notice (§ 5 TMG)
├── datenschutzerklaerung.html  — privacy policy (DSGVO)
├── sitemap.xml
├── well-known/
│   └── security.txt
├── css/
│   ├── style.css               — full-screen dark layout, wheel styles, overlays
│   ├── pages.css               — shared styles for about.html / anleitung.html
│   └── storage.css             — styles for storage.html
└── js/
    ├── app.js                  — core application logic (see below)
    ├── telegram.js             — Telegram integration (see below)
    ├── words.js                — WT_DATA constant: curated word tree
    └── words_de.js             — GERMAN_WORDLIST constant: ~686 000 word forms
```

---

## Core modules

### `js/app.js` — application logic

The single largest file. Contains all of the following subsystems in one flat scope:

#### Eye tracking
- Initialises `MediaPipe FaceMesh` via CDN WASM.
- `MediaPipe Camera` feeds 320×240 webcam frames to FaceMesh on each animation tick.
- Per-frame callback extracts 468 facial landmarks, selects the configured eye (left/right).
- **EAR (Eye Aspect Ratio):** ratio of vertical to horizontal eye opening, computed from three landmark pairs. Used to detect eye closure.
- **Iris vertical position:** normalised displacement of the iris centre relative to the eye corners. Used to detect gaze up / gaze down.
- A configurable close-debounce timer prevents momentary landmark noise from triggering closure.
- Emits logical events consumed by mode-specific handlers: `gaze up`, `gaze down`, `blink` (short close), `long-hold` (mode-switch trigger).

#### Calibration wizard
- Four-step guided process: neutral → closed → look up → look down.
- Captures EAR and iris-position samples at each step.
- Writes computed thresholds to `cfg` and persists them in `localStorage`.
- Audio beeps (double / triple) provide feedback without requiring visual attention.

#### Mode state machine
- `MODES` array defines the ordered cycle. Only enabled modes are included at runtime.
- `applyMode(newMode)` shows/hides the appropriate sub-panel in the centre wheel, updates the mode badge, and resets mode-local state.
- Each mode has its own render, scroll, and select handler functions called from the shared input dispatchers.

#### Spelling mode (Buchstaben)
- Two-level T9 wheel: level 0 selects a letter group or special action; level 1 selects the individual letter.
- `SP_SPECIALS`: `[' ', '⌫', 'CLR', '▶ Sprechen', '💾 Speichern', '↵ Satz speichern']`
- `T9_KEYS`: `['abc','def','ghi','jkl','mno','pqrs','tuv','wxyz']`
- `spExecuteSpecial()` handles all special actions including TTS, save-phrase, and buffer clear.

#### Autocomplete mode (Ergänzung)
- Level 0 items = T9 groups + live suggestion objects (`{_type:'suggestion', text}`) + SP_SPECIALS.
- `acCurrentPrefix()`: takes the last whitespace-separated token of the text buffer, lowercased.
- `acCollectAllWords()`: merges three sources with deduplication — `ispeak_words` tree first (user priority), then `WT_DATA`, then `GERMAN_WORDLIST`.
- `acGetSuggestions()`: prefix-filters merged list, sorts by length then locale-alphabetically, returns up to 15 results.
- `acBuildItems()`: rebuilds item list on every render (called from `renderText()` when `acLevel === 0`).
- Selecting a suggestion appends the full word (replacing the partial prefix) to the text buffer and resets to level 0.

#### Word tree mode (Wortbaum)
- Data source: `WT_DATA` (from `words.js`) — static JS object with categories as keys, each containing T9-bucketed word arrays.
- `wordsTreeLoad()` / `wordsTreeSave()`: read/write the personal `ispeak_words` tree from `localStorage`.
- Navigation state: `wtPath` array of `{items, index}` frames — a manual call stack.
- Special root-level entries: **Gespeichert** (saved phrases as word insertions) and **↵ Sprechen**.

#### Sätze mode
- Reads `ispeak_saved` array from `localStorage`.
- Single-level if ≤10 phrases; otherwise T9-bucketed by first character.
- Selecting a phrase speaks it immediately via TTS.

#### Manage mode (Verwalten)
- Eye-controlled CRUD on the `ispeak_words` tree.
- Actions: navigate, rename node, add child category, delete node, move node.
- All changes written back via `wordsTreeSave()`.

#### Text buffer
- `buf` (string) — the in-progress phrase.
- `renderText()` updates the right panel preview and re-triggers autocomplete suggestion rebuild when in autocomplete mode.
- History of previously spoken/cleared phrases shown below the preview area.

#### TTS output
- `speakText(text)` — calls `window.speechSynthesis.speak()` with `lang='de-DE'`.
- Phrase is appended to `phrasesHistory` before speaking.

#### Settings & persistence
- `cfg` object holds all runtime parameters (thresholds, enabled modes, eye side, etc.).
- `loadCfg()` / `saveCfg()` serialise `cfg` to `localStorage` key `ispeak`.
- Settings panel sliders/checkboxes update `cfg` live and persist on each change.

#### Audio feedback
- Beep tones implemented as `HTMLAudioElement` with inline WAV data-URIs (not Web Audio API, for iOS compatibility).
- Tones unlocked on first user tap via the start-splash handler.

#### UI layout
- Three-column flex layout: camera panel (left) · wheel panel (centre) · text panel (right).
- Wheel panel contains one sub-panel `div` per mode; only the active mode's sub-panel is shown (`display:flex`).
- Overlays (mode-switch modal, calibration wizard, Telegram contact picker, category picker) are `position:fixed` divs toggled by CSS class or `display` style.

---

### `js/telegram.js` — Telegram integration

Loaded after `app.js`. Adds Telegram functionality without coupling to the core eye-tracking loop.

- **Bot API base:** `https://api.telegram.org/bot<token>/`
- **Contacts:** stored in `localStorage` as `ispeak_tg_contacts` (array of `{name, chatId}`).
- **Message history:** stored in `localStorage` as `ispeak_tg_messages` (array of message objects).
- **Polling:** `getUpdates` with `offset` tracking (`ispeak_tg_offset`). Supports automatic polling at a configurable interval and manual on-demand fetch.
- **Send:** `sendMessage` called with the active contact's `chatId` and the current text buffer content.
- **UI:** Telegram overlay panel (message list + status bar), contact selection modal (eye-navigable), settings inputs for token, polling interval, and contact management.

---

### `js/words.js` — curated word tree

Exports the `WT_DATA` constant: a JS object used by Wortbaum and Ergänzung modes. Structured as:

```js
WT_DATA = {
  "Häufig": { "abc": ["auch","aber",...], "def": [...], ... },
  "Verb":   { ... },
  "Nomen":  { ... },
  "Adjektiv": { ... },
  "Andere": { ... }
}
```

~200 curated everyday German words, pre-bucketed into T9 groups by first character.

---

### `js/words_de.js` — German word list

Exports the `GERMAN_WORDLIST` constant: a flat JS array of ~686 000 inflected German word forms, sourced from [enz/german-wordlist](https://github.com/enz/german-wordlist) (CC0-1.0). Used exclusively by autocomplete (Ergänzung) mode as the fallback suggestion source after user words and WT_DATA.

---

## Data flow

```
Webcam frames (320×240)
    └─► MediaPipe FaceMesh  ──► 468 landmarks per frame
                                    │
                          ┌─────────┴──────────────┐
                          ▼                         ▼
                    EAR computation           Iris position
                    (eye open/closed)         (gaze up/down)
                          │                         │
                          ▼                         ▼
                   blink / long-hold        gaze:up / gaze:down
                          │                         │
                          └──────────┬──────────────┘
                                     ▼
                           mode-specific handler
                      (scroll / select / mode-switch)
                                     │
                         ┌───────────┴────────────┐
                         ▼                         ▼
                  text buffer (buf)          UI render
                         │
               ┌─────────┴──────────┐
               ▼                    ▼
          TTS speak()         Telegram send
          localStorage        (if configured)
          save phrase
```

---

## Data persistence

All persistence uses `localStorage`. No server, no cookies, no IndexedDB.

| Key | Content |
|---|---|
| `ispeak` | `cfg` object: all settings and calibration thresholds |
| `ispeak_saved` | JSON array of saved phrases (most-recent-first, deduplicated) |
| `ispeak_words` | JSON: user's personal word tree (nested category/phrase nodes) |
| `ispeak_sätze` | JSON array of named saved sentences with category metadata |
| `ispeak_tg_messages` | JSON array of Telegram message objects |
| `ispeak_tg_offset` | Integer: last processed Telegram update ID |

The **Speicher verwalten** page (`storage.html`) provides a full JSON backup/restore for all of the above keys.

---

## Key technical decisions

| Concern | Decision | Rationale |
|---|---|---|
| Server dependency | None | Works offline; no data leaves the device |
| Framework | Vanilla JS | Minimal dependency surface; easier to run on low-end hardware; no build step |
| Eye tracking | MediaPipe FaceMesh (CDN WASM) | Runs fully client-side, good accuracy on a single eye, Apache 2.0 license |
| Audio | `HTMLAudioElement` + WAV data-URIs | Web Audio API is suspended after camera permission dialog on iOS; data-URI approach is unlocked by the start-splash tap |
| TTS | Web Speech API (`de-DE`) | Zero latency, no server call, German voice available in all target browsers |
| Autocomplete data | Flat `const` array in `words_de.js` | No server, no fetch; ~8 MB loaded once at page start; acceptable for a dedicated-device use case |
| T9 navigation | Two-level wheel (group → letter) | Minimises required eye movements; matches established AAC scanning patterns |
| Persistence | `localStorage` only | Simple, no permissions required beyond camera; all data stays on-device |
| Look-down detection | Disabled by default | Visually ambiguous with closed eye in some lighting/face conditions; must be explicitly enabled after calibration |

---

## Accessibility & UX constraints

- All interactive elements are controllable **solely via the eye-tracker** — no keyboard or mouse dependency in the primary interaction path.
- The settings panel is caregiver-facing and can be operated via standard pointer/keyboard.
- Reaction speed controls (gaze debounce, blink thresholds) are critical; they are set once by a caregiver and persisted.
- High-contrast dark display (white on near-black) to reduce eye strain during extended sessions.
- Large font sizes throughout the wheel (8–11 vmin) to remain readable from typical device-to-face distances.
- Landscape orientation enforced; a portrait-mode hint is displayed if the device is rotated.
- Audio feedback at each calibration step and on confirmation actions reduces reliance on visual attention to status indicators.
