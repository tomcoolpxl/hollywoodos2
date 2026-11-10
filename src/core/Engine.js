import { Application, Container, Graphics } from 'pixi.js';
import { WindowManager, destroyContainerChildren } from './WindowManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigManager } from './ConfigManager.js';
import { BootSequence } from './BootSequence.js';
import { CRTFilter, CRT_PRESETS } from './CRTFilter.js';
import { createRNG } from './RNG.js';
import { ensureBitmapFontsInstalled, createRetroText } from './Adapters.js';

const ALERT_SCENARIOS = [
    { target: 'NODE-X9 // AS4192', lat: 55.75, lon: 37.61, label: '55.8N 037.6E' },
    { target: 'SAT-KH12 // UPLINK', lat: 39.90, lon: 116.40, label: '39.9N 116.4E' },
    { target: 'SUB-CABLE // TAT-14', lat: 51.50, lon: -0.12, label: '51.5N 000.1W' },
    { target: 'CORE-GW // ZURICH-04', lat: 47.37, lon: 8.54, label: '47.4N 008.5E' }
];

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

        this.systemState = {
            alertActive: false,
            alertChanged: false,
            alertTimer: 0,
            autoAlertTimer: 45,
            alertScenarioIdx: 0,
            alertTarget: ALERT_SCENARIOS[0].target,
            alertCoords: { lat: ALERT_SCENARIOS[0].lat, lon: ALERT_SCENARIOS[0].lon },
            alertCoordsLabel: ALERT_SCENARIOS[0].label,
            layoutName: 'default'
        };

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
            const global = this.configManager.getGlobal();
            const initialMode =
                global.crtMode || (global.crtEnabled === false ? 'super_crisp' : 'sharp_crt');
            this.crtFilter = new CRTFilter({ preset: initialMode });
            this.applyCRTMode(initialMode, false);
        } catch (e) {
            console.warn('CRTFilter initialization skipped:', e);
            this.crtFilter = null;
        }
    }

    applyCRTMode(modeId, saveConfig = true) {
        if (!this.crtFilter) return null;
        const preset = this.crtFilter.applyPreset(modeId);
        const global = this.configManager.getGlobal();
        global.crtMode = preset.id;
        global.crtEnabled = preset.enabled;
        this.app.stage.filters = preset.enabled ? [this.crtFilter] : [];
        if (saveConfig) {
            this.configManager.save();
        }
        return preset;
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
            case 'KeyM':
                this.toggleColorMode();
                break;
            case 'KeyP':
            case 'Space':
                e.preventDefault();
                this.toggleCyclePause();
                break;
            case 'BracketLeft':
                this.stepWindowPlugin(-1);
                break;
            case 'BracketRight':
                this.stepWindowPlugin(1);
                break;
            case 'KeyA':
                this.toggleSystemAlert();
                break;
            case 'KeyL':
                this.cycleLayoutPreset();
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
                    this.showToast('RESTORED VIEW');
                } else if (this.systemState.alertActive) {
                    this.clearSystemAlert();
                    this.showToast('PRIORITY ALERT CLEARED');
                }
                break;
            case 'Digit1':
                this.harnessPluginName = null;
                this.applyPreset('default');
                this.showToast('LAYOUT [1]: TILED 6-WIN WORKSTATION');
                break;
            case 'Digit2':
                this.harnessPluginName = null;
                this.applyPreset('minimal');
                this.showToast('LAYOUT [2]: MINIMAL MATRIX CORE');
                break;
            case 'Digit3':
                this.harnessPluginName = null;
                this.applyPreset('debug_lab');
                this.showToast('LAYOUT [3]: KERNEL DEBUG LAB');
                break;
            case 'Digit4':
                this.harnessPluginName = null;
                this.applyPreset('map_deck');
                this.showToast('LAYOUT [4]: HERO MAP + FLOATING PIP');
                break;
            case 'Digit5':
                this.harnessPluginName = null;
                this.applyPreset('cyber_ops');
                this.showToast('LAYOUT [5]: CYBER & SCI-FI OPS');
                break;
            case 'Digit6':
                this.harnessPluginName = null;
                this.applyPreset('workstation');
                this.showToast('LAYOUT [6]: OVERLAPPING X11 WORKSTATION');
                break;
            case 'Digit7':
                this.harnessPluginName = null;
                this.applyPreset('crisis');
                this.showToast('LAYOUT [7]: CINEMA CRISIS CASCADE');
                break;
        }
    }

    toggleCyclePause() {
        if (!this.windowManager) return;
        const paused = this.windowManager.toggleCyclePause();
        this.showToast(paused ? 'PLUGIN CYCLING: PINNED / PAUSED' : 'PLUGIN CYCLING: AUTO-ROTATE ON');
        if (this.hudVisible) this.renderHUD();
    }

    stepWindowPlugin(delta) {
        if (!this.windowManager) return;
        const targetId =
            this.windowManager.maximizedWindowId ||
            this.windowManager.activeWindowId ||
            this.windowManager.windows.keys().next().value;
        if (!targetId) return;
        const pluginName = this.windowManager.stepWindowPlugin(targetId, delta);
        if (pluginName) {
            this.showToast(`WIN [${targetId.toUpperCase()}] -> ${pluginName.toUpperCase()}`);
        }
    }

    cycleLayoutPreset() {
        const presetOrder = ['default', 'minimal', 'debug_lab', 'map_deck', 'cyber_ops', 'workstation', 'crisis'];
        const idx = presetOrder.indexOf(this.currentPresetName);
        const nextPreset = presetOrder[(idx + 1) % presetOrder.length];
        this.harnessPluginName = null;
        this.applyPreset(nextPreset);
        this.showToast(`LAYOUT PRESET: ${nextPreset.toUpperCase()}`);
    }

    triggerSystemAlert(duration = 16.0) {
        const scenario = ALERT_SCENARIOS[this.systemState.alertScenarioIdx % ALERT_SCENARIOS.length];
        this.systemState.alertScenarioIdx++;
        this.systemState.alertActive = true;
        this.systemState.alertChanged = true;
        this.systemState.alertTimer = duration;
        this.systemState.alertTarget = scenario.target;
        this.systemState.alertCoords = { lat: scenario.lat, lon: scenario.lon };
        this.systemState.alertCoordsLabel = scenario.label;

        if (this.windowManager) {
            this.windowManager.spawnCrisisPopups(this.systemState);
        }
    }

    clearSystemAlert() {
        this.systemState.alertActive = false;
        this.systemState.alertChanged = true;
        this.systemState.alertTimer = 0;
        if (this.windowManager) {
            this.windowManager.dismissCrisisPopups();
        }
    }

    toggleSystemAlert() {
        if (this.systemState.alertActive) {
            this.clearSystemAlert();
            this.showToast('PRIORITY INTERCEPT CLEARED');
        } else {
            this.triggerSystemAlert(18.0);
            this.showToast(`!! PRIORITY ALERT: ${this.systemState.alertTarget} !!`);
        }
    }

    /**
     * Parses URL query parameters (?plugin=globe&preset=map_deck&theme=amber&seed=42&crt=0&noboot=1&alert=1)
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
        if (params.has('mode')) {
            const mode = params.get('mode').toLowerCase();
            global.colorMode = mode === 'color' ? 'color' : 'mono';
        }
        if (params.has('crt')) {
            const crtParam = params.get('crt').toLowerCase();
            if (crtParam === '0' || crtParam === 'false' || crtParam === 'off') {
                this.applyCRTMode('super_crisp', false);
            } else if (CRT_PRESETS.some((p) => p.id === crtParam)) {
                this.applyCRTMode(crtParam, false);
            } else {
                this.applyCRTMode('sharp_crt', false);
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

        const forceAlert = params.get('alert') === '1' || params.get('alert') === 'true';

        const skipBoot = params.get('noboot') === '1' || params.get('noboot') === 'true' || Boolean(this.harnessPluginName);
        if (skipBoot && params.get('boot') !== '1') {
            this.isBooting = false;
            this.windowManager.container.visible = true;
            this.activateCurrentView();
            if (forceAlert && !this.systemState.alertActive) {
                this.triggerSystemAlert(25.0);
            }
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
        this.clearSystemAlert();
        const global = this.configManager.getGlobal();
        this.rng.reset(global.seed || 'HOLLYWOOD-2026');
        this.windowManager.clear();

        const refRes = global.referenceResolution || { width: 1600, height: 900 };
        const winConfig = this.configManager.resolveWindowConfig({
            id: 'harness_1',
            title: `TEST_HARNESS // PLUGIN: ${pluginName.toUpperCase()}`,
            x: 20,
            y: 12,
            width: refRes.width - 40,
            height: refRes.height - 32,
            plugin: pluginName
        });

        this.windowManager.createWindow(winConfig);
        if (this.hudVisible) this.renderHUD();
    }

    reboot() {
        if (this.bootSequence) return;

        this.isBooting = true;
        this.errorTestActive = false;
        this.clearSystemAlert();
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
        const currentId = global.crtMode || this.crtFilter.currentPreset?.id || 'sharp_crt';
        const idx = CRT_PRESETS.findIndex((p) => p.id === currentId);
        const nextIdx = (idx + 1) % CRT_PRESETS.length;
        const nextPreset = this.applyCRTMode(CRT_PRESETS[nextIdx].id, true);
        if (nextPreset) {
            this.showToast(`CRT DISPLAY [${nextIdx + 1}/${CRT_PRESETS.length}]: ${nextPreset.label}`);
        }
        if (this.hudVisible) this.renderHUD();
    }

    cycleTheme() {
        const themes = Object.keys(
            this.configManager.config?.themes || {
                'classic-green': {},
                amber: {},
                'light-grey': {}
            }
        );
        if (themes.length === 0) return;
        const global = this.configManager.getGlobal();
        const currentIdx = themes.indexOf(global.theme || 'classic-green');
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        global.theme = nextTheme;
        this.configManager.save();
        this.activateCurrentView();
        this.showToast(`PHOSPHOR THEME: ${nextTheme.toUpperCase()}`);
    }

    toggleColorMode() {
        const global = this.configManager.getGlobal();
        global.colorMode = (global.colorMode || 'mono') === 'mono' ? 'color' : 'mono';
        this.configManager.save();
        this.activateCurrentView();
        this.showToast(
            `RENDERING MODE: ${global.colorMode === 'mono' ? 'MONO (BOLD / SINGLE PHOSPHOR)' : 'COLOR (MULTI-TONE ANSI)'}`
        );
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
        const boxW = 620;
        const boxH = 440;
        const x = Math.max(10, Math.floor((window.innerWidth - boxW) / 2));
        const y = Math.max(10, Math.floor((window.innerHeight - boxH) / 2));

        const panel = new Graphics();
        panel.rect(x, y, boxW, boxH).fill({ color: 0x030603, alpha: 0.96 });
        panel.rect(x, y, boxW, boxH).stroke({ width: 2, color: theme.primary });
        panel.moveTo(x, y + 26).lineTo(x + boxW, y + 26).stroke({ width: 1, color: theme.primary });
        this.hudContainer.addChild(panel);

        const modeStr = global.integerScale
            ? 'INTEGER RETRO'
            : global.maintainAspectRatio
                ? 'LETTERBOX'
                : 'STRETCH FILL';

        const crtLabel = this.crtFilter?.currentPreset?.label || 'SHARP CRT';
        const colorModeStr = (global.colorMode || 'mono') === 'mono' ? 'MONO (BOLD/DIM)' : 'COLOR (MULTI-TONE)';
        const pinStr = this.windowManager?.cyclePaused ? 'PINNED (MANUAL)' : 'AUTO-ROTATE';

        const lines = [
            'HOLLYWOOD_OS 2 // OPERATOR HUD & CINEMA COMPOSITIONS',
            '',
            `ACTIVE VIEW  : ${(this.harnessPluginName ? `HARNESS (${this.harnessPluginName})` : this.currentPresetName).toUpperCase()}`,
            `PHOSPHOR     : ${(global.theme || 'classic-green').toUpperCase()} // ${colorModeStr}`,
            `PLUGIN CYCLE : ${pinStr}   |   CRT: ${crtLabel}`,
            `SCALING MODE : ${modeStr}  |   SEED: ${global.seed || 'HOLLYWOOD-2026'}`,
            '',
            '--- LAYOUT COMPOSITIONS ---',
            '[1] Default 6-Win Tiled   [2] Minimal Matrix Core',
            '[3] Kernel Debug Lab      [4] Hero Map + Floating PiP',
            '[5] Cyber & Sci-Fi Ops    [6] UNIX X11 Floating Stack',
            '[7] Cinema Crisis Cascade [L] Cycle Layout Presets',
            '',
            '--- OPERATOR CONTROLS ---',
            '[P / SPACE] Pin/Pause Cycling   [[ / ]] Step Active Plugin',
            '[A] Trigger Priority Crisis     [Drag/Click] Move/Front Win',
            '[T] Green / Amber / Light-Grey  [M] Toggle Mono / Color Mode',
            '[C] Cycle 5 CRT Display Modes   [S / I] Scaling / Integer Snap',
            '[E] Simulate Fault              [R] System Reboot',
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
                const mode =
                    global.crtMode || (global.crtEnabled === false ? 'super_crisp' : 'sharp_crt');
                this.applyCRTMode(mode, false);
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
        this.systemState.layoutName = presetName;
        this.errorTestActive = false;
        this.clearSystemAlert();

        this.rng.reset(this.configManager.getGlobal().seed || 'HOLLYWOOD-2026');
        this.windowManager.clear();

        preset.windows.forEach((winConfig) => {
            const resolved = this.configManager.resolveWindowConfig(winConfig, preset);
            this.windowManager.createWindow(resolved);
        });

        // In Cinema Crisis Director mode, automatically trigger the staggered popup cascade
        if (presetName === 'crisis' || preset.autoAlert) {
            this.triggerSystemAlert(25.0);
        }

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
            // Update synchronized alert state
            if (this.systemState.alertActive) {
                this.systemState.alertTimer -= dt;
                if (this.systemState.alertTimer <= 0) {
                    if (this.currentPresetName === 'crisis') {
                        // Re-trigger next crisis scenario in Crisis Director mode
                        this.triggerSystemAlert(22.0);
                    } else {
                        this.clearSystemAlert();
                    }
                }
            }

            this.pluginManager.update(dt);
            this.windowManager.update(dt, this.systemState);
            this.systemState.alertChanged = false;
        }
    }

    registerPlugin(name, pluginClass) {
        this.pluginManager.register(name, pluginClass);
    }
}
