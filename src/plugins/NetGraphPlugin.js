export class NetGraphPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.nodes = [];
        this.edges = [];
        this.packets = [];
        this.spawnTimer = 0;
        this.pulseTime = 0;
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
        this.packets = [];

        const nodeNames = [
            'GW-CORE',
            'NODE-01',
            'NODE-02',
            'FW-ALPHA',
            'DB-MAIN',
            'RELAY-7',
            'PROXY-X',
            'SAT-LINK'
        ];

        const cx = this.width / 2;
        const cy = this.height / 2;
        const rx = this.width * 0.36;
        const ry = this.height * 0.34;

        // Central hub node
        this.nodes.push({
            id: 0,
            name: nodeNames[0],
            x: cx,
            y: cy,
            radius: 7,
            load: 0.5
        });

        // Outer ring nodes
        const ringCount = nodeNames.length - 1;
        for (let i = 0; i < ringCount; i++) {
            const angle = (i / ringCount) * Math.PI * 2 + this.rng.range(-0.18, 0.18);
            const distScale = this.rng.range(0.78, 1.05);
            const x = cx + Math.cos(angle) * rx * distScale;
            const y = cy + Math.sin(angle) * ry * distScale;
            this.nodes.push({
                id: i + 1,
                name: nodeNames[i + 1],
                x,
                y,
                radius: 5,
                load: this.rng()
            });

            // Connect to central hub
            this.edges.push([0, i + 1]);
            // Connect to next ring neighbor
            const nextRing = ((i + 1) % ringCount) + 1;
            this.edges.push([i + 1, nextRing]);
        }

        // Create persistent labels for each node
        for (const node of this.nodes) {
            node.label = this.adapter.createLabel(node.name, {
                fontSize: 10,
                fill: node.id === 0 ? this.theme.peak : this.theme.primary,
                x: Math.min(this.width - 58, Math.max(4, node.x + 8)),
                y: Math.min(this.height - 14, Math.max(4, node.y - 7))
            });
        }

        // Spawn initial packets
        for (let i = 0; i < 6; i++) {
            this.spawnPacket();
        }
    }

    spawnPacket() {
        if (this.edges.length === 0) return;
        const edge = this.rng.pick(this.edges);
        const reverse = this.rng.chance(0.5);
        this.packets.push({
            from: reverse ? edge[1] : edge[0],
            to: reverse ? edge[0] : edge[1],
            t: 0,
            speed: 0.6 + this.rng() * 0.9
        });
    }

    update(dt) {
        this.pulseTime += dt;
        this.spawnTimer += dt;

        if (this.spawnTimer >= 0.35 && this.packets.length < 14) {
            this.spawnTimer = 0;
            this.spawnPacket();
        }

        for (let i = this.packets.length - 1; i >= 0; i--) {
            const p = this.packets[i];
            p.t += p.speed * dt;
            if (p.t >= 1.0) {
                this.nodes[p.to].load = Math.min(1.0, this.nodes[p.to].load + 0.25);
                this.packets.splice(i, 1);
            }
        }

        for (const node of this.nodes) {
            node.load = Math.max(0.15, node.load - dt * 0.3);
        }

        this.renderTopology();
    }

    renderTopology() {
        const g = this.adapter.graphics;
        g.clear();

        // 1. Draw network edges (PixiJS v8 build-then-stroke)
        for (const [i1, i2] of this.edges) {
            const n1 = this.nodes[i1];
            const n2 = this.nodes[i2];
            g.moveTo(n1.x, n1.y);
            g.lineTo(n2.x, n2.y);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.55 });

        // 2. Draw nodes & active pulse rings
        for (const node of this.nodes) {
            g.circle(node.x, node.y, node.radius).fill(this.theme.bg ?? 0x000000);
            g.circle(node.x, node.y, node.radius).stroke({
                width: 2,
                color: node.id === 0 ? this.theme.peak : this.theme.primary
            });

            const pulseR = node.radius + 3 + Math.sin(this.pulseTime * 4 + node.id) * 2 + node.load * 5;
            g.circle(node.x, node.y, pulseR).stroke({
                width: 1,
                color: this.theme.primary,
                alpha: 0.35
            });
        }

        // 3. Draw moving data packets along edges
        for (const p of this.packets) {
            const n1 = this.nodes[p.from];
            const n2 = this.nodes[p.to];
            const x = n1.x + (n2.x - n1.x) * p.t;
            const y = n1.y + (n2.y - n1.y) * p.t;
            g.circle(x, y, 3).fill(this.theme.peak);
        }
    }

    destroy() {
        this.nodes = [];
        this.edges = [];
        this.packets = [];
        this.adapter = null;
    }
}
