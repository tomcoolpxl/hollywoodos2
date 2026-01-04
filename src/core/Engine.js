import { Application } from 'pixi.js';
import { gsap } from 'gsap';
import { WindowManager } from './WindowManager.js';
import { PluginManager } from './PluginManager.js';
import { ConfigManager } from './ConfigManager.js';
import { BootSequence } from './BootSequence.js';

export class Engine {
    constructor() {
        this.app = null;
        this.windowManager = null;
        this.pluginManager = null;
        this.configManager = new ConfigManager();
        this.bootSequence = null;
        this.isBooting = true;
    }

    async init(containerId) {
        this.app = new Application();
        
        await this.app.init({
            resizeTo: window,
            backgroundColor: 0x050505, // Match HTML to prevent dimming
            antialias: true,
            preference: 'webgl', 
            powerPreference: 'default', // Avoid forcing high-performance mode
        });

        document.getElementById(containerId).appendChild(this.app.canvas);

        this.pluginManager = new PluginManager(this);
        this.windowManager = new WindowManager(this.app, this.pluginManager);
        this.windowManager.container.visible = false; // Hide windows initially

        this.setupKeyboardControls();
        this.reboot();

        // Hook into Pixi Ticker for the main loop
        this.app.ticker.add((ticker) => {
            const dt = ticker.deltaMS / 1000;
            try {
                this.update(dt);
            } catch (err) {
                console.error("Critical Engine Error:", err);
            }
        });

        // Listen for resize to scale the UI
        window.addEventListener('resize', () => this.handleResize());

        console.log('HollywoodOS 2 Engine Core Initialized');
    }

    reboot() {
        if (this.bootSequence) return;
        
        console.log("Rebooting...");
        this.isBooting = true;
        this.windowManager.container.visible = false;
        
        this.bootSequence = new BootSequence(this.app, () => {
            console.log("Boot complete. Switching state...");
            this.windowManager.container.visible = true; 
            this.isBooting = false;
            this.bootSequence = null;
        });
    }

    setupKeyboardControls() {
        window.addEventListener('keydown', (e) => {
            if (this.isBooting) return;

            switch (e.code) {
                case 'KeyR':
                    this.reboot();
                    break;
                case 'KeyS':
                    this.toggleScaling();
                    break;
                case 'Digit1':
                    this.applyPreset('default');
                    break;
                case 'Digit2':
                    this.applyPreset('minimal');
                    break;
            }
        });
    }

    toggleScaling() {
        const global = this.configManager.getGlobal();
        global.maintainAspectRatio = !global.maintainAspectRatio;
        console.log(`Scaling mode: ${global.maintainAspectRatio ? 'Letterbox' : 'Fill'}`);
        this.handleResize();
    }

    async loadConfig(path) {
        const config = await this.configManager.load(path);
        if (config) {
            this.handleResize(); // Initial scale
        }
        return config;
    }

    handleResize() {
        const global = this.configManager.getGlobal();
        if (global.referenceResolution) {
            const refW = global.referenceResolution.width;
            const refH = global.referenceResolution.height;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            const scaleX = winW / refW;
            const scaleY = winH / refH;

            if (global.maintainAspectRatio) {
                // Letterbox mode
                const scale = Math.min(scaleX, scaleY);
                this.windowManager.setScale(scale);
                this.windowManager.setPosition(
                    (winW - refW * scale) / 2,
                    (winH - refH * scale) / 2
                );
            } else {
                // Stretch / Fill mode
                this.windowManager.setScale(scaleX, scaleY);
                this.windowManager.setPosition(0, 0);
            }
        }
    }

    applyPreset(presetName) {
        const preset = this.configManager.getPreset(presetName);
        if (!preset) return;

        this.windowManager.clear(); 

        preset.windows.forEach(winConfig => {
            if (winConfig.style) {
                if (typeof winConfig.style.borderColor === 'string') {
                    winConfig.style.borderColor = parseInt(winConfig.style.borderColor, 16);
                }
                if (typeof winConfig.style.titleColor === 'string') {
                    winConfig.style.titleColor = parseInt(winConfig.style.titleColor, 16);
                }
            }
            this.windowManager.createWindow(winConfig);
        });
    }

    update(dt) {
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
