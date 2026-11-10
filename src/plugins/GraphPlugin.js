export class GraphPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;

        this.dataCPU = [];
        this.dataRAM = [];
        this.maxPoints = 60;

        this.timer = 0;
        this.updateRate = 0.1;

        this.cpuLabel = null;
        this.ramLabel = null;
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x008800,
            dim: 0x003300
        };
        this.maxPoints = context.options?.maxPoints ?? 60;
        this.updateRate = context.options?.updateRate ?? 0.1;

        this.adapter = context.createFreeformAdapter();

        this.dataCPU = [];
        this.dataRAM = [];
        for (let i = 0; i < this.maxPoints; i++) {
            this.dataCPU.push(0.3);
            this.dataRAM.push(0.4);
        }

        this.cpuLabel = this.adapter.createLabel('CPU: 30%', {
            fontSize: 12,
            fill: this.theme.primary,
            x: 10,
            y: 10
        });
        this.ramLabel = this.adapter.createLabel('MEM: 6.4GB', {
            fontSize: 12,
            fill: this.theme.secondary,
            x: 110,
            y: 10
        });

        this.drawStaticGrid();
        this.renderGraph();
    }

    drawStaticGrid() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        // Build grid geometry first, then stroke (PixiJS v8)
        for (let i = 1; i < 5; i++) {
            const y = (this.height / 5) * i;
            bg.moveTo(0, y);
            bg.lineTo(this.width, y);
        }
        for (let i = 1; i < 10; i++) {
            const x = (this.width / 10) * i;
            bg.moveTo(x, 0);
            bg.lineTo(x, this.height);
        }
        bg.stroke({ width: 1, color: this.theme.dim });
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.updateRate) {
            this.timer = 0;
            this.updateData();
            this.renderGraph();
        }
    }

    updateData() {
        const lastCPU = this.dataCPU[this.dataCPU.length - 1];
        let nextCPU = lastCPU + (this.rng() - 0.5) * 0.15;
        nextCPU = Math.max(0.05, Math.min(0.95, nextCPU));

        const lastRAM = this.dataRAM[this.dataRAM.length - 1];
        let nextRAM = lastRAM + this.rng() * 0.02 - 0.005;
        if (nextRAM > 0.9) nextRAM = 0.3;
        nextRAM = Math.max(0.1, Math.min(0.95, nextRAM));

        this.dataCPU.push(nextCPU);
        this.dataRAM.push(nextRAM);

        if (this.dataCPU.length > this.maxPoints) this.dataCPU.shift();
        if (this.dataRAM.length > this.maxPoints) this.dataRAM.shift();

        this.cpuLabel.text = `CPU: ${Math.floor(nextCPU * 100)}%`;
        this.ramLabel.text = `MEM: ${(nextRAM * 16).toFixed(1)}GB`;
    }

    renderGraph() {
        const g = this.adapter.graphics;
        g.clear();

        const stepX = this.width / Math.max(1, this.maxPoints - 1);

        // 1. Build RAM path, then stroke in secondary color (PixiJS v8)
        this.buildSeriesPath(g, this.dataRAM, stepX);
        g.stroke({ width: 2, color: this.theme.secondary, alpha: 0.75 });

        // 2. Build CPU path, then stroke in primary bright color (PixiJS v8)
        this.buildSeriesPath(g, this.dataCPU, stepX);
        g.stroke({ width: 2, color: this.theme.primary });
    }

    buildSeriesPath(g, data, stepX) {
        if (!data || data.length === 0) return;

        g.moveTo(0, this.height - data[0] * this.height);
        for (let i = 1; i < data.length; i++) {
            const x = i * stepX;
            const y = this.height - data[i] * this.height;
            g.lineTo(x, y);
        }
    }

    destroy() {
        this.dataCPU = [];
        this.dataRAM = [];
        this.adapter = null;
    }
}
