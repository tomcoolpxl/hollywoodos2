export function parseColor(value, fallback = 0x00FF00) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
            const parsed = parseInt(trimmed.slice(2), 16);
            return Number.isNaN(parsed) ? fallback : parsed;
        }
        if (trimmed.startsWith('#')) {
            const parsed = parseInt(trimmed.slice(1), 16);
            return Number.isNaN(parsed) ? fallback : parsed;
        }
        const parsed = parseInt(trimmed, 16);
        return Number.isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
}

export function toHexColorString(colorInt) {
    const num = parseColor(colorInt, 0x00FF00);
    return `#${num.toString(16).toUpperCase().padStart(6, '0')}`;
}

export class ConfigManager {
    constructor() {
        this.config = null;
        this.storageKey = 'hollywoodos_config_v2';
    }

    async load(configPath) {
        let fileConfig = null;
        try {
            const response = await fetch(configPath);
            fileConfig = await response.json();
        } catch (e) {
            console.error('Failed to fetch config file:', e);
        }

        // Load user overrides from localStorage only if versions match
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (!fileConfig || (parsed.version && parsed.version === fileConfig.version)) {
                    this.config = parsed;
                    console.log('Config loaded from localStorage');
                    return this.config;
                } else {
                    console.info('Config file version updated; refreshing stale localStorage config.');
                    localStorage.removeItem(this.storageKey);
                }
            } catch (e) {
                console.warn('Failed to parse localStorage config, falling back to file.');
            }
        }

        this.config = fileConfig;
        if (this.config) {
            console.log('Config loaded from file');
        }
        return this.config;
    }

    save() {
        if (this.config) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.config));
            } catch (e) {
                console.warn('Failed to save config to localStorage:', e);
            }
        }
    }

    resetStorage() {
        localStorage.removeItem(this.storageKey);
    }

    exportJSON() {
        return JSON.stringify(this.config, null, 2);
    }

    importJSON(jsonString) {
        const parsed = JSON.parse(jsonString);
        this.config = parsed;
        this.save();
        return this.config;
    }

    getPreset(name) {
        return this.config?.presets?.[name] || null;
    }

    getGlobal() {
        return this.config?.global || {};
    }

    getTheme(themeName) {
        const activeName = themeName || this.getGlobal().theme || 'classic-green';
        const raw = this.config?.themes?.[activeName] || {
            primary: '0x00FF00',
            secondary: '0x00AA00',
            dim: '0x003300',
            peak: '0x55FF55',
            bg: '0x000000',
            error: '0xFF3300'
        };
        return {
            name: activeName,
            primary: parseColor(raw.primary, 0x00FF00),
            secondary: parseColor(raw.secondary, 0x00AA00),
            dim: parseColor(raw.dim, 0x003300),
            peak: parseColor(raw.peak, 0x55FF55),
            bg: parseColor(raw.bg, 0x000000),
            error: parseColor(raw.error, 0xFF3300),
            primaryHex: toHexColorString(raw.primary),
            secondaryHex: toHexColorString(raw.secondary),
            dimHex: toHexColorString(raw.dim),
            peakHex: toHexColorString(raw.peak)
        };
    }

    /**
     * Hierarchical resolution:
     * Global windowDefaults -> Theme colors -> Preset defaults -> Window config -> Instance style
     * Returns a fresh normalized window config without mutating the source JSON.
     */
    resolveWindowConfig(winConfig, preset = {}) {
        const global = this.getGlobal();
        const theme = this.getTheme(preset.theme || global.theme);
        const winDefaults = global.windowDefaults || {};
        const presetDefaults = preset.windowDefaults || {};
        const rawStyle = {
            ...winDefaults,
            ...presetDefaults,
            ...(winConfig.style || {})
        };

        const refRes = global.referenceResolution || { width: 1600, height: 900 };
        const x = winConfig.xPct !== undefined ? Math.round((winConfig.xPct / 100) * refRes.width) : (winConfig.x ?? 0);
        const y = winConfig.yPct !== undefined ? Math.round((winConfig.yPct / 100) * refRes.height) : (winConfig.y ?? 0);
        const width = winConfig.widthPct !== undefined ? Math.round((winConfig.widthPct / 100) * refRes.width) : (winConfig.width ?? 400);
        const height = winConfig.heightPct !== undefined ? Math.round((winConfig.heightPct / 100) * refRes.height) : (winConfig.height ?? 300);

        return {
            ...winConfig,
            x,
            y,
            width,
            height,
            cycleInterval: winConfig.cycleInterval ?? rawStyle.cycleInterval ?? 5000,
            speedMultiplier: winConfig.speedMultiplier ?? rawStyle.speedMultiplier ?? 1.0,
            theme,
            style: {
                borderWidth: rawStyle.borderWidth ?? 2,
                borderColor: parseColor(rawStyle.borderColor ?? theme.primary, theme.primary),
                titleColor: parseColor(rawStyle.titleColor ?? theme.primary, theme.primary),
                bgColor: parseColor(rawStyle.bgColor ?? theme.bg, theme.bg)
            }
        };
    }

    /**
     * Hierarchical plugin config resolution:
     * Global pluginDefaults[pluginName] -> Window options[pluginName] / winConfig.pluginOptions
     */
    resolvePluginOptions(pluginName, winConfig = {}) {
        const globalDefaults = this.getGlobal().pluginDefaults?.[pluginName] || {};
        const winOverrides = winConfig.pluginOptions?.[pluginName] || winConfig.pluginOptions || {};
        return {
            ...globalDefaults,
            ...winOverrides
        };
    }
}
