import { Graphics } from 'pixi.js';

const VALID_CURSOR_TYPES = new Set(['block', 'underline', 'line', 'beam', 'hollow']);

export class Cursor {
    constructor(container, color = 0x00FF00) {
        this.graphics = new Graphics();
        container.addChild(this.graphics);

        this.x = 0;
        this.y = 0;
        this.width = 9;
        this.height = 15;
        this.color = color;

        this.enabled = false;
        this.blinkState = true;
        this.blinkTimer = 0;
        this.blinkSpeed = 0.28;
        this.type = 'block'; // 'block' | 'hollow' | 'line' | 'underline'

        this.draw();
        this.updateVisibility();
    }

    setPosition(x, y) {
        const moved = Math.abs(this.x - x) > 0.5 || Math.abs(this.y - y) > 0.5;
        this.x = x;
        this.y = y;
        this.graphics.x = Math.round(x);
        this.graphics.y = Math.round(y);
        if (moved && this.enabled) {
            // Keep cursor solid while actively typing or scanning across cells
            this.blinkState = true;
            this.blinkTimer = 0;
            this.updateVisibility();
        }
    }

    setSize(w, h) {
        this.width = Math.max(6, Math.round(w));
        this.height = Math.max(10, Math.round(h));
        this.draw();
    }

    setColor(color) {
        this.color = color;
        this.draw();
    }

    setType(type) {
        this.type = VALID_CURSOR_TYPES.has(type) ? type : 'block';
        this.draw();
    }

    setEnabled(isEnabled) {
        this.enabled = Boolean(isEnabled);
        this.blinkState = true;
        this.blinkTimer = 0;
        this.updateVisibility();
    }

    draw() {
        const g = this.graphics;
        g.clear();

        if (this.type === 'block') {
            g.rect(0, 1, this.width, Math.max(2, this.height - 2)).fill({
                color: this.color,
                alpha: 0.92
            });
        } else if (this.type === 'hollow') {
            g.rect(0, 1, this.width, Math.max(2, this.height - 2)).stroke({
                width: 1.5,
                color: this.color,
                alpha: 0.95
            });
        } else if (this.type === 'underline') {
            g.rect(0, Math.max(0, this.height - 3), this.width, 3).fill(this.color);
        } else if (this.type === 'line' || this.type === 'beam') {
            g.rect(0, 1, 2.5, Math.max(2, this.height - 2)).fill(this.color);
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
