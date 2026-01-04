export class PluginManager {
    constructor(engine) {
        this.engine = engine;
        this.registry = new Map();
        this.activePlugins = new Map(); // windowId -> pluginInstance
    }

    register(name, pluginClass) {
        if (this.registry.has(name)) {
            console.warn(`Plugin ${name} is already registered.`);
            return;
        }
        this.registry.set(name, pluginClass);
        console.log(`Plugin registered: ${name}`);
    }

    instantiate(name, windowId, context) {
        const PluginClass = this.registry.get(name);
        if (!PluginClass) {
            console.error(`Plugin ${name} not found.`);
            return null;
        }

        try {
            const instance = new PluginClass();
            instance.init(context);
            this.activePlugins.set(windowId, instance);
            return instance;
        } catch (e) {
            console.error(`Failed to instantiate plugin ${name}:`, e);
            return null;
        }
    }

    update(dt) {
        for (const [windowId, instance] of this.activePlugins) {
            try {
                // TODO: Pass relevant state
                instance.update(dt, {}); 
            } catch (e) {
                console.error(`Error updating plugin in window ${windowId}:`, e);
            }
        }
    }

    destroyPlugin(windowId) {
        const instance = this.activePlugins.get(windowId);
        if (instance) {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
            this.activePlugins.delete(windowId);
        }
    }
}
