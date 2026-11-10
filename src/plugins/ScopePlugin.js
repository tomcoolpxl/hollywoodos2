export class ScopePlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.phase = 0;
        this.modeTimer = 0;
        this.mode = 'wave'; // 'wave' | 'lissajous'
        this.freqA = 3.0;
        this.freqB = 2.0;
        this.noiseAmp = 0.04;
        this.readoutTimer = 0;
        this.labels = [];
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
        this.freqA = 2.0 + this.rng.int(0, 3);
        this.freqB = 3.0 + this.rng.int(0, 3);

        this.drawGraticule();

        this.labels = [
            this.adapter.createLabel('CH1: 5.0V/DIV  TIME: 2.0ms', {
                fontSize: 10,
                fill: this.theme.primary,
                x: 8,
                y: 6
            }),
            this.adapter.createLabel('MODE: DUAL HARMONIC', {
                fontSize: 10,
                fill: this.theme.secondary,
                x: 8,
                y: this.height - 18
            })
        ];

        this.renderScope();
    }

    drawGraticule() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const cols = 8;
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

        // Center crosshair ticks
        const cx = this.width / 2;
        const cy = this.height / 2;
        for (let x = 0; x <= this.width; x += 12) {
            bg.moveTo(x, cy - 3);
            bg.lineTo(x, cy + 3);
        }
        for (let y = 0; y <= this.height; y += 12) {
            bg.moveTo(cx - 3, y);
            bg.lineTo(cx + 3, y);
        }
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });
    }

    update(dt) {
        this.phase += dt * 4.5;
        this.modeTimer += dt;
        this.readoutTimer += dt;

        if (this.modeTimer >= 5.0) {
            this.modeTimer = 0;
            this.mode = this.mode === 'wave' ? 'lissajous' : 'wave';
            this.freqA = 2 + this.rng.int(0, 4);
            this.freqB = 3 + this.rng.int(0, 4);
            this.labels[1].text =
                this.mode === 'wave'
                    ? `MODE: HARMONIC (${this.freqA}:${this.freqB})`
                    : `MODE: LISSAJOUS XY (${this.freqA}:${this.freqB})`;
        }

        if (this.readoutTimer >= 0.25) {
            this.readoutTimer = 0;
            const mhz = (420 + this.rng() * 8.5).toFixed(2);
            this.labels[0].text = `CARRIER: ${mhz} MHz  PHASE: ${(this.phase % 6.28).toFixed(2)} rad`;
        }

        this.renderScope();
    }

    renderScope() {
        const g = this.adapter.graphics;
        g.clear();

        const cx = this.width / 2;
        const cy = this.height / 2;

        if (this.mode === 'wave') {
            const samples = 120;
            const amp = this.height * 0.32;

            // Secondary harmonic carrier
            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                const x = t * this.width;
                const y =
                    cy +
                    Math.sin(t * Math.PI * 2 * this.freqB - this.phase * 0.7) * (amp * 0.55);
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 1.5, color: this.theme.secondary, alpha: 0.7 });

            // Primary composite signal
            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                const x = t * this.width;
                const jitter = (this.rng() - 0.5) * this.noiseAmp * amp;
                const wave =
                    Math.sin(t * Math.PI * 2 * this.freqA + this.phase) * 0.65 +
                    Math.cos(t * Math.PI * 2 * (this.freqB * 1.5) - this.phase * 1.3) * 0.35;
                const y = cy + wave * amp + jitter;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 2, color: this.theme.primary });
        } else {
            // Lissajous X-Y Phase Curve
            const steps = 160;
            const rx = Math.min(this.width, this.height) * 0.36;
            const ry = Math.min(this.width, this.height) * 0.36;

            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * Math.PI * 2;
                const x = cx + Math.sin(this.freqA * t + this.phase * 0.6) * rx;
                const y = cy + Math.sin(this.freqB * t) * ry;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 2, color: this.theme.primary });
        }
    }

    destroy() {
        this.labels = [];
        this.adapter = null;
    }
}
