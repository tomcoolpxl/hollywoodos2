import { Text, TextStyle, FillGradient } from 'pixi.js';
import { getMonoCharWidth } from '../core/Adapters.js';

export class MatrixPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.fontSize = 14;
        this.charWidth = 8.4;
        this.cols = [];
        this.sharedStyle = null;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x003300,
            peak: 0x55FF55
        };
        this.fontSize = context.options?.fontSize ?? 14;
        this.charWidth = getMonoCharWidth(this.fontSize);

        // PixiJS v8 FillGradient uses `colorStops` and end.x = 0.12 so multi-line Text
        // stretches the gradient across the full column height rather than per-line.
        const headColor =
            this.theme.isMono !== false
                ? this.theme.primary
                : (this.theme.peak ?? 0xFFFFFF);

        const gradient = new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0 },
            end: { x: 0.12, y: 1 },
            textureSpace: 'local',
            colorStops: [
                { offset: 0.0, color: this.theme.dim },
                { offset: 0.72, color: this.theme.secondary ?? this.theme.primary },
                { offset: 1.0, color: headColor }
            ]
        });

        this.sharedStyle = new TextStyle({
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: this.fontSize,
            fill: gradient,
            lineHeight: this.fontSize
        });

        const colCount = Math.max(1, Math.floor(this.width / this.charWidth));
        for (let i = 0; i < colCount; i++) {
            this.createColumn(i);
        }
    }

    createColumn(index) {
        const speed = 100 + this.rng() * 180;
        const trailLength = this.rng.int(6, 19);

        const contentArr = [];
        for (let j = 0; j < trailLength; j++) {
            contentArr.push(this.getRandomChar());
        }

        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        const textObj = new Text({
            text: contentArr.join('\n'),
            style: this.sharedStyle,
            resolution: Math.min(3, Math.max(2, dpr * 1.5)),
            roundPixels: true
        });
        textObj.x = Math.round(index * this.charWidth);
        textObj.y = this.rng() * this.height * 1.5 - this.height;

        this.container.addChild(textObj);

        this.cols.push({
            obj: textObj,
            speed,
            trailLength,
            flickerTimer: this.rng() * 0.1,
            contentArr
        });
    }

    getRandomChar() {
        if (this.rng() > 0.5) {
            return String.fromCharCode(0x30A0 + this.rng.int(0, 95));
        }
        return String.fromCharCode(0x21 + this.rng.int(0, 92));
    }

    update(dt) {
        const resetThreshold = this.height + 50;

        for (const col of this.cols) {
            col.obj.y += col.speed * dt;

            if (col.obj.y > resetThreshold) {
                col.obj.y = -(col.trailLength * this.fontSize) - this.rng() * 200;
                col.speed = 100 + this.rng() * 180;
            }

            col.flickerTimer += dt;
            if (col.flickerTimer >= 0.1) {
                col.flickerTimer = 0;
                const idx = this.rng.int(0, col.trailLength - 1);
                col.contentArr[idx] = this.getRandomChar();
                col.obj.text = col.contentArr.join('\n');
            }
        }
    }

    destroy() {
        for (const col of this.cols) {
            if (col.obj && !col.obj.destroyed) {
                col.obj.destroy();
            }
        }
        this.cols = [];
        this.sharedStyle = null;
    }
}
