import { Container, Text, TextStyle, Graphics } from 'pixi.js';

export class BootSequence {
    constructor(app, onComplete) {
        this.app = app;
        this.onComplete = onComplete;
        this.container = new Container();
        this.app.stage.addChild(this.container);
        
        this.lines = [];
        this.textObj = null;
        this.timer = 0;
        this.step = 0;
        
        this.bootLog = [
            "HOLLYWOOD BIOS v2.0",
            "COPYRIGHT (C) 1999-2026",
            "",
            "CPU: QUANTUM CORE i9 @ 9.9GHz",
            "MEM: 64TB OK",
            "",
            "INITIALIZING GRAPHICS ADAPTER...",
            " OK",
            "LOADING KERNEL...",
            " [....................] 100%",
            "MOUNTING FILE SYSTEMS...",
            " /ROOT: READ-ONLY",
            " /USR: MOUNTED",
            " /NET: CONNECTED (SECURE)",
            "",
            "STARTING HOLLYWOOD_OS SESSION MANAGER...",
            "ACCESS GRANTED."
        ];

        this.init();
    }

    init() {
        // Black background
        const bg = new Graphics();
        bg.rect(0, 0, window.innerWidth, window.innerHeight);
        bg.fill(0x050505);
        this.container.addChild(bg);

        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 16,
            fill: '#00FF00',
            lineHeight: 20
        });

        this.textObj = new Text({ text: '', style });
        this.textObj.x = 20;
        this.textObj.y = 20;
        this.container.addChild(this.textObj);
    }

    update(dt) {
        this.timer += dt;

        // Typing speed varies
        if (this.timer > 0.1 && this.step < this.bootLog.length) {
            this.timer = 0;
            this.lines.push(this.bootLog[this.step]);
            this.textObj.text = this.lines.join('\n');
            this.step++;
        }

        // End of sequence
        if (this.step >= this.bootLog.length && this.timer > 1.0) {
            this.destroy();
            this.onComplete();
        }
    }

    resize(w, h) {
        // Re-draw background if needed, or ignore for short boot
    }

    destroy() {
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }
}
