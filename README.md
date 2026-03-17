# iSpeak

iSpeak is a small, fully client-side web application designed to help people who have suffered a stroke and are locked in — unable to communicate except through limited eye movements — to compose and speak text aloud.

The person this was originally developed for can only move their eye upward, and open and close their eyelid. iSpeak is built around exactly these three inputs.

It has been tested on an iPhone in landscape mode and in a current Chrome browser.

> **Note:** Looking down is not yet reliably detected — it is visually similar to a closed eye in some conditions. It is therefore disabled by default and can be enabled in settings once calibrated for a specific user.

---

## How it works

iSpeak offers two input modes plus an inactive state, cycled by holding the eye closed for ~3 seconds (confirming with a blink):

### Word tree mode (default active mode)
A hierarchical word selection system. Navigate a tree of ~400 curated German words grouped by type (Häufig, Verb, Nomen, Adjektiv, Andere) and then by T9 letter group (abc, def, …). Look up to scroll, blink to select. Selecting a word appends it to the phrase.



### Letter spelling mode
A two-level T9 wheel. First select a letter group (abc, def, ghi, jkl, mno, pqrs, tuv, wxyz), then pick the individual letter. Special actions (space, delete, clear, speak) are available at the top level.

Built words can also be stored via "speichern". They are then available in word tree mode in the category "gespeichert". 

### Speaking
Once a phrase is composed it can be spoken aloud via the browser's built-in text-to-speech (German, `de-DE`). A history of recent phrases is shown in the text panel.

---

## Eye tracking & input

- A standard webcam captures video frames at 320×240.
- **MediaPipe FaceMesh** detects 468+ facial landmarks per frame, including iris position.
- The **Eye Aspect Ratio (EAR)** — the ratio of vertical to horizontal eye opening — is computed from three landmark pairs and used to detect deliberate blinks.
- The **iris vertical position** relative to the eye corners is used for gaze direction (up / down).
- All processing runs entirely in the browser — no frames are ever sent to a server.

### Calibration
A four-step wizard (look straight → close eye → look up → look down) calibrates the EAR threshold and gaze thresholds to the individual user's eye.

### Controls
| Action | Input |
|---|---|
| Scroll up | Look up |
| Scroll down | Look down *(disabled by default)* |
| Select current item | Short blink (400–800 ms) |
| Open mode-switch modal | Hold eye closed ~3 s |
| Confirm mode switch | Blink while modal is visible |
| Dismiss mode-switch modal | Look up/down, or wait 5 s |

---

## User interface

- **Left panel:** Live webcam feed with eye-tracking overlay (EAR value, gaze zone lines, iris highlight), eye open/closed indicator, hold-to-switch progress bar, calibration button, sound toggle.
- **Centre panel:** Current selection — large text showing the active letter group, letter, or word; ±2 context items above and below.
- **Right panel:** Composed phrase with blinking cursor; history of previously spoken or cleared phrases; Speak button.
- **Settings panel** (top right ⚙): All thresholds adjustable by a caregiver and persisted to `localStorage` — scroll speed, blink window, hold duration, EAR threshold, close debounce, gaze zone, which eye to track, and look-down toggle.

---

## File structure

```
ispeak/
├── index.html          — markup, settings panel, calibration overlay
├── css/
│   └── style.css       — full-screen dark layout, wheel styles, overlays
└── js/
    ├── words.js        — WT_DATA: ~400 curated German words in T9 buckets
    └── app.js          — all application logic (eye tracking, modes, TTS, UI)
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
| `Web Audio API` (`AudioContext`) | Tone feedback sounds (no audio files) |
| `localStorage` | Persistence of all user settings and calibration data |
| `ResizeObserver` | Responsive canvas sizing |

---

## Browser & device compatibility

- Tested: iPhone (Safari, landscape), Chrome (desktop)
- Requires: webcam access, a browser with MediaPipe WASM support
- Landscape orientation is required; a hint is shown when the device is in portrait mode

---

## License

MIT License — © 2026 Daniel Heldt

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Repository

[https://github.com/dheldt/iSpeak/](https://github.com/dheldt/iSpeak/)
