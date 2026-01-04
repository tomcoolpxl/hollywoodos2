import { Graphics, Container, Text, TextStyle } from 'pixi.js';

export class SpectrumPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.bars = [];
        this.barCount = 16; // Fewer, chunkier bars for retro look
        this.graphics = null;
        this.textContainer = null;
        this.timer = 0;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        this.graphics = new Graphics();
        this.textContainer = new Container();
        
        this.container.addChild(this.graphics);
        this.container.addChild(this.textContainer);

        // Initialize bar data
        for (let i = 0; i < this.barCount; i++) {
            this.bars.push({
                value: Math.random() * 0.5,
                target: Math.random() * 0.5,
            });
        }

        this.drawLabels();
    }

    drawLabels() {
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 10,
            fill: '#008800', // Dim green for labels
        });

        const bottomY = this.height - 15;
        const step = (this.width - 30) / this.barCount; // -30 for left padding

        // X-Axis Labels (Hz)
        const freqs = ['60', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
        // Distribute sparsely
        for (let i = 0; i < freqs.length; i++) {
            const lbl = new Text({ text: freqs[i], style });
            // Map index to bar position approx
            const barIdx = Math.floor(i * (this.barCount / freqs.length));
            lbl.x = 30 + barIdx * step;
            lbl.y = bottomY;
            this.textContainer.addChild(lbl);
        }

        // Y-Axis Labels (dB)
        const dbs = ['0', '-6', '-12', '-24'];
        for (let i = 0; i < dbs.length; i++) {
            const lbl = new Text({ text: dbs[i], style });
            lbl.x = 0;
            lbl.y = (this.height - 20) * (i / dbs.length);
            this.textContainer.addChild(lbl);
        }
    }

    update(dt) {
        this.timer += dt;
        
        // Update targets less frequently for a "stepped" machine look
        if (this.timer > 0.15) { 
            this.timer = 0;
            for (let i = 0; i < this.barCount; i++) {
                // Gentle shifts, rarely zero, rarely full
                const change = (Math.random() - 0.5) * 0.3;
                this.bars[i].target = Math.max(0.1, Math.min(0.9, this.bars[i].target + change));
            }
        }

        // Smoothly interpolate values
        for (let i = 0; i < this.barCount; i++) {
            const bar = this.bars[i];
            const diff = bar.target - bar.value;
            bar.value += diff * dt * 2.0; // Slow smooth speed
        }

        this.render();
    }

    render() {
        const g = this.graphics;
        g.clear();

        const paddingLeft = 30;
        const graphWidth = this.width - paddingLeft;
        const graphHeight = this.height - 20; // Room for labels
        
        const barWidth = (graphWidth / this.barCount) - 4; // 4px gap
        const segmentHeight = 6; // Height of each "LED" block
        const segmentGap = 2;
        const totalSegments = Math.floor(graphHeight / (segmentHeight + segmentGap));

        for (let i = 0; i < this.barCount; i++) {
            const bar = this.bars[i];
            const x = paddingLeft + i * (barWidth + 4);
            
            // Calculate how many segments are "lit"
            const litSegments = Math.floor(bar.value * totalSegments);

            for (let j = 0; j < totalSegments; j++) {
                const y = graphHeight - ((j + 1) * (segmentHeight + segmentGap));
                
                if (j < litSegments) {
                    // Lit Segment
                    // Color gradient: Bottom=DarkGreen, Top=BrightGreen
                    const intensity = j / totalSegments;
                    if (intensity > 0.8) g.fill(0x55FF55); // Peak
                    else g.fill(0x00AA00); // Normal
                } else {
                    // Unlit Segment (Ghost)
                    g.fill(0x002200);
                }
                
                g.rect(x, y, barWidth, segmentHeight);
            }
        }
    }

    destroy() {
        this.container.removeChildren();
    }
}