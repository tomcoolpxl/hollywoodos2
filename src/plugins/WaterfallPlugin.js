export class WaterfallPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.cols = 56;
        this.rows = 20;
        this.history = [];
        this.tracks = [];
        this.sweepAngle = -0.8;
        this.sweepDir = 1;
        this.scrollTimer = 0;
        this.readoutTimer = 0;
        this.cornerLabels = {};
        this.contactLabels = [];
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
        this.cols = 56;
        this.rows = 20;

        this.tracks = [
            { pos: 0.22, drift: 0.025, width: 0.025, amp: 0.88, name: 'CONTACT-ALPHA' },
            { pos: 0.54, drift: -0.018, width: 0.032, amp: 0.76, name: 'CONTACT-BRAVO' },
            { pos: 0.78, drift: 0.015, width: 0.022, amp: 0.68, name: 'CONTACT-SIERRA' }
        ];

        this.history = [];
        for (let r = 0; r < this.rows; r++) {
            this.pushWaterfallRow(0.1);
        }

        this.drawStaticLayout();

        this.contactLabels = this.tracks.map((t) =>
            this.adapter.createLabel(t.name, {
                fontSize: 9,
                fill: this.theme.primary,
                x: 10,
                y: 10
            })
        );

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                'SOSUS ACOUSTIC WATERFALL // ARRAY: TOWED-64\nBAND: 10 Hz - 4.8 kHz // DEMON-LOFAR\nBEARING RES: 0.25°  GAIN: +18 dB',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'PRIMARY BRG: 042.5°\nDOPPLER: +1.8 kts\nCLASS: SUBSURFACE',
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
                'WATERFALL HISTORY: 60s CASCADE\nNOISE FLOOR: -84 dB // SEA STATE 2',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'TONAL HARMONIC: 50/150 Hz\nCAVITATION: NOMINAL',
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

        this.render(false);
    }

    drawStaticLayout() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const cx = this.width / 2;
        const fanApexY = this.height * 0.44;
        const fanR = Math.min(this.width * 0.36, this.height * 0.35);

        // 1. Azimuth Sector Fan arcs (-75 deg to +75 deg around vertical up)
        const minAng = -Math.PI * 0.42;
        const maxAng = Math.PI * 0.42;
        const steps = 40;
        for (const scale of [0.4, 0.7, 1.0]) {
            const r = fanR * scale;
            for (let i = 0; i <= steps; i++) {
                const a = minAng + (maxAng - minAng) * (i / steps) - Math.PI / 2;
                const x = cx + Math.cos(a) * r;
                const y = fanApexY + Math.sin(a) * r;
                if (i === 0) bg.moveTo(x, y);
                else bg.lineTo(x, y);
            }
        }

        // Radial azimuth spokes
        for (let s = 0; s <= 6; s++) {
            const a = minAng + (maxAng - minAng) * (s / 6) - Math.PI / 2;
            bg.moveTo(cx, fanApexY);
            bg.lineTo(cx + Math.cos(a) * fanR, fanApexY + Math.sin(a) * fanR);
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.75 });

        // 2. Waterfall Spectrogram bounding box in lower half
        const wfLeft = 24;
        const wfTop = Math.floor(this.height * 0.48);
        const wfW = this.width - 48;
        const wfH = Math.floor(this.height * 0.42);
        bg.rect(wfLeft, wfTop, wfW, wfH).stroke({
            width: 1,
            color: this.theme.secondary,
            alpha: 0.65
        });
    }

    pushWaterfallRow(dt) {
        for (const t of this.tracks) {
            t.pos += t.drift * dt + (this.rng() - 0.5) * 0.008;
            if (t.pos < 0.12) {
                t.pos = 0.12;
                t.drift = Math.abs(t.drift);
            }
            if (t.pos > 0.88) {
                t.pos = 0.88;
                t.drift = -Math.abs(t.drift);
            }
            t.amp = Math.max(0.5, Math.min(0.98, t.amp + (this.rng() - 0.5) * 0.08));
        }

        const row = new Array(this.cols);
        for (let c = 0; c < this.cols; c++) {
            const u = c / (this.cols - 1);
            let val = this.rng() * 0.22;
            for (const t of this.tracks) {
                const d = Math.abs(u - t.pos);
                val += t.amp * Math.exp(-(d * d) / (2 * t.width * t.width));
                // Harmonic sideband line
                const d2 = Math.abs(u - (t.pos + 0.06));
                val += t.amp * 0.42 * Math.exp(-(d2 * d2) / (2 * (t.width * 0.7) ** 2));
            }
            row[c] = Math.min(1.0, val);
        }

        this.history.unshift(row);
        if (this.history.length > this.rows) {
            this.history.pop();
        }
    }

    update(dt, state) {
        this.scrollTimer += dt;
        this.readoutTimer += dt;

        // Sweep hydrophone beam back and forth across sector fan
        this.sweepAngle += this.sweepDir * dt * 0.85;
        if (this.sweepAngle > Math.PI * 0.40) {
            this.sweepAngle = Math.PI * 0.40;
            this.sweepDir = -1;
        } else if (this.sweepAngle < -Math.PI * 0.40) {
            this.sweepAngle = -Math.PI * 0.40;
            this.sweepDir = 1;
        }

        if (this.scrollTimer >= 0.14) {
            this.scrollTimer = 0;
            this.pushWaterfallRow(0.14);
        }

        if (this.readoutTimer >= 0.35 && this.cornerLabels.topRight) {
            this.readoutTimer = 0;
            const brg = (this.tracks[0].pos * 150 - 75 + 360) % 360;
            const doppler = (1.2 + this.rng() * 1.4).toFixed(1);
            const alertPrefix = state?.alertActive ? '[! LOCK !] ' : '';
            this.cornerLabels.topRight.text =
                `${alertPrefix}BRG: ${brg.toFixed(1).padStart(5, '0')}°\n` +
                `DOPPLER: +${doppler} kts\n` +
                `CLASS: SUBSURFACE`;
        }

        this.render(Boolean(state?.alertActive));
    }

    render(alertActive = false) {
        const g = this.adapter.graphics;
        g.clear();

        const cx = this.width / 2;
        const fanApexY = this.height * 0.44;
        const fanR = Math.min(this.width * 0.36, this.height * 0.35);
        const minAng = -Math.PI * 0.42;
        const maxAng = Math.PI * 0.42;

        // 1. Draw Active Sweep Beam in Azimuth Fan
        const beamAng = this.sweepAngle - Math.PI / 2;
        g.moveTo(cx, fanApexY);
        g.lineTo(cx + Math.cos(beamAng) * fanR, fanApexY + Math.sin(beamAng) * fanR);
        g.stroke({ width: 2, color: this.theme.primary, alpha: 0.85 });

        // 2. Draw Contact Bearing Vectors & Reticles in Azimuth Fan
        for (let i = 0; i < this.tracks.length; i++) {
            const t = this.tracks[i];
            const ang = minAng + (maxAng - minAng) * t.pos - Math.PI / 2;
            const dist = fanR * (0.55 + (i % 2) * 0.25);
            const tx = cx + Math.cos(ang) * dist;
            const ty = fanApexY + Math.sin(ang) * dist;

            g.moveTo(cx, fanApexY);
            g.lineTo(tx, ty);
            g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.55 });

            g.rect(tx - 5, ty - 5, 10, 10).stroke({
                width: i === 0 && alertActive ? 2 : 1,
                color: this.theme.primary
            });
            g.rect(tx - 2, ty - 2, 4, 4).fill(this.theme.primary);

            if (this.contactLabels[i]) {
                this.contactLabels[i].x = Math.min(this.width - 95, Math.max(8, tx + 8));
                this.contactLabels[i].y = Math.max(42, ty - 6);
            }
        }

        // 3. Draw Scrolling Density Waterfall Spectrogram
        const wfLeft = 26;
        const wfTop = Math.floor(this.height * 0.48) + 2;
        const wfW = this.width - 52;
        const wfH = Math.floor(this.height * 0.42) - 4;
        const cellW = wfW / this.cols;
        const cellH = wfH / this.rows;

        // Batch cells by 3 intensity tiers for fast PixiJS v8 rendering
        for (let r = 0; r < this.history.length; r++) {
            const row = this.history[r];
            const y = wfTop + r * cellH;
            for (let c = 0; c < this.cols; c++) {
                const v = row[c];
                if (v >= 0.22 && v < 0.48) {
                    g.rect(wfLeft + c * cellW, y, Math.max(1.5, cellW - 1.5), Math.max(1.5, cellH - 1.5));
                }
            }
        }
        g.fill({ color: this.theme.dim, alpha: 0.85 });

        for (let r = 0; r < this.history.length; r++) {
            const row = this.history[r];
            const y = wfTop + r * cellH;
            for (let c = 0; c < this.cols; c++) {
                const v = row[c];
                if (v >= 0.48 && v < 0.74) {
                    g.rect(wfLeft + c * cellW, y, Math.max(1.5, cellW - 1.5), Math.max(1.5, cellH - 1.5));
                }
            }
        }
        g.fill({ color: this.theme.secondary, alpha: 0.85 });

        for (let r = 0; r < this.history.length; r++) {
            const row = this.history[r];
            const y = wfTop + r * cellH;
            for (let c = 0; c < this.cols; c++) {
                const v = row[c];
                if (v >= 0.74) {
                    g.rect(wfLeft + c * cellW, y, Math.max(1.5, cellW - 1.5), Math.max(1.5, cellH - 1.5));
                }
            }
        }
        g.fill({ color: this.theme.primary, alpha: 0.98 });
    }

    destroy() {
        this.history = [];
        this.tracks = [];
        this.contactLabels = [];
        this.cornerLabels = {};
        this.adapter = null;
    }
}
