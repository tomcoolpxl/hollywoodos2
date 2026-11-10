import { WORLD_COASTLINES, projectEquirectangular } from '../core/WorldMapData.js';

export class OrbitPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.satellites = [];
        this.stations = [];
        this.cornerLabels = {};
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

        // Real-world ground station coordinates [lon, lat]
        this.stations = [
            { name: 'GS-PINE-GAP', lon: 133.74, lat: -23.80 },
            { name: 'GS-MENWITH', lon: -1.68, lat: 54.00 },
            { name: 'GS-THULE', lon: -68.70, lat: 76.53 },
            { name: 'GS-DIEGO', lon: 72.42, lat: -7.31 }
        ];

        this.drawWorldGrid();

        const satDefs = [
            { name: 'KH-12 KEYHOLE', norad: '49210', alt: 412, amp: 0.33, freq: 1.0, speed: 0.011, phase: 0.2 },
            { name: 'LACROSSE-5', norad: '28646', alt: 684, amp: 0.26, freq: 1.5, speed: 0.015, phase: 2.1 },
            { name: 'ORION-SIGINT', norad: '37232', alt: 520, amp: 0.38, freq: 2.0, speed: 0.0085, phase: 4.0 }
        ];

        this.satellites = satDefs.map((def) => {
            const label = this.adapter.createLabel(`${def.name}\nALT:${def.alt}KM`, {
                fontSize: 9,
                lineHeight: 11,
                fill: this.theme.primary,
                fontWeight: 'bold',
                x: 10,
                y: 10
            });
            return {
                ...def,
                lonNorm: this.rng(),
                label
            };
        });

        for (const st of this.stations) {
            const { x: sx, y: sy } = projectEquirectangular(st.lon, st.lat, this.width, this.height);
            this.adapter.createLabel(st.name, {
                fontSize: 9,
                fill: this.theme.secondary,
                x: Math.min(this.width - 75, sx + 6),
                y: sy - 5
            });
        }

        const pad = 8;
        this.cornerLabels = {
            topLeft: this.adapter.createLabel(
                'NORAD CAT: 49210 // CLASSIFIED NRO\nEPOCH: 26314.5419  INC: 63.42°\nRAAN: 142.8°  ECC: 0.0014  MM: 15.19/D',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: 6
                }
            ),
            topRight: this.adapter.createLabel(
                'DOWNLINK: GS-PINE-GAP [LOCKED]\nBAND: Ka-BAND 26.5 GHz\nDOPPLER: -4.18 kHz  BER: 1E-9',
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
                'TRACK: KH-12 KEYHOLE  LON: -70.0°  VEL: 7.66 KM/S\nPASS WINDOW: AOS 00:04:12 // LOS 00:18:45',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.primary,
                    x: pad,
                    y: this.height - 30
                }
            ),
            bottomRight: this.adapter.createLabel(
                'SENSOR CROP: SAR-STRIP [0.4m RES]\nSWATH: 14.2x14.2 KM // AZ: 194.2°',
                {
                    fontSize: 10,
                    lineHeight: 13,
                    fill: this.theme.secondary,
                    x: this.width - pad,
                    y: this.height - 30,
                    anchorX: 1,
                    anchorY: 0
                }
            )
        };

        this.renderOrbits();
    }

    drawWorldGrid() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        // 1. Lat/Lon coordinate grid (every 30 degrees)
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
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.6 });

        // 2. High-resolution geographic world coastlines behind orbital paths
        for (const poly of WORLD_COASTLINES) {
            for (let i = 0; i < poly.length; i++) {
                const { x, y } = projectEquirectangular(poly[i][0], poly[i][1], this.width, this.height);
                if (i === 0) bg.moveTo(x, y);
                else bg.lineTo(x, y);
            }
        }
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.45 });

        // 3. Equator line
        const eqY = this.height / 2;
        bg.moveTo(0, eqY);
        bg.lineTo(this.width, eqY);
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.65 });

        // 4. Ground station crosshairs & range rings
        for (const st of this.stations) {
            const { x: sx, y: sy } = projectEquirectangular(st.lon, st.lat, this.width, this.height);
            bg.moveTo(sx - 4, sy);
            bg.lineTo(sx + 4, sy);
            bg.moveTo(sx, sy - 4);
            bg.lineTo(sx, sy + 4);
            bg.circle(sx, sy, 9);
        }
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.8 });
    }

    update(dt) {
        this.timer += dt;

        for (const sat of this.satellites) {
            sat.lonNorm = (sat.lonNorm + sat.speed * dt) % 1.0;
        }

        if (this.timer >= 0.4) {
            this.timer = 0;
            const s0 = this.satellites[0];
            const s1 = this.satellites[1];
            const lon0 = (s0.lonNorm * 360 - 180).toFixed(1);
            const lon1 = (s1.lonNorm * 360 - 180).toFixed(1);
            const vel = (7.65 + this.rng() * 0.04).toFixed(2);
            const doppler = (-4.2 + (this.rng() - 0.5) * 0.35).toFixed(2);
            const az = (190 + this.rng() * 8).toFixed(1);

            this.cornerLabels.bottomLeft.text =
                `SAT-1 ${s0.name}  LON: ${lon0}°  VEL: ${vel} KM/S\n` +
                `SAT-2 ${s1.name}     LON: ${lon1}°  PASS: ACTIVE`;

            this.cornerLabels.topRight.text =
                `DOWNLINK: GS-PINE-GAP [LOCKED]\n` +
                `BAND: Ka-BAND 26.5 GHz\n` +
                `DOPPLER: ${doppler} kHz  BER: 1E-9`;

            this.cornerLabels.bottomRight.text =
                `SENSOR CROP: SAR-STRIP [0.4m RES]\n` +
                `SWATH: 14.2x14.2 KM // AZ: ${az}°`;
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

            // 2. Current satellite position, sensor crop box & footprint ring
            const satX = sat.lonNorm * this.width;
            const satY =
                cy + Math.sin(sat.lonNorm * Math.PI * 2 * sat.freq + sat.phase) * (this.height * sat.amp);

            g.circle(satX, satY, 18).stroke({ width: 1, color: this.theme.primary, alpha: 0.45 });
            if (s === 0) {
                g.rect(satX - 11, satY - 11, 22, 22).stroke({
                    width: 1,
                    color: this.theme.primary,
                    alpha: 0.75
                });
            }
            g.rect(satX - 3, satY - 3, 6, 6).fill(this.theme.primary);

            sat.label.x = Math.min(this.width - 98, Math.max(6, satX + 10));
            sat.label.y = Math.min(this.height - 52, Math.max(42, satY - 10));
        }
    }

    destroy() {
        this.satellites = [];
        this.stations = [];
        this.cornerLabels = {};
        this.adapter = null;
    }
}
