# iSpeak

iSpeak is a small, fully client-side web application designed to help people who have suffered a stroke and are locked in — unable to communicate except through limited eye movements — to compose and speak text aloud.

The person this was originally developed for can only move their eye upward, and open and close their eyelid. iSpeak is built around exactly these three inputs.

It has been tested on an iPhone in landscape mode and in a current Chrome browser.

> **Note:** Looking down is not yet reliably detected — it is visually similar to a closed eye in some conditions. It is therefore disabled by default and can be enabled in settings once calibrated for a specific user.

---

## How it works

iSpeak offers up to four modes cycled by holding the eye closed for ~3 seconds (confirming with a blink). Which modes are active is configurable in the settings panel; by default only **Buchstaben** is enabled.

### Buchstaben (letter spelling mode)
A two-level T9 wheel. First select a letter group (abc, def, ghi, jkl, mno, pqrs, tuv, wxyz), then pick the individual letter. Special actions at the top level: space, delete, clear, speak, and **Speichern** (saves the current phrase to the browser cache).

### Wortbaum (word tree mode)
A hierarchical word selection system. Navigate a tree of ~200 curated German everyday words grouped by type (Häufig, Verb, Nomen, Adjektiv, Andere) and then by T9 letter group. A **Gespeichert** category lists all phrases previously saved via Speichern; if more than 10 are stored they are split into T9 buckets by first character. A **↵ Sprechen** shortcut at the root level speaks the current phrase immediately.

### Sätze (saved phrases mode)
A dedicated wheel for browsing and speaking saved phrases. Scrolling and selection work identically to the other modes. With ≤10 saved phrases the wheel is a single level; with >10 it uses the same T9 bucketing as the Gespeichert category.

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

- **Left panel:** Eye-tracking overlay (EAR value, gaze zone lines, iris highlight) — hidden by default, toggleable in settings. Eye open/closed indicator, hold-to-switch progress bar (overlaid on the camera area).
- **Centre panel:** Current selection — large text showing the active item; ±2 context items above and below, circulating. The selected item is always centred vertically.
- **Right panel:** Composed phrase with blinking cursor; history of previously spoken or cleared phrases; Speak button.
- **Settings panel** (top right ⚙, caregiver-facing): All thresholds adjustable and persisted to `localStorage`:

| Setting | Description |
|---|---|
| Kalibrieren | Launch the four-step calibration wizard |
| Sound AN/AUS | Toggle audio feedback |
| Kamera AN/AUS | Show or hide the live camera feed |
| Modus: Inaktiv/Wortbaum/Buchstaben/Sätze | Enable or disable each mode; disabled modes are skipped in the cycle |
| Auge | Which eye to track (left / right) |
| Blick unten aktiv | Enable look-down scrolling |
| Scrollgeschwindigkeit | Debounce between wheel steps (ms) |
| Blink min / max | Short-blink detection window (ms) |
| Modus-Haltezeit | Duration of hold required to open the mode-switch modal (ms) |
| Gaze zone | Iris displacement threshold for gaze detection |
| EAR threshold | Eye-closure detection threshold |
| Close debounce | Minimum time EAR must stay below threshold before "closed" fires (ms) |

---

## Saved phrases

Phrases are saved via the **Speichern** action in Buchstaben mode. They are stored in `localStorage` under the key `ispeak_saved` as a JSON array, most recently used first, with automatic deduplication. Saved phrases are accessible in two places:

- **Wortbaum → Gespeichert** — browse and append a saved phrase as a word to the current text buffer
- **Sätze mode** — browse and speak a saved phrase directly in one step

---

## File structure

```
ispeak/
├── index.html                  — markup, settings panel, calibration overlay
├── impressum.html              — legal notice (§ 5 TMG)
├── datenschutzerklaerung.html  — privacy policy (DSGVO)
├── .well-known/
│   └── security.txt            — security contact (RFC 9116)
├── css/
│   └── style.css               — full-screen dark layout, wheel styles, overlays
└── js/
    ├── words.js                — WT_DATA: ~200 curated German words in T9 buckets
    └── app.js                  — all application logic (eye tracking, modes, TTS, UI)
```

No build step. No bundler. Open `index.html` directly in a browser or serve the folder with any static file server.

---

## External components

| Component | Version | License | Purpose |
|---|---|---|---|
| [MediaPipe FaceMesh](https://github.com/google/mediapipe) | latest (CDN) | Apache 2.0 | Facial landmark detection (468 points + iris) running as WASM in the browser |
| [MediaPipe Camera Utils](https://github.com/google/mediapipe) | latest (CDN) | Apache 2.0 | Convenience wrapper that feeds webcam frames to FaceMesh |

Both are loaded from `cdn.jsdelivr.net` at runtime. No other runtime dependencies exist. The application falls back gracefully to keyboard-only mode if MediaPipe fails to load.

### Browser APIs used (no external libraries)

| API | Purpose |
|---|---|
| `getUserMedia` | Webcam access |
| `Canvas 2D` | Mirrored video overlay with landmark annotations |
| `Web Speech API` (`speechSynthesis`) | Text-to-speech output (`de-DE`) |
| `HTMLAudioElement` + WAV data-URIs | Tone feedback sounds — used instead of Web Audio API for iOS compatibility |
| `localStorage` | Persistence of settings, calibration data, and saved phrases |
| `ResizeObserver` | Responsive canvas sizing |

---

## Browser & device compatibility

- Tested: iPhone (Safari, landscape), Chrome (desktop)
- Requires: webcam access, a browser with MediaPipe WASM support
- Landscape orientation is required; a hint is shown when the device is in portrait mode
- iOS note: Web Audio API (`AudioContext`) is suspended by the camera permission dialog and cannot be reliably resumed. iSpeak uses `HTMLAudioElement` with pre-baked WAV data-URIs instead, unlocked via the start-splash tap handler.

---

## Privacy & legal

iSpeak processes all data exclusively in the browser. No video frames, phrases, or personal data are transmitted to any server. The only external network requests are the initial CDN loads for MediaPipe from `cdn.jsdelivr.net`.

- [Impressum](impressum.html)
- [Datenschutzerklärung](datenschutzerklaerung.html)
- [security.txt](.well-known/security.txt)

---

## License

MIT License — © 2026 Daniel Heldt

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Repository

[https://github.com/dheldt/iSpeak/](https://github.com/dheldt/iSpeak/)
