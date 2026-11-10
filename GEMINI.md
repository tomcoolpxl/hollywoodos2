# HollywoodOS 2

## Project Overview

**HollywoodOS 2** is a modular, browser-based, retro-rendering platform designed to simulate "Hollywood-style" computer interfaces (e.g., Matrix rain, 3D wireframe globes, tactical radar maps, scrolling logs, hex dumps, spectrum analyzers). It emphasizes deterministic visual behavior, crisp bitmap font rendering, and a clean separation between content logic (Plugins) and the rendering engine.

The platform is deployed as a static site via Vite and GitHub Pages.

### Core Architecture

*   **Engine vs. Plugins (Pragmatic Hybrid Adapter Pattern):**
    *   **Engine (`src/core/`):** Handles layout, PixiJS v8 rendering, `BitmapFont` registration, `GridAdapter` & `FreeformAdapter` abstractions, seeded PRNG (`RNG.js`), hierarchical configuration (`ConfigManager.js`), window chrome/masking/error isolation (`WindowManager.js`), and global WebGL CRT post-processing (`CRTFilter.js`).
    *   **Plugins (`src/plugins/`):** Define *what* to render using `context.createGridAdapter()`, `context.createFreeformAdapter()`, and `context.rng`. Each plugin renders into an isolated `pluginContainer` so plugin cycling never detaches window masks or the shared [`Cursor`](file:///C:/Users/thraa/github/hollywoodos2/src/core/Cursor.js).
*   **Rendering Stack:**
    *   **PixiJS v8:** Core WebGL rendering engine, `FillGradient`, GLSL ES 300 `Filter` / `GlProgram`, and `BitmapFont` / `BitmapText`.
    *   **GSAP:** Smooth line-step scroll animations.
*   **Data Flow:**
    *   `public/config.json` -> `ConfigManager` -> `Engine` -> `WindowManager` -> `PluginManager` -> Plugin Instance (`GridAdapter` / `FreeformAdapter`).

## Development Status

**Current Phase:** Active & Production-Ready.

*   **Core Modules (`src/core/`):**
    *   [`Engine.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/Engine.js): Main lifecycle, PixiJS v8 initialization, resize/scaling modes, keyboard shortcuts, focus pause.
    *   [`WindowManager.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/WindowManager.js): Window chrome, isolated `pluginContainer` & `errorContainer`, plugin cycling, GPU resource cleanup.
    *   [`PluginManager.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/PluginManager.js): Plugin registration, instantiation, per-window error trapping.
    *   [`Adapters.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/Adapters.js): `HollywoodMono` `BitmapFont` installer, `GridAdapter`, and `FreeformAdapter`.
    *   [`CRTFilter.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/CRTFilter.js): PixiJS v8 GLSL ES 300 CRT scanline, curvature, chromatic aberration, and vignette filter.
    *   [`ConfigManager.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/ConfigManager.js): Hierarchical config & theme resolution, versioned `localStorage` persistence.
    *   [`RNG.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/RNG.js): Deterministic Mulberry32 PRNG with `.fork()`, `.int()`, `.range()`, and `.pick()`.
    *   [`Cursor.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/Cursor.js) & [`BootSequence.js`](file:///C:/Users/thraa/github/hollywoodos2/src/core/BootSequence.js).
*   **Plugins (`src/plugins/`):**
    *   `MatrixPlugin`, `BootPlugin`, `GlobePlugin`, `MapPlugin`, `HexPlugin`, `SpectrumPlugin`, `CodePlugin`, `LogPlugin`, `GraphPlugin`.

## Architecture & Conventions

### Plugin API
Plugins adhere to the following lifecycle:
```javascript
init(context)       // Receive adapters, dimensions, theme, cursor, and seeded context.rng
update(dt, state)   // Advance simulation logic and update adapters
destroy()           // Clean up internal state; WindowManager destroys child display objects
```

### Determinism
*   **RNG:** Always use `context.rng()` (and helpers `context.rng.int()`, `context.rng.pick()`, `context.rng.range()`). **Never** use `Math.random()` in plugins.

### PixiJS v8 Graphics Convention
*   Always define geometry first (`.rect()`, `.circle()`, `.moveTo()`/`.lineTo()`) and call `.fill()` or `.stroke()` **after** the geometry definition, or use `FreeformAdapter` methods.
