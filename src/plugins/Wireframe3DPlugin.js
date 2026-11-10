export class Wireframe3DPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.rotY = 0.4;
        this.rotX = 0.32;
        this.modelTimer = 0;
        this.readoutTimer = 0;
        this.modelIndex = 0; // 0 = Keyhole Recon Satellite, 1 = Tokamak Torus Core
        this.models = [];
        this.calloutLabels = [];
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
        this.models = [this.buildSatelliteModel(), this.buildTokamakModel()];
        this.modelIndex = this.rng.int(0, 1);

        this.drawStaticBlueprintGrid();

        this.calloutLabels = [
            this.adapter.createLabel('', { fontSize: 9, fill: this.theme.primary, x: 10, y: 10 }),
            this.adapter.createLabel('', { fontSize: 9, fill: this.theme.primary, x: 10, y: 30 }),
            this.adapter.createLabel('', { fontSize: 9, fill: this.theme.primary, x: 10, y: 50 })
        ];

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                'CAD SCHEMATIC // ASSEMBLY: KH-12 ORBITAL BUS\nSCALE: 1:48 ISOMETRIC  TOL: 0.002mm\nFEA STRESS: NOMINAL [SAFETY FACTOR 2.4]',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'ROTATION: Y=024° X=018°\nMESH: 3D WIREFRAME\nLAYER: STRUCTURAL+BUS',
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
                'SUBSYSTEMS: 100% VERIFIED\nTHERMAL ENVELOPE: 185K - 340K',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'MASS: 14,820 KG\nC.O.M. OFFSET: +0.04m',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: this.width - pad,
                    y: this.height - 30,
                    anchorX: 1,
                    anchorY: 0
                }
            )
        };

        this.syncModelTelemetry();
        this.render();
    }

    drawStaticBlueprintGrid() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const step = 36;
        for (let x = step; x < this.width; x += step) {
            bg.moveTo(x, 0);
            bg.lineTo(x, this.height);
        }
        for (let y = step; y < this.height; y += step) {
            bg.moveTo(0, y);
            bg.lineTo(this.width, y);
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.45 });

        // Blueprint corner registration crosshairs
        const m = 18;
        const len = 10;
        const corners = [
            [m, 44],
            [this.width - m, 44],
            [m, this.height - 36],
            [this.width - m, this.height - 36]
        ];
        for (const [cx, cy] of corners) {
            bg.moveTo(cx - len, cy);
            bg.lineTo(cx + len, cy);
            bg.moveTo(cx, cy - len);
            bg.lineTo(cx, cy + len);
        }
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });
    }

    buildSatelliteModel() {
        const verts = [];
        const edges = [];
        const addV = (x, y, z) => {
            verts.push({ x, y, z });
            return verts.length - 1;
        };
        const addE = (a, b, primary = true) => edges.push({ a, b, primary });

        // 1. Octagonal central satellite bus + forward optical telescope tube
        const rings = [
            { x: -0.65, r: 0.28 },
            { x: -0.15, r: 0.28 },
            { x: 0.35, r: 0.22 },
            { x: 0.78, r: 0.20 }
        ];
        const sides = 8;
        const ringIndices = [];
        for (let r = 0; r < rings.length; r++) {
            const ring = [];
            for (let s = 0; s < sides; s++) {
                const a = (s / sides) * Math.PI * 2;
                ring.push(addV(rings[r].x, Math.cos(a) * rings[r].r, Math.sin(a) * rings[r].r));
            }
            ringIndices.push(ring);
            for (let s = 0; s < sides; s++) {
                addE(ring[s], ring[(s + 1) % sides], true);
                if (r > 0) {
                    addE(ringIndices[r - 1][s], ring[s], true);
                }
            }
        }

        // 2. Port & Starboard Solar Array Wings (extending along Z axis)
        for (const sign of [-1, 1]) {
            const zStart = sign * 0.32;
            const zEnd = sign * 1.28;
            const xA = -0.36;
            const xB = 0.06;
            const panels = 5;
            let prevA = addV(xA, 0, zStart);
            let prevB = addV(xB, 0, zStart);
            addE(prevA, prevB, true);

            for (let p = 1; p <= panels; p++) {
                const z = zStart + ((zEnd - zStart) * p) / panels;
                const curA = addV(xA, 0, z);
                const curB = addV(xB, 0, z);
                addE(prevA, curA, true);
                addE(prevB, curB, true);
                addE(curA, curB, false);
                addE(prevA, curB, false); // diagonal truss bracing
                prevA = curA;
                prevB = curB;
            }
        }

        // 3. High-Gain Parabolic Dish on ventral strut
        const dishCenter = addV(0.05, 0.56, 0);
        addE(ringIndices[1][0], dishCenter, true);
        const dishRing = [];
        const dishSegs = 10;
        for (let i = 0; i < dishSegs; i++) {
            const a = (i / dishSegs) * Math.PI * 2;
            const vIdx = addV(0.05 + Math.cos(a) * 0.24, 0.64, Math.sin(a) * 0.24);
            dishRing.push(vIdx);
        }
        for (let i = 0; i < dishSegs; i++) {
            addE(dishRing[i], dishRing[(i + 1) % dishSegs], true);
            if (i % 2 === 0) addE(dishCenter, dishRing[i], false);
        }

        return {
            name: 'KH-12 ORBITAL RECON BUS',
            verts,
            edges,
            callouts: [
                { vertIdx: ringIndices[3][2], text: '01: PRIMARY_MIRROR_BAFFLE', dx: 45, dy: -28 },
                { vertIdx: verts.length - 12, text: '02: GaAs_SOLAR_WING', dx: -95, dy: -26 },
                { vertIdx: dishCenter, text: '03: Ka-BAND_GIMBAL_DISH', dx: 38, dy: 24 }
            ]
        };
    }

    buildTokamakModel() {
        const verts = [];
        const edges = [];
        const addV = (x, y, z) => {
            verts.push({ x, y, z });
            return verts.length - 1;
        };
        const addE = (a, b, primary = true) => edges.push({ a, b, primary });

        const majorCols = 14;
        const minorSegs = 8;
        const R = 0.68;
        const r = 0.30;
        const rings = [];

        for (let i = 0; i < majorCols; i++) {
            const u = (i / majorCols) * Math.PI * 2;
            const cosU = Math.cos(u);
            const sinU = Math.sin(u);
            const ring = [];
            for (let j = 0; j < minorSegs; j++) {
                const v = (j / minorSegs) * Math.PI * 2;
                const rad = R + Math.cos(v) * r;
                const x = cosU * rad;
                const z = sinU * rad;
                const y = Math.sin(v) * r;
                ring.push(addV(x, y, z));
            }
            rings.push(ring);
            // Toroidal D-coil Poloidal Ring
            for (let j = 0; j < minorSegs; j++) {
                addE(ring[j], ring[(j + 1) % minorSegs], true);
            }
        }

        // Toroidal magnetic field lines connecting rings
        for (let i = 0; i < majorCols; i++) {
            const next = (i + 1) % majorCols;
            for (let j = 0; j < minorSegs; j++) {
                addE(rings[i][j], rings[next][j], j % 2 === 0);
            }
        }

        return {
            name: 'TOKAMAK FUSION CORE // MK-IV',
            verts,
            edges,
            callouts: [
                { vertIdx: rings[0][0], text: '01: TF_SUPERCONDUCTOR_COIL', dx: 42, dy: -28 },
                { vertIdx: rings[4][2], text: '02: DIVERTOR_MANIFOLD', dx: -105, dy: -24 },
                { vertIdx: rings[8][6], text: '03: PLASMA_CONFINEMENT_TORUS', dx: 36, dy: 26 }
            ]
        };
    }

    syncModelTelemetry() {
        const model = this.models[this.modelIndex];
        if (!model || !this.cornerLabels.topLeft) return;
        this.cornerLabels.topLeft.text =
            `CAD SCHEMATIC // ${model.name}\n` +
            `VERTICES: ${model.verts.length}  EDGES: ${model.edges.length}  TOL: 0.002mm\n` +
            `FEA STRESS: NOMINAL [SAFETY FACTOR 2.4]`;
    }

    update(dt) {
        this.rotY += dt * 0.42;
        this.rotX = 0.28 + Math.sin(this.rotY * 0.6) * 0.16;
        this.modelTimer += dt;
        this.readoutTimer += dt;

        if (this.modelTimer >= 11.0) {
            this.modelTimer = 0;
            this.modelIndex = (this.modelIndex + 1) % this.models.length;
            this.syncModelTelemetry();
        }

        if (this.readoutTimer >= 0.3 && this.cornerLabels.topRight) {
            this.readoutTimer = 0;
            const degY = Math.round(((this.rotY * 180) / Math.PI) % 360)
                .toString()
                .padStart(3, '0');
            const degX = Math.round((this.rotX * 180) / Math.PI)
                .toString()
                .padStart(3, '0');
            this.cornerLabels.topRight.text =
                `ROTATION: Y=${degY}° X=${degX}°\n` +
                `MESH: 3D WIREFRAME\n` +
                `LAYER: STRUCTURAL+BUS`;
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const model = this.models[this.modelIndex];
        if (!model) return;

        const cx = this.width / 2;
        const cy = this.height * 0.52;
        const scale = Math.min(this.width, this.height) * 0.34;

        const cosY = Math.cos(this.rotY);
        const sinY = Math.sin(this.rotY);
        const cosX = Math.cos(this.rotX);
        const sinX = Math.sin(this.rotX);

        const proj = model.verts.map((v) => {
            const x1 = v.x * cosY - v.z * sinY;
            const z1 = v.x * sinY + v.z * cosY;
            const y2 = v.y * cosX - z1 * sinX;
            const z2 = v.y * sinX + z1 * cosX;
            const persp = 2.6 / (2.6 - z2 * 0.45);
            return {
                x: cx + x1 * scale * persp,
                y: cy + y2 * scale * persp,
                z: z2
            };
        });

        // 1. Back-facing wireframe edges
        for (const e of model.edges) {
            const p1 = proj[e.a];
            const p2 = proj[e.b];
            if (p1.z < 0 && p2.z < 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1, color: this.theme.dim, alpha: 0.55 });

        // 2. Front-facing secondary truss edges
        for (const e of model.edges) {
            if (e.primary) continue;
            const p1 = proj[e.a];
            const p2 = proj[e.b];
            if (p1.z >= 0 || p2.z >= 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.68 });

        // 3. Front-facing primary structural edges
        for (const e of model.edges) {
            if (!e.primary) continue;
            const p1 = proj[e.a];
            const p2 = proj[e.b];
            if (p1.z >= 0 || p2.z >= 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1.5, color: this.theme.primary, alpha: 0.92 });

        // 4. 3D Callout Leader Lines & Subsystem Labels
        for (let i = 0; i < model.callouts.length; i++) {
            const c = model.callouts[i];
            const p = proj[c.vertIdx];
            const lbl = this.calloutLabels[i];
            if (!p || !lbl) continue;

            const elbowX = Math.min(this.width - 145, Math.max(16, p.x + c.dx));
            const elbowY = Math.min(this.height - 52, Math.max(52, p.y + c.dy));

            g.rect(p.x - 2.5, p.y - 2.5, 5, 5).fill(this.theme.primary);
            g.moveTo(p.x, p.y);
            g.lineTo(elbowX, elbowY);
            g.lineTo(elbowX + (c.dx >= 0 ? 28 : -28), elbowY);
            g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.85 });

            lbl.text = c.text;
            lbl.x = Math.min(this.width - 155, Math.max(8, elbowX + (c.dx >= 0 ? 4 : -110)));
            lbl.y = elbowY - 12;
        }
    }

    destroy() {
        this.models = [];
        this.calloutLabels = [];
        this.cornerLabels = {};
        this.adapter = null;
    }
}
