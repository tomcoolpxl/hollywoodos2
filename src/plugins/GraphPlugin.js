import { Graphics, Text, TextStyle, Container } from 'pixi.js';

export class GraphPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        
        // Two data series: CPU and RAM
        this.dataCPU = [];
        this.dataRAM = [];
        this.maxPoints = 60;
        
        this.graphics = null;
        this.textContainer = null;
        this.timer = 0;
        this.updateRate = 0.1; // Update every 100ms (10fps for data)
        
        this.cpuLabel = null;
        this.ramLabel = null;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        this.graphics = new Graphics();
        this.textContainer = new Container();
        
        this.container.addChild(this.graphics);
        this.container.addChild(this.textContainer);

        // Fill initial data
        for (let i = 0; i < this.maxPoints; i++) {
            this.dataCPU.push(0.3);
            this.dataRAM.push(0.4);
        }

        // Labels
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 12,
            fill: '#00FF00',
        });

        this.cpuLabel = new Text({ text: "CPU: 0%", style });
        this.cpuLabel.x = 10; 
        this.cpuLabel.y = 10;
        
        this.ramLabel = new Text({ text: "MEM: 0GB", style });
        this.ramLabel.x = 100;
        this.ramLabel.y = 10;

        this.textContainer.addChild(this.cpuLabel);
        this.textContainer.addChild(this.ramLabel);
    }

    update(dt) {
        this.timer += dt;
        if (this.timer > this.updateRate) {
            this.timer = 0;
            this.updateData();
        }
        this.renderGraph();
    }

    updateData() {
        // CPU: Volatile
        const lastCPU = this.dataCPU[this.dataCPU.length - 1];
        let nextCPU = lastCPU + (Math.random() - 0.5) * 0.15;
        nextCPU = Math.max(0.05, Math.min(0.95, nextCPU));
        
        // RAM: Slow moving, mostly rising then drop
        const lastRAM = this.dataRAM[this.dataRAM.length - 1];
        let nextRAM = lastRAM + (Math.random() * 0.02) - 0.005; // Trend up
        if (nextRAM > 0.9) nextRAM = 0.3; // Garbage collect
        nextRAM = Math.max(0.1, Math.min(0.95, nextRAM));

        this.dataCPU.push(nextCPU);
        this.dataRAM.push(nextRAM);

        if (this.dataCPU.length > this.maxPoints) this.dataCPU.shift();
        if (this.dataRAM.length > this.maxPoints) this.dataRAM.shift();

        // Update Text
        this.cpuLabel.text = `CPU: ${Math.floor(nextCPU * 100)}%`;
        this.ramLabel.text = `MEM: ${(nextRAM * 16).toFixed(1)}GB`;
    }

    renderGraph() {
        const g = this.graphics;
        g.clear();

        // Draw Grid
        g.stroke({ width: 1, color: 0x003300 });
        // Horizontal lines
        for (let i = 1; i < 5; i++) {
            const y = (this.height / 5) * i;
            g.moveTo(0, y);
            g.lineTo(this.width, y);
        }
        // Vertical lines (moving effect? Keep static for now to avoid jitter)
        for (let i = 1; i < 10; i++) {
            const x = (this.width / 10) * i;
            g.moveTo(x, 0);
            g.lineTo(x, this.height);
        }

        const stepX = this.width / (this.maxPoints - 1);

        // Draw RAM (Background, Dimmer)
        g.stroke({ width: 2, color: 0x008800, alpha: 0.7 });
        this.drawSeries(g, this.dataRAM, stepX);

        // Draw CPU (Foreground, Bright)
        g.stroke({ width: 2, color: 0x00FF00 });
        this.drawSeries(g, this.dataCPU, stepX);
    }

    drawSeries(g, data, stepX) {
        if (data.length === 0) return;
        
        g.moveTo(0, this.height - (data[0] * this.height));
        
        for (let i = 1; i < data.length; i++) {
            const x = i * stepX;
            const y = this.height - (data[i] * this.height);
            g.lineTo(x, y);
        }
    }

    destroy() {
        this.container.removeChildren();
    }
}
