# HollywoodOS 2

A browser-based, modular retro-rendering platform. Simulates a multi-terminal "Hollywood-style" dashboard with deterministic seeded animations, bitmap fonts, Fake ANSI multi-color/inverse terminal spans, CRT post-processing shaders, and a cinematic boot sequence.

<https://tomcoolpxl.github.io/hollywoodos2/>

## Features
- **13 Purely-Visual Modules across 5 Workstation Presets:**
  - **Matrix Rain (`matrix`):** Falling Katakana/ASCII streams with PixiJS v8 `FillGradient` vertical trails and character decoding effects.
  - **BIOS Boot Emulator (`boot`):** Retro diagnostic sequence with Fake ANSI status badges and underline terminal cursor.
  - **Global Tracking (`globe`):** 3D wireframe rotating globe with horizon ring and dynamic coordinate readouts.
  - **Tactical Radar Map (`map`):** Wireframe continents, radar sweep, and moving target vectors with live ID tags.
  - **Satellite Ground-Track (`orbit`):** Sinusoidal orbital paths, moving satellite footprints, and velocity telemetry.
  - **Core Memory (`hex`):** Scrolling hex/ASCII memory dump with an active scanning block cursor.
  - **WarGames Cipher Decryptor (`decrypt`):** Brute-force rolling cipher lock-in cracker with progress bar and cracked-key history.
  - **Signal Analysis (`spectrum`):** LED-style segmented frequency spectrum analyzer.
  - **Harmonic Phase Scope (`scope`):** Dual-mode oscilloscope waveform & Lissajous X-Y phase vector scope.
  - **Code Stream (`code`):** Kernel/assembly/neural-net code injection stream.
  - **Network Log (`log`):** Deterministic system message stream with Fake ANSI tags and GSAP-driven smooth line scrolling.
  - **System Load (`graph`):** Dual-series real-time CPU & RAM performance telemetry graph.
  - **Network Node Topology (`netgraph`):** Interconnected server node graph with live packet routing and load pulse rings.
- **Window UX & Transitions:**
  - **Click-to-Maximize:** Click any terminal window to maximize it to full screen; click again or press `Escape` to restore the tiled layout.
  - **Scanline Transitions & Header Badges:** Smooth GSAP scanline wipe transitions when windows cycle plugins, plus live `[PLUGIN N/M]` badges and cycling progress bars.
- **Deterministic Seeded RNG:** Global Mulberry32 PRNG (`src/core/RNG.js`) forked per window and plugin for reproducible visual behavior.
- **CRT Shader Pipeline:** Custom PixiJS v8 GLSL ES 300 `CRTFilter` with scanlines, RGB chromatic shift, analog grain, and corner vignette.
- **Single-Plugin URL Test Harness:** Mount any plugin in isolation via URL parameters (e.g. `?plugin=decrypt&theme=amber&seed=42&noboot=1`).

## Controls
- **`1`**: Load **Default 6-Window Workstation** Preset.
- **`2`**: Load **Minimalist Central Core Matrix** Preset.
- **`3`**: Load **4-Terminal Debug Lab** Preset (`hex`, `code`, `log`, `graph`).
- **`4`**: Load **Tactical Map Deck** Preset (`map`, `globe`, `log`, `spectrum`).
- **`5`**: Load **Cyber Ops Deck** Preset (`decrypt`, `netgraph`, `orbit`, `scope`).
- **`Click Window` / `ESC`**: Toggle Full-Screen Maximize on any terminal window.
- **`T`**: Cycle Color Theme (`classic-green` → `amber` → `cyber-cyan`).
- **`C`**: Toggle CRT Post-Processing Shader (Scanlines / Chromatic Shift / Vignette).
- **`S`**: Toggle Scaling Mode (Stretch/Fill vs. Maintain Aspect Ratio Letterbox).
- **`I`**: Toggle Integer-Snap Retro Scaling Mode (`1x`/`2x`/`3x` pixel-aligned scaling).
- **`E`**: Toggle Simulated Module Fault / Crash Containment Screen in Window 1.
- **`R`**: Reboot System (resets deterministic RNG seed and triggers BIOS boot sequence).
- **`X` / `O`**: Export or Import JSON configuration file.
- **`H` / `?`**: Toggle On-Screen Operator HUD & Keymap Reference.

## Development & Verification
```bash
npm install
npm test      # Run deterministic RNG, Fake ANSI, and PixiJS v8 verification suite
npm run dev   # Local development server
npm run build # Production static bundle in dist/
```
