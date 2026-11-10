import { Container, Graphics } from 'pixi.js';
import { Cursor } from './Cursor.js';
import { createRetroText, GridAdapter, FreeformAdapter } from './Adapters.js';

export function destroyContainerChildren(container) {
    if (!container || container.destroyed) return;
    const children = container.removeChildren();
    for (const child of children) {
        if (child && !child.destroyed && typeof child.destroy === 'function') {
            child.destroy({ children: true });
        }
    }
}

export class WindowManager {
    constructor(app, pluginManager, configManager, globalRng) {
        this.app = app;
        this.pluginManager = pluginManager;
        this.configManager = configManager;
        this.globalRng = globalRng;

        this.windows = new Map(); // id -> windowObject
        this.container = new Container();
        this.app.stage.addChild(this.container);
    }

    createWindow(config) {
        const id = config.id || `win_${this.windows.size + 1}`;
        const styleConfig = config.style || {};
        const theme = config.theme || this.configManager?.getTheme() || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x003300,
            peak: 0x55FF55,
            bg: 0x000000,
            error: 0xFF3300
        };

        const borderColor = styleConfig.borderColor ?? theme.primary;
        const borderWidth = styleConfig.borderWidth ?? 2;
        const bgColor = styleConfig.bgColor ?? theme.bg;
        const titleColor = styleConfig.titleColor ?? theme.primary;

        const width = config.width || 400;
        const height = config.height || 300;
        const innerWidth = Math.max(10, width - 20);
        const innerHeight = Math.max(10, height - 32);

        // Root container for this window
        const winContainer = new Container();
        winContainer.x = config.x || 0;
        winContainer.y = config.y || 0;

        // Window Chrome (Frame + Header Divider)
        const frame = new Graphics();
        frame.rect(0, 0, width, height);
        frame.fill({ color: bgColor });
        frame.stroke({ width: borderWidth, color: borderColor });

        frame.moveTo(0, 20);
        frame.lineTo(width, 20);
        frame.stroke({ width: 1, color: borderColor });
        winContainer.addChild(frame);

        // Window Title
        const titleText = createRetroText(config.title || 'TERMINAL', {
            fontSize: 14,
            fill: titleColor
        });
        titleText.x = 10;
        titleText.y = 2;
        winContainer.addChild(titleText);

        // Masked Body Container (holds mask, pluginContainer, errorContainer, and cursor)
        const bodyContainer = new Container();
        bodyContainer.x = 10;
        bodyContainer.y = 22;

        const mask = new Graphics();
        mask.rect(0, 0, innerWidth, innerHeight).fill(0xffffff);
        bodyContainer.mask = mask;
        bodyContainer.addChild(mask);

        // Dedicated child container for the active plugin (isolated from mask & cursor!)
        const pluginContainer = new Container();
        bodyContainer.addChild(pluginContainer);

        // Dedicated child container for isolated crash/error screen
        const errorContainer = new Container();
        errorContainer.visible = false;
        bodyContainer.addChild(errorContainer);

        // Shared Cursor sits on top of pluginContainer inside bodyContainer
        const cursor = new Cursor(bodyContainer, borderColor);

        winContainer.addChild(bodyContainer);
        this.container.addChild(winContainer);

        const winRng = this.globalRng ? this.globalRng.fork(id) : null;

        const windowObj = {
            id,
            config,
            theme,
            container: winContainer,
            bodyContainer,
            contentContainer: pluginContainer, // Alias for backward compatibility
            pluginContainer,
            errorContainer,
            frame,
            titleText,
            width,
            height,
            innerWidth,
            innerHeight,
            pluginInstance: null,
            activePluginName: null,
            cursor,
            rng: winRng,
            pluginConfig: config.plugin,
            cycleIndex: 0,
            cycleTimer: 0,
            cycleInterval: config.cycleInterval || 5000,
            speedMultiplier: config.speedMultiplier ?? 1.0,
            hasError: false,
            errorFlickerTimer: 0
        };

        this.windows.set(id, windowObj);
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

        // Destroy previous plugin and free all GPU children inside pluginContainer
        if (win.pluginInstance) {
            this.pluginManager.destroyPlugin(windowId);
            win.pluginInstance = null;
        }
        destroyContainerChildren(win.pluginContainer);
        this.clearErrorScreen(win);

        // Reset Cursor state for the new plugin
        if (win.cursor) {
            win.cursor.setEnabled(false);
            win.cursor.setColor(win.theme.primary);
            win.cursor.setPosition(0, 0);
        }

        const pluginRng = win.rng ? win.rng.fork(`${pluginName}:${win.cycleIndex}`) : null;
        const pluginOptions = this.configManager
            ? this.configManager.resolvePluginOptions(pluginName, win.config)
            : {};

        const context = {
            windowId: win.id,
            container: win.pluginContainer,
            width: win.innerWidth,
            height: win.innerHeight,
            cursor: win.cursor,
            theme: win.theme,
            options: pluginOptions,
            rng: pluginRng,
            createGridAdapter: (opts = {}) =>
                new GridAdapter(win.pluginContainer, win.innerWidth, win.innerHeight, win.cursor, {
                    color: win.theme.primary,
                    theme: win.theme,
                    ...pluginOptions,
                    ...opts
                }),
            createFreeformAdapter: () =>
                new FreeformAdapter(win.pluginContainer, win.innerWidth, win.innerHeight)
        };

        win.activePluginName = pluginName;
        const instance = this.pluginManager.instantiate(pluginName, windowId, context);
        win.pluginInstance = instance;
    }

    showErrorScreen(windowId, error) {
        const win = this.windows.get(windowId);
        if (!win) return;

        win.hasError = true;
        win.pluginContainer.visible = false;
        if (win.cursor) win.cursor.setEnabled(false);

        destroyContainerChildren(win.errorContainer);
        win.errorContainer.visible = true;

        const errColor = win.theme?.error ?? 0xFF3300;
        const bg = new Graphics();
        bg.rect(0, 0, win.innerWidth, win.innerHeight).fill({ color: 0x080000 });
        bg.rect(2, 2, Math.max(4, win.innerWidth - 4), Math.max(4, win.innerHeight - 4))
            .stroke({ width: 1, color: errColor });
        win.errorContainer.addChild(bg);

        const msg = [
            '*** MODULE FAULT DETECTED ***',
            `WINDOW: ${win.id} [${String(win.activePluginName || 'UNKNOWN').toUpperCase()}]`,
            `ERR: ${error?.message || String(error)}`,
            '',
            'STATUS: ISOLATED // CONTAINED',
            'PRESS [E] OR [R] TO RECOVER'
        ].join('\n');

        const errText = createRetroText(msg, {
            fontSize: 13,
            lineHeight: 18,
            fill: errColor,
            wordWrap: true,
            wordWrapWidth: Math.max(40, win.innerWidth - 20)
        });
        errText.x = 10;
        errText.y = 12;
        win.errorContainer.addChild(errText);
    }

    clearErrorScreen(win) {
        if (!win) return;
        win.hasError = false;
        win.pluginContainer.visible = true;
        win.errorContainer.visible = false;
        destroyContainerChildren(win.errorContainer);
    }

    update(dt) {
        for (const win of this.windows.values()) {
            const scaledDt = dt * (win.speedMultiplier ?? 1.0);

            if (win.hasError) {
                win.errorFlickerTimer += dt;
                if (win.errorFlickerTimer > 0.25) {
                    win.errorFlickerTimer = 0;
                    win.errorContainer.alpha = win.errorContainer.alpha < 0.9 ? 1.0 : 0.65;
                }
                continue;
            }

            if (win.cursor) {
                win.cursor.update(scaledDt);
            }

            if (Array.isArray(win.pluginConfig) && win.pluginConfig.length > 1) {
                win.cycleTimer += scaledDt * 1000;
                if (win.cycleTimer >= win.cycleInterval) {
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
        for (const [id, win] of this.windows.entries()) {
            this.pluginManager.destroyPlugin(id);
            if (win.cursor) {
                win.cursor.destroy();
            }
            destroyContainerChildren(win.pluginContainer);
            destroyContainerChildren(win.errorContainer);
        }
        this.windows.clear();
        destroyContainerChildren(this.container);
    }
}
