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
import { WaterfallPlugin } from './plugins/WaterfallPlugin.js';
import { Wireframe3DPlugin } from './plugins/Wireframe3DPlugin.js';
import { HelixPlugin } from './plugins/HelixPlugin.js';
import { FileSysPlugin } from './plugins/FileSysPlugin.js';
import { TrajectoryPlugin } from './plugins/TrajectoryPlugin.js';
import { ShellPlugin } from './plugins/ShellPlugin.js';
import { ProcTablePlugin } from './plugins/ProcTablePlugin.js';
import { DossierPlugin } from './plugins/DossierPlugin.js';
import { PacketPlugin } from './plugins/PacketPlugin.js';

async function bootstrap() {
    const engine = new Engine();
    await engine.init('app-container');

    // Register Plugins (22 total)
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
    engine.registerPlugin('waterfall', WaterfallPlugin);
    engine.registerPlugin('cad', Wireframe3DPlugin);
    engine.registerPlugin('helix', HelixPlugin);
    engine.registerPlugin('filesys', FileSysPlugin);
    engine.registerPlugin('trajectory', TrajectoryPlugin);
    engine.registerPlugin('shell', ShellPlugin);
    engine.registerPlugin('top', ProcTablePlugin);
    engine.registerPlugin('dossier', DossierPlugin);
    engine.registerPlugin('pcap', PacketPlugin);

    // Load Config and Launch Preset or URL Test Harness (?plugin=shell&preset=demo_2&theme=amber&seed=42)
    await engine.loadConfig('config.json');
    engine.startFromQueryOrPreset('default');
}

bootstrap();
