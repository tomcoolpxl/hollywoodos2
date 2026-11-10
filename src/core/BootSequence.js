import { Container, Graphics } from 'pixi.js';
import { createRetroText } from './Adapters.js';

export class BootSequence {
    constructor(app, onComplete, themeColor = 0x00FF00) {
        this.app = app;
        this.onComplete = onComplete;
        this.themeColor = themeColor;
        this.container = new Container();
        this.app.stage.addChild(this.container);

        this.bg = null;
        this.lines = [];
        this.textObj = null;
        this.timer = 0;
        this.step = 0;

        this.bootLog = [
            'HOLLYWOOD BIOS v2.1',
            'COPYRIGHT (C) 1999-2026',
            '',
            'CPU: QUANTUM CORE i9 @ 9.9GHz',
            'MEM: 64TB ECC OK',
            '',
            'INITIALIZING GRAPHICS ADAPTER...',
            ' OK',
            'LOADING KERNEL...',
            ' [####################] 100%',
            'MOUNTING FILE SYSTEMS...',
            ' /ROOT: READ-ONLY',
            ' /USR: MOUNTED',
            ' /NET: CONNECTED (SECURE)',
            '',
            'STARTING HOLLYWOOD_OS SESSION MANAGER...',
            'ACCESS GRANTED.'
        ];

        this.init();
    }

    init() {
        this.bg = new Graphics();
        this.drawBackground(window.innerWidth, window.innerHeight);
        this.container.addChild(this.bg);

        this.lines = [this.bootLog[0]];
        this.step = 1;
        this.textObj = createRetroText(this.lines.join('\n'), {
            fontSize: 16,
            lineHeight: 20,
            fill: this.themeColor
        });
        this.textObj.x = 20;
        this.textObj.y = 20;
        this.container.addChild(this.textObj);
    }

    drawBackground(w, h) {
        if (!this.bg) return;
        this.bg.clear();
        this.bg.rect(0, 0, Math.max(1, w), Math.max(1, h)).fill(0x050505);
    }

    update(dt) {
        this.timer += dt;

        if (this.timer > 0.08 && this.step < this.bootLog.length) {
            this.timer = 0;
            this.lines.push(this.bootLog[this.step]);
            this.textObj.text = this.lines.join('\n');
            this.step++;
        }

        if (this.step >= this.bootLog.length && this.timer > 0.75) {
            this.destroy();
            if (typeof this.onComplete === 'function') {
                this.onComplete();
            }
        }
    }

    resize(w, h) {
        this.drawBackground(w, h);
    }

    destroy() {
        if (this.container && !this.container.destroyed) {
            this.app.stage.removeChild(this.container);
            this.container.destroy({ children: true });
        }
    }
}
