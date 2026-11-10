export class OrbitPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.satellites = [];
        this.statusLabel = null;
        this.timer = 0;
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
        this.drawWorldGrid();

        const satDefs = [
            { name: 'KH-12 KEYHOLE', amp: 0.36, freq: 1.0, speed: 0.011, phase: 0.2 },
            { name: 'LACROSSE-5', amp: 0.28, freq: 1.5, speed: 0.015, phase: 2.1 },
            { name: 'ORION-SIGINT', amp: 0.41, freq: 2.0, speed: 0.0085, phase: 4.0 }
        ];

        this.satellites = satDefs.map((def) => {
            const label = this.adapter.createLabel(def.name, {
                fontSize: 10,
                fill: this.theme.peak,
                x: 10,
                y: 10
            });
            return {
                ...def,
                lonNorm: this.rng(), // 0..1 across map width
                label
            };
        });

        this.statusLabel = this.adapter.createLabel('ORBITAL TRACKING // INC: 63.4 DEG  ALT: 412 KM', {
            fontSize: 10,
            fill: this.theme.primary,
            x: 8,
            y: this.height - 16
        });

        this.renderOrbits();
    }

    drawWorldGrid() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const cols = 12;
        const rows = 6;
        for (let i = 1; i < cols; i++) {
            const x = (this.width / cols) * i;
            bg.moveTo(x, 0);
            bg.lineTo(x, this.height);
        }
        for (let j = 1; j < rows; j++) {
            const y = (this.height / rows) * j;
            bg.moveTo(0, y);
            bg.lineTo(this.width, y);
        }
        bg.stroke({ width: 1, color: this.theme.dim });

        // Equator line
        const eqY = this.height / 2;
        bg.moveTo(0, eqY);
        bg.lineTo(this.width, eqY);
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });
    }

    update(dt) {
        this.timer += dt;

        for (const sat of this.satellites) {
            sat.lonNorm = (sat.lonNorm + sat.speed * dt) % 1.0;
        }

        if (this.timer >= 0.4) {
            this.timer = 0;
            const primarySat = this.satellites[0];
            const lonDeg = (primarySat.lonNorm * 360 - 180).toFixed(1);
            const vel = (7.65 + this.rng() * 0.04).toFixed(2);
            this.statusLabel.text = `TRACK: ${primarySat.name}  LON: ${lonDeg}°  VEL: ${vel} KM/S`;
        }

        this.renderOrbits();
    }

    renderOrbits() {
        const g = this.adapter.graphics;
        g.clear();

        const cy = this.height / 2;
        const steps = 100;

        for (let s = 0; s < this.satellites.length; s++) {
            const sat = this.satellites[s];

            // 1. Sinusoidal ground track curve
            for (let i = 0; i <= steps; i++) {
                const u = i / steps;
                const x = u * this.width;
                const y = cy + Math.sin(u * Math.PI * 2 * sat.freq + sat.phase) * (this.height * sat.amp);
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({
                width: s === 0 ? 1.5 : 1,
                color: s === 0 ? this.theme.primary : this.theme.secondary,
                alpha: s === 0 ? 0.85 : 0.55
            });

            // 2. Current satellite position & footprint ring
            const satX = sat.lonNorm * this.width;
            const satY =
                cy + Math.sin(sat.lonNorm * Math.PI * 2 * sat.freq + sat.phase) * (this.height * sat.amp);

            g.circle(satX, satY, 18).stroke({ width: 1, color: this.theme.primary, alpha: 0.45 });
            g.rect(satX - 3, satY - 3, 6, 6).fill(this.theme.peak);

            sat.label.x = Math.min(this.width - 95, Math.max(4, satX + 8));
            sat.label.y = Math.min(this.height - 28, Math.max(4, satY - 8));
        }
    }

    destroy() {
        this.satellites = [];
        this.statusLabel = null;
        this.adapter = null;
    }
}
