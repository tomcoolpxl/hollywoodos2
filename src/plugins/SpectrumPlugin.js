export class SpectrumPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.binCount = 140;
        this.bins = [];
        this.maxHold = [];
        this.carriers = [];
        this.timer = 0;
        this.sweepPos = 0;
        this.headerLeft = null;
        this.headerRight = null;
        this.markerLabel = null;
        this.footerLabel = null;
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x002200,
            peak: 0x55FF55
        };

        this.adapter = context.createFreeformAdapter();
        this.binCount = 140;
        this.bins = new Array(this.binCount).fill(0.12);
        this.maxHold = new Array(this.binCount).fill(0.15);

        // Narrowband & wideband RF carriers (center bin normalized 0..1, bandwidth, amplitude, drift)
        this.carriers = [
            { pos: 0.18, width: 0.018, amp: 0.68, targetAmp: 0.72, sidebands: true, drift: 0.004 },
            { pos: 0.37, width: 0.011, amp: 0.45, targetAmp: 0.45, sidebands: false, drift: -0.003 },
            { pos: 0.56, width: 0.026, amp: 0.82, targetAmp: 0.85, sidebands: true, drift: 0.002 },
            { pos: 0.74, width: 0.014, amp: 0.52, targetAmp: 0.58, sidebands: false, drift: 0.006 },
            { pos: 0.86, width: 0.019, amp: 0.38, targetAmp: 0.42, sidebands: true, drift: -0.005 }
        ];

        this.drawStaticGraticule();
        this.stepSimulation(0.1);
        this.render();
    }

    drawStaticGraticule() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const padLeft = 34;
        const padRight = 10;
        const padTop = 26;
        const padBottom = 26;
        const plotW = this.width - padLeft - padRight;
        const plotH = this.height - padTop - padBottom;

        // Plot bounding frame & internal RF graticule
        bg.rect(padLeft, padTop, plotW, plotH);
        const rows = 5;
        const cols = 8;
        for (let r = 1; r < rows; r++) {
            const y = padTop + (plotH / rows) * r;
            bg.moveTo(padLeft, y);
            bg.lineTo(padLeft + plotW, y);
        }
        for (let c = 1; c < cols; c++) {
            const x = padLeft + (plotW / cols) * c;
            bg.moveTo(x, padTop);
            bg.lineTo(x, padTop + plotH);
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.7 });

        // dBm reference scale on left axis
        const dbLabels = ['-20', '-40', '-60', '-80', '-100'];
        for (let i = 0; i < dbLabels.length; i++) {
            const y = padTop + (plotH / (dbLabels.length - 1)) * i - 6;
            this.adapter.createLabel(dbLabels[i], {
                fontSize: 9,
                fill: this.theme.secondary,
                x: 4,
                y
            });
        }

        // RF Center/Span frequency labels on bottom axis
        const freqs = ['410M', '415M', '420M', '425M', '430M', '435M', '440M'];
        for (let i = 0; i < freqs.length; i++) {
            const x = padLeft + (plotW / (freqs.length - 1)) * i - 12;
            this.adapter.createLabel(freqs[i], {
                fontSize: 9,
                fill: this.theme.secondary,
                x: Math.max(padLeft, Math.min(this.width - 34, x)),
                y: this.height - 16
            });
        }

        this.headerLeft = this.adapter.createLabel(
            'RF SIGINT // RBW: 10kHz  SPAN: 30MHz',
            {
                fontSize: 10,
                fill: this.theme.primary,
                x: 6,
                y: 6
            }
        );
        this.headerRight = this.adapter.createLabel('MKR1: 426.80 MHz  -24.2 dBm', {
            fontSize: 10,
            fill: this.theme.primary,
            fontWeight: 'bold',
            x: this.width - 6,
            y: 6,
            anchorX: 1,
            anchorY: 0
        });
        this.markerLabel = this.adapter.createLabel('MKR1', {
            fontSize: 9,
            fill: this.theme.primary,
            fontWeight: 'bold',
            x: 100,
            y: 30
        });
    }

    stepSimulation(dt) {
        this.sweepPos = (this.sweepPos + dt * 0.45) % 1.0;

        // Update carrier amplitudes & slow frequency hopping/drift
        for (const c of this.carriers) {
            if (this.rng.chance(0.15)) {
                c.targetAmp = 0.25 + this.rng() * 0.68;
            }
            if (this.rng.chance(0.02)) {
                // Occasional frequency hop
                c.pos = 0.12 + this.rng() * 0.78;
            }
            c.amp += (c.targetAmp - c.amp) * Math.min(1, dt * 4.5);
            c.pos = Math.max(0.08, Math.min(0.92, c.pos + c.drift * dt));
            if (c.pos <= 0.09 || c.pos >= 0.91) c.drift *= -1;
        }

        for (let i = 0; i < this.binCount; i++) {
            const u = i / (this.binCount - 1);
            // Thermal RF noise floor with jagged micro-variations
            let val = 0.06 + this.rng() * 0.08 + Math.sin(u * 37.0 + this.sweepPos * 6.28) * 0.02;

            for (const c of this.carriers) {
                const dist = Math.abs(u - c.pos);
                // Lorentzian/Gaussian carrier spike
                const mainLobe = c.amp * Math.exp(-(dist * dist) / (2 * c.width * c.width));
                val += mainLobe;

                // Modulation sidebands around main carrier
                if (c.sidebands) {
                    const sbDist1 = Math.abs(dist - c.width * 2.6);
                    const sbDist2 = Math.abs(dist - c.width * 4.8);
                    val += c.amp * 0.34 * Math.exp(-(sbDist1 * sbDist1) / (2 * (c.width * 0.65) ** 2));
                    val += c.amp * 0.16 * Math.exp(-(sbDist2 * sbDist2) / (2 * (c.width * 0.55) ** 2));
                }
            }

            val = Math.max(0.04, Math.min(0.95, val));
            this.bins[i] = this.bins[i] * 0.55 + val * 0.45;

            if (this.bins[i] >= this.maxHold[i]) {
                this.maxHold[i] = this.bins[i];
            } else {
                this.maxHold[i] = Math.max(this.bins[i], this.maxHold[i] - dt * 0.08);
            }
        }
    }

    update(dt) {
        this.timer += dt;
        this.stepSimulation(dt);

        if (this.timer >= 0.25) {
            this.timer = 0;
            let peakIdx = 0;
            let peakVal = -1;
            for (let i = 0; i < this.binCount; i++) {
                if (this.bins[i] > peakVal) {
                    peakVal = this.bins[i];
                    peakIdx = i;
                }
            }
            const freqMhz = (410 + (peakIdx / (this.binCount - 1)) * 30).toFixed(2);
            const dbm = (-100 + peakVal * 82).toFixed(1);
            if (this.headerRight) {
                this.headerRight.text = `MKR1: ${freqMhz} MHz  ${dbm} dBm`;
            }
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const padLeft = 34;
        const padRight = 10;
        const padTop = 26;
        const padBottom = 26;
        const plotW = this.width - padLeft - padRight;
        const plotH = this.height - padTop - padBottom;
        const baseY = padTop + plotH;

        // 1. Vertical spectral comb lines under trace (every 2nd bin)
        for (let i = 0; i < this.binCount; i += 2) {
            const x = padLeft + (i / (this.binCount - 1)) * plotW;
            const y = baseY - this.bins[i] * plotH;
            g.moveTo(x, baseY);
            g.lineTo(x, y);
        }
        g.stroke({ width: 1, color: this.theme.dim, alpha: 0.55 });

        // 2. Max-Hold envelope trace (upper ghost curve)
        for (let i = 0; i < this.binCount; i++) {
            const x = padLeft + (i / (this.binCount - 1)) * plotW;
            const y = baseY - this.maxHold[i] * plotH;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });

        // 3. Live high-res RF spectrum trace
        let peakIdx = 0;
        let peakVal = -1;
        for (let i = 0; i < this.binCount; i++) {
            const val = this.bins[i];
            if (val > peakVal) {
                peakVal = val;
                peakIdx = i;
            }
            const x = padLeft + (i / (this.binCount - 1)) * plotW;
            const y = baseY - val * plotH;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.stroke({ width: 1.8, color: this.theme.primary });

        // 4. Noise-floor threshold line (-75 dBm squelch gate)
        const squelchY = baseY - plotH * 0.32;
        for (let x = padLeft; x < padLeft + plotW; x += 12) {
            g.moveTo(x, squelchY);
            g.lineTo(Math.min(padLeft + plotW, x + 6), squelchY);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.45 });

        // 5. Diamond lock marker on dominant carrier peak
        const mx = padLeft + (peakIdx / (this.binCount - 1)) * plotW;
        const my = baseY - peakVal * plotH;
        g.moveTo(mx, my - 6);
        g.lineTo(mx + 5, my);
        g.lineTo(mx, my + 6);
        g.lineTo(mx - 5, my);
        g.closePath();
        g.stroke({ width: 1.5, color: this.theme.primary });

        if (this.markerLabel) {
            this.markerLabel.x = Math.min(this.width - 42, Math.max(padLeft + 4, mx + 7));
            this.markerLabel.y = Math.max(padTop + 2, my - 12);
        }
    }

    destroy() {
        this.bins = [];
        this.maxHold = [];
        this.carriers = [];
        this.headerLeft = null;
        this.headerRight = null;
        this.markerLabel = null;
        this.adapter = null;
    }
}
