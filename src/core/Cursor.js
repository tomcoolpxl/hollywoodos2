import { Graphics } from 'pixi.js';

export class Cursor {
    constructor(container, color = 0x00FF00) {
        this.graphics = new Graphics();
        container.addChild(this.graphics);

        this.x = 0;
        this.y = 0;
        this.width = 10;
        this.height = 14;
        this.color = color;

        this.enabled = false;
        this.blinkState = true;
        this.blinkTimer = 0;
        this.blinkSpeed = 0.5;
        this.type = 'block'; // 'block' | 'line' | 'underline'

        this.draw();
        this.updateVisibility();
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

    setColor(color) {
        this.color = color;
        this.draw();
    }

    setType(type) {
        this.type = type;
        this.draw();
    }

    setEnabled(isEnabled) {
        this.enabled = isEnabled;
        this.blinkState = true;
        this.blinkTimer = 0;
        this.updateVisibility();
    }

    draw() {
        const g = this.graphics;
        g.clear();

        if (this.type === 'block') {
            g.rect(0, 0, this.width, this.height).fill(this.color);
        } else if (this.type === 'underline') {
            g.rect(0, Math.max(0, this.height - 3), this.width, 3).fill(this.color);
        } else if (this.type === 'line' || this.type === 'beam') {
            g.rect(0, 0, 2, this.height).fill(this.color);
        }
    }

    update(dt) {
        if (!this.enabled) return;

        this.blinkTimer += dt;
        if (this.blinkTimer > this.blinkSpeed) {
            this.blinkTimer = 0;
            this.blinkState = !this.blinkState;
            this.updateVisibility();
        }
    }

    updateVisibility() {
        const isVisible = this.enabled && this.blinkState;
        this.graphics.alpha = isVisible ? 1 : 0;
        this.graphics.visible = this.enabled;
    }

    destroy() {
        if (this.graphics && !this.graphics.destroyed) {
            this.graphics.destroy();
        }
    }
}
