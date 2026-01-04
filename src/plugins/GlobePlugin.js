import { Graphics, Container, Text, TextStyle } from 'pixi.js';

export class GlobePlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.graphics = null;
        this.uiContainer = null;
        this.rotation = 0;
        this.vertices = [];
        this.lines = [];
        
        this.cornerTexts = []; // TL, TR, BL, BR
        this.timer = 0;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        this.graphics = new Graphics();
        this.uiContainer = new Container();
        
        this.container.addChild(this.graphics);
        this.container.addChild(this.uiContainer);

        // Setup Corner Text
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 10,
            fill: '#00FF00',
        });

        // 0: TL, 1: TR, 2: BL, 3: BR
        for (let i = 0; i < 4; i++) {
            const t = new Text({ text: '', style });
            this.cornerTexts.push(t);
            this.uiContainer.addChild(t);
        }
        
        this.updateLayout();

        // Generate 3D Sphere Points
        const r = 1; 
        const lats = 12;
        const longs = 16;

        // Latitude Rings
        for (let i = 1; i < lats; i++) {
            const lat = Math.PI * (i / lats) - Math.PI/2;
            const y = Math.sin(lat) * r;
            const ringR = Math.cos(lat) * r;
            
            const startIdx = this.vertices.length;
            for (let j = 0; j <= longs; j++) {
                const long = (Math.PI * 2 * j) / longs;
                const x = Math.sin(long) * ringR;
                const z = Math.cos(long) * ringR;
                this.vertices.push({x, y, z});
                
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
                const lat = Math.PI * (i / segs) - Math.PI/2;
                const y = Math.sin(lat) * r;
                const ringR = Math.cos(lat) * r;
                const x = sinLong * ringR;
                const z = cosLong * ringR;
                
                this.vertices.push({x, y, z});
                 if (i > 0) {
                    this.lines.push([this.vertices.length - 2, this.vertices.length - 1]);
                }
            }
        }
    }

    updateLayout() {
        const pad = 10;
        // TL
        this.cornerTexts[0].x = pad;
        this.cornerTexts[0].y = pad;
        this.cornerTexts[0].text = "LAT: 00.00 N";

        // TR
        this.cornerTexts[1].anchor.set(1, 0);
        this.cornerTexts[1].x = this.width - pad;
        this.cornerTexts[1].y = pad;
        this.cornerTexts[1].text = "LNG: 00.00 W";

        // BL
        this.cornerTexts[2].anchor.set(0, 1);
        this.cornerTexts[2].x = pad;
        this.cornerTexts[2].y = this.height - pad;
        this.cornerTexts[2].text = "MODE: SCAN";

        // BR
        this.cornerTexts[3].anchor.set(1, 1);
        this.cornerTexts[3].x = this.width - pad;
        this.cornerTexts[3].y = this.height - pad;
        this.cornerTexts[3].text = "ZOOM: 1.0X";
    }

    update(dt) {
        this.rotation += dt * 0.5;
        this.timer += dt;

        // Update Text Randomly
        if (this.timer > 0.2) {
            this.timer = 0;
            this.cornerTexts[0].text = `LAT: ${(Math.random() * 90).toFixed(2)} N`;
            this.cornerTexts[1].text = `LNG: ${(Math.random() * 180).toFixed(2)} W`;
            this.cornerTexts[3].text = `ZOOM: ${(1.0 + Math.random()).toFixed(1)}X`;
        }

        this.render();
    }

    render() {
        const g = this.graphics;
        g.clear();
        g.stroke({ width: 1, color: 0x00FF00 });

        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.35;
        
        const tilt = 0.4; 
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        
        const rot = this.rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        // Project vertices
        const proj = this.vertices.map(v => {
            // Rotate Y (Spin)
            let x = v.x * cosR - v.z * sinR;
            let z = v.x * sinR + v.z * cosR;
            let y = v.y;

            // Rotate X (Tilt)
            let y2 = y * cosT - z * sinT;
            let z2 = y * sinT + z * cosT;

            return {
                x: cx + x * scale,
                y: cy + y2 * scale,
            };
        });

        // Draw Lines
        for (const [i1, i2] of this.lines) {
            const p1 = proj[i1];
            const p2 = proj[i2];
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
        }
        
        // Outer Circle
        g.stroke({ width: 2, color: 0x00FF00 });
        g.circle(cx, cy, scale);
    }

    destroy() {
        this.container.removeChildren();
    }
}