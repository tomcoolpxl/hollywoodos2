import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import { createRNG } from '../src/core/RNG.js';
import { ConfigManager } from '../src/core/ConfigManager.js';
import { parseFakeAnsiLine } from '../src/core/Adapters.js';

import { BootPlugin } from '../src/plugins/BootPlugin.js';
import { CodePlugin } from '../src/plugins/CodePlugin.js';
import { LogPlugin } from '../src/plugins/LogPlugin.js';
import { HexPlugin } from '../src/plugins/HexPlugin.js';
import { GlobePlugin } from '../src/plugins/GlobePlugin.js';
import { GraphPlugin } from '../src/plugins/GraphPlugin.js';
import { MapPlugin } from '../src/plugins/MapPlugin.js';
import { SpectrumPlugin } from '../src/plugins/SpectrumPlugin.js';
import { DecryptPlugin } from '../src/plugins/DecryptPlugin.js';
import { ScopePlugin } from '../src/plugins/ScopePlugin.js';
import { NetGraphPlugin } from '../src/plugins/NetGraphPlugin.js';
import { OrbitPlugin } from '../src/plugins/OrbitPlugin.js';
import { WaterfallPlugin } from '../src/plugins/WaterfallPlugin.js';
import { Wireframe3DPlugin } from '../src/plugins/Wireframe3DPlugin.js';
import { HelixPlugin } from '../src/plugins/HelixPlugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function getAllJsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(getAllJsFiles(full));
        else if (entry.name.endsWith('.js')) files.push(full);
    }
    return files;
}

// 1. Verify zero Math.random() calls in src/
const jsFiles = getAllJsFiles(path.join(repoRoot, 'src'));
for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
        content.includes('Math.random'),
        false,
        `Found forbidden Math.random in ${file}`
    );
}
console.log(`✓ Verified 0 occurrences of Math.random() across ${jsFiles.length} source files.`);

// 2. Verify RNG determinism
const rngA = createRNG('HOLLYWOOD-2026');
const rngB = createRNG('HOLLYWOOD-2026');
for (let i = 0; i < 50; i++) {
    assert.equal(rngA(), rngB(), 'Seeded RNG must produce identical sequence');
}
const childA = rngA.fork('win_1:matrix');
const childB = rngB.fork('win_1:matrix');
for (let i = 0; i < 20; i++) {
    assert.equal(childA.int(0, 1000), childB.int(0, 1000), 'Forked RNG must be deterministic');
}
console.log('✓ Verified deterministic Mulberry32 RNG and .fork() reproducibility.');

// 3. Verify ConfigManager presets & Fake ANSI parser
const rawJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public/config.json'), 'utf8'));
const cm = new ConfigManager();
cm.config = structuredClone(rawJson);
for (const presetName of ['default', 'minimal', 'debug_lab', 'map_deck', 'cyber_ops', 'workstation', 'crisis']) {
    const preset = cm.getPreset(presetName);
    assert.ok(preset, `Preset "${presetName}" must exist`);
    for (const w of preset.windows) {
        const resolved = cm.resolveWindowConfig(w, preset);
        assert.equal(typeof resolved.style.borderColor, 'number');
    }
}

const parsedAnsi = parseFakeAnsiLine('MOUNTING DISK A: ... {error}FAILED{/} [{peak}RETRY{/}]');
assert.equal(parsedAnsi.baseLine, 'MOUNTING DISK A: ...        [     ]');
assert.equal(parsedAnsi.spans.length, 2);
assert.deepEqual(parsedAnsi.spans[0], { tag: 'error', text: 'FAILED', col: 21 });
assert.deepEqual(parsedAnsi.spans[1], { tag: 'peak', text: 'RETRY', col: 29 });
console.log('✓ Verified all 7 presets (default, minimal, debug_lab, map_deck, cyber_ops, workstation, crisis) and Fake ANSI parser.');

// 4. Verify PixiJS v8 Graphics build-then-style order & determinism across plugins
function createMockGraphics() {
    let hasPendingGeometry = false;
    return {
        ops: [],
        clear() {
            hasPendingGeometry = false;
            this.ops.push('clear');
            return this;
        },
        moveTo() {
            hasPendingGeometry = true;
            return this;
        },
        lineTo() {
            hasPendingGeometry = true;
            return this;
        },
        closePath() {
            assert.equal(hasPendingGeometry, true, 'closePath() called without geometry');
            return this;
        },
        circle() {
            hasPendingGeometry = true;
            return this;
        },
        rect() {
            hasPendingGeometry = true;
            return this;
        },
        stroke(style) {
            assert.equal(
                hasPendingGeometry,
                true,
                `PixiJS v8 violation: .stroke(${JSON.stringify(style)}) called BEFORE building geometry!`
            );
            hasPendingGeometry = false;
            this.ops.push('stroke');
            return this;
        },
        fill(style) {
            assert.equal(
                hasPendingGeometry,
                true,
                `PixiJS v8 violation: .fill(${JSON.stringify(style)}) called BEFORE building geometry!`
            );
            hasPendingGeometry = false;
            this.ops.push('fill');
            return this;
        }
    };
}

function createMockContext(seed) {
    const rng = createRNG(seed);
    return {
        width: 500,
        height: 400,
        rng,
        theme: cm.getTheme('classic-green'),
        options: {},
        createGridAdapter() {
            return {
                cols: 60,
                rows: 24,
                lines: [],
                cursorPos: { c: 0, r: 0 },
                enableCursor() {},
                setText(t) { this.lines = [t]; },
                setLines(l) { this.lines = [...l]; },
                setCursorGrid(c, r) { this.cursorPos = { c, r }; },
                destroy() {}
            };
        },
        createFreeformAdapter() {
            return {
                bgGraphics: createMockGraphics(),
                graphics: createMockGraphics(),
                createLabel(text, opts = {}) {
                    return { text, x: opts.x ?? 0, y: opts.y ?? 0 };
                }
            };
        }
    };
}

const pluginClasses = [
    BootPlugin,
    CodePlugin,
    LogPlugin,
    HexPlugin,
    GlobePlugin,
    GraphPlugin,
    MapPlugin,
    SpectrumPlugin,
    DecryptPlugin,
    ScopePlugin,
    NetGraphPlugin,
    OrbitPlugin,
    WaterfallPlugin,
    Wireframe3DPlugin,
    HelixPlugin
];

for (const PluginCls of pluginClasses) {
    const p1 = new PluginCls();
    const p2 = new PluginCls();
    const ctx1 = createMockContext('TEST-SEED-42');
    const ctx2 = createMockContext('TEST-SEED-42');

    p1.init(ctx1);
    p2.init(ctx2);

    for (let step = 0; step < 80; step++) {
        p1.update(0.05);
        p2.update(0.05);
    }

    if (p1.lines) {
        assert.deepEqual(p1.lines, p2.lines, `${PluginCls.name} output must be deterministic`);
    }
    if (p1.targetKey) {
        assert.equal(p1.targetKey, p2.targetKey, `${PluginCls.name} targetKey must be deterministic`);
    }
    if (p1.dataCPU) {
        assert.deepEqual(p1.dataCPU, p2.dataCPU, `${PluginCls.name} CPU series must be deterministic`);
    }

    p1.destroy();
    p2.destroy();
    console.log(`✓ Verified ${PluginCls.name} (PixiJS v8 draw order, determinism, and lifecycle).`);
}
