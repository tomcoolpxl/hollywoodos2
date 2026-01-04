import { Graphics, Container } from 'pixi.js';

export class GlobePlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.graphics = null;
        this.angle = 0;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
    }

    update(dt) {
        this.angle += dt * 0.5;
        this.render();
    }

    render() {
        const g = this.graphics;
        g.clear();
        
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.35;
        
        g.stroke({ width: 2, color: 0x00FF00 });

        // Draw Latitude lines (Horizontal circles)
        const lats = 8;
        for (let i = 0; i < lats; i++) {
            const latAngle = (Math.PI / lats) * i - (Math.PI / 2);
            // Tilt the globe slightly
            const tilt = 0.3;
            
            // Perspective squish based on tilt
            const y = Math.sin(latAngle) * radius;
            const r = Math.cos(latAngle) * radius;
            
            // Draw ellipse
            g.ellipse(cx, cy + y, r, r * 0.4); 
        }

        // Draw Longitude lines (Vertical ellipses rotating)
        const longs = 8;
        for (let i = 0; i < longs; i++) {
            const longAngle = (Math.PI / longs) * i + this.angle;
            const w = Math.cos(longAngle) * radius;
            
            // Simple approach: Draw ellipse with varying width
            // This isn't perfectly 3D correct but looks "retro wireframe" enough
            g.ellipse(cx, cy, Math.abs(w), radius);
        }

        // Outer rim
        g.stroke({ width: 3, color: 0x00FF00 });
        g.circle(cx, cy, radius);
    }

    destroy() {
        this.container.removeChildren();
    }
}
