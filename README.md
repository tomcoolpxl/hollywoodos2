# HollywoodOS 2

A browser-based, modular retro-rendering platform. Simulates a multi-terminal "Hollywood-style" dashboard with deterministic seeded animations, bitmap fonts, Fake ANSI multi-color/inverse terminal spans, CRT post-processing shaders, and a cinematic boot sequence.

<https://tomcoolpxl.github.io/hollywoodos2/>

## Features
- **9 Integrated Modules across 4 Workstation Presets:**
  - **Matrix Rain (`matrix`):** Falling Katakana/ASCII streams with PixiJS v8 `FillGradient` vertical trails and character decoding effects.
  - **BIOS Boot Emulator (`boot`):** Retro diagnostic sequence with Fake ANSI status badges and underline terminal cursor.
  - **Global Tracking (`globe`):** 3D wireframe rotating globe with horizon ring and dynamic coordinate readouts.
  - **Tactical Radar Map (`map`):** Wireframe continents, radar sweep, and moving target vectors with live ID tags.
  - **Core Memory (`hex`):** Scrolling hex/ASCII memory dump with an active scanning block cursor.
  - **Signal Analysis (`spectrum`):** LED-style segmented frequency spectrum analyzer.
  - **Code Stream (`code`):** Kernel/assembly/neural-net code injection stream.
  - **Network Log (`log`):** Deterministic system message stream with Fake ANSI tags and GSAP-driven smooth line scrolling.
  - **System Load (`graph`):** Dual-series real-time CPU & RAM performance telemetry graph.
- **Deterministic Seeded RNG:** Global Mulberry32 PRNG (`src/core/RNG.js`) forked per window and plugin for reproducible visual behavior.
- **CRT Shader Pipeline:** Custom PixiJS v8 GLSL ES 300 `CRTFilter` with barrel curvature, scanlines, RGB chromatic shift, analog grain, and corner vignette.
- **Isolated Fault Containment:** Runtime plugin errors trigger an isolated flickering fault screen inside the affected window without crashing the dashboard.
- **Single-Plugin URL Test Harness:** Mount any plugin in isolation via URL parameters (e.g. `?plugin=globe&theme=amber&seed=42&noboot=1`).

## Controls
- **`1`**: Load **Default 6-Window Workstation** Preset.
- **`2`**: Load **Minimalist Central Core Matrix** Preset.
- **`3`**: Load **4-Terminal Debug Lab** Preset (`hex`, `code`, `log`, `graph`).
- **`4`**: Load **Tactical Map Deck** Preset (`map`, `globe`, `log`, `spectrum`).
- **`T`**: Cycle Color Theme (`classic-green` → `amber` → `cyber-cyan`).
- **`C`**: Toggle CRT Post-Processing Shader (Scanlines / Curvature / Chromatic Shift).
- **`S`**: Toggle Scaling Mode (Stretch/Fill vs. Maintain Aspect Ratio Letterbox).
- **`I`**: Toggle Integer-Snap Retro Scaling Mode (`1x`/`2x`/`3x` pixel-aligned scaling).
- **`E`**: Toggle Simulated Module Fault / Crash Containment Screen in Window 1.
- **`R`**: Reboot System (resets deterministic RNG seed and triggers BIOS boot sequence).
- **`X`**: Export current configuration to `hollywoodos2-config.json`.
- **`O`**: Import a custom JSON configuration file.
- **`H` / `?`**: Toggle On-Screen Operator HUD & Keymap Reference.

## Tech Stack
- **PixiJS v8:** High-performance WebGL2 / GLSL ES 300 rendering and `BitmapText` glyph atlases.
- **GSAP:** Smooth terminal line scrolling and timeline transitions.
- **Vite:** Development server and static production bundler.

## Development
```bash
npm install
npm run dev   # Local development server
npm run build # Production static bundle in dist/
```
