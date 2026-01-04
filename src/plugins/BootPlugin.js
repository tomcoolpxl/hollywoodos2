import { Text, TextStyle } from 'pixi.js';

export class BootPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.cursor = null;
        this.lines = [];
        this.textObj = null;
        this.timer = 0;
        this.state = 'booting'; 
        this.bootLog = [
            "BIOS DATE 01/01/99 14:22:51 VER 1.02",
            "CPU: NEC V20, SPEED: 8 MHz",
            "640K RAM SYSTEM OK",
            "INITIALIZING VIDEO ADAPTER...",
            "VIDEO ADAPTER INITIALIZED",
            "LOADING OS...",
            "MOUNTING DISK A: ... FAILED",
            "MOUNTING DISK C: ... OK",
            "READING SECTOR 0x000...",
            "EXECUTING BOOTSTRAP...",
            "SYSTEM READY."
        ];
        this.currentLineIdx = 0;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        this.cursor = context.cursor;

        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 14,
            fill: '#00FF00',
            lineHeight: 18
        });

        this.textObj = new Text({ text: '', style });
        this.container.addChild(this.textObj);
        
        if (this.cursor) {
            this.cursor.setEnabled(true);
            this.cursor.setType('underline');
            this.cursor.setSize(10, 18); // Match line height
            
            // Move cursor to top of stack to ensure visibility
            this.container.addChild(this.cursor.graphics);
        }
        
        this.reset();
    }

    reset() {
        this.lines = [];
        this.currentLineIdx = 0;
        this.textObj.text = '';
        this.state = 'booting';
        this.timer = 0;
        this.updateCursorPos();
    }

    updateCursorPos() {
        if (!this.cursor) return;
        const metrics = 18; 
        const y = this.lines.length * metrics;
        this.cursor.setPosition(0, y);
    }

    update(dt) {
        this.timer += dt;
        
        if (this.state === 'booting') {
            // Typing speed varies slightly
            if (this.timer > 0.3) { 
                this.timer = 0;
                if (this.currentLineIdx < this.bootLog.length) {
                    this.lines.push(this.bootLog[this.currentLineIdx]);
                    this.currentLineIdx++;
                    this.textObj.text = this.lines.join('\n');
                    this.updateCursorPos();
                } else {
                    this.state = 'waiting';
                }
            }
        } else if (this.state === 'waiting') {
            if (this.timer > 3.0) { // Reboot after 3 seconds
                this.reset();
            }
        }
    }

    destroy() {
        this.container.removeChildren();
    }
}
