import { WORLD_COASTLINES, projectEquirectangular } from '../core/WorldMapData.js';

export class MapPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.targets = [];
        this.scanAngle = 0;
        this.gridSize = 40;
        this.cornerLabels = {};
        this.telemetryTimer = 0;
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x008800,
            dim: 0x003300,
            peak: 0x55FF55
        };
        this.gridSize = context.options?.gridSize ?? 40;
        const targetCount = context.options?.targetCount ?? 5;

        this.adapter = context.createFreeformAdapter();
        this.drawMapStatic();

        const minX = 36;
        const maxX = Math.max(60, this.width - 75);
        const minY = 54;
        const maxY = Math.max(80, this.height - 46);

        this.targets = [];
        for (let i = 0; i < targetCount; i++) {
            const id = `TRGT-${this.rng.int(1000, 9999)}`;
            const x = this.rng.range(minX, maxX);
            const y = this.rng.range(minY, maxY);
            const label = this.adapter.createLabel(id, {
                fontSize: 9,
                fill: this.theme.primary,
                x: x + 7,
                y: y - 6
            });

            this.targets.push({
                x,
                y,
                vx: (this.rng() - 0.5) * 42,
                vy: (this.rng() - 0.5) * 42,
                id,
                label
            });
        }

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                `SECTOR: GLOBAL THEATER // WGS-84\nRADAR: AN/FPS-132 PHASED ARRAY\nCONTACTS: ${targetCount} TRACKED [IFF: ACTIVE]`,
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'SWEEP: 000.0° MAG\nRANGE: 1,200 NM\nCLUTTER REJ: HIGH',
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
                'DEFCON STATUS: LEVEL 3 // WATCHCON 2\nSAT-LINK: SYNCHRONIZED',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'INTERCEPT VEC: STANDBY\nALT FLOOR: FL180',
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
    }

    drawMapStatic() {
        const g = this.adapter.bgGraphics;
        g.clear();

        // 1. Background 30-degree Lat/Lon Graticule
        const cols = 12;
        const rows = 6;
        for (let i = 1; i < cols; i++) {
            const x = (this.width / cols) * i;
            g.moveTo(x, 0);
            g.lineTo(x, this.height);
        }
        for (let j = 1; j < rows; j++) {
            const y = (this.height / rows) * j;
            g.moveTo(0, y);
            g.lineTo(this.width, y);
        }
        g.stroke({ width: 1, color: this.theme.dim, alpha: 0.55 });

        // 2. High-resolution geographic world coastlines (WGS-84 Equirectangular)
        for (const poly of WORLD_COASTLINES) {
            for (let i = 0; i < poly.length; i++) {
                const { x, y } = projectEquirectangular(poly[i][0], poly[i][1], this.width, this.height);
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
        }
        g.stroke({ width: 1.4, color: this.theme.secondary, alpha: 0.8 });

        // 3. Concentric Radar Range Rings & Crosshairs
        const rcx = this.width / 2;
        const rcy = this.height / 2;
        const maxR = Math.min(this.width, this.height) * 0.41;

        g.circle(rcx, rcy, maxR * 0.33);
        g.circle(rcx, rcy, maxR * 0.66);
        g.moveTo(0, rcy);
        g.lineTo(this.width, rcy);
        g.moveTo(rcx, 0);
        g.lineTo(rcx, this.height);
        g.stroke({ width: 1, color: this.theme.dim, alpha: 0.75 });
    }

    update(dt) {
        const g = this.adapter.graphics;
        g.clear();

        const minX = 28;
        const maxX = Math.max(60, this.width - 72);
        const minY = 52;
        const maxY = Math.max(80, this.height - 42);

        // 1. Update & build all target reticles + velocity vectors
        for (const t of this.targets) {
            t.x += t.vx * dt;
            t.y += t.vy * dt;

            if (t.x < minX) { t.x = minX; t.vx *= -1; }
            if (t.x > maxX) { t.x = maxX; t.vx *= -1; }
            if (t.y < minY) { t.y = minY; t.vy *= -1; }
            if (t.y > maxY) { t.y = maxY; t.vy *= -1; }

            g.circle(t.x, t.y, 3.5);
            g.rect(t.x - 6, t.y - 6, 12, 12);
            g.moveTo(t.x, t.y);
            g.lineTo(t.x + t.vx * 0.55, t.y + t.vy * 0.55);

            if (t.label) {
                t.label.x = Math.min(this.width - 68, t.x + 8);
                t.label.y = Math.max(46, t.y - 6);
            }
        }
        g.stroke({ width: 1, color: this.theme.primary });

        // 2. Radar Sweep Line, Trailing Echo Fan & Outer Ring
        this.scanAngle = (this.scanAngle + dt * 1.35) % (Math.PI * 2);
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.41;

        for (let i = 1; i <= 4; i++) {
            const trailAng = this.scanAngle - i * 0.08;
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(trailAng) * radius, cy + Math.sin(trailAng) * radius);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.3 });

        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(this.scanAngle) * radius, cy + Math.sin(this.scanAngle) * radius);
        g.stroke({ width: 2, color: this.theme.peak, alpha: 0.8 });

        g.circle(cx, cy, radius);
        g.stroke({ width: 1.5, color: this.theme.secondary, alpha: 0.85 });

        this.telemetryTimer += dt;
        if (this.telemetryTimer >= 0.25 && this.cornerLabels.topRight) {
            this.telemetryTimer = 0;
            const deg = ((this.scanAngle * 180) / Math.PI).toFixed(1).padStart(5, '0');
            const lead = this.targets[0];
            const brg = lead ? Math.round((Math.atan2(lead.y - cy, lead.x - cx) * 180) / Math.PI + 180) : 0;
            this.cornerLabels.topRight.text =
                `SWEEP: ${deg}° MAG\n` +
                `RANGE: 1,200 NM\n` +
                `PRIMARY BRG: ${brg}°`;
        }
    }

    destroy() {
        this.targets = [];
        this.cornerLabels = {};
        this.adapter = null;
    }
}
