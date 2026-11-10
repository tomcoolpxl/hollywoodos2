export class HexPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.nextOffset = 0x1000;
        this.rows = 0;
        this.speed = 0.06;
        this.timer = 0;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 14;
        const lineHeight = context.options?.lineHeight ?? 16;
        this.speed = context.options?.speed ?? 0.06;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.primary ?? 0x00FF00
        });
        this.rows = this.adapter.rows;
        this.nextOffset = 0x1000;

        this.generateInitialData();
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);
        this.adapter.setCursorGrid(10, 0);
    }

    generateInitialData() {
        this.lines = [];
        for (let i = 0; i < this.rows; i++) {
            this.lines.push(this.generateLine(this.nextOffset));
            this.nextOffset += 16;
        }
        this.adapter.setLines(this.lines, false);
    }

    generateLine(offset) {
        const hexOffset = (offset >>> 0).toString(16).toUpperCase().padStart(8, '0');
        let hexBytes = '';
        let ascii = '';

        for (let j = 0; j < 8; j++) {
            const val = this.rng.int(0, 255);
            hexBytes += val.toString(16).toUpperCase().padStart(2, '0') + ' ';
            ascii += val > 32 && val < 127 ? String.fromCharCode(val) : '.';
        }

        return `${hexOffset}  ${hexBytes} |${ascii}|`;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            if (this.lines.length >= this.rows) {
                this.lines.shift();
            }
            this.lines.push(this.generateLine(this.nextOffset));
            this.nextOffset = (this.nextOffset + 16) & 0xFFFFFFFF;
            this.adapter.setLines(this.lines, false);
        }

        if (this.rng() > 0.88) {
            const r = this.rng.int(0, Math.max(0, this.rows - 1));
            const c = 10 + this.rng.int(0, 23);
            this.adapter.setCursorGrid(c, r);
        }
    }

    destroy() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        this.lines = [];
    }
}
