import { Application, Container, Graphics } from 'pixi.js';
import { WindowManager, destroyContainerChildren } from './WindowManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigManager } from './ConfigManager.js';
import { BootSequence } from './BootSequence.js';
import { CRTFilter } from './CRTFilter.js';
import { createRNG } from './RNG.js';
import { ensureBitmapFontsInstalled, createRetroText } from './Adapters.js';

export class Engine {
    constructor() {
        this.app = null;
        this.windowManager = null;
        this.pluginManager = null;
        this.configManager = new ConfigManager();
        this.bootSequence = null;
        this.crtFilter = null;
        this.rng = createRNG('HOLLYWOOD-2026');
        this.isBooting = true;
        this.isPaused = false;
        this.currentPresetName = 'default';
        this.harnessPluginName = null;
        this.errorTestActive = false;

        // HUD & Toast State
        this.hudContainer = null;
        this.hudVisible = false;
        this.toastContainer = null;
        this.toastTimer = 0;

        this._onResize = () => this.handleResize();
        this._onKeyDown = (e) => this.handleKeyDown(e);
        this._onVisibilityChange = () => {
            this.isPaused = document.hidden;
        };
    }

    async init(containerId) {
        this.app = new Application();

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        await this.app.init({
            resizeTo: window,
            backgroundColor: 0x050505,
            antialias: true,
            resolution: dpr,
            autoDensity: true,
            roundPixels: true,
            preference: 'webgl',
            powerPreference: 'default'
        });

        const host = document.getElementById(containerId);
        if (!host) {
            throw new Error(`Container element "#${containerId}" not found.`);
        }
        host.appendChild(this.app.canvas);

        ensureBitmapFontsInstalled();

        this.pluginManager = new PluginManager(this);
        this.windowManager = new WindowManager(this.app, this.pluginManager, this.configManager, this.rng);
        this.windowManager.container.visible = false;

        this.hudContainer = new Container();
        this.hudContainer.visible = false;
        this.app.stage.addChild(this.hudContainer);

        this.toastContainer = new Container();
        this.toastContainer.visible = false;
        this.app.stage.addChild(this.toastContainer);

        this.setupCRTFilter();
        this.setupEventListeners();

        this.app.ticker.add((ticker) => {
            if (this.isPaused) return;
            const dt = Math.min(0.1, ticker.deltaMS / 1000);
            try {
                this.update(dt);
            } catch (err) {
                console.error('Critical Engine Error:', err);
            }
        });

        console.log('HollywoodOS 2 Engine Core Initialized');
    }

    setupCRTFilter() {
        try {
            this.crtFilter = new CRTFilter();
            const crtEnabled = this.configManager.getGlobal().crtEnabled ?? true;
            this.app.stage.filters = crtEnabled ? [this.crtFilter] : [];
        } catch (e) {
            console.warn('CRTFilter initialization skipped:', e);
            this.crtFilter = null;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', this._onResize);
        window.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    handleKeyDown(e) {
        if (this.isBooting) return;

        switch (e.code) {
            case 'KeyR':
                this.reboot();
                break;
            case 'KeyS':
                this.toggleScaling();
                break;
            case 'KeyI':
                this.toggleIntegerScale();
                break;
            case 'KeyC':
                this.toggleCRT();
                break;
            case 'KeyT':
                this.cycleTheme();
                break;
            case 'KeyE':
                this.toggleErrorSimulation();
                break;
            case 'KeyX':
                this.exportConfigFile();
                break;
            case 'KeyO':
                this.importConfigFile();
                break;
            case 'KeyH':
            case 'Slash':
                this.toggleHUD();
                break;
            case 'Escape':
                if (this.hudVisible) {
                    this.toggleHUD();
                } else if (this.windowManager?.maximizedWindowId) {
                    this.windowManager.restoreMaximizedWindow();
                    this.showToast('RESTORED TILED VIEW');
                }
                break;
            case 'Digit1':
                this.harnessPluginName = null;
                this.applyPreset('default');
                this.showToast('PRESET: DEFAULT WORKSTATION');
                break;
            case 'Digit2':
                this.harnessPluginName = null;
                this.applyPreset('minimal');
                this.showToast('PRESET: MINIMAL MATRIX');
                break;
            case 'Digit3':
                this.harnessPluginName = null;
                this.applyPreset('debug_lab');
                this.showToast('PRESET: DEBUG LAB');
                break;
            case 'Digit4':
                this.harnessPluginName = null;
                this.applyPreset('map_deck');
                this.showToast('PRESET: TACTICAL MAP DECK');
                break;
            case 'Digit5':
                this.harnessPluginName = null;
                this.applyPreset('cyber_ops');
                this.showToast('PRESET: CYBER OPS DECK');
                break;
        }
    }

    /**
     * Parses URL query parameters (?plugin=globe&preset=map_deck&theme=amber&seed=42&crt=0&noboot=1)
     * and launches either the Single-Plugin Test Harness or the configured workstation preset.
     */
    startFromQueryOrPreset(defaultPreset = 'default') {
        const params = new URLSearchParams(window.location.search);
        const global = this.configManager.getGlobal();

        if (params.has('seed')) {
            global.seed = params.get('seed');
        }
        if (params.has('theme')) {
            global.theme = params.get('theme');
        }
        if (params.has('crt')) {
            const crtParam = params.get('crt');
            global.crtEnabled = crtParam !== '0' && crtParam !== 'false';
            if (this.crtFilter) {
                this.app.stage.filters = global.crtEnabled ? [this.crtFilter] : [];
            }
        }
        if (params.has('preset')) {
            this.currentPresetName = params.get('preset');
        } else {
            this.currentPresetName = defaultPreset;
        }

        if (params.has('plugin')) {
            this.harnessPluginName = params.get('plugin');
        }

        const skipBoot = params.get('noboot') === '1' || params.get('noboot') === 'true' || Boolean(this.harnessPluginName);
        if (skipBoot && params.get('boot') !== '1') {
            this.isBooting = false;
            this.windowManager.container.visible = true;
            this.activateCurrentView();
            if (this.harnessPluginName) {
                this.showToast(`DEV HARNESS: [${this.harnessPluginName.toUpperCase()}]`);
            }
        } else {
            this.activateCurrentView();
            this.reboot();
        }
    }

    activateCurrentView() {
        if (this.harnessPluginName) {
            this.applySinglePluginHarness(this.harnessPluginName);
        } else {
            this.applyPreset(this.currentPresetName);
        }
    }

    applySinglePluginHarness(pluginName) {
        this.errorTestActive = false;
        const global = this.configManager.getGlobal();
        this.rng.reset(global.seed || 'HOLLYWOOD-2026');
        this.windowManager.clear();

        const refRes = global.referenceResolution || { width: 1600, height: 900 };
        const winConfig = this.configManager.resolveWindowConfig({
            id: 'harness_1',
            title: `TEST_HARNESS // PLUGIN: ${pluginName.toUpperCase()}`,
            x: 20,
            y: 20,
            width: refRes.width - 40,
            height: refRes.height - 40,
            plugin: pluginName
        });

        this.windowManager.createWindow(winConfig);
        if (this.hudVisible) this.renderHUD();
    }

    reboot() {
        if (this.bootSequence) return;

        this.isBooting = true;
        this.errorTestActive = false;
        this.windowManager.container.visible = false;
        this.hudContainer.visible = false;

        const seed = this.configManager.getGlobal().seed || 'HOLLYWOOD-2026';
        this.rng.reset(seed);

        const theme = this.configManager.getTheme();
        this.bootSequence = new BootSequence(this.app, () => {
            this.windowManager.container.visible = true;
            this.isBooting = false;
            this.bootSequence = null;
            if (this.configManager.config) {
                this.activateCurrentView();
            }
            if (this.hudVisible) {
                this.hudContainer.visible = true;
                this.renderHUD();
            }
        }, theme.primary);
    }

    toggleScaling() {
        const global = this.configManager.getGlobal();
        global.maintainAspectRatio = !global.maintainAspectRatio;
        if (!global.maintainAspectRatio) {
            global.integerScale = false;
        }
        this.configManager.save();
        const modeLabel = global.maintainAspectRatio ? 'LETTERBOX (ASPECT)' : 'STRETCH FILL';
        this.showToast(`SCALING: ${modeLabel}`);
        this.handleResize();
        if (this.hudVisible) this.renderHUD();
    }

    toggleIntegerScale() {
        const global = this.configManager.getGlobal();
        global.integerScale = !global.integerScale;
        if (global.integerScale) {
            global.maintainAspectRatio = true;
        }
        this.configManager.save();
        this.showToast(`INTEGER RETRO SNAP: ${global.integerScale ? 'ON' : 'OFF'}`);
        this.handleResize();
        if (this.hudVisible) this.renderHUD();
    }

    toggleCRT() {
        if (!this.crtFilter) return;
        const global = this.configManager.getGlobal();
        global.crtEnabled = !(global.crtEnabled ?? true);
        this.app.stage.filters = global.crtEnabled ? [this.crtFilter] : [];
        this.configManager.save();
        this.showToast(`CRT SHADER: ${global.crtEnabled ? 'ENABLED' : 'BYPASSED'}`);
        if (this.hudVisible) this.renderHUD();
    }

    cycleTheme() {
        const themes = Object.keys(this.configManager.config?.themes || { 'classic-green': {} });
        if (themes.length === 0) return;
        const global = this.configManager.getGlobal();
        const currentIdx = themes.indexOf(global.theme || 'classic-green');
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        global.theme = nextTheme;
        this.configManager.save();
        this.activateCurrentView();
        this.showToast(`THEME: ${nextTheme.toUpperCase()}`);
    }

    toggleErrorSimulation() {
        const firstWin = this.windowManager.windows.values().next().value;
        if (!firstWin) return;

        if (!this.errorTestActive && !firstWin.hasError) {
            this.errorTestActive = true;
            this.windowManager.showErrorScreen(firstWin.id, new Error('SIMULATED KERNEL PANIC (0xDEAD0001)'));
            this.showToast(`FAULT INJECTED: ${firstWin.id.toUpperCase()}`);
        } else {
            this.errorTestActive = false;
            this.windowManager.loadCurrentPlugin(firstWin);
            this.showToast(`FAULT CLEARED: ${firstWin.id.toUpperCase()}`);
        }
    }

    exportConfigFile() {
        const json = this.configManager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hollywoodos2-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('CONFIG EXPORTED TO JSON');
    }

    importConfigFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                this.configManager.importJSON(text);
                this.handleResize();
                this.activateCurrentView();
                this.showToast(`IMPORTED: ${file.name.toUpperCase()}`);
            } catch (err) {
                console.error('Failed to import JSON config:', err);
                this.showToast('CONFIG IMPORT FAILED');
            }
        };
        input.click();
    }

    toggleHUD() {
        this.hudVisible = !this.hudVisible;
        this.hudContainer.visible = this.hudVisible;
        if (this.hudVisible) {
            this.renderHUD();
        }
    }

    renderHUD() {
        destroyContainerChildren(this.hudContainer);
        if (!this.hudVisible) return;

        const theme = this.configManager.getTheme();
        const global = this.configManager.getGlobal();
        const boxW = 560;
        const boxH = 380;
        const x = Math.max(10, Math.floor((window.innerWidth - boxW) / 2));
        const y = Math.max(10, Math.floor((window.innerHeight - boxH) / 2));

        const panel = new Graphics();
        panel.rect(x, y, boxW, boxH).fill({ color: 0x030603, alpha: 0.94 });
        panel.rect(x, y, boxW, boxH).stroke({ width: 2, color: theme.primary });
        panel.moveTo(x, y + 26).lineTo(x + boxW, y + 26).stroke({ width: 1, color: theme.primary });
        this.hudContainer.addChild(panel);

        const modeStr = global.integerScale
            ? 'INTEGER RETRO'
            : global.maintainAspectRatio
                ? 'LETTERBOX'
                : 'STRETCH FILL';

        const lines = [
            'HOLLYWOOD_OS 2 // OPERATOR HUD & KEYMAP',
            '',
            `ACTIVE VIEW  : ${(this.harnessPluginName ? `HARNESS (${this.harnessPluginName})` : this.currentPresetName).toUpperCase()}`,
            `COLOR THEME  : ${(global.theme || 'classic-green').toUpperCase()}`,
            `SCALING MODE : ${modeStr}`,
            `CRT SHADER   : ${(global.crtEnabled ?? true) ? 'ENABLED' : 'BYPASSED'}`,
            `PRNG SEED    : ${global.seed || 'HOLLYWOOD-2026'}`,
            '',
            '[1] Default 6-Win   [2] Minimal Matrix',
            '[3] Debug Lab       [4] Tactical Map Deck',
            '[5] Cyber Ops Deck  [Click Win] Maximize/Restore',
            '[T] Cycle Theme     [C] Toggle CRT Filter',
            '[S] Scaling Mode    [I] Integer-Snap Retro',
            '[E] Simulate Fault  [R] System Reboot',
            '[X] Export JSON     [O] Import JSON Config',
            '[H / ? / ESC] Close HUD'
        ].join('\n');

        const hudText = createRetroText(lines, {
            fontSize: 14,
            lineHeight: 20,
            fill: theme.primary
        });
        hudText.x = x + 18;
        hudText.y = y + 6;
        this.hudContainer.addChild(hudText);
    }

    showToast(message) {
        destroyContainerChildren(this.toastContainer);
        const theme = this.configManager.getTheme();

        const label = createRetroText(` ${message} `, {
            fontSize: 13,
            lineHeight: 18,
            fill: theme.bg
        });
        const padX = 10;
        const padY = 5;
        const w = label.width + padX * 2;
        const h = 26;
        const x = Math.max(10, window.innerWidth - w - 18);
        const y = Math.max(10, window.innerHeight - h - 18);

        const bg = new Graphics();
        bg.rect(x, y, w, h).fill({ color: theme.primary });
        this.toastContainer.addChild(bg);

        label.x = x + padX;
        label.y = y + padY;
        this.toastContainer.addChild(label);

        this.toastContainer.visible = true;
        this.toastContainer.alpha = 1;
        this.toastTimer = 2.0;
    }

    async loadConfig(path) {
        const config = await this.configManager.load(path);
        if (config) {
            const global = this.configManager.getGlobal();
            this.rng.reset(global.seed || 'HOLLYWOOD-2026');
            if (this.crtFilter) {
                const crtEnabled = global.crtEnabled ?? true;
                this.app.stage.filters = crtEnabled ? [this.crtFilter] : [];
            }
            this.handleResize();
        }
        return config;
    }

    handleResize() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        if (this.bootSequence) {
            this.bootSequence.resize(winW, winH);
        }
        if (this.hudVisible) {
            this.renderHUD();
        }

        const global = this.configManager.getGlobal();
        if (global.referenceResolution) {
            const refW = global.referenceResolution.width;
            const refH = global.referenceResolution.height;

            const scaleX = winW / refW;
            const scaleY = winH / refH;

            if (global.integerScale) {
                const rawScale = Math.min(scaleX, scaleY);
                const scale = rawScale >= 1 ? Math.floor(rawScale) : rawScale;
                this.windowManager.setScale(scale);
                this.windowManager.setPosition(
                    Math.floor((winW - refW * scale) / 2),
                    Math.floor((winH - refH * scale) / 2)
                );
            } else if (global.maintainAspectRatio) {
                const scale = Math.min(scaleX, scaleY);
                this.windowManager.setScale(scale);
                this.windowManager.setPosition(
                    (winW - refW * scale) / 2,
                    (winH - refH * scale) / 2
                );
            } else {
                this.windowManager.setScale(scaleX, scaleY);
                this.windowManager.setPosition(0, 0);
            }
        }
    }

    applyPreset(presetName) {
        const preset = this.configManager.getPreset(presetName) || this.configManager.getPreset('default');
        if (!preset) return;

        this.currentPresetName = presetName;
        this.errorTestActive = false;
        this.rng.reset(this.configManager.getGlobal().seed || 'HOLLYWOOD-2026');
        this.windowManager.clear();

        preset.windows.forEach((winConfig) => {
            const resolved = this.configManager.resolveWindowConfig(winConfig, preset);
            this.windowManager.createWindow(resolved);
        });

        if (this.hudVisible) {
            this.renderHUD();
        }
    }

    update(dt) {
        if (this.crtFilter) {
            this.crtFilter.update(dt);
        }

        if (this.toastTimer > 0) {
            this.toastTimer -= dt;
            if (this.toastTimer <= 0.35) {
                this.toastContainer.alpha = Math.max(0, this.toastTimer / 0.35);
            }
            if (this.toastTimer <= 0) {
                this.toastContainer.visible = false;
            }
        }

        if (this.isBooting && this.bootSequence) {
            this.bootSequence.update(dt);
        } else {
            this.pluginManager.update(dt);
            this.windowManager.update(dt);
        }
    }

    registerPlugin(name, pluginClass) {
        this.pluginManager.register(name, pluginClass);
    }
}
