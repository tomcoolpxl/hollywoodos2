# HollywoodOS 2

## Project Overview

**HollywoodOS 2** is a modular, browser-based, retro-rendering platform designed to simulate "Hollywood-style" computer interfaces (e.g., Matrix rain, scrolling log files, hex dumps). It emphasizes deterministic visual behavior, precise text control, and a clean separation between content logic (Plugins) and the rendering engine.

The platform is designed to be deployed as a static site.

### Core Architecture

*   **Engine vs. Plugins:**
    *   **Engine:** Handles layout, rendering (PixiJS), input, time, and global effects (CRT style, scanlines).
    *   **Plugins:** Define *what* to render (logic) but not *how*. They operate in a sandboxed manner with a specific API.
*   **Rendering Stack:**
    *   **PixiJS:** Core rendering engine (WebGL/Canvas).
    *   **GSAP:** Timing and animation management.
    *   **Bitmap Fonts:** Used for precise, grid-based text rendering.
*   **Data Flow:**
    *   Config (JSON) -> Engine -> Window Manager -> Plugin Instance.

## Tech Stack

*   **Language:** JavaScript (ES6+) / TypeScript (Recommended for structure).
*   **Runtime:** Browser (Static HTML/JS).
*   **Libraries:**
    *   PixiJS
    *   GSAP
*   **Build Tooling:** *To be determined (likely Vite or Webpack)*.

## Development Status

**Current Phase:** Design & Planning.

*   **`DESIGN_PLAN.md`:** Contains the comprehensive architecture, requirements, and implementation plan.
*   **Codebase:** Not yet initialized.

## Getting Started (Planned)

*Since the project is in the initialization phase, standard commands are not yet established.*

### Implementation Roadmap

1.  **Scaffold Project:** Initialize `package.json`, set up build tool (Vite recommended).
2.  **Core Engine:** Implement the main loop, PixiJS initialization, and Window Manager.
3.  **Plugin System:** Define the `init/update/render/destroy` interface.
4.  **First Plugins:** Implement "Matrix Rain" and "Fake Log" to test the engine.
5.  **UI/UX:** Add retro CRT effects and window chrome.

## Architecture & Conventions

### Plugin API
Plugins must adhere to the following lifecycle:
```javascript
init(context)       // Setup resources, receive grid/font info, RNG handle
update(dt, state)   // Advance logic step
render(adapter)     // Issue abstract drawing commands
destroy()           // Cleanup
```

### Configuration
*   **Format:** JSON.
*   **Structure:** Hierarchical (Global -> Screen -> Window -> Plugin).
*   **Styles:** Separated from logic; visual themes are applied by the engine.

### Determinism
*   **RNG:** Use a global seeded RNG. **Do not** use `Math.random()` directly in plugins.

### Rendering
*   **Grid Mode:** 80x25 or 40x24 character grids.
*   **Free-Form:** 2D primitives/overlays.
*   **Coordinate System:** Local to the window (0,0 is top-left of the specific window/plugin).
