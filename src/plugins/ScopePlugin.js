export class ScopePlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.phase = 0;
        this.modeTimer = 0;
        this.packetTimer = 0;
        this.mode = 'wave'; // 'wave' | 'lissajous'
        this.freqA = 3.0;
        this.freqB = 2.0;
        this.readoutTimer = 0;
        this.packets = [];
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

        this.generateWavePackets();
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
                'TRIG: AUTO [PULSE +1.2V]\nSAMPLE: 2.4 GS/s  12-BIT\nBURST LEN: 142 us',
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
                'MODE: CHIRP-BURST TELEMETRY\nMOD: BPSK/QPSK PACKET ENVELOPE // SYNC',
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

    generateWavePackets() {
        // Non-uniform modulated wave-packets (center 0..1, width, carrier freq, chirp rate, amp, phase flip)
        this.packets = [
            {
                center: 0.16 + this.rng() * 0.08,
                width: 0.055 + this.rng() * 0.04,
                freq: 9 + this.rng.int(0, 8),
                chirp: 14 + this.rng() * 12,
                amp: 0.65 + this.rng() * 0.35,
                phaseFlip: this.rng() * Math.PI
            },
            {
                center: 0.46 + this.rng() * 0.1,
                width: 0.075 + this.rng() * 0.05,
                freq: 14 + this.rng.int(0, 12),
                chirp: -18 + this.rng() * 36,
                amp: 0.75 + this.rng() * 0.25,
                phaseFlip: this.rng() * Math.PI
            },
            {
                center: 0.78 + this.rng() * 0.08,
                width: 0.045 + this.rng() * 0.045,
                freq: 7 + this.rng.int(0, 10),
                chirp: 20 + this.rng() * 15,
                amp: 0.55 + this.rng() * 0.4,
                phaseFlip: this.rng() * Math.PI
            }
        ];
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
        this.phase += dt * 0.85;
        this.modeTimer += dt;
        this.packetTimer += dt;
        this.readoutTimer += dt;

        // Slowly drift packet envelopes & modulate amplitudes so waveform is organic and non-repetitive
        for (const pkt of this.packets) {
            pkt.center = (pkt.center + dt * 0.035) % 1.0;
        }
        if (this.packetTimer >= 2.4) {
            this.packetTimer = 0;
            const targetPkt = this.rng.pick(this.packets);
            targetPkt.freq = 6 + this.rng.int(0, 14);
            targetPkt.amp = 0.45 + this.rng() * 0.55;
            targetPkt.width = 0.04 + this.rng() * 0.065;
        }

        if (this.modeTimer >= 10.0) {
            this.modeTimer = 0;
            this.mode = this.mode === 'wave' ? 'lissajous' : 'wave';
            this.freqA = 2 + this.rng.int(0, 4);
            this.freqB = 3 + this.rng.int(0, 4);
            this.labels.bottomLeft.text =
                this.mode === 'wave'
                    ? 'MODE: CHIRP-BURST TELEMETRY\nMOD: BPSK/QPSK PACKET ENVELOPE // SYNC'
                    : `MODE: VECTOR PHASE CONSTELLATION (${this.freqA}:${this.freqB})\nORTHOGONAL HARMONIC CORRELATOR`;
        }

        if (this.readoutTimer >= 0.3) {
            this.readoutTimer = 0;
            const mhz = (420 + this.rng() * 4.5).toFixed(2);
            const snr = (27.8 + this.rng() * 1.4).toFixed(1);
            const thd = (0.035 + this.rng() * 0.015).toFixed(3);
            const vpp = (9.6 + this.rng() * 0.45).toFixed(2);
            const vrms = (Number(vpp) * 0.3535).toFixed(2);
            const burst = 110 + this.rng.int(0, 75);

            this.labels.topLeft.text =
                `CH1: 5.0V/DIV  CH2: 2.5V/DIV  TIME: 2.0ms\n` +
                `CARRIER: ${mhz} MHz  PHASE: ${(this.phase % 6.28).toFixed(2)} rad\n` +
                `SNR: +${snr} dB  THD: ${thd}%  PLL: LOCKED`;

            this.labels.topRight.text =
                `TRIG: AUTO [PULSE +1.2V]\n` +
                `SAMPLE: 2.4 GS/s  12-BIT\n` +
                `BURST LEN: ${burst} us`;

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
            const samples = 180;
            const amp = this.height * 0.30;

            // CH2: Stepped digital clock / BPSK sync envelope trace (secondary trace)
            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                const x = t * this.width;
                const gate =
                    Math.sin(t * 19.0 - this.phase * 0.9) *
                    Math.cos(t * 7.0 + this.phase * 0.4);
                const squareStep = gate > 0.22 ? 0.38 : gate < -0.22 ? -0.38 : 0.0;
                const y = cy + squareStep * amp;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.6 });

            // CH1: Non-periodic chirp wave-packet bursts + transient spikes + baseline noise
            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                const x = t * this.width;

                // Baseline irregular multi-frequency carrier + noise floor
                let signal =
                    Math.sin(t * 11.0 + this.phase) *
                    Math.sin(t * 3.7 - this.phase * 0.6) *
                    0.18 +
                    (this.rng() - 0.5) * 0.05;

                // Superimpose localized chirp bursts & phase-flipped wave packets
                for (const pkt of this.packets) {
                    let d = t - pkt.center;
                    if (d > 0.5) d -= 1.0;
                    if (d < -0.5) d += 1.0;

                    const env = Math.exp(-(d * d) / (2 * pkt.width * pkt.width));
                    if (env > 0.01) {
                        const instPhase =
                            d * pkt.freq * Math.PI * 2 +
                            d * d * pkt.chirp * Math.PI +
                            this.phase * 1.4 +
                            pkt.phaseFlip;
                        // Asymmetric harmonic distortion inside burst
                        const carrier =
                            Math.sin(instPhase) * 0.75 +
                            Math.sin(instPhase * 2.3 + 0.8) * 0.25;
                        signal += env * pkt.amp * carrier;
                    }
                }

                signal = Math.max(-1.05, Math.min(1.05, signal));
                const y = cy + signal * amp;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 1.8, color: this.theme.primary });
        } else {
            // Modulated multi-lobe damped vector phase constellation
            const steps = 200;
            const maxR = Math.min(this.width, this.height) * 0.34;

            for (let i = 0; i <= steps; i++) {
                const u = i / steps;
                const t = u * Math.PI * 4;
                const modEnv = 0.55 + 0.45 * Math.cos(u * Math.PI * 3 - this.phase * 0.8);
                const x =
                    cx +
                    (Math.sin(this.freqA * t + this.phase * 0.5) * 0.78 +
                        Math.cos((this.freqB + 1) * t - this.phase * 0.3) * 0.22) *
                        maxR *
                        modEnv;
                const y =
                    cy +
                    (Math.sin(this.freqB * t) * 0.78 +
                        Math.sin((this.freqA + 2) * t + this.phase * 0.4) * 0.22) *
                        maxR *
                        modEnv;
                if (i === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ width: 1.8, color: this.theme.primary });
        }
    }

    destroy() {
        this.packets = [];
        this.labels = {};
        this.adapter = null;
    }
}
