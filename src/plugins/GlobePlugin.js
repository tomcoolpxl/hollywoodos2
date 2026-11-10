export class GlobePlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.rotation = 0;
        this.rotationSpeed = 0.5;
        this.vertices = [];
        this.lines = [];
        this.cornerTexts = [];
        this.timer = 0;
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x003300
        };
        this.rotationSpeed = context.options?.rotationSpeed ?? 0.5;

        this.adapter = context.createFreeformAdapter();

        const pad = 10;
        this.cornerTexts = [
            this.adapter.createLabel('LAT: 00.00 N', {
                fontSize: 10,
                fill: this.theme.primary,
                x: pad,
                y: pad
            }),
            this.adapter.createLabel('LNG: 00.00 W', {
                fontSize: 10,
                fill: this.theme.primary,
                x: this.width - pad,
                y: pad,
                anchorX: 1,
                anchorY: 0
            }),
            this.adapter.createLabel('MODE: SCAN', {
                fontSize: 10,
                fill: this.theme.primary,
                x: pad,
                y: this.height - pad,
                anchorX: 0,
                anchorY: 1
            }),
            this.adapter.createLabel('ZOOM: 1.0X', {
                fontSize: 10,
                fill: this.theme.primary,
                x: this.width - pad,
                y: this.height - pad,
                anchorX: 1,
                anchorY: 1
            })
        ];

        const r = 1;
        const lats = context.options?.lats ?? 12;
        const longs = context.options?.longs ?? 16;

        this.vertices = [];
        this.lines = [];

        // Latitude Rings
        for (let i = 1; i < lats; i++) {
            const lat = Math.PI * (i / lats) - Math.PI / 2;
            const y = Math.sin(lat) * r;
            const ringR = Math.cos(lat) * r;

            for (let j = 0; j <= longs; j++) {
                const long = (Math.PI * 2 * j) / longs;
                const x = Math.sin(long) * ringR;
                const z = Math.cos(long) * ringR;
                this.vertices.push({ x, y, z });

                if (j > 0) {
                    this.lines.push([this.vertices.length - 2, this.vertices.length - 1]);
                }
            }
        }

        // Longitude Lines
        for (let j = 0; j < longs; j++) {
            const long = (Math.PI * 2 * j) / longs;
            const cosLong = Math.cos(long);
            const sinLong = Math.sin(long);

            const segs = 16;
            for (let i = 0; i <= segs; i++) {
                const lat = Math.PI * (i / segs) - Math.PI / 2;
                const y = Math.sin(lat) * r;
                const ringR = Math.cos(lat) * r;
                const x = sinLong * ringR;
                const z = cosLong * ringR;

                this.vertices.push({ x, y, z });
                if (i > 0) {
                    this.lines.push([this.vertices.length - 2, this.vertices.length - 1]);
                }
            }
        }

        this.render();
    }

    update(dt) {
        this.rotation += dt * this.rotationSpeed;
        this.timer += dt;

        if (this.timer >= 0.2) {
            this.timer = 0;
            this.cornerTexts[0].text = `LAT: ${(this.rng() * 90).toFixed(2)} N`;
            this.cornerTexts[1].text = `LNG: ${(this.rng() * 180).toFixed(2)} W`;
            this.cornerTexts[3].text = `ZOOM: ${(1.0 + this.rng()).toFixed(1)}X`;
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.35;

        const tilt = 0.4;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);

        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        const proj = this.vertices.map((v) => {
            const x = v.x * cosR - v.z * sinR;
            const z = v.x * sinR + v.z * cosR;
            const y = v.y;

            const y2 = y * cosT - z * sinT;
            return {
                x: cx + x * scale,
                y: cy + y2 * scale
            };
        });

        // PixiJS v8: Build all wireframe segments first, then call .stroke()
        for (const [i1, i2] of this.lines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
        }
        g.stroke({ width: 1, color: this.theme.primary, alpha: 0.85 });

        // PixiJS v8: Build outer horizon circle, then call .stroke()
        g.circle(cx, cy, scale);
        g.stroke({ width: 2, color: this.theme.primary });
    }

    destroy() {
        this.vertices = [];
        this.lines = [];
        this.cornerTexts = [];
        this.adapter = null;
    }
}
