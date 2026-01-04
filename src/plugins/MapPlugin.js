import { Graphics, Container, Text, TextStyle } from 'pixi.js';

export class MapPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.targets = [];
        this.mapLayer = null;
        this.uiLayer = null;
        this.timer = 0;
        this.scanAngle = 0;
    }

    init(context) {
        console.log('MapPlugin initializing...');
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        this.mapLayer = new Graphics();
        this.uiLayer = new Container();
        this.uiGraphics = new Graphics(); // Persistent graphics for dynamic elements
        
        this.uiLayer.addChild(this.uiGraphics);
        this.container.addChild(this.mapLayer);
        this.container.addChild(this.uiLayer);

        // Generate static map geometry (World Borders / Grid)
        this.drawMapStatic();

        // Generate dynamic targets
        for (let i = 0; i < 5; i++) {
            this.targets.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 50, // Pixels per second
                vy: (Math.random() - 0.5) * 50,
                id: `TRGT-${Math.floor(Math.random() * 9999)}`,
                label: null
            });
        }
    }

    drawMapStatic() {
        const g = this.mapLayer;
        g.clear();
        
        // Draw Grid
        g.stroke({ width: 1, color: 0x003300 });
        const gridSize = 40;
        for (let x = 0; x <= this.width; x += gridSize) {
            g.moveTo(x, 0);
            g.lineTo(x, this.height);
        }
        for (let y = 0; y <= this.height; y += gridSize) {
            g.moveTo(0, y);
            g.lineTo(this.width, y);
        }

        // Draw "Continents" (Abstract Shapes)
        g.stroke({ width: 2, color: 0x008800 });
        g.moveTo(this.width * 0.2, this.height * 0.3);
        g.lineTo(this.width * 0.4, this.height * 0.2);
        g.lineTo(this.width * 0.5, this.height * 0.5);
        g.lineTo(this.width * 0.3, this.height * 0.6);
        g.closePath();

        g.moveTo(this.width * 0.6, this.height * 0.6);
        g.lineTo(this.width * 0.8, this.height * 0.5);
        g.lineTo(this.width * 0.9, this.height * 0.8);
        g.lineTo(this.width * 0.7, this.height * 0.9);
        g.closePath();
    }

    update(dt) {
        // Reuse the text objects? 
        // For now, let's just clear the graphics. 
        // Re-creating text every frame is BAD. 
        // I will remove text update for a second to verify graphics first.
        
        this.uiGraphics.clear();
        const g = this.uiGraphics;

        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 10,
            fill: '#00FF00',
        });

        // Update Targets
        this.targets.forEach(t => {
            t.x += t.vx * dt;
            t.y += t.vy * dt;

            // Bounce
            if (t.x < 0 || t.x > this.width) t.vx *= -1;
            if (t.y < 0 || t.y > this.height) t.vy *= -1;

            // Draw Target
            g.stroke({ width: 1, color: 0x00FF00 });
            g.circle(t.x, t.y, 4);
            
            // Draw Vector Line
            g.moveTo(t.x, t.y);
            g.lineTo(t.x + t.vx * 0.5, t.y + t.vy * 0.5);
        });

        // Draw Radar Sweep
        this.scanAngle += dt * 2; // Rads per second
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.4;
        
        g.stroke({ width: 2, color: 0x00FF00, alpha: 0.5 });
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(this.scanAngle) * radius, cy + Math.sin(this.scanAngle) * radius);
        
        g.stroke({ width: 1, color: 0x004400 });
        g.circle(cx, cy, radius);
    }

    destroy() {
        this.container.removeChildren();
    }
}
