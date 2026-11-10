import { WORLD_COASTLINES } from '../core/WorldMapData.js';

export class GlobePlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.rotation = 0;
        this.rotationSpeed = 0.45;
        this.vertices = [];
        this.lines = [];
        this.coastLines = [];
        this.beacons = [];
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
            dim: 0x003300,
            peak: 0x55FF55
        };
        this.rotationSpeed = context.options?.rotationSpeed ?? 0.45;

        this.adapter = context.createFreeformAdapter();

        const pad = 8;
        this.cornerTexts = [
            this.adapter.createLabel('LAT: 34.12 N\nALT: 35,786 KM\nINCL: 23.44°', {
                fontSize: 10,
                lineHeight: 13,
                fill: this.theme.primary,
                x: pad,
                y: pad
            }),
            this.adapter.createLabel('LNG: 118.40 W\nAZIMUTH: 142.8°\nSYNC: GEO-LOCK', {
                fontSize: 10,
                lineHeight: 13,
                fill: this.theme.secondary,
                x: this.width - pad,
                y: pad,
                anchorX: 1,
                anchorY: 0
            }),
            this.adapter.createLabel('MODE: GLOBAL RADAR SCAN\nGRID: WGS-84 GEODESIC', {
                fontSize: 10,
                lineHeight: 13,
                fill: this.theme.secondary,
                x: pad,
                y: this.height - pad,
                anchorX: 0,
                anchorY: 1
            }),
            this.adapter.createLabel('ZOOM: 1.0X\nFOV: 45.0°', {
                fontSize: 10,
                lineHeight: 13,
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
        this.coastLines = [];

        // 1. Latitude Graticule Rings
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

        // 2. Longitude Graticule Lines
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

        // 3. Real 3D World Coastlines projected onto the unit sphere
        for (const poly of WORLD_COASTLINES) {
            for (let i = 0; i < poly.length; i++) {
                const lonRad = (poly[i][0] * Math.PI) / 180;
                const latRad = (-poly[i][1] * Math.PI) / 180; // screen Y is down
                const y = Math.sin(latRad) * r;
                const ringR = Math.cos(latRad) * r;
                const x = Math.sin(lonRad) * ringR;
                const z = Math.cos(lonRad) * ringR;
                this.vertices.push({ x, y, z });
                if (i > 0) {
                    this.coastLines.push([this.vertices.length - 2, this.vertices.length - 1]);
                }
            }
        }

        // Surface tactical beacons
        this.beacons = [
            { lat: -0.65, lon: -1.3 }, // North America
            { lat: -0.88, lon: 0.05 }, // Europe
            { lat: 0.42, lon: 2.33 },  // Australia (Pine Gap)
            { lat: -0.62, lon: 2.44 }  // East Asia
        ];

        this.render();
    }

    update(dt) {
        this.rotation += dt * this.rotationSpeed;
        this.timer += dt;

        if (this.timer >= 0.35) {
            this.timer = 0;
            const lat = (20 + this.rng() * 50).toFixed(2);
            const lng = (60 + this.rng() * 110).toFixed(2);
            const az = (((this.rotation * 180) / Math.PI) % 360).toFixed(1);
            this.cornerTexts[0].text = `LAT: ${lat} N\nALT: 35,786 KM\nINCL: 23.44°`;
            this.cornerTexts[1].text = `LNG: ${lng} W\nAZIMUTH: ${az}°\nSYNC: GEO-LOCK`;
            this.cornerTexts[3].text = `ZOOM: ${(1.0 + this.rng() * 0.4).toFixed(1)}X\nFOV: 45.0°`;
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.34;

        const tilt = 0.32;
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
            const z2 = y * sinT + z * cosT;
            return {
                x: cx + x * scale,
                y: cy + y2 * scale,
                z: z2
            };
        });

        // 1. Back-hemisphere graticule + coastlines (dimmed for 3D depth)
        for (const [i1, i2] of this.lines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            if (p1.z < 0 && p2.z < 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        for (const [i1, i2] of this.coastLines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            if (p1.z < 0 && p2.z < 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1, color: this.theme.dim, alpha: 0.45 });

        // 2. Front-hemisphere graticule (secondary intensity)
        for (const [i1, i2] of this.lines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            if (p1.z >= 0 || p2.z >= 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.55 });

        // 3. Front-hemisphere 3D World Coastlines (bright primary)
        for (const [i1, i2] of this.coastLines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            if (p1.z >= 0 && p2.z >= 0) {
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
            }
        }
        g.stroke({ width: 1.5, color: this.theme.primary, alpha: 0.95 });

        // 4. Outer horizon circle + inclined orbital ring
        g.circle(cx, cy, scale);
        g.stroke({ width: 2, color: this.theme.primary });

        const orbitSteps = 48;
        const orbitR = scale * 1.18;
        for (let i = 0; i <= orbitSteps; i++) {
            const a = (i / orbitSteps) * Math.PI * 2;
            const ox = Math.cos(a) * orbitR;
            const oy = Math.sin(a) * orbitR * 0.36;
            const rx = ox * 0.92 - oy * 0.38;
            const ry = ox * 0.38 + oy * 0.92;
            if (i === 0) g.moveTo(cx + rx, cy + ry);
            else g.lineTo(cx + rx, cy + ry);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });

        // 5. Orbiting satellite marker along the inclined ring
        const satAng = -this.rotation * 1.8;
        const sox = Math.cos(satAng) * orbitR;
        const soy = Math.sin(satAng) * orbitR * 0.36;
        const srx = cx + sox * 0.92 - soy * 0.38;
        const sry = cy + sox * 0.38 + soy * 0.92;
        g.rect(srx - 3, sry - 3, 6, 6).fill(this.theme.primary);

        // 6. Front-facing surface uplink beacons
        for (const b of this.beacons) {
            const ringR = Math.cos(b.lat);
            const vx = Math.sin(b.lon) * ringR;
            const vy = Math.sin(b.lat);
            const vz = Math.cos(b.lon) * ringR;

            const x = vx * cosR - vz * sinR;
            const z = vx * sinR + vz * cosR;
            const y2 = vy * cosT - z * sinT;
            const z2 = vy * sinT + z * cosT;

            if (z2 > 0.1) {
                const bx = cx + x * scale;
                const by = cy + y2 * scale;
                g.circle(bx, by, 5).stroke({ width: 1, color: this.theme.primary });
                g.rect(bx - 1.5, by - 1.5, 3, 3).fill(this.theme.primary);
            }
        }
    }

    destroy() {
        this.vertices = [];
        this.lines = [];
        this.coastLines = [];
        this.beacons = [];
        this.cornerTexts = [];
        this.adapter = null;
    }
}
