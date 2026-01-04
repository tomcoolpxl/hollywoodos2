import { Text, TextStyle, Container } from 'pixi.js';

export class MatrixPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.fontSize = 14;
        this.charWidth = 0;
        this.cols = []; // Array of Column objects
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        // 1. Measure Font
        const tempStyle = new TextStyle({ fontFamily: 'monospace', fontSize: this.fontSize });
        const tempText = new Text({ text: 'M', style: tempStyle });
        this.charWidth = tempText.width;
        tempText.destroy();

        // 2. Setup Columns
        const colCount = Math.floor(this.width / this.charWidth);
        
        for (let i = 0; i < colCount; i++) {
            this.createColumn(i);
        }
    }

    createColumn(index) {
        // Random properties
        const speed = 100 + Math.random() * 200; // Pixels per second
        const trailLength = 5 + Math.floor(Math.random() * 15); // 5 to 20 chars
        
        // Generate initial string
        let content = "";
        for (let j = 0; j < trailLength; j++) {
            content += this.getRandomChar() + "\n";
        }

        // Style with Gradient (Head=White, Body=Green, Tail=Dark)
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: this.fontSize,
            fill: ['#ffffff', '#00ff00', '#003300'], // Gradient
            fillGradientType: 1, // Linear Vertical
            fillGradientStops: [0, 0.3, 1], // White at top, Green mid, Dark bottom
            lineHeight: this.fontSize, // Compact
        });

        const textObj = new Text({ text: content, style });
        textObj.x = index * this.charWidth;
        // Start randomly placed or above screen
        textObj.y = Math.random() * this.height * 1.5 - this.height; 

        this.container.addChild(textObj);

        this.cols.push({
            obj: textObj,
            speed: speed,
            trailLength: trailLength,
            flickerTimer: Math.random(),
            contentArr: content.split('\n') // Keep array for easy editing
        });
    }

    getRandomChar() {
        // Half-width Katakana + Latin + Numbers
        if (Math.random() > 0.5) {
            return String.fromCharCode(0x30A0 + Math.random() * 96);
        } else {
            return String.fromCharCode(0x21 + Math.random() * 93);
        }
    }

    update(dt) {
        const resetThreshold = this.height + 50;

        for (const col of this.cols) {
            // 1. Move
            col.obj.y += col.speed * dt;

            // 2. Reset if off screen
            if (col.obj.y > resetThreshold) {
                col.obj.y = -(col.trailLength * this.fontSize) - (Math.random() * 200);
                col.speed = 100 + Math.random() * 200;
            }

            // 3. Flicker (Change one character randomly)
            col.flickerTimer += dt;
            if (col.flickerTimer > 0.1) { // Throttle updates
                col.flickerTimer = 0;
                
                // Change a random character in the trail
                const idx = Math.floor(Math.random() * col.trailLength);
                col.contentArr[idx] = this.getRandomChar();
                
                // Update text texture
                col.obj.text = col.contentArr.join('\n');
            }
        }
    }

    destroy() {
        this.container.removeChildren();
        this.cols = [];
    }
}