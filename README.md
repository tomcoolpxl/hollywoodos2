# HollywoodOS 2

A browser-based, modular retro-rendering platform. Simulates a multi-terminal "Hollywood-style" dashboard with deterministic animations and a cinematic boot sequence.

## Features
- **6 Integrated Modules:**
  - **Matrix Rain:** Upgraded with vertical trails and decoding effects.
  - **Global Tracking:** A 3D wireframe rotating globe with dynamic coordinate readouts.
  - **Core Memory:** A scrolling hex dump with an active scanning cursor.
  - **Signal Analysis:** An LED-style segmented spectrum analyzer.
  - **Network Log:** A simulated system message stream.
  - **System Load:** A dual-line real-time performance graph.
- **Cinematic Boot Sequence:** BIOS-style startup log with terminal emulation.
- **Dynamic Scaling:** Automatically stretches or letterboxes to fill any screen size.
- **Persistence:** Remembers layout and settings via localStorage.

## Controls
- **`R`**: Reboot System (triggers boot sequence).
- **`S`**: Toggle Scaling Mode (Stretch/Fill vs. Maintain Aspect Ratio).
- **`1`**: Load Default 6-Window Layout.
- **`2`**: Load Minimalist Matrix Layout.

## Tech Stack
- **PixiJS v8:** High-performance WebGL rendering.
- **GSAP:** Precise timing and animation.
- **Vite:** Modern development and build tooling.

## Development
```bash
npm install
npm run dev   # Local development
npm run build # Production bundle
```
