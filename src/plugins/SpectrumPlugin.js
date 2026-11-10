export class SpectrumPlugin {
    constructor() {
        this.adapter = null;
        this.width = 0;
        this.height = 0;
        this.rng = null;
        this.theme = null;
        this.bars = [];
        this.barCount = 16;
        this.updateRate = 0.15;
        this.timer = 0;
    }

    init(context) {
        this.width = context.width;
        this.height = context.height;
        this.rng = context.rng;
        this.theme = context.theme || {
            primary: 0x00FF00,
            secondary: 0x00AA00,
            dim: 0x002200,
            peak: 0x55FF55
        };
        this.barCount = context.options?.barCount ?? 16;
        this.updateRate = context.options?.updateRate ?? 0.15;

        this.adapter = context.createFreeformAdapter();

        this.bars = [];
        for (let i = 0; i < this.barCount; i++) {
            this.bars.push({
                value: 0.15 + this.rng() * 0.45,
                target: 0.15 + this.rng() * 0.45
            });
        }

        this.drawLabels();
        this.render();
    }

    drawLabels() {
        const bottomY = this.height - 15;
        const step = (this.width - 30) / this.barCount;

        const freqs = ['60', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
        for (let i = 0; i < freqs.length; i++) {
            const barIdx = Math.floor(i * (this.barCount / freqs.length));
            this.adapter.createLabel(freqs[i], {
                fontSize: 10,
                fill: this.theme.secondary,
                x: 30 + barIdx * step,
                y: bottomY
            });
        }

        const dbs = ['0', '-6', '-12', '-24'];
        for (let i = 0; i < dbs.length; i++) {
            this.adapter.createLabel(dbs[i], {
                fontSize: 10,
                fill: this.theme.secondary,
                x: 0,
                y: 22 + (this.height - 40) * (i / dbs.length)
            });
        }

        this.headerLeft = this.adapter.createLabel('FFT SPECTRUM // HANNING WINDOW 4096-PT', {
            fontSize: 10,
            fill: this.theme.primary,
            x: 6,
            y: 4
        });
        this.headerRight = this.adapter.createLabel('PEAK: -2.4 dBFS @ 2.0 kHz', {
            fontSize: 10,
            fill: this.theme.secondary,
            x: this.width - 6,
            y: 4,
            anchorX: 1,
            anchorY: 0
        });
    }

    update(dt) {
        this.timer += dt;

        if (this.timer >= this.updateRate) {
            this.timer = 0;
            for (let i = 0; i < this.barCount; i++) {
                const change = (this.rng() - 0.5) * 0.3;
                this.bars[i].target = Math.max(0.1, Math.min(0.92, this.bars[i].target + change));
            }
            if (this.headerRight) {
                const db = (-1.2 - this.rng() * 5.8).toFixed(1);
                const khz = (0.8 + this.rng() * 11.2).toFixed(1);
                this.headerRight.text = `PEAK: ${db} dBFS @ ${khz} kHz`;
            }
        }

        for (let i = 0; i < this.barCount; i++) {
            const bar = this.bars[i];
            const diff = bar.target - bar.value;
            bar.value += diff * dt * 2.5;
        }

        this.render();
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const paddingLeft = 30;
        const graphWidth = this.width - paddingLeft;
        const graphHeight = this.height - 20;

        const barWidth = Math.max(2, graphWidth / this.barCount - 4);
        const segmentHeight = 6;
        const segmentGap = 2;
        const totalSegments = Math.max(1, Math.floor(graphHeight / (segmentHeight + segmentGap)));

        for (let i = 0; i < this.barCount; i++) {
            const bar = this.bars[i];
            const x = paddingLeft + i * (barWidth + 4);
            const litSegments = Math.floor(bar.value * totalSegments);

            for (let j = 0; j < totalSegments; j++) {
                const y = graphHeight - (j + 1) * (segmentHeight + segmentGap);
                const intensity = j / totalSegments;

                let segColor = this.theme.dim;
                if (j < litSegments) {
                    segColor = intensity > 0.8 ? this.theme.peak : this.theme.secondary;
                }

                // PixiJS v8: Define rect geometry FIRST, then call .fill()
                g.rect(x, y, barWidth, segmentHeight).fill(segColor);
            }
        }
    }

    destroy() {
        this.bars = [];
        this.adapter = null;
    }
}
