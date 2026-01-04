# Retro Modular Rendering Platform — Final Design Plan

This document defines the architecture and requirements for a modular retro-rendering platform with pluggable content modules, high-precision text rendering, and retro-style animated visuals. The platform is browser-based and deployable as a static site.

The intent is to maintain deterministic visual behavior, precise text control, and clean separation between content logic and rendering.

---

## Core Architectural Principle

Separate content logic (plugins) from rendering + layout engine.

- Plugins describe *what* to render.
- The engine decides *how* it is rendered.

This avoids plugins leaking layout assumptions and preserves long-term maintainability.

---

## Plugin Model (Window “Contents”)

Each window hosts one plugin instance.

### Planned Plugin Types

- Matrix rain
- Hex editor / debugger  
  - ASCII text column  
  - Cursor scrolling down
- Fake logfile stream
- Wireframe monochrome map  
  - Animated points/lines  
  - Mixed free-form text overlays
- Other retro visual systems

### Minimal Initial Plugin Set

- Matrix rain
- Fake logfile stream

---

## Plugin Rendering Modes

Two rendering paradigms:

1. Grid Text Mode  
   - terminal-like text  
   - character grid addressing  
   - cursor control  

2. Free-Form Graphics Mode  
   - arbitrary 2D primitives  
   - overlays and map visuals  

Both run inside the same Pixi rendering stack.

### Mode Declaration

Each plugin declares one of:

- `grid`
- `freeform`
- `both`

The engine uses this to select the appropriate adapter.

---

## Plugin API

Plugins never interact with Pixi or GSAP directly.

```text
init(context)
update(dt, state)
render(adapter)
destroy()
````

Where:

* `context`

  * grid or pixel size
  * font + theme
  * cursor + scroll mode
  * RNG handle (deterministic)
* `update(dt)`

  * logic step
* `render(adapter)`

  * abstract drawing ops
* `destroy()`

  * cleanup

Properties:

* stable
* minimal
* mockable
* dev-friendly

Plugins are wired manually via code/JSON.

---

## Configuration System

Hierarchical override chain:

```text
Global defaults
 → Screen preset
    → Window defaults
       → Window style
          → Plugin defaults
             → Instance overrides
```

Last-wins resolution.

Configs authored as JSON and bundled.

---

## Styles and Presets

Screen presets define:

* tiled layout (%-based)
* default plugins per window
* style + color
* render effects

Examples:

* 4-terminal workstation
* debug lab
* matrix chamber
* map deck

Persistence:

* localStorage
* JSON export/import

Layout editing is JSON-only.

---

## Rendering Options

Engine-level (not plugin-level):

* CRT glow
* phosphor bloom
* chromatic shift
* scanlines
* noise grain
* gamma curves

Pixi filters apply these.

---

## Cursor Engine

Shared system supporting:

* block / underline / beam
* blink timing
* insert / overwrite
* show / hide policy

Plugins only request cursor movement.

---

## Scrolling Engine

Supports:

* line-step scroll
* smooth pixel scroll
* animated transitions

Driven by GSAP timelines.

Plugins state intent; engine animates.

---

## Text Rendering Model

Grid mode uses bitmap fonts for:

* fixed width glyphs
* exact alignment
* deterministic cursor behavior
* retro authenticity

Fake ANSI supports:

* FG/BG colors
* bold/dim
* inverse
* limited retro palettes

Behavior is stylistic, not terminal-accurate.

---

## Logical Grid Sizes

Built-in:

* 80×25
* 40×24

Plus **auto-grid mode**:

* grid size computed from window size
* cell-aligned
* dependent on font metrics

Plugins may request specific dimensions.

---

## Engine Architecture

### Core Stack

* PixiJS (rendering)
* GSAP (timing + animation)
* Bitmap font atlases (text)

### Layered Modules

* Engine Core
* Window Manager
* Text Grid Engine
* Free-Form Graphics Engine
* Plugin Runtime
* Config + Preset Manager
* RNG Manager (global seeded)
* Persistence Manager

Structured, not flat.

---

## Font Assets and Webfonts

* start with one primary bitmap mono font
* fonts loaded as atlases
* webfont source acceptable for generation
* runtime uses Pixi bitmap text

Guarantees stable cell metrics.

---

## Deployment

Fully static.

Compatible with:

* GitHub Pages
* any static host

Assets:

* HTML
* JS bundle
* font atlases
* JSON configs
* CSS
* optional shaders

No backend required.

---

## Scaling Strategy

Logical grid is fixed per window:

* 80×25
* 40×24
* or auto-grid

Rendering:

1. draw to logical buffer
2. scale visually

Prefer integer scale factors:

* 1x
* 2x
* 3x

Use nearest-neighbor.

### Two modes

#### Default

Fractional scaling allowed
(alignment preserved)

#### Retro Mode

Integer-snap only
(letterboxing allowed)

User-toggleable.

---

## Responsive Layout

* windows defined as % tiles
* window size updates on resize
* scaling applied per window
* auto-grid recomputes dimensions where enabled

Grid dimensions remain stable unless auto-grid is in use.

---

## Window Chrome and Borders

Engine-rendered:

* frames
* separators
* titles
* CRT effects

Plugins know nothing about it.

---

## Runtime Content Swapping

Windows may replace active plugins:

* matrix ↔ log ↔ others later
* initial transition: hard-cut
* later transitions allowed

Must:

* destroy old plugin
* init new plugin
* preserve layout + style
* avoid leaks

Manual wiring only.

---

## Persistence

Supports:

* localStorage save/restore
* JSON import/export

Includes:

* layouts
* plugin assignments
* styles

---

## Deterministic Randomness

Single **global seeded RNG**.

Plugins must not use `Math.random`.

Engine injects RNG handle.

Benefits:

* reproducible demos
* repeatable layouts
* easier debugging

---

## Error Handling

If a plugin crashes:

* engine catches error
* logs to dev tools
* replaces window with error screen

Error screen:

* black / flicker theme
* contained to that window

App continues running.

---

## Developer Experience

Goals:

* minimal boilerplate
* clear API
* easy testing
* simple wiring

### Lightweight Test Harness

A dev page that:

* mounts single plugin
* provides context + RNG
* loops update/render
* injects JSON config

No heavy tooling.

### Hot Reload

Prefer:

* live reload during dev
* plugin reload without restart
* reinit plugin on refresh

Debugging via browser dev tools only.

---

## Initial Plugin Behavior

### Matrix

* runs indefinitely
* global RNG controls variation
* continuous rain effect

### Fake Log

* runs indefinitely
* appends log lines at simple configurable intervals
* scrolls via engine scroll system
* supports per-window speeds

No scripting required initially.

---

## Runtime + Focus Handling

* each window has its own update clock
* shared render loop
* independent speeds supported
* animation pauses on lost focus
* desktop-only support acceptable
* accessibility not a priority

---

## Risk + Control Measures

Main risk:

* mixing terminal simulation
* creative visuals
* theming
* plugins

Mitigation:

* strict separation
* consistent APIs
* JSON-based config
* layered engine
* deterministic RNG
* manual wiring

---

## Existing Behavioral Requirements (Confirmed)

* ≈4 windows typical
* independent update speeds
* continuous terminal updates
* smooth + line-step scrolling
* cursor system
* fixed logical grids
* bitmap font
* fake ANSI
* static deployment
* responsive layout
* seeded global RNG
* persistence (localStorage + JSON)
* plugins isolated + testable
* hot reload dev workflow
* integer-snap mode toggle
* runtime plugin swaps allowed
* minimal test harness
* manual plugin registration
* error screen isolation
* initial plugins: matrix + fake log
* engine = layered, not flat
* configs embedded JSON initially
* fonts as web-served bitmap atlases

---

## Update Speed Model

Each window:

* runs on its own logical clock
* updates continuously
* does not block others
* syncs to shared render cycle

GSAP timelines coordinate scrolling + animation.

State updates decouple from drawing.

---

## Time Step Model

Use **simplest approach**:

* variable dt per frame
* engine passes actual elapsed time to plugins
* plugins use dt for simulation

Fixed timestep can be added later if required.

---

## Coordinate Origin Convention

Free-form rendering coordinates are:

* **local to each window**
* origin at window top-left
* engine handles global transforms

This keeps plugin logic intuitive.

---

## Global Controls

Provide minimal keyboard toggles:

* switch screen / preset
* toggle integer-snap mode
* optional test/error mode

No UI necessary.

---

# Summary of Stack

* PixiJS renderer
* GSAP timing + animation
* Bitmap fonts
* Seeded RNG
* JSON configs
* Static deployment
* Layered architecture
* Plugin API abstraction
* Initial plugins:

  * Matrix
  * Fake log

---

# End State

This platform:

* simulates retro multi-terminal dashboards
* supports deterministic visual effects
* allows multiple independent animated windows
* runs entirely static in the browser
* remains maintainable through strict separation
* enables developer-friendly plugin creation
* scales without architectural rewrites
