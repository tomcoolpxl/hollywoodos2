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

        this.targets = [];
        for (let i = 0; i < targetCount; i++) {
            const id = `TRGT-${this.rng.int(1000, 9999)}`;
            const x = this.rng.range(20, Math.max(40, this.width - 20));
            const y = this.rng.range(20, Math.max(40, this.height - 20));
            const label = this.adapter.createLabel(id, {
                fontSize: 10,
                fill: this.theme.primary,
                x: x + 6,
                y: y - 6
            });

            this.targets.push({
                x,
                y,
                vx: (this.rng() - 0.5) * 55,
                vy: (this.rng() - 0.5) * 55,
                id,
                label
            });
        }

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                `SECTOR: NORTH-ATLANTIC // GRID: ${this.gridSize}KM\nRADAR: AN/FPS-132 PHASED ARRAY\nCONTACTS: ${targetCount} TRACKED [IFF: ACTIVE]`,
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

        // 1. Build background grid geometry first, then stroke (PixiJS v8)
        for (let x = 0; x <= this.width; x += this.gridSize) {
            g.moveTo(x, 0);
            g.lineTo(x, this.height);
        }
        for (let y = 0; y <= this.height; y += this.gridSize) {
            g.moveTo(0, y);
            g.lineTo(this.width, y);
        }
        g.stroke({ width: 1, color: this.theme.dim });

        // 2. Build wireframe continents geometry, then stroke (PixiJS v8)
        g.moveTo(this.width * 0.16, this.height * 0.28);
        g.lineTo(this.width * 0.38, this.height * 0.18);
        g.lineTo(this.width * 0.48, this.height * 0.48);
        g.lineTo(this.width * 0.28, this.height * 0.62);
        g.closePath();

        g.moveTo(this.width * 0.58, this.height * 0.52);
        g.lineTo(this.width * 0.82, this.height * 0.42);
        g.lineTo(this.width * 0.88, this.height * 0.78);
        g.lineTo(this.width * 0.66, this.height * 0.86);
        g.closePath();
        g.stroke({ width: 2, color: this.theme.secondary });
    }

    update(dt) {
        const g = this.adapter.graphics;
        g.clear();

        // 1. Update & build all target circles + velocity vectors, then stroke (PixiJS v8)
        for (const t of this.targets) {
            t.x += t.vx * dt;
            t.y += t.vy * dt;

            if (t.x < 6) { t.x = 6; t.vx *= -1; }
            if (t.x > this.width - 6) { t.x = this.width - 6; t.vx *= -1; }
            if (t.y < 6) { t.y = 6; t.vy *= -1; }
            if (t.y > this.height - 6) { t.y = this.height - 6; t.vy *= -1; }

            g.circle(t.x, t.y, 4);
            g.moveTo(t.x, t.y);
            g.lineTo(t.x + t.vx * 0.45, t.y + t.vy * 0.45);

            if (t.label) {
                t.label.x = Math.min(this.width - 62, t.x + 6);
                t.label.y = Math.max(2, t.y - 6);
            }
        }
        g.stroke({ width: 1, color: this.theme.primary });

        // 2. Radar Sweep Line + Outer Ring (PixiJS v8 build-then-stroke)
        this.scanAngle = (this.scanAngle + dt * 2.0) % (Math.PI * 2);
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.4;

        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(this.scanAngle) * radius, cy + Math.sin(this.scanAngle) * radius);
        g.stroke({ width: 2, color: this.theme.peak, alpha: 0.65 });

        g.circle(cx, cy, radius);
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.8 });

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
