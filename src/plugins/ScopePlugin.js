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
        this.noiseAmp = 0.01;
        this.readoutTimer = 0;
        this.labels = {};
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

        const pad = 8;
        this.labels = {
            topLeft: this.adapter.createLabel(
                'CH1: 5.0V/DIV  CH2: 2.5V/DIV  TIME: 2.0ms\nCARRIER: 421.80 MHz  PHASE: 0.00 rad\nSNR: +28.4 dB  THD: 0.041%  PLL: LOCKED',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'TRIG: AUTO [RISING +1.2V]\nSAMPLE: 2.4 GS/s  12-BIT\nFFT PEAK: 14.22 kHz',
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
                `MODE: DUAL HARMONIC (${this.freqA}:${this.freqB})\nMOD: QPSK-ORTHOGONAL // SUB-CARRIER SYNC`,
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'Vpp: 9.84V   Vrms: 3.48V\nDELTA-T: 0.412ms  DUTY: 49.8%',
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
        this.phase += dt * 0.8;
        this.modeTimer += dt;
        this.readoutTimer += dt;

        if (this.modeTimer >= 10.0) {
            this.modeTimer = 0;
            this.mode = this.mode === 'wave' ? 'lissajous' : 'wave';
            this.freqA = 2 + this.rng.int(0, 4);
            this.freqB = 3 + this.rng.int(0, 4);
            this.labels.bottomLeft.text =
                this.mode === 'wave'
                    ? `MODE: DUAL HARMONIC (${this.freqA}:${this.freqB})\nMOD: QPSK-ORTHOGONAL // SUB-CARRIER SYNC`
                    : `MODE: LISSAJOUS XY (${this.freqA}:${this.freqB})\nVECTOR PHASE CORRELATION // ORTHO-LOCK`;
        }

        if (this.readoutTimer >= 0.3) {
            this.readoutTimer = 0;
            const mhz = (420 + this.rng() * 4.5).toFixed(2);
            const snr = (27.8 + this.rng() * 1.4).toFixed(1);
            const thd = (0.035 + this.rng() * 0.015).toFixed(3);
            const vpp = (9.6 + this.rng() * 0.45).toFixed(2);
            const vrms = (Number(vpp) * 0.3535).toFixed(2);
            const fft = (14.1 + this.rng() * 0.35).toFixed(2);

            this.labels.topLeft.text =
                `CH1: 5.0V/DIV  CH2: 2.5V/DIV  TIME: 2.0ms\n` +
                `CARRIER: ${mhz} MHz  PHASE: ${(this.phase % 6.28).toFixed(2)} rad\n` +
                `SNR: +${snr} dB  THD: ${thd}%  PLL: LOCKED`;

            this.labels.topRight.text =
                `TRIG: AUTO [RISING +1.2V]\n` +
                `SAMPLE: 2.4 GS/s  12-BIT\n` +
                `FFT PEAK: ${fft} kHz`;

            this.labels.bottomRight.text =
                `Vpp: ${vpp}V   Vrms: ${vrms}V\n` +
                `DELTA-T: 0.412ms  DUTY: ${(49.5 + this.rng() * 0.8).toFixed(1)}%`;
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
            const amp = this.height * 0.28;

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
            const rx = Math.min(this.width, this.height) * 0.32;
            const ry = Math.min(this.width, this.height) * 0.32;

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
        this.labels = {};
        this.adapter = null;
    }
}
