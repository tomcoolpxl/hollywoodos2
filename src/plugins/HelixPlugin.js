const BASES = ['A-T', 'T-A', 'G-C', 'C-G'];

export class HelixPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.phase = 0;
        this.scanNorm = 0.5;
        this.scanDir = 1;
        this.rungs = [];
        this.readoutTimer = 0;
        this.cornerLabels = {};
        this.scanLabel = null;
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

        const rungCount = 26;
        this.rungs = [];
        for (let i = 0; i < rungCount; i++) {
            this.rungs.push({
                pair: this.rng.pick(BASES),
                mutated: i === 9 || i === 18
            });
        }

        this.drawStaticFrame();

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                'GENOMIC LATTICE // LOCUS: CHR-17q21.31\nPOLYMERASE READ: 5\' -> 3\' [SYNCHRONIZED]\nHOMOLOGY: 99.84%  GC-CONTENT: 54.2%',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'CODON: ATG-GGC-TAC\nHELIX PITCH: 3.4 nm\nTORSION: 36.0°/BP',
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
                'ANOMALY SCAN: 2 POLYMORPHIC LOCI FLAGGED\nVECTOR: CRISPR-CAS9 // PAM: NGG LOCKED',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'MOL WEIGHT: 18.4 kDa\nTHERMAL Tm: 84.2°C',
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

        this.scanLabel = this.adapter.createLabel('Z-SCAN // BP #12 [G-C]', {
            fontSize: 9,
            fill: this.theme.primary,
            fontWeight: 'bold',
            x: 16,
            y: this.height / 2
        });

        this.render();
    }

    drawStaticFrame() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const cx = this.width / 2;
        const topY = 48;
        const botY = this.height - 38;
        const radius = Math.min(this.width * 0.24, 130);

        // Central axis & bounding vertical measurement rails
        bg.moveTo(cx, topY);
        bg.lineTo(cx, botY);
        bg.moveTo(cx - radius - 22, topY);
        bg.lineTo(cx - radius - 22, botY);
        bg.moveTo(cx + radius + 22, topY);
        bg.lineTo(cx + radius + 22, botY);

        for (let y = topY; y <= botY; y += 16) {
            bg.moveTo(cx - radius - 26, y);
            bg.lineTo(cx - radius - 18, y);
            bg.moveTo(cx + radius + 18, y);
            bg.lineTo(cx + radius + 26, y);
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.7 });
    }

    update(dt) {
        this.phase += dt * 1.15;
        this.scanNorm += this.scanDir * dt * 0.22;
        if (this.scanNorm > 0.92) {
            this.scanNorm = 0.92;
            this.scanDir = -1;
        } else if (this.scanNorm < 0.08) {
            this.scanNorm = 0.08;
            this.scanDir = 1;
        }

        this.readoutTimer += dt;
        if (this.readoutTimer >= 0.3 && this.cornerLabels.topRight) {
            this.readoutTimer = 0;
            const c1 = this.rng.pick(['ATG', 'CGA', 'TAC', 'GGC', 'TTA', 'CAG']);
            const c2 = this.rng.pick(['GTC', 'AAC', 'CCG', 'TGG', 'CAT', 'GAG']);
            const c3 = this.rng.pick(['TGA', 'CCA', 'GGA', 'TTC', 'AGC', 'CTG']);
            this.cornerLabels.topRight.text =
                `CODON: ${c1}-${c2}-${c3}\n` +
                `HELIX PITCH: 3.4 nm\n` +
                `TORSION: 36.0°/BP`;
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const cx = this.width / 2;
        const topY = 50;
        const botY = this.height - 40;
        const spanH = botY - topY;
        const radius = Math.min(this.width * 0.22, 120);
        const n = this.rungs.length;

        const strandA = [];
        const strandB = [];

        for (let i = 0; i < n; i++) {
            const u = i / (n - 1);
            const y = topY + u * spanH;
            const angle = u * Math.PI * 3.6 - this.phase;
            const xA = cx + Math.sin(angle) * radius;
            const zA = Math.cos(angle);
            const xB = cx + Math.sin(angle + Math.PI) * radius;
            const zB = Math.cos(angle + Math.PI);

            strandA.push({ x: xA, y, z: zA });
            strandB.push({ x: xB, y, z: zB });
        }

        // 1. Base-pair hydrogen bond rungs (back-facing dimmed, front-facing brighter)
        for (let i = 0; i < n; i++) {
            const a = strandA[i];
            const b = strandB[i];
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.55 });

        // 2. Dual phosphate backbone curves
        for (let i = 0; i < n; i++) {
            if (i === 0) g.moveTo(strandA[i].x, strandA[i].y);
            else g.lineTo(strandA[i].x, strandA[i].y);
        }
        for (let i = 0; i < n; i++) {
            if (i === 0) g.moveTo(strandB[i].x, strandB[i].y);
            else g.lineTo(strandB[i].x, strandB[i].y);
        }
        g.stroke({ width: 2, color: this.theme.primary, alpha: 0.9 });

        // 3. Nucleotide nodes & polymorphic mutation markers
        for (let i = 0; i < n; i++) {
            const a = strandA[i];
            const b = strandB[i];
            const rA = a.z >= 0 ? 3.5 : 2.2;
            const rB = b.z >= 0 ? 3.5 : 2.2;
            g.circle(a.x, a.y, rA).fill(a.z >= 0 ? this.theme.primary : this.theme.dim);
            g.circle(b.x, b.y, rB).fill(b.z >= 0 ? this.theme.primary : this.theme.dim);

            if (this.rungs[i].mutated) {
                const mx = (a.x + b.x) / 2;
                const my = a.y;
                g.rect(mx - 6, my - 6, 12, 12).stroke({ width: 1.5, color: this.theme.primary });
            }
        }

        // 4. Active Laser Z-Plane Scanner Bar
        const scanY = topY + this.scanNorm * spanH;
        const activeIdx = Math.min(n - 1, Math.max(0, Math.round(this.scanNorm * (n - 1))));
        g.moveTo(cx - radius - 30, scanY);
        g.lineTo(cx + radius + 30, scanY);
        g.stroke({ width: 1.5, color: this.theme.primary, alpha: 0.85 });

        if (this.scanLabel) {
            const bp = this.rungs[activeIdx];
            this.scanLabel.text = `Z-SCAN // BP #${String(activeIdx + 1).padStart(2, '0')} [${bp.pair}]${bp.mutated ? ' *MUT*' : ''}`;
            this.scanLabel.x = Math.min(this.width - 155, cx + radius + 34);
            this.scanLabel.y = Math.min(botY - 12, Math.max(topY, scanY - 6));
        }
    }

    destroy() {
        this.rungs = [];
        this.cornerLabels = {};
        this.scanLabel = null;
        this.adapter = null;
    }
}
