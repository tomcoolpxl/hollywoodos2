import { Graphics } from 'pixi.js';

export class Cursor {
    constructor(container) {
        this.graphics = new Graphics();
        container.addChild(this.graphics);
        
        this.x = 0;
        this.y = 0;
        this.width = 10;
        this.height = 14;
        this.visible = true;
        this.blinkTimer = 0;
        this.blinkSpeed = 0.5; // Seconds
        this.type = 'block'; // block, line, underline
        
        this.draw();
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.graphics.x = x;
        this.graphics.y = y;
    }

    setSize(w, h) {
        this.width = w;
        this.height = h;
        this.draw();
    }

    setType(type) {
        this.type = type;
        this.draw();
    }

    draw() {
        const g = this.graphics;
        g.clear();
        g.fill(0x00FF00); // Standard Green Cursor
        
        if (this.type === 'block') {
            g.rect(0, 0, this.width, this.height);
        } else if (this.type === 'underline') {
            g.rect(0, this.height - 2, this.width, 2);
        } else if (this.type === 'line') {
            g.rect(0, 0, 2, this.height);
        }
    }

    update(dt) {
        this.blinkTimer += dt;
        if (this.blinkTimer > this.blinkSpeed) {
            this.blinkTimer = 0;
            this.visible = !this.visible;
            this.graphics.alpha = this.visible ? 1 : 0;
        }
    }

    destroy() {
        this.graphics.destroy();
    }
}
