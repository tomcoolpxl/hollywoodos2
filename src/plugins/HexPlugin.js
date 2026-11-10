const REG_NAMES = ['RAX', 'RBX', 'RCX', 'RDX', 'RSI', 'RDI', 'RBP', 'RSP', 'RIP', 'CR3', 'EFL', 'CS '];

export class HexPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.nextOffset = 0x00401000;
        this.rows = 0;
        this.cols = 0;
        this.speed = 0.08;
        this.timer = 0;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 14;
        const lineHeight = context.options?.lineHeight ?? 16;
        this.speed = context.options?.speed ?? 0.08;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.primary ?? 0x00FF00
        });
        this.rows = Math.max(4, this.adapter.rows);
        this.cols = this.adapter.cols;
        this.nextOffset = 0x00401000;

        this.generateInitialData();
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);
        this.adapter.setCursorGrid(10, 1);
    }

    getHeaderLine() {
        const base = '{secondary}ADDRESS   00 01 02 03 04 05 06 07  |ASCII   |{/}';
        if (this.cols >= 62) {
            return `${base}  {secondary}REGISTER STATE{/}`;
        }
        return base;
    }

    generateInitialData() {
        this.lines = [];
        const dataRows = Math.max(1, this.rows - 1);
        for (let i = 0; i < dataRows; i++) {
            this.lines.push(this.generateLine(this.nextOffset, i));
            this.nextOffset += 8;
        }
        this.renderLines();
    }

    generateLine(offset, rowIdx = 0) {
        const hexOffset = (offset >>> 0).toString(16).toUpperCase().padStart(8, '0');
        let hexBytes = '';
        let ascii = '';

        const highlightIdx = this.rng.chance(0.18) ? this.rng.int(0, 7) : -1;

        for (let j = 0; j < 8; j++) {
            const val = this.rng.int(0, 255);
            const hex = val.toString(16).toUpperCase().padStart(2, '0');
            if (j === highlightIdx) {
                hexBytes += `{peak}${hex}{/} `;
            } else {
                hexBytes += `${hex} `;
            }
            ascii += val > 32 && val < 126 && val !== 123 && val !== 125 ? String.fromCharCode(val) : '.';
        }

        let line = `{secondary}${hexOffset}{/}  ${hexBytes} |${ascii}|`;

        if (this.cols >= 62) {
            const reg = REG_NAMES[rowIdx % REG_NAMES.length];
            const regVal = this.rng.int(0, 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0');
            line += `  {secondary}${reg}:{/} 0x${regVal}`;
        }

        return line;
    }

    renderLines() {
        this.adapter.setLines([this.getHeaderLine(), ...this.lines], false);
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            const dataRows = Math.max(1, this.rows - 1);
            if (this.lines.length >= dataRows) {
                this.lines.shift();
            }
            this.lines.push(this.generateLine(this.nextOffset, this.nextOffset >> 3));
            this.nextOffset = (this.nextOffset + 8) & 0xFFFFFFFF;
            this.renderLines();
        }

        if (this.rng() > 0.88) {
            const r = 1 + this.rng.int(0, Math.max(0, this.rows - 2));
            const c = 10 + this.rng.int(0, 22);
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
