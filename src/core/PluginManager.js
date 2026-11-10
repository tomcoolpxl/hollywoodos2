import { destroyContainerChildren } from './WindowManager.js';

export class PluginManager {
    constructor(engine) {
        this.engine = engine;
        this.registry = new Map();
        this.activePlugins = new Map(); // windowId -> { instance, context, faulted }
    }

    register(name, pluginClass) {
        if (this.registry.has(name)) {
            console.warn(`Plugin ${name} is already registered.`);
            return;
        }
        this.registry.set(name, pluginClass);
    }

    instantiate(name, windowId, context) {
        const PluginClass = this.registry.get(name);
        if (!PluginClass) {
            const err = new Error(`Plugin "${name}" not registered`);
            console.error(err.message);
            this.engine?.windowManager?.showErrorScreen(windowId, err);
            return null;
        }

        try {
            const instance = new PluginClass();
            instance.init(context);
            this.activePlugins.set(windowId, {
                name,
                instance,
                context,
                faulted: false
            });
            return instance;
        } catch (e) {
            console.error(`Failed to initialize plugin "${name}" in window "${windowId}":`, e);
            this.activePlugins.set(windowId, {
                name,
                instance: null,
                context,
                faulted: true
            });
            this.engine?.windowManager?.showErrorScreen(windowId, e);
            return null;
        }
    }

    update(dt) {
        for (const [windowId, entry] of this.activePlugins.entries()) {
            if (!entry || entry.faulted || !entry.instance) continue;

            const win = this.engine?.windowManager?.windows?.get(windowId);
            const scaledDt = dt * (win?.speedMultiplier ?? 1.0);

            try {
                entry.instance.update(scaledDt, {
                    windowId,
                    ...(this.engine?.systemState || {})
                });
            } catch (e) {
                entry.faulted = true;
                console.error(`Runtime fault in plugin "${entry.name}" (window "${windowId}"):`, e);
                this.engine?.windowManager?.showErrorScreen(windowId, e);
            }
        }
    }

    destroyPlugin(windowId) {
        const entry = this.activePlugins.get(windowId);
        if (!entry) return;

        const { instance, context } = entry;
        if (instance && typeof instance.destroy === 'function') {
            try {
                instance.destroy();
            } catch (e) {
                console.warn(`Error during destroy of plugin in window "${windowId}":`, e);
            }
        }
        if (context?.container) {
            destroyContainerChildren(context.container);
        }
        this.activePlugins.delete(windowId);
    }
}
