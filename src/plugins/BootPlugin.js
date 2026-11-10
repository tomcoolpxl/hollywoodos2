export class BootPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.timer = 0;
        this.nextDelay = 0.25;
        this.state = 'booting';
        this.bootLog = [
            'BIOS DATE 01/01/99 14:22:51 {secondary}VER 1.02{/}',
            'CPU: NEC V20, SPEED: {peak}8 MHz{/}',
            '640K RAM SYSTEM {peak}OK{/}',
            'INITIALIZING VIDEO ADAPTER...',
            'VIDEO ADAPTER {peak}INITIALIZED{/}',
            'LOADING OS...',
            'MOUNTING DISK A: ... {error}FAILED{/}',
            'MOUNTING DISK C: ... {peak}OK{/}',
            'READING SECTOR {secondary}0x000{/}...',
            'EXECUTING BOOTSTRAP...',
            '{inverse} SYSTEM READY. {/}'
        ];
        this.currentLineIdx = 0;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 14;
        const lineHeight = context.options?.lineHeight ?? 18;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.primary ?? 0x00FF00
        });
        this.adapter.enableCursor('underline', context.theme?.primary ?? 0x00FF00);

        this.reset();
    }

    reset() {
        this.lines = [];
        this.currentLineIdx = 0;
        this.adapter.setText('');
        this.state = 'booting';
        this.timer = 0;
        this.nextDelay = 0.2 + this.rng() * 0.15;
        this.updateCursorPos();
    }

    updateCursorPos() {
        this.adapter.setCursorGrid(0, this.lines.length);
    }

    update(dt) {
        this.timer += dt;

        if (this.state === 'booting') {
            if (this.timer >= this.nextDelay) {
                this.timer = 0;
                this.nextDelay = 0.2 + this.rng() * 0.15;
                if (this.currentLineIdx < this.bootLog.length) {
                    this.lines.push(this.bootLog[this.currentLineIdx]);
                    this.currentLineIdx++;
                    this.adapter.setLines(this.lines, false);
                    this.updateCursorPos();
                } else {
                    this.state = 'waiting';
                }
            }
        } else if (this.state === 'waiting') {
            if (this.timer > 3.0) {
                this.reset();
            }
        }
    }

    destroy() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
    }
}
