export class NetGraphPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.nodes = [];
        this.edges = [];
        this.clusters = [];
        this.packets = [];
        this.activeRoute = [];
        this.spawnTimer = 0;
        this.routeTimer = 0;
        this.telemetryTimer = 0;
        this.pulseTime = 0;
        this.cornerLabels = {};
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x003300,
            peak: 0x55FF55
        };

        this.adapter = context.createFreeformAdapter();
        this.buildTopology();
        this.renderTopology();
    }

    buildTopology() {
        this.nodes = [];
        this.edges = [];
        this.clusters = [];
        this.packets = [];
        this.activeRoute = [];

        const edgeSet = new Set();
        const addEdge = (a, b, tier = 1) => {
            if (a === b) return;
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            if (edgeSet.has(key)) return;
            edgeSet.add(key);
            this.edges.push({ a, b, tier });
        };

        const cx = this.width / 2;
        const cy = this.height * 0.52;
        const rxCore = this.width * 0.085;
        const ryCore = this.height * 0.105;
        const rxMid = this.width * 0.245;
        const ryMid = this.height * 0.255;
        const rxOuter = this.width * 0.415;
        const ryOuter = this.height * 0.395;

        // 1. Tier 0: 4 Core Backbone Switches (Inner Mesh)
        const coreNames = ['CORE-01', 'CORE-02', 'CORE-03', 'CORE-04'];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            this.nodes.push({
                id: this.nodes.length,
                name: coreNames[i],
                tier: 0,
                x: cx + Math.cos(angle) * rxCore,
                y: cy + Math.sin(angle) * ryCore,
                radius: 6.5,
                load: 0.55 + this.rng() * 0.3,
                adj: []
            });
        }
        // Full mesh among core backbone switches
        for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
                addEdge(i, j, 0);
            }
        }

        // 2. Tier 1: 8 Regional Distribution / Security Gateways
        const midNames = [
            'FW-NORTH',
            'GW-ALPHA',
            'SAT-RELAY',
            'IDS-EAST',
            'DB-MASTER',
            'VAULT-09',
            'TOR-EXIT',
            'PROXY-WEST'
        ];
        const midCount = midNames.length;
        for (let i = 0; i < midCount; i++) {
            const angle = (i / midCount) * Math.PI * 2 + this.rng.range(-0.07, 0.07);
            const scale = this.rng.range(0.92, 1.06);
            const id = this.nodes.length;
            this.nodes.push({
                id,
                name: midNames[i],
                tier: 1,
                x: cx + Math.cos(angle) * rxMid * scale,
                y: cy + Math.sin(angle) * ryMid * scale,
                radius: 5,
                load: 0.3 + this.rng() * 0.4,
                adj: []
            });

            // Dual-homed to nearest two core nodes
            const coreA = Math.floor(i / 2) % 4;
            const coreB = (coreA + 1) % 4;
            addEdge(id, coreA, 1);
            addEdge(id, coreB, 1);
        }
        // Ring + cross-peering links on distribution tier
        for (let i = 0; i < midCount; i++) {
            const cur = 4 + i;
            const next = 4 + ((i + 1) % midCount);
            addEdge(cur, next, 1);
            if (i % 2 === 0) {
                const skip = 4 + ((i + 2) % midCount);
                addEdge(cur, skip, 1);
            }
        }

        // 3. Tier 2: 12 Outer Subnet / Endpoint Nodes
        const outerNames = [
            'SUB-10.1',
            'NODE-A1',
            'NODE-A2',
            'SAT-UPLINK',
            'EDGE-04',
            'CLUSTER-B',
            'REPLICA-2',
            'BACKUP-Z',
            'DMZ-HOST',
            'HONEYPOT',
            'VPN-GW',
            'SENSOR-9'
        ];
        const outerCount = outerNames.length;
        for (let i = 0; i < outerCount; i++) {
            const angle = (i / outerCount) * Math.PI * 2 + 0.12 + this.rng.range(-0.06, 0.06);
            const scale = this.rng.range(0.9, 1.04);
            const id = this.nodes.length;
            const x = Math.min(this.width - 24, Math.max(24, cx + Math.cos(angle) * rxOuter * scale));
            const y = Math.min(this.height - 22, Math.max(28, cy + Math.sin(angle) * ryOuter * scale));
            this.nodes.push({
                id,
                name: outerNames[i],
                tier: 2,
                x,
                y,
                radius: 3.5,
                load: 0.15 + this.rng() * 0.5,
                adj: []
            });

            // Connect to nearest distribution gateway + secondary uplink
            const primaryMid = 4 + (Math.floor((i * midCount) / outerCount) % midCount);
            const secondaryMid = 4 + ((Math.floor((i * midCount) / outerCount) + 1) % midCount);
            addEdge(id, primaryMid, 2);
            if (i % 2 === 0) {
                addEdge(id, secondaryMid, 2);
            }
        }

        // Connect adjacent outer subnet pairs for local mesh redundancy
        for (let i = 0; i < outerCount; i++) {
            const cur = 12 + i;
            const next = 12 + ((i + 1) % outerCount);
            if (i % 3 !== 2) {
                addEdge(cur, next, 2);
            }
        }

        // Populate adjacency list for multi-hop routing
        for (const e of this.edges) {
            this.nodes[e.a].adj.push(e.b);
            this.nodes[e.b].adj.push(e.a);
        }

        // Draw static background grid & cluster zone rings once on bgGraphics
        this.drawBackgroundZones(cx, cy, rxCore, ryCore, rxMid, ryMid);

        // Create crisp labels (core + gateways + select outer endpoints to avoid clutter)
        for (const node of this.nodes) {
            const showLabel = node.tier <= 1 || node.id % 2 === 0;
            if (!showLabel) continue;
            const offsetX = node.x >= cx ? 8 : -54;
            const offsetY = node.tier === 0 ? -12 : -6;
            node.label = this.adapter.createLabel(node.name, {
                fontSize: 9,
                fill:
                    node.tier === 0
                        ? this.theme.peak
                        : node.tier === 1
                          ? this.theme.primary
                          : this.theme.secondary,
                x: Math.min(this.width - 62, Math.max(6, node.x + offsetX)),
                y: Math.min(this.height - 16, Math.max(18, node.y + offsetY))
            });
        }

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                `MESH TOPOLOGY // NODES: ${this.nodes.length}  LINKS: ${this.edges.length}\nBGP ASN: AS-64512 // PROTO: OSPF-V3\nTRACE: INIT`,
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'THROUGHPUT: 14.82 Gbps\nPKT LOSS: 0.002%  RTT: 4.1ms\nENC: AES-256-GCM // ZERO-TRUST',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: this.width - pad,
                    y: 6,
                    anchorX: 1,
                    anchorY: 0
                }
            ),
            bottomLeft: this.adapter.createLabel(
                'CORE LOAD: [|||||||...] 68%\nIDS STATUS: NOMINAL // 0 BREACHES\nSUBNET: 10.240.0.0/16 [MASKED]',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 42
                }
            ),
            bottomRight: this.adapter.createLabel(
                'ACTIVE FLOWS: 1,428 SESSIONS\nFIREWALL: STRICT DROP [INGRESS]\nHANDSHAKE: 00:00:01.42',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: this.width - pad,
                    y: this.height - 42,
                    anchorX: 1,
                    anchorY: 0
                }
            )
        };

        this.pickActiveRoute();

        // Spawn initial multi-hop packets
        for (let i = 0; i < 16; i++) {
            this.spawnPacket();
        }
    }

    drawBackgroundZones(cx, cy, rxCore, ryCore, rxMid, ryMid) {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        // Subtle crosshair axes
        bg.moveTo(cx, 20);
        bg.lineTo(cx, this.height - 10);
        bg.moveTo(12, cy);
        bg.lineTo(this.width - 12, cy);
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.45 });

        // Concentric topological tier rings (Core & Distribution zones)
        const steps = 64;
        const rings = [
            { rx: rxCore * 1.15, ry: ryCore * 1.15 },
            { rx: rxMid, ry: ryMid }
        ];
        for (const ring of rings) {
            for (let i = 0; i <= steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                const x = cx + Math.cos(a) * ring.rx;
                const y = cy + Math.sin(a) * ring.ry;
                if (i === 0) bg.moveTo(x, y);
                else bg.lineTo(x, y);
            }
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.6 });
    }

    pickActiveRoute() {
        // Select a 4-hop path from an outer node -> mid -> core -> mid -> outer
        const outerIds = this.nodes.filter((n) => n.tier === 2).map((n) => n.id);
        if (outerIds.length === 0) return;

        let curr = this.rng.pick(outerIds);
        const path = [curr];
        for (let step = 0; step < 4; step++) {
            const neighbors = this.nodes[curr].adj.filter((nId) => !path.includes(nId));
            if (neighbors.length === 0) break;
            curr = this.rng.pick(neighbors);
            path.push(curr);
        }
        this.activeRoute = path;

        if (this.cornerLabels.topLeft && path.length >= 2) {
            const src = this.nodes[path[0]].name;
            const dst = this.nodes[path[path.length - 1]].name;
            this.cornerLabels.topLeft.text =
                `MESH TOPOLOGY // NODES: ${this.nodes.length}  LINKS: ${this.edges.length}\n` +
                `BGP ASN: AS-64512 // PROTO: OSPF-V3\n` +
                `TRACE: ${src} -> ${dst} (${path.length - 1} HOPS)`;
        }
    }

    spawnPacket() {
        if (this.edges.length === 0) return;
        const edge = this.rng.pick(this.edges);
        const reverse = this.rng.chance(0.5);
        this.packets.push({
            from: reverse ? edge.b : edge.a,
            to: reverse ? edge.a : edge.b,
            t: this.rng() * 0.25,
            speed: 0.45 + this.rng() * 0.65,
            hopsLeft: this.rng.int(1, 3),
            priority: this.rng.chance(0.25)
        });
    }

    update(dt) {
        this.pulseTime += dt;
        this.spawnTimer += dt;
        this.routeTimer += dt;
        this.telemetryTimer += dt;

        if (this.spawnTimer >= 0.18 && this.packets.length < 24) {
            this.spawnTimer = 0;
            this.spawnPacket();
        }

        if (this.routeTimer >= 3.5) {
            this.routeTimer = 0;
            this.pickActiveRoute();
        }

        if (this.telemetryTimer >= 0.45 && this.cornerLabels.topRight) {
            this.telemetryTimer = 0;
            const gbps = (13.4 + this.rng() * 2.8).toFixed(2);
            const rtt = (3.6 + this.rng() * 1.4).toFixed(1);
            const flows = 1380 + this.rng.int(0, 120);
            const loadPct = 62 + this.rng.int(0, 18);
            const bars = Math.round(loadPct / 10);
            const barStr = '|'.repeat(bars) + '.'.repeat(10 - bars);

            this.cornerLabels.topRight.text =
                `THROUGHPUT: ${gbps} Gbps\n` +
                `PKT LOSS: 0.002%  RTT: ${rtt}ms\n` +
                `ENC: AES-256-GCM // ZERO-TRUST`;

            this.cornerLabels.bottomLeft.text =
                `CORE LOAD: [${barStr}] ${loadPct}%\n` +
                `IDS STATUS: NOMINAL // 0 BREACHES\n` +
                `SUBNET: 10.240.0.0/16 [MASKED]`;

            this.cornerLabels.bottomRight.text =
                `ACTIVE FLOWS: ${flows.toLocaleString()} SESSIONS\n` +
                `FIREWALL: STRICT DROP [INGRESS]\n` +
                `PKTS IN FLIGHT: ${this.packets.length} FRAMES`;
        }

        for (let i = this.packets.length - 1; i >= 0; i--) {
            const p = this.packets[i];
            p.t += p.speed * dt;
            if (p.t >= 1.0) {
                const targetNode = this.nodes[p.to];
                targetNode.load = Math.min(1.0, targetNode.load + 0.22);

                // Multi-hop forwarding across the mesh
                if (p.hopsLeft > 0 && targetNode.adj.length > 0) {
                    const candidates = targetNode.adj.filter((id) => id !== p.from);
                    const nextId =
                        candidates.length > 0 ? this.rng.pick(candidates) : this.rng.pick(targetNode.adj);
                    p.from = p.to;
                    p.to = nextId;
                    p.t = 0;
                    p.hopsLeft--;
                } else {
                    this.packets.splice(i, 1);
                }
            }
        }

        for (const node of this.nodes) {
            node.load = Math.max(0.15, node.load - dt * 0.25);
        }

        this.renderTopology();
    }

    renderTopology() {
        const g = this.adapter.graphics;
        g.clear();

        // 1. Draw outer & distribution links (PixiJS v8 build-then-stroke)
        for (const e of this.edges) {
            if (e.tier === 0) continue;
            const n1 = this.nodes[e.a];
            const n2 = this.nodes[e.b];
            g.moveTo(n1.x, n1.y);
            g.lineTo(n2.x, n2.y);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.42 });

        // 2. Draw Core Backbone mesh links (brighter/thicker)
        for (const e of this.edges) {
            if (e.tier !== 0) continue;
            const n1 = this.nodes[e.a];
            const n2 = this.nodes[e.b];
            g.moveTo(n1.x, n1.y);
            g.lineTo(n2.x, n2.y);
        }
        g.stroke({ width: 1.5, color: this.theme.primary, alpha: 0.75 });

        // 3. Draw highlighted active multi-hop route trace
        if (this.activeRoute.length >= 2) {
            for (let i = 0; i < this.activeRoute.length - 1; i++) {
                const n1 = this.nodes[this.activeRoute[i]];
                const n2 = this.nodes[this.activeRoute[i + 1]];
                g.moveTo(n1.x, n1.y);
                g.lineTo(n2.x, n2.y);
            }
            g.stroke({ width: 2, color: this.theme.peak, alpha: 0.9 });
        }

        // 4. Draw nodes & telemetry load rings
        for (const node of this.nodes) {
            const isCore = node.tier === 0;
            const isMid = node.tier === 1;
            const strokeColor = isCore
                ? this.theme.peak
                : isMid
                  ? this.theme.primary
                  : this.theme.secondary;

            g.circle(node.x, node.y, node.radius).fill(this.theme.bg ?? 0x000000);
            g.circle(node.x, node.y, node.radius).stroke({
                width: isCore ? 2 : 1.5,
                color: strokeColor
            });

            if (isCore) {
                g.rect(node.x - 2, node.y - 2, 4, 4).fill(this.theme.peak);
            }

            const pulseR =
                node.radius + 2.5 + Math.sin(this.pulseTime * 3.2 + node.id) * 1.5 + node.load * 4.5;
            g.circle(node.x, node.y, pulseR).stroke({
                width: 1,
                color: this.theme.primary,
                alpha: isCore ? 0.45 : 0.25
            });
        }

        // 5. Draw moving data packets along edges
        for (const p of this.packets) {
            const n1 = this.nodes[p.from];
            const n2 = this.nodes[p.to];
            const x = n1.x + (n2.x - n1.x) * p.t;
            const y = n1.y + (n2.y - n1.y) * p.t;
            g.circle(x, y, p.priority ? 3 : 2.2).fill(
                p.priority ? this.theme.peak : this.theme.primary
            );
        }
    }

    destroy() {
        this.nodes = [];
        this.edges = [];
        this.clusters = [];
        this.packets = [];
        this.activeRoute = [];
        this.cornerLabels = {};
        this.adapter = null;
    }
}
