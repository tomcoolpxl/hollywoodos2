import { Text, TextStyle } from 'pixi.js';

export class HexPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.fontSize = 14;
        this.lines = [];
        this.textObject = null;
        this.startOffset = 0x1000;
        this.rows = 0;
        this.speed = 0.05;
        this.timer = 0;
        this.cursor = null;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        this.cursor = context.cursor;

        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: this.fontSize,
            fill: '#00FF00',
            lineHeight: 16
        });

        this.rows = Math.floor(this.height / 16);
        this.textObject = new Text({ text: '', style });
        this.container.addChild(this.textObject);

        this.generateInitialData();

        if (this.cursor) {
            this.cursor.visible = true;
            this.cursor.setType('block');
            this.cursor.setSize(8.4, 16);
        }
    }

    generateInitialData() {
        this.lines = [];
        for (let i = 0; i < this.rows; i++) {
            this.lines.push(this.generateLine(this.startOffset + (i * 16)));
        }
        this.render();
    }

    generateLine(offset) {
        const hexOffset = offset.toString(16).toUpperCase().padStart(8, '0');
        let hexBytes = '';
        let ascii = '';
        
        for (let j = 0; j < 8; j++) { 
            const val = Math.floor(Math.random() * 256);
            hexBytes += val.toString(16).toUpperCase().padStart(2, '0') + ' ';
            ascii += (val > 32 && val < 127) ? String.fromCharCode(val) : '.';
        }

        return `${hexOffset}  ${hexBytes} |${ascii}|`;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer > this.speed) {
            this.timer = 0;
            this.lines.shift();
            // Safeguard against empty lines array
            let lastOffset = this.startOffset;
            if (this.lines.length > 0) {
                 const parts = this.lines[this.lines.length - 1].split(' ');
                 if (parts.length > 0) lastOffset = parseInt(parts[0], 16);
            }
            this.lines.push(this.generateLine(lastOffset + 16));
            this.render();
        }

        if (this.cursor && Math.random() > 0.9) {
            // Move cursor mostly in hex area
            // 10 chars offset, 24 chars hex
            const r = Math.floor(Math.random() * this.rows);
            const c = 10 + Math.floor(Math.random() * 24); 
            // 8.4 is approx width of monospace 14px char (0.6 * 14)
            this.cursor.setPosition(c * 8.4, r * 16);
        }
    }

    render() {
        this.textObject.text = this.lines.join('\n');
    }

    destroy() {
        this.container.removeChildren();
    }
}