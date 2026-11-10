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
import { DecryptPlugin } from './plugins/DecryptPlugin.js';
import { ScopePlugin } from './plugins/ScopePlugin.js';
import { NetGraphPlugin } from './plugins/NetGraphPlugin.js';
import { OrbitPlugin } from './plugins/OrbitPlugin.js';

async function bootstrap() {
    const engine = new Engine();
    await engine.init('app-container');

    // Register Plugins (13 total)
    engine.registerPlugin('matrix', MatrixPlugin);
    engine.registerPlugin('log', LogPlugin);
    engine.registerPlugin('hex', HexPlugin);
    engine.registerPlugin('map', MapPlugin);
    engine.registerPlugin('spectrum', SpectrumPlugin);
    engine.registerPlugin('graph', GraphPlugin);
    engine.registerPlugin('globe', GlobePlugin);
    engine.registerPlugin('code', CodePlugin);
    engine.registerPlugin('boot', BootPlugin);
    engine.registerPlugin('decrypt', DecryptPlugin);
    engine.registerPlugin('scope', ScopePlugin);
    engine.registerPlugin('netgraph', NetGraphPlugin);
    engine.registerPlugin('orbit', OrbitPlugin);

    // Load Config and Launch Preset or URL Test Harness (?plugin=decrypt&theme=amber&seed=42)
    await engine.loadConfig('config.json');
    engine.startFromQueryOrPreset('default');
}

bootstrap();
