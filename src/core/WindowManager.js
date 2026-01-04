import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Cursor } from './Cursor.js';

export class WindowManager {
    constructor(app, pluginManager) {
        this.app = app;
        this.pluginManager = pluginManager;
        this.windows = new Map(); // id -> windowObject
        this.container = new Container();
        this.app.stage.addChild(this.container);
    }

    createWindow(config) {
        const id = config.id || `win_${Date.now()}`;
        const styleConfig = config.style || {};
        
        // ... (Styles) ...
        const borderColor = styleConfig.borderColor !== undefined ? styleConfig.borderColor : 0x00FF00;
        const borderWidth = styleConfig.borderWidth !== undefined ? styleConfig.borderWidth : 2;
        const bgColor = styleConfig.bgColor !== undefined ? styleConfig.bgColor : 0x000000;
        const titleColor = styleConfig.titleColor !== undefined ? styleConfig.titleColor : 0x00FF00;

        // Visual Container for the window
        const winContainer = new Container();
        winContainer.x = config.x || 0;
        winContainer.y = config.y || 0;

        // Background / Frame
        const frame = new Graphics();
        const width = config.width || 400;
        const height = config.height || 300;
        
        frame.rect(0, 0, width, height);
        frame.stroke({ width: borderWidth, color: borderColor });
        frame.fill({ color: bgColor }); 
        
        // Header Bar
        frame.moveTo(0, 20);
        frame.lineTo(width, 20);
        frame.stroke({ width: 1, color: borderColor });

        winContainer.addChild(frame);

        // Content Container
        const contentContainer = new Container();
        contentContainer.x = 10;
        contentContainer.y = 22; 
        
        // Mask
        const mask = new Graphics();
        mask.rect(0, 0, width - 20, height - 32); 
        mask.fill(0xffffff);
        contentContainer.mask = mask;
        contentContainer.addChild(mask);
        
        winContainer.addChild(contentContainer);

        // Title
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 14,
            fill: titleColor,
        });
        const titleText = new Text({ text: config.title || 'TERMINAL', style });
        titleText.x = 10;
        titleText.y = 2; 
        winContainer.addChild(titleText);

        this.container.addChild(winContainer);

        // Create Cursor (z-index top of content)
        const cursor = new Cursor(contentContainer);

        const windowObj = {
            id,
            container: winContainer,
            contentContainer,
            width,
            height,
            pluginInstance: null,
            cursor: cursor, // Store cursor
            // Cycling State
            pluginConfig: config.plugin, 
            cycleIndex: 0,
            cycleTimer: 0,
            cycleInterval: config.cycleInterval || 5000 
        };

        this.windows.set(id, windowObj);

        // Load initial plugin
        this.loadCurrentPlugin(windowObj);

        return windowObj;
    }

    loadCurrentPlugin(win) {
        let pluginName = '';
        if (Array.isArray(win.pluginConfig)) {
            pluginName = win.pluginConfig[win.cycleIndex];
        } else {
            pluginName = win.pluginConfig;
        }

        if (pluginName) {
            this.loadPluginIntoWindow(win.id, pluginName);
        }
    }

    loadPluginIntoWindow(windowId, pluginName) {
        const win = this.windows.get(windowId);
        if (!win) return;

        // Cleanup existing
        if (win.pluginInstance) {
            this.pluginManager.destroyPlugin(windowId);
        }
        
        // Reset Cursor
        if (win.cursor) win.cursor.setEnabled(false); // Disable by default

        // Context passed to the plugin
        const context = {
            container: win.contentContainer,
            width: win.width - 20,
            height: win.height - 40,
            cursor: win.cursor, // Pass cursor
            rng: () => Math.random() 
        };

        const instance = this.pluginManager.instantiate(pluginName, windowId, context);
        win.pluginInstance = instance;
    }

    render() {
        // Unused
    }

    update(dt) {
        // Handle cycling and cursor
        for (const win of this.windows.values()) {
            // Update Cursor blink
            if (win.cursor) win.cursor.update(dt);

            if (Array.isArray(win.pluginConfig) && win.pluginConfig.length > 1) {
                win.cycleTimer += dt * 1000; // ms
                if (win.cycleTimer > win.cycleInterval) {
                    win.cycleTimer = 0;
                    win.cycleIndex = (win.cycleIndex + 1) % win.pluginConfig.length;
                    this.loadCurrentPlugin(win);
                }
            }
        }
    }

    setScale(scaleX, scaleY) {
        this.container.scale.set(scaleX, scaleY !== undefined ? scaleY : scaleX);
    }

    setPosition(x, y) {
        this.container.x = x;
        this.container.y = y;
    }

    clear() {
        for (const id of this.windows.keys()) {
            this.pluginManager.destroyPlugin(id);
        }
        this.windows.clear();
        this.container.removeChildren();
    }
}
