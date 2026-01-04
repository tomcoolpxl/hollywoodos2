import { Engine } from './core/Engine.js';
import { MatrixPlugin } from './plugins/MatrixPlugin.js';
import { LogPlugin } from './plugins/LogPlugin.js';
import { HexPlugin } from './plugins/HexPlugin.js';
import { MapPlugin } from './plugins/MapPlugin.js';
import { SpectrumPlugin } from './plugins/SpectrumPlugin.js';
import { GraphPlugin } from './plugins/GraphPlugin.js';
import { GlobePlugin } from './plugins/GlobePlugin.js';
import { CodePlugin } from './plugins/CodePlugin.js';
import { BootPlugin } from './plugins/BootPlugin.js';

async function bootstrap() {
    const engine = new Engine();
    await engine.init('app-container');

    // Register Plugins
    engine.registerPlugin('matrix', MatrixPlugin);
    engine.registerPlugin('log', LogPlugin);
    engine.registerPlugin('hex', HexPlugin);
    engine.registerPlugin('map', MapPlugin);
    engine.registerPlugin('spectrum', SpectrumPlugin);
    engine.registerPlugin('graph', GraphPlugin);
    engine.registerPlugin('globe', GlobePlugin);
    engine.registerPlugin('code', CodePlugin);
    engine.registerPlugin('boot', BootPlugin);

    // Load Config and Apply Default Preset
    // In production, config.json is at the root (copied from public/)
    await engine.loadConfig('config.json');
    engine.applyPreset('default');
}

bootstrap();
