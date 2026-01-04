export class ConfigManager {
    constructor() {
        this.config = null;
        this.storageKey = 'hollywoodos_config_v2';
    }

    async load(configPath) {
        // Try to load from localStorage first
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.config = JSON.parse(saved);
                console.log('Config loaded from localStorage');
                return this.config;
            } catch (e) {
                console.warn('Failed to parse localStorage config, falling back to file.');
            }
        }

        try {
            const response = await fetch(configPath);
            this.config = await response.json();
            console.log('Config loaded from file');
            return this.config;
        } catch (e) {
            console.error('Failed to load config:', e);
            return null;
        }
    }

    save() {
        if (this.config) {
            localStorage.setItem(this.storageKey, JSON.stringify(this.config));
            console.log('Config saved to localStorage');
        }
    }

    getPreset(name) {
        return this.config?.presets?.[name] || null;
    }

    getGlobal() {
        return this.config?.global || {};
    }
}
