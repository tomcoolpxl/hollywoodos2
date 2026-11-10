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
        this.activeWindowId = null;
        this.cyclePaused = false;
        this.topZIndex = 10;
        this.simMissionClock = 66492.0; // 18:28:12.00 UTC
        this.statusTimer = 0;

        // Drag state for floating/movable windows
        this.dragState = null;

        // Pending staggered crisis popups
        this.pendingPopups = [];

        this.container = new Container();
        this.windowLayer = new Container();
        this.windowLayer.sortableChildren = true;
        this.statusBarContainer = new Container();

        this.container.addChild(this.windowLayer);
        this.container.addChild(this.statusBarContainer);
        this.app.stage.addChild(this.container);

        this.setupGlobalDragHandlers();
    }

    setupGlobalDragHandlers() {
        if (typeof window === 'undefined') return;

        this._onPointerMove = (e) => {
            if (!this.dragState) return;
            const win = this.windows.get(this.dragState.windowId);
            if (!win || this.maximizedWindowId === win.id) return;

            const scaleX = this.container.scale.x || 1;
            const scaleY = this.container.scale.y || 1;
            const dx = (e.clientX - this.dragState.startClientX) / scaleX;
            const dy = (e.clientY - this.dragState.startClientY) / scaleY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                this.dragState.moved = true;
            }

            const refRes = this.configManager?.getGlobal()?.referenceResolution || {
                width: 1600,
                height: 900
            };
            win.x = Math.round(Math.max(6, Math.min(refRes.width - win.width - 6, this.dragState.startWinX + dx)));
            win.y = Math.round(Math.max(26, Math.min(refRes.height - win.height - 6, this.dragState.startWinY + dy)));
            win.savedBounds.x = win.x;
            win.savedBounds.y = win.y;
            win.container.x = win.x;
            win.container.y = win.y;
        };

        this._onPointerUp = () => {
            if (this.dragState) {
                this.dragState = null;
            }
        };

        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    ensureStatusBar() {
        destroyContainerChildren(this.statusBarContainer);
        if (!this.statusBarContainer.parent) {
            this.container.addChild(this.statusBarContainer);
        }

        const theme = this.configManager?.getTheme() || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x003300,
            bg: 0x000000
        };
        const refRes = this.configManager?.getGlobal()?.referenceResolution || {
            width: 1600,
            height: 900
        };
        const barW = refRes.width - 20;

        this.statusBg = new Graphics();
        this.statusBg.rect(10, 3, barW, 20).fill({ color: theme.bg });
        this.statusBg.rect(10, 3, barW, 20).stroke({ width: 1, color: theme.primary, alpha: 0.85 });
        this.statusBarContainer.addChild(this.statusBg);

        this.statusAlertBg = new Graphics();
        this.statusAlertBg.visible = false;
        this.statusBarContainer.addChild(this.statusAlertBg);

        this.statusLeft = createRetroText(
            'HOLLYWOOD_OS v2.6 // UTC 18:28:12.00 // DEFCON 3 // UPLINK: SYNCHRONIZED',
            {
                fontSize: 11,
                fill: theme.primary
            }
        );
        this.statusLeft.x = 18;
        this.statusLeft.y = 6;
        this.statusBarContainer.addChild(this.statusLeft);

        this.statusCenter = createRetroText('STATUS: NOMINAL // ALL SECTORS SECURE', {
            fontSize: 11,
            fontWeight: 'bold',
            fill: theme.primary
        });
        this.statusCenter.anchor?.set(0.5, 0);
        this.statusCenter.x = refRes.width / 2;
        this.statusCenter.y = 6;
        this.statusBarContainer.addChild(this.statusCenter);

        this.statusRight = createRetroText('LAYOUT [1-7/L]   PIN [P]   ALERT [A]   CRT [C]   HELP [H]', {
            fontSize: 11,
            fill: theme.secondary
        });
        this.statusRight.anchor?.set(1, 0);
        this.statusRight.x = refRes.width - 18;
        this.statusRight.y = 6;
        this.statusBarContainer.addChild(this.statusRight);
    }

    updateStatusBar(dt, systemState = {}) {
        this.simMissionClock += dt;
        this.statusTimer += dt;
        if (this.statusTimer < 0.08 && !systemState.alertChanged) return;
        this.statusTimer = 0;

        if (!this.statusLeft) return;

        const theme = this.configManager?.getTheme() || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            bg: 0x000000
        };
        const refRes = this.configManager?.getGlobal()?.referenceResolution || {
            width: 1600,
            height: 900
        };

        const totalSec = Math.floor(this.simMissionClock) % 86400;
        const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSec % 60).padStart(2, '0');
        const cs = String(Math.floor((this.simMissionClock % 1) * 100)).padStart(2, '0');

        this.statusLeft.text = `HOLLYWOOD_OS v2.6 // UTC ${hrs}:${mins}:${secs}.${cs} // DEFCON ${systemState.alertActive ? '2' : '3'} // UPLINK: SYNC`;
        this.statusRight.text = `LAYOUT [1-7/L]   CYCLE: ${this.cyclePaused ? 'PINNED [P]' : 'AUTO [P]'}   ALERT [A]   HELP [H]`;

        if (systemState.alertActive) {
            const msg = ` ! PRIORITY INTERCEPT: ${systemState.alertTarget || 'VECTOR-OMEGA'} @ ${systemState.alertCoordsLabel || '35.6N 139.7E'} ! `;
            this.statusCenter.text = msg;
            this.statusCenter.style.fill = theme.bg;
            this.statusAlertBg.clear();
            const w = this.statusCenter.width + 12;
            this.statusAlertBg
                .rect(refRes.width / 2 - w / 2, 4, w, 18)
                .fill({ color: theme.primary });
            this.statusAlertBg.visible = true;
        } else {
            this.statusAlertBg.visible = false;
            this.statusCenter.text = 'STATUS: NOMINAL // ALL SECTORS SECURE';
            this.statusCenter.style.fill = theme.primary;
        }
    }

    bringToFront(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return;
        this.topZIndex += 1;
        win.container.zIndex = this.topZIndex;
        this.windowLayer.sortChildren?.();
    }

    createWindow(config) {
        if (this.windows.size === 0) {
            this.ensureStatusBar();
        }

        const id = config.id || `win_${this.windows.size + 1}`;
        if (!this.activeWindowId) {
            this.activeWindowId = id;
        }

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

        const isFloating = Boolean(config.floating || config.isPopup);
        const isPopup = Boolean(config.isPopup);
        const headerStyle = config.headerStyle || (isPopup ? 'inverse' : 'normal');

        const refRes = this.configManager?.getGlobal()?.referenceResolution || {
            width: 1600,
            height: 900
        };
        const topBarOffset = 20;
        const yScale = (refRes.height - topBarOffset) / refRes.height;

        const rawX = config.x || 0;
        const rawY = config.y || 0;
        const width = config.width || 400;
        const rawH = config.height || 300;

        const x = rawX;
        const y = isPopup ? rawY : Math.round(topBarOffset + rawY * yScale);
        const height = isPopup ? rawH : Math.round(rawH * yScale);

        const innerWidth = Math.max(10, width - 20);
        const innerHeight = Math.max(10, height - 32);

        const winContainer = new Container();
        winContainer.x = x;
        winContainer.y = y;
        this.topZIndex += 1;
        winContainer.zIndex = config.zIndex ?? (isPopup ? 500 + this.topZIndex : isFloating ? 100 + this.topZIndex : this.topZIndex);
        winContainer.eventMode = 'static';
        winContainer.cursor = 'pointer';
        winContainer.hitArea = new Rectangle(0, 0, width, height);

        // Window Chrome (Cutout Moat + Drop Shadow + Frame + Header Divider)
        const frame = new Graphics();
        winContainer.addChild(frame);

        // Cycling Progress Bar in Header
        const cycleBar = new Graphics();
        winContainer.addChild(cycleBar);

        const isInverseHeader = headerStyle === 'inverse';
        const effectiveTitleFill = isInverseHeader ? bgColor : titleColor;
        const effectiveBadgeFill = isInverseHeader ? bgColor : theme.secondary;

        // Window Title (Left)
        const titleText = createRetroText(config.title || 'TERMINAL', {
            fontSize: 13,
            fontWeight: isInverseHeader || isFloating ? 'bold' : 'normal',
            fill: effectiveTitleFill
        });
        titleText.x = 10;
        titleText.y = 3;
        winContainer.addChild(titleText);

        // Active Plugin / Status Badge (Right - Clickable to manually step plugin)
        const badgeText = createRetroText('', {
            fontSize: 11,
            fontWeight: isInverseHeader ? 'bold' : 'normal',
            fill: effectiveBadgeFill
        });
        badgeText.anchor?.set(1, 0);
        badgeText.x = width - 10;
        badgeText.y = 4;
        badgeText.eventMode = 'static';
        badgeText.cursor = 'pointer';
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
        this.windowLayer.addChild(winContainer);

        const winRng = this.globalRng ? this.globalRng.fork(id) : null;

        const windowObj = {
            id,
            config,
            theme,
            borderColor,
            borderWidth,
            bgColor,
            titleColor,
            isFloating,
            isPopup,
            headerStyle,
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
            x,
            y,
            width,
            height,
            savedBounds: {
                x,
                y,
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
            errorFlickerTimer: 0,
            lastTapTime: 0
        };

        this.drawWindowChrome(windowObj);

        winContainer.on('pointerover', () => {
            this.activeWindowId = id;
        });

        winContainer.on('pointerdown', (e) => {
            this.activeWindowId = id;
            this.bringToFront(id);

            const globalPos = e?.data?.global || e?.global;
            const localY = globalPos
                ? (globalPos.y - this.container.y) / (this.container.scale.y || 1) - winObjY(windowObj)
                : 100;

            // Allow dragging via the top 24px header bar (or anywhere on a floating window)
            if ((localY <= 26 || windowObj.isFloating) && this.maximizedWindowId !== id) {
                const nativeEv = e?.nativeEvent || e;
                if (nativeEv?.clientX !== undefined) {
                    this.dragState = {
                        windowId: id,
                        startClientX: nativeEv.clientX,
                        startClientY: nativeEv.clientY,
                        startWinX: windowObj.x,
                        startWinY: windowObj.y,
                        moved: false
                    };
                }
            }
        });

        badgeText.on('pointertap', (e) => {
            e?.stopPropagation?.();
            this.activeWindowId = id;
            this.bringToFront(id);
            this.stepWindowPlugin(id, 1);
        });

        winContainer.on('pointertap', () => {
            if (this.dragState?.moved) {
                return;
            }
            this.activeWindowId = id;
            this.bringToFront(id);

            // For floating windows, single tap focuses/brings to front; double-tap maximizes/restores
            if (windowObj.isFloating && this.maximizedWindowId !== id) {
                const now = performance.now();
                if (now - windowObj.lastTapTime < 350) {
                    this.toggleMaximizeWindow(id);
                }
                windowObj.lastTapTime = now;
            } else {
                this.toggleMaximizeWindow(id);
            }
        });

        this.windows.set(id, windowObj);
        this.loadCurrentPlugin(windowObj, isPopup);

        return windowObj;
    }

    spawnCrisisPopups(systemState = {}) {
        this.dismissCrisisPopups();

        const popupDefs = [
            {
                delay: 0.0,
                config: {
                    id: 'crisis_popup_1',
                    title: '!! PRIORITY ALERT // INTRUSION TRACE !!',
                    x: 240,
                    y: 95,
                    width: 640,
                    height: 390,
                    plugin: 'netgraph',
                    floating: true,
                    isPopup: true,
                    headerStyle: 'inverse'
                }
            },
            {
                delay: 0.45,
                config: {
                    id: 'crisis_popup_2',
                    title: '!! EMERGENCY CIPHER OVERRIDE !!',
                    x: 720,
                    y: 230,
                    width: 660,
                    height: 360,
                    plugin: 'decrypt',
                    floating: true,
                    isPopup: true,
                    headerStyle: 'inverse'
                }
            },
            {
                delay: 0.90,
                config: {
                    id: 'crisis_popup_3',
                    title: `!! SATELLITE TASKING // ${systemState.alertCoordsLabel || 'LOCK'} !!`,
                    x: 410,
                    y: 440,
                    width: 620,
                    height: 380,
                    plugin: 'orbit',
                    floating: true,
                    isPopup: true,
                    headerStyle: 'inverse'
                }
            }
        ];

        this.pendingPopups = popupDefs.map((p) => ({ ...p }));
    }

    dismissCrisisPopups() {
        this.pendingPopups = [];
        for (const [id, win] of Array.from(this.windows.entries())) {
            if (win.isPopup) {
                this.removeWindow(id);
            }
        }
    }

    removeWindow(windowId) {
        const win = this.windows.get(windowId);
        if (!win) return;
        if (this.maximizedWindowId === windowId) {
            this.maximizedWindowId = null;
            for (const otherWin of this.windows.values()) {
                otherWin.container.visible = true;
            }
        }
        gsap.killTweensOf(win.pluginContainer);
        gsap.killTweensOf(win.transitionGraphics);
        this.pluginManager.destroyPlugin(windowId);
        if (win.cursor) {
            win.cursor.destroy();
        }
        destroyContainerChildren(win.pluginContainer);
        destroyContainerChildren(win.errorContainer);
        if (win.container && !win.container.destroyed) {
            win.container.destroy({ children: true });
        }
        this.windows.delete(windowId);
    }

    stepWindowPlugin(windowId, delta = 1) {
        const targetId = windowId || this.maximizedWindowId || this.activeWindowId || this.windows.keys().next().value;
        const win = this.windows.get(targetId);
        if (!win) return null;

        win.cycleTimer = 0;

        if (Array.isArray(win.pluginConfig) && win.pluginConfig.length > 1) {
            const len = win.pluginConfig.length;
            win.cycleIndex = (win.cycleIndex + delta + len) % len;
            this.loadCurrentPlugin(win, true);
            return win.activePluginName;
        }

        const allPlugins = Array.from(this.pluginManager?.registry?.keys() || []);
        if (allPlugins.length === 0) return null;
        const curIdx = Math.max(0, allPlugins.indexOf(win.activePluginName));
        const nextName = allPlugins[(curIdx + delta + allPlugins.length) % allPlugins.length];
        this.loadPluginIntoWindow(win.id, nextName, true);
        return nextName;
    }

    toggleCyclePause() {
        this.cyclePaused = !this.cyclePaused;
        for (const win of this.windows.values()) {
            this.updateHeaderBadge(win);
        }
        return this.cyclePaused;
    }

    drawWindowChrome(win) {
        win.innerWidth = Math.max(10, win.width - 20);
        win.innerHeight = Math.max(10, win.height - 32);
        win.container.x = win.x;
        win.container.y = win.y;
        win.container.hitArea = new Rectangle(0, 0, win.width, win.height);

        win.frame.clear();

        // 1. If floating/popup, draw an opaque black cutout moat + offset frame shadow for true Z-depth
        if (win.isFloating && this.maximizedWindowId !== win.id) {
            win.frame.rect(-6, -6, win.width + 16, win.height + 16).fill({ color: win.bgColor, alpha: 0.96 });
            win.frame.rect(6, 6, win.width, win.height).fill({ color: win.bgColor });
            win.frame.rect(6, 6, win.width, win.height).stroke({
                width: 1,
                color: win.theme.secondary,
                alpha: 0.75
            });
        }

        // 2. Main window background & border
        win.frame.rect(0, 0, win.width, win.height).fill({ color: win.bgColor });
        win.frame.rect(0, 0, win.width, win.height).stroke({
            width: win.isFloating ? Math.max(2, win.borderWidth) : win.borderWidth,
            color: win.borderColor
        });

        // 3. Header bar (inverse solid phosphor fill or classic divider line)
        if (win.headerStyle === 'inverse') {
            win.frame.rect(0, 0, win.width, 20).fill({ color: win.borderColor });
        } else {
            win.frame.moveTo(0, 20);
            win.frame.lineTo(win.width, 20);
            win.frame.stroke({ width: 1, color: win.borderColor });
        }

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
        if (this.cyclePaused) {
            badge += ' [PIN]';
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
        win.y = 28;
        win.width = refRes.width - 20;
        win.height = refRes.height - 38;
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

    update(dt, systemState = {}) {
        this.updateStatusBar(dt, systemState);

        // Process staggered crisis popup cascade
        if (this.pendingPopups.length > 0) {
            for (let i = this.pendingPopups.length - 1; i >= 0; i--) {
                this.pendingPopups[i].delay -= dt;
                if (this.pendingPopups[i].delay <= 0) {
                    const def = this.pendingPopups.splice(i, 1)[0];
                    const resolved = this.configManager
                        ? this.configManager.resolveWindowConfig(def.config)
                        : def.config;
                    this.createWindow(resolved);
                }
            }
        }

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

            if (!this.cyclePaused && Array.isArray(win.pluginConfig) && win.pluginConfig.length > 1) {
                win.cycleTimer += scaledDt * 1000;
                const progress = Math.min(1, win.cycleTimer / win.cycleInterval);
                win.cycleBar.clear();
                win.cycleBar
                    .rect(1, 18, (win.width - 2) * progress, 2)
                    .fill({
                        color: win.headerStyle === 'inverse' ? win.bgColor : win.theme.secondary,
                        alpha: 0.85
                    });

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
        this.activeWindowId = null;
        this.dragState = null;
        this.pendingPopups = [];
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
        destroyContainerChildren(this.statusBarContainer);
        destroyContainerChildren(this.windowLayer);
    }
}

function winObjY(win) {
    return win?.y || 0;
}
