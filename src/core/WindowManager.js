import { Container, Graphics, Rectangle } from 'pixi.js';
import { gsap } from 'gsap';
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
        this.maximizedWindowId = null;
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

        const winContainer = new Container();
        winContainer.x = config.x || 0;
        winContainer.y = config.y || 0;
        winContainer.eventMode = 'static';
        winContainer.cursor = 'pointer';
        winContainer.hitArea = new Rectangle(0, 0, width, height);

        // Window Chrome (Frame + Header Divider)
        const frame = new Graphics();
        winContainer.addChild(frame);

        // Cycling Progress Bar in Header
        const cycleBar = new Graphics();
        winContainer.addChild(cycleBar);

        // Window Title (Left)
        const titleText = createRetroText(config.title || 'TERMINAL', {
            fontSize: 14,
            fill: titleColor
        });
        titleText.x = 10;
        titleText.y = 2;
        winContainer.addChild(titleText);

        // Active Plugin / Status Badge (Right)
        const badgeText = createRetroText('', {
            fontSize: 11,
            fill: theme.secondary
        });
        badgeText.anchor?.set(1, 0);
        badgeText.x = width - 10;
        badgeText.y = 4;
        winContainer.addChild(badgeText);

        // Masked Body Container
        const bodyContainer = new Container();
        bodyContainer.x = 10;
        bodyContainer.y = 22;

        const mask = new Graphics();
        bodyContainer.mask = mask;
        bodyContainer.addChild(mask);

        const pluginContainer = new Container();
        bodyContainer.addChild(pluginContainer);

        const transitionGraphics = new Graphics();
        transitionGraphics.visible = false;
        bodyContainer.addChild(transitionGraphics);

        const errorContainer = new Container();
        errorContainer.visible = false;
        bodyContainer.addChild(errorContainer);

        const cursor = new Cursor(bodyContainer, borderColor);

        winContainer.addChild(bodyContainer);
        this.container.addChild(winContainer);

        const winRng = this.globalRng ? this.globalRng.fork(id) : null;

        const windowObj = {
            id,
            config,
            theme,
            borderColor,
            borderWidth,
            bgColor,
            titleColor,
            container: winContainer,
            bodyContainer,
            contentContainer: pluginContainer,
            pluginContainer,
            transitionGraphics,
            errorContainer,
            frame,
            cycleBar,
            mask,
            titleText,
            badgeText,
            x: config.x || 0,
            y: config.y || 0,
            width,
            height,
            savedBounds: {
                x: config.x || 0,
                y: config.y || 0,
                width,
                height
            },
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

        this.drawWindowChrome(windowObj);

        winContainer.on('pointertap', () => {
            this.toggleMaximizeWindow(id);
        });

        this.windows.set(id, windowObj);
        this.loadCurrentPlugin(windowObj, false);

        return windowObj;
    }

    drawWindowChrome(win) {
        win.innerWidth = Math.max(10, win.width - 20);
        win.innerHeight = Math.max(10, win.height - 32);
        win.container.x = win.x;
        win.container.y = win.y;
        win.container.hitArea = new Rectangle(0, 0, win.width, win.height);

        win.frame.clear();
        win.frame.rect(0, 0, win.width, win.height);
        win.frame.fill({ color: win.bgColor });
        win.frame.stroke({ width: win.borderWidth, color: win.borderColor });

        win.frame.moveTo(0, 20);
        win.frame.lineTo(win.width, 20);
        win.frame.stroke({ width: 1, color: win.borderColor });

        win.mask.clear();
        win.mask.rect(0, 0, win.innerWidth, win.innerHeight).fill(0xffffff);

        win.badgeText.x = win.width - 10;
        this.updateHeaderBadge(win);
    }

    updateHeaderBadge(win) {
        const name = String(win.activePluginName || '').toUpperCase();
        const isMax = this.maximizedWindowId === win.id;
        let badge = `[${name}]`;
        if (Array.isArray(win.pluginConfig) && win.pluginConfig.length > 1) {
            badge = `[${name} ${win.cycleIndex + 1}/${win.pluginConfig.length}]`;
        }
        if (isMax) {
            badge += ' [MAX]';
        }
        win.badgeText.text = badge;
    }

    toggleMaximizeWindow(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return false;

        if (this.maximizedWindowId === windowId) {
            this.restoreMaximizedWindow();
            return false;
        }

        // If another window was maximized first, restore it
        if (this.maximizedWindowId) {
            this.restoreMaximizedWindow();
        }

        this.maximizedWindowId = windowId;
        const refRes = this.configManager?.getGlobal()?.referenceResolution || {
            width: 1600,
            height: 900
        };

        for (const [id, otherWin] of this.windows.entries()) {
            if (id !== windowId) {
                otherWin.container.visible = false;
            }
        }

        win.x = 10;
        win.y = 10;
        win.width = refRes.width - 20;
        win.height = refRes.height - 20;
        this.drawWindowChrome(win);
        this.loadCurrentPlugin(win, true);
        return true;
    }

    restoreMaximizedWindow() {
        if (!this.maximizedWindowId) return false;
        const win = this.windows.get(this.maximizedWindowId);
        this.maximizedWindowId = null;

        for (const otherWin of this.windows.values()) {
            otherWin.container.visible = true;
        }

        if (win) {
            win.x = win.savedBounds.x;
            win.y = win.savedBounds.y;
            win.width = win.savedBounds.width;
            win.height = win.savedBounds.height;
            this.drawWindowChrome(win);
            this.loadCurrentPlugin(win, true);
        }
        return true;
    }

    loadCurrentPlugin(win, animateTransition = false) {
        let pluginName = '';
        if (Array.isArray(win.pluginConfig)) {
            pluginName = win.pluginConfig[win.cycleIndex];
        } else {
            pluginName = win.pluginConfig;
        }

        if (pluginName) {
            this.loadPluginIntoWindow(win.id, pluginName, animateTransition);
        }
    }

    loadPluginIntoWindow(windowId, pluginName, animateTransition = false) {
        const win = this.windows.get(windowId);
        if (!win) return;

        if (win.pluginInstance) {
            this.pluginManager.destroyPlugin(windowId);
            win.pluginInstance = null;
        }
        gsap.killTweensOf(win.pluginContainer);
        gsap.killTweensOf(win.transitionGraphics);
        destroyContainerChildren(win.pluginContainer);
        this.clearErrorScreen(win);

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
        this.updateHeaderBadge(win);

        const instance = this.pluginManager.instantiate(pluginName, windowId, context);
        win.pluginInstance = instance;

        if (animateTransition && !win.hasError) {
            this.playScanlineTransition(win);
        } else {
            win.pluginContainer.alpha = 1;
            win.pluginContainer.x = 0;
            win.transitionGraphics.visible = false;
        }
    }

    playScanlineTransition(win) {
        const tg = win.transitionGraphics;
        tg.clear();
        tg.rect(0, 0, win.innerWidth, 4).fill({ color: win.theme.peak, alpha: 0.75 });
        tg.visible = true;
        tg.y = 0;

        win.pluginContainer.alpha = 0.2;
        gsap.to(win.pluginContainer, {
            alpha: 1,
            duration: 0.22,
            ease: 'steps(4)'
        });
        gsap.to(tg, {
            y: win.innerHeight,
            duration: 0.22,
            ease: 'power1.out',
            onComplete: () => {
                tg.visible = false;
            }
        });
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
            if (!win.container.visible) continue;

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
                const progress = Math.min(1, win.cycleTimer / win.cycleInterval);
                win.cycleBar.clear();
                win.cycleBar
                    .rect(1, 18, (win.width - 2) * progress, 2)
                    .fill({ color: win.theme.secondary, alpha: 0.85 });

                if (win.cycleTimer >= win.cycleInterval) {
                    win.cycleTimer = 0;
                    win.cycleIndex = (win.cycleIndex + 1) % win.pluginConfig.length;
                    this.loadCurrentPlugin(win, true);
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
        this.maximizedWindowId = null;
        for (const [id, win] of this.windows.entries()) {
            gsap.killTweensOf(win.pluginContainer);
            gsap.killTweensOf(win.transitionGraphics);
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
