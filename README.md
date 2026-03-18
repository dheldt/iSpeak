# iSpeak

iSpeak is a fully client-side web application designed to help people who have suffered a stroke and are locked in — unable to communicate except through limited eye movements — to compose and speak text aloud.

The person this was originally developed for can only move their eye upward, and open and close their eyelid. iSpeak is built around exactly these three inputs.

It has been tested on an iPhone in landscape mode and in a current Chrome browser.

> **Note:** Looking down is not yet reliably detected — it is visually similar to a closed eye in some conditions. It is therefore disabled by default and can be enabled in settings once calibrated for a specific user.

---

## Live versions

| Environment | URL |
|---|---|
| **Stable** | https://ispeak.clue-less.de/ |
| **Development** | https://ispeak.clue-less.de/test/ |

---

## How it works

iSpeak offers up to seven modes cycled by holding the eye closed for ~3 seconds (confirming with a blink). Which modes are active is configurable in the settings panel; by default **Buchstaben**, **Wortbaum**, and **Sätze** are enabled.

### Buchstaben (letter spelling mode)
A two-level T9 wheel. First select a letter group (abc, def, ghi, jkl, mno, pqrs, tuv, wxyz), then pick the individual letter. Special actions at the top level: space, delete, clear, speak, and **Speichern** (saves the current phrase to the browser cache).

### Ergänzung (autocomplete mode)
Like Buchstaben, but at the top level the T9 groups are interleaved with live word suggestions matching the current partial word in the text buffer. Suggestions are drawn from three sources in priority order: the user's saved word tree (`ispeak_words`), the curated WT_DATA vocabulary (~200 words), and the full german-wordlist (~686 000 inflected word forms). Selecting a suggestion appends the completed word to the buffer. T9 letter entry works identically to Buchstaben.

### Wortbaum (word tree mode)
A hierarchical word selection system. Navigate a tree of ~200 curated German everyday words grouped by type (Häufig, Verb, Nomen, Adjektiv, Andere) and then by T9 letter group. A **Gespeichert** category lists all phrases previously saved via Speichern; if more than 10 are stored they are split into T9 buckets by first character. A **↵ Sprechen** shortcut at the root level speaks the current phrase immediately.

### Sätze (saved phrases mode)
A dedicated wheel for browsing and speaking saved phrases. With ≤10 saved phrases the wheel is a single level; with >10 it uses the same T9 bucketing as the Gespeichert category.

### Telegram (messaging mode)
Browse contacts and send/receive messages via the Telegram Bot API. Incoming messages are fetched by polling. A contact selection wheel lets the user choose the recipient via gaze; messages are composed in the text buffer and sent with a blink. Requires a personal Bot Token configured in the settings panel.

### Verwalten (manage mode)
An eye-controlled interface for organising the personal word tree (`ispeak_words`). Navigate the tree, rename categories and words, move entries, and create new categories — entirely without touching a keyboard or mouse.

### Inaktiv (inactive state)
The resting state. The wheel is dimmed and no input is processed. Can be included or excluded from the mode cycle in settings.

### Speaking
Once a phrase is composed it can be spoken aloud via the browser's built-in text-to-speech (German, `de-DE`). A history of recent phrases is shown in the text panel. Phrases can also be saved permanently to the browser cache for reuse in Sätze mode.

---

## Eye tracking & input

- A standard webcam captures video frames at 320×240.
- **MediaPipe FaceMesh** detects 468+ facial landmarks per frame, including iris position.
- The **Eye Aspect Ratio (EAR)** — the ratio of vertical to horizontal eye opening — is computed from three landmark pairs and used to detect deliberate blinks.
- The **iris vertical position** relative to the eye corners is used for gaze direction (up / down).
- All processing runs entirely in the browser — no frames are ever sent to a server.

### Calibration
A four-step wizard (look straight → close eye → look up → look down) calibrates the EAR threshold and gaze thresholds to the individual user's eye. Audio feedback (a double beep) plays at the end of each step; a triple beep signals successful completion of the full calibration. Gaze navigation and mode switching are suppressed while the wizard is active to prevent accidental input.

### Controls
| Action | Input |
|---|---|
| Scroll up | Look up |
| Scroll down | Look down *(disabled by default)* |
| Select current item | Short blink (400–800 ms) |
| Open mode-switch modal | Hold eye closed ~3 s |
| Confirm mode switch | Blink while modal is visible |
| Dismiss mode-switch modal | Look up/down, or wait 5 s |

Mode switching is disabled entirely when fewer than two modes are enabled in settings.

---

## User interface

- **Left panel:** Live camera feed with eye-tracking overlay (EAR value, gaze zone lines, iris highlight) — feed hidden by default, toggleable in settings. Eye open/closed indicator and hold-to-switch progress bar overlaid on the camera area.
- **Centre panel:** Current selection — large text showing the active item; ±2 context items above and below, circulating. The selected item is always centred vertically.
- **Right panel:** Composed phrase with blinking cursor; history of previously spoken or cleared phrases; Speak and Telegram Send buttons.
- **Settings panel** (top right ⚙, caregiver-facing): All thresholds adjustable and persisted to `localStorage`:

| Setting | Description |
|---|---|
| Kalibrieren | Launch the four-step calibration wizard |
| Sound AN/AUS | Toggle audio feedback |
| Kamera AN/AUS | Show or hide the live camera feed |
| Bot Token | Telegram bot token for messaging |
| Polling | Automatic or manual Telegram message polling |
| Senden an | Active Telegram contact |
| Modus: Inaktiv / Wortbaum / Buchstaben / Ergänzung / Sätze / Telegram / Verwalten | Enable or disable each mode; disabled modes are skipped in the cycle |
| Auge | Which eye to track (left / right) |
| Blick unten aktiv | Enable look-down scrolling |
| Scrollgeschwindigkeit | Debounce between wheel steps (ms) |
| Blink min / max | Short-blink detection window (ms) |
| Modus-Haltezeit | Duration of hold required to open the mode-switch modal (ms) |
| Gaze zone | Iris displacement threshold for gaze detection |
| EAR threshold | Eye-closure detection threshold |
| Close debounce | Minimum time EAR must stay below threshold before "closed" fires (ms) |

---

## Saved phrases & word tree

Phrases are saved via the **Speichern** action in Buchstaben / Ergänzung mode. They are stored in `localStorage` under the key `ispeak_saved` as a JSON array, most recently used first, with automatic deduplication. Saved phrases are accessible in two places:

- **Wortbaum → Gespeichert** — browse and append a saved phrase as a word to the current text buffer
- **Sätze mode** — browse and speak a saved phrase directly in one step

The personal word tree (`ispeak_words`) is a separate, user-editable hierarchy managed through Verwalten mode and persisted in `localStorage`.

---

## Data backup & restore

All data lives exclusively in `localStorage`. The **Speicher verwalten** page (`storage.html`) provides a full backup/restore feature: export all keys (words, phrases, settings, Telegram history) as a single JSON file, and import a previously exported backup. Regular exports are strongly recommended — recreating lost data via eye control is extremely tedious.

---

## File structure

```
ispeak/
├── index.html                  — markup, settings panel, calibration overlay, all modals
├── about.html                  — project description, technology, acknowledgements
├── anleitung.html              — user manual (eye controls, modes, backup, settings)
├── storage.html                — localStorage viewer, backup export/import
├── impressum.html              — legal notice (§ 5 TMG)
├── datenschutzerklaerung.html  — privacy policy (DSGVO)
├── sitemap.xml
├── well-known/
│   └── security.txt            — security contact (RFC 9116)
├── css/
│   ├── style.css               — full-screen dark layout, wheel styles, overlays
│   ├── pages.css               — shared styles for about.html and anleitung.html
│   └── storage.css             — styles for storage.html
└── js/
    ├── app.js                  — all application logic (eye tracking, modes, TTS, UI)
    ├── telegram.js             — Telegram Bot API integration (polling, send, contacts)
    ├── words.js                — WT_DATA: ~200 curated German words in T9 buckets
    └── words_de.js             — GERMAN_WORDLIST: ~686 000 inflected German word forms (CC0)
```

No build step. No bundler. Open `index.html` directly in a browser or serve the folder with any static file server.

---

## External components

| Component | Version | License | Purpose |
|---|---|---|---|
| [MediaPipe FaceMesh](https://github.com/google/mediapipe) | latest (CDN) | Apache 2.0 | Facial landmark detection (468 points + iris) running as WASM in the browser |
| [MediaPipe Camera Utils](https://github.com/google/mediapipe) | latest (CDN) | Apache 2.0 | Convenience wrapper that feeds webcam frames to FaceMesh |
| [german-wordlist](https://github.com/enz/german-wordlist) | – | CC0-1.0 (public domain) | ~686 000 inflected German word forms; autocomplete suggestions (`js/words_de.js`) |
| [Telegram Bot API](https://core.telegram.org/bots/api) | – | free/open | Sending and receiving messages via a personal bot token |

The MediaPipe scripts are loaded from `cdn.jsdelivr.net` at runtime. No other runtime dependencies exist. The application falls back gracefully to keyboard-only mode if MediaPipe fails to load.

### Acknowledgements

**Google / MediaPipe team** — The eye-tracking engine powering iSpeak is built on [MediaPipe FaceMesh](https://github.com/google/mediapipe) and MediaPipe Camera Utils (Apache 2.0). MediaPipe detects 468+ facial landmarks including iris position in real time entirely in the browser via WASM. Many thanks to the MediaPipe team and all contributors for making this sophisticated framework freely available.

**Philipp Enz and the german-wordlist contributors** — The autocomplete word suggestions are drawn from [german-wordlist](https://github.com/enz/german-wordlist) (CC0-1.0, public domain), containing ~686 000 inflected German word forms. Many thanks to Philipp Enz and all contributors for making this comprehensive German word list freely available as public domain.

**Telegram** — The messaging feature is powered by the [Telegram Bot API](https://core.telegram.org/bots/api), which provides a free and open interface for sending and receiving messages without requiring any server infrastructure. Many thanks to Telegram for making this API freely accessible.

**Browser vendors (Web Speech API)** — Text-to-speech output uses the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). Thanks to Apple (Safari/iOS) and Google (Chrome) for their implementations of this standard API, which make voice output possible on all supported devices without any external service.

### Browser APIs used (no external libraries)

| API | Purpose |
|---|---|
| `getUserMedia` | Webcam access |
| `Canvas 2D` | Mirrored video overlay with landmark annotations |
| `Web Speech API` (`speechSynthesis`) | Text-to-speech output (`de-DE`) |
| `HTMLAudioElement` + WAV data-URIs | Tone feedback sounds — used instead of Web Audio API for iOS compatibility |
| `localStorage` | Persistence of settings, calibration data, saved phrases, and word tree |
| `ResizeObserver` | Responsive canvas sizing |
| `Fetch API` | Telegram Bot API requests |

---

## Browser & device compatibility

- Tested: iPhone (Safari, landscape), Chrome (desktop)
- Requires: webcam access, a browser with MediaPipe WASM support
- Landscape orientation is required; a hint is shown when the device is in portrait mode
- iOS note: Web Audio API (`AudioContext`) is suspended by the camera permission dialog and cannot be reliably resumed. iSpeak uses `HTMLAudioElement` with pre-baked WAV data-URIs instead, unlocked via the start-splash tap handler.

---

## Privacy & legal

iSpeak processes all data exclusively in the browser. No video frames, phrases, or personal data are transmitted to any server. The only external network requests are:
- Initial CDN loads for MediaPipe from `cdn.jsdelivr.net`
- Telegram Bot API calls, only when the Telegram feature is explicitly configured and used

- [Impressum](impressum.html)
- [Datenschutzerklärung](datenschutzerklaerung.html)
- [security.txt](well-known/security.txt)

---

## License

MIT License — © 2026 Daniel Heldt

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Repository

[https://github.com/dheldt/iSpeak/](https://github.com/dheldt/iSpeak/)
