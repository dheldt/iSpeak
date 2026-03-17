# iSpeak — Architecture

## Overview

iSpeak is a single-page, client-side web application. It enables people with severely limited motor control (e.g. post-stroke) to compose and speak text using only eye movements captured by a standard webcam. No server is required at runtime; all processing runs in the browser.

---

## Core Modules

### 1. Eye Tracking (`eye-tracker`)

**Responsibility:** Continuously read webcam frames, locate one eye, and emit discrete events.

- **Input:** `MediaStream` from `getUserMedia({ video: true })`
- **Processing:** Landmark detection on each frame — candidates:
  - [MediaPipe FaceMesh](https://google.github.io/mediapipe/solutions/face_mesh) (WASM, runs fully client-side)
  - or a lightweight custom model via TensorFlow.js / ONNX Runtime Web
- **Output events (typed):**
  - `gaze:up` / `gaze:down` — vertical gaze shift detected
  - `blink` — eye closure held beyond a configurable threshold (distinct from involuntary blinks via duration gating)
- **Configurable parameters (exposed to UI):**
  - `gazeThreshold` — pixel / angle delta to trigger a gaze event
  - `blinkDurationMin` / `blinkDurationMax` — time window (ms) that counts as intentional blink vs. hold
  - `gazeDebounceMs` — cooldown between successive gaze events

### 2. Letter Wheel (`letter-wheel`)

**Responsibility:** Maintain a circular list of characters and expose the currently selected one.

- **Character set:** German alphabet (A–Z + Ä Ö Ü ß), `SPACE`, `BACKSPACE`, `ENTER` — ~32 entries
- **State:** `currentIndex` (integer, wraps around)
- **API:**
  - `next()` / `prev()` — advance/retreat the wheel (driven by `gaze:down` / `gaze:up`)
  - `select()` → returns current character (driven by `blink`)
  - `reset()` — return to index 0
- **No I/O of its own;** pure state machine.

### 3. Text Buffer (`text-buffer`)

**Responsibility:** Accumulate selected characters into a string.

- Appends printable characters on `select()`
- Handles `BACKSPACE` (delete last char)
- On `ENTER`: emits `text:commit` event with the current string, then clears

### 4. UI Renderer (`ui`)

**Responsibility:** Reflect application state visually.

- **Center display:** Single large letter (current wheel position) — `font-size` ~40–60 vmin so it is readable from a distance
- **Context strip (optional):** small display of ±2 adjacent letters for orientation
- **Text preview:** growing string of selected characters shown below the center letter
- **Settings panel:** sliders/inputs for the configurable eye-tracking parameters (see §1); changes are persisted to `localStorage`
- **Technology:** Plain HTML + CSS + vanilla JS, or a minimal framework (Preact/Solid) if reactive updates become complex. No build toolchain required for the MVP — a single `index.html` is a valid deliverable.

### 5. TTS Output (`tts`)

**Responsibility:** Speak the committed text aloud.

- **Primary:** Web Speech API (`speechSynthesis.speak()`) — zero dependencies, available in all modern browsers, runs entirely on-device
- **Language:** `lang = "de-DE"` (German) by default; configurable
- **Fallback:** If `speechSynthesis` is unavailable, render the committed text as a prominent on-screen message only

---

## Data Flow

```
Webcam frames
    └─► eye-tracker  ──── gaze:up/down ──►  letter-wheel.next() / prev()
                     ──── blink        ──►  letter-wheel.select()
                                                  │
                                                  ▼
                                           text-buffer.append(char)
                                                  │
                                        ┌─────────┴──────────┐
                                        ▼                     ▼
                                   ui (live preview)    on ENTER:
                                                        tts.speak(text)
                                                        text-buffer.clear()
```

---

## File Structure (proposed)

```
ispeak/
├── index.html          # Entry point — markup + module imports
├── style.css           # Full-screen layout, large letter display
├── src/
│   ├── eye-tracker.js  # Webcam capture + landmark model + event emitter
│   ├── letter-wheel.js # Character list + index state machine
│   ├── text-buffer.js  # String accumulation + commit event
│   ├── tts.js          # Web Speech API wrapper
│   └── ui.js           # DOM updates, settings panel, localStorage
└── README.md
```

No bundler is strictly required. ES modules (`type="module"`) suffice for the MVP.

---

## Key Technical Constraints & Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Server dependency | None | Accessibility: works offline, no data leaves the device |
| Eye tracking library | MediaPipe FaceMesh (WASM) | Runs client-side, good accuracy on a single eye, permissive license |
| TTS | Web Speech API | No latency, no server call, German voice available in all target browsers |
| Framework | Vanilla JS (or Preact if needed) | Minimal dependency surface; easier to load on low-end hardware |
| Blink vs. involuntary blink | Duration gating | Short blinks (<80 ms) ignored; intentional blinks ~150–500 ms |
| German character set | Fixed 32-char wheel | Covers standard German plus control characters |

---

## Accessibility & UX Considerations

- All interactive elements must be controllable **solely via the eye-tracker** — no keyboard or mouse dependency in the primary interaction path
- Reaction speed controls (gaze debounce, blink thresholds) are critical for users with different residual motor control; they must be reachable from the eye-tracker interface itself (or set once by a caregiver)
- High-contrast display (white letter on black, or inverted) to reduce eye strain during extended sessions
