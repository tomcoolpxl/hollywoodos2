export class BootPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.timer = 0;
        this.nextDelay = 0.2;
        this.state = 'booting';
        this.bootLog = [
            'BIOS DATE 01/01/99 14:22:51 {secondary}VER 4.02-MIL{/}',
            'CPU: DUAL TACTICAL RISC @ {peak}1.20 GHz{/} [SMP-OK]',
            'MEMORY TEST: 16,777,216K {peak}OK [ECC ENABLED]{/}',
            'INITIALIZING IOMMU & DMA PROTECTION... {peak}DONE{/}',
            'PCIe BUS 00:01.0 -> CRYPTO ACCELERATOR {peak}[ONLINE]{/}',
            'PCIe BUS 00:02.0 -> VECTOR DISPLAY DSP {peak}[ONLINE]{/}',
            'PCIe BUS 00:04.0 -> SATCOM UPLINK NIC  {peak}[ONLINE]{/}',
            'MOUNTING /dev/nvme0n1p1 (ROOTFS)... {peak}OK{/}',
            'MOUNTING /dev/sda1 (LEGACY ARCHIVE)... {error}READ-ONLY{/}',
            'LOADING KERNEL IMAGE: /boot/vmlinuz-hollywood-sec...',
            'VERIFYING RSA-4096 KERNEL SIGNATURE... {peak}VALID{/}',
            'STARTING SUBSYSTEM: NETFILTER_ZERO_TRUST... {peak}OK{/}',
            'STARTING SUBSYSTEM: ORBITAL_TELEMETRY_DAEMON... {peak}OK{/}',
            'CALIBRATING PHASE-LOCKED LOOP... {secondary}0x004F00{/}',
            'ESTABLISHING ENCRYPTED MESH TUNNEL...',
            '{inverse} SYSTEM READY // OPERATOR TERMINAL ACTIVE {/}'
        ];
        this.currentLineIdx = 0;
        this.maxLines = 20;
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
        this.maxLines = Math.max(6, this.adapter.rows);
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);

        this.reset();
    }

    reset() {
        this.lines = this.bootLog.slice(0, 4);
        this.currentLineIdx = 4;
        this.adapter.setLines(this.lines, false);
        this.state = 'booting';
        this.timer = 0;
        this.nextDelay = 0.14 + this.rng() * 0.12;
        this.updateCursorPos();
    }

    updateCursorPos() {
        if (this.lines.length === 0) {
            this.adapter.setCursorGrid(0, 0);
            return;
        }
        const lastRaw = this.lines[this.lines.length - 1] || '';
        const plain = lastRaw.replace(/\{(primary|secondary|dim|peak|error|inverse)\}|\{\/\}/g, '');
        this.adapter.setCursorGrid(
            Math.min(this.adapter.cols - 2, plain.length + 1),
            this.lines.length - 1
        );
    }

    update(dt) {
        this.timer += dt;

        if (this.state === 'booting') {
            if (this.timer >= this.nextDelay) {
                this.timer = 0;
                this.nextDelay = 0.14 + this.rng() * 0.14;
                if (this.currentLineIdx < this.bootLog.length) {
                    this.lines.push(this.bootLog[this.currentLineIdx]);
                    if (this.lines.length > this.maxLines) {
                        this.lines.shift();
                    }
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
