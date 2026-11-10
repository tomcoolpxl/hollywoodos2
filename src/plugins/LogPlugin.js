const LOG_TEMPLATES = [
    (rng) => `INITIALIZING KERNEL SUBROUTINE {secondary}0x${rng.int(0x1000, 0xFFFF).toString(16).toUpperCase()}{/}...`,
    (rng) => `BYPASSING SECURITY NODE ${rng.int(10, 99)} [GATEWAY-${rng.int(1, 9)}]...`,
    (rng) => `DECRYPTING 256-BIT STREAM // CH-${rng.int(1, 16)}...`,
    (rng) => `ACCESS GRANTED: {peak}LEVEL ${rng.int(4, 9)} CLEARANCE{/}`,
    (rng) => `UPLOADING PAYLOAD.BIN {secondary}[|||||||...] ${rng.int(65, 99)}%{/}`,
    (rng) => `SCANNING TCP PORTS ${rng.int(1024, 4096)}-${rng.int(8000, 9999)}...`,
    (rng) => `TRACE COMPLETE. ENDPOINT: {peak}10.${rng.int(10, 250)}.${rng.int(1, 254)}.${rng.int(1, 254)}{/}`,
    (rng) => `ESTABLISHING TLSv1.3 HANDSHAKE [RTT: ${rng.int(2, 18)}ms]...`,
    (rng) => `PACKET ANOMALY ON ETH${rng.int(0, 3)}. {error}REROUTING...{/}`,
    () => `{inverse} ROOT ACCESS: CONFIRMED // UID=0 {/}`,
    (rng) => `COMPILING SHADER MODULE [CRC32: 0x${rng.int(0x100000, 0xFFFFFF).toString(16).toUpperCase()}]...`,
    (rng) => `INJECTING RING-0 HOOK AT {secondary}0xFFFFFFFF810${rng.int(10, 99)}0{/}...`,
    (rng) => `FIREWALL RULE #${rng.int(100, 899)} OVERRIDE {peak}SUCCESSFUL{/}`,
    (rng) => `SYNCING REPLICA SHARD 'SECTOR_${rng.int(1, 12)}'...`,
    (rng) => `ROTATING SESSION KEY [EPOCH ${rng.int(4000, 9999)}]...`,
    (rng) => `SCRUBBING AUDIT TRAIL /var/log/auth.${rng.int(1, 5)}...`,
    (rng) => `CLOSING IDLE SOCKET FD=${rng.int(12, 255)}...`,
    (rng) => `{error}INTRUSION COUNTERMEASURE DETECTED [NODE-${rng.int(1, 24)}]{/}`,
    (rng) => `MOUNTING ENCRYPTED VOLUME /dev/mapper/vault${rng.int(0, 4)}...`,
    (rng) => `ALLOCATING DMA BUFFER {secondary}0x${rng.int(0x4000, 0xFFFF).toString(16).toUpperCase()}{/} (64KB)...`
];

export class LogPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.maxLines = 20;
        this.timer = 0;
        this.speed = 0.12;
        this.simClockSeconds = 34210; // Deterministic starting clock (09:30:10)
        this.lastTemplateIdx = -1;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 14;
        const lineHeight = context.options?.lineHeight ?? 16;
        this.speed = context.options?.speed ?? 0.12;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.primary ?? 0x00FF00,
            wordWrap: false
        });
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);
        this.maxLines = Math.max(5, this.adapter.rows);

        // Pre-populate several initial log entries so the window starts rich
        this.appendLog('{peak}SYSTEM TELEMETRY DAEMON ONLINE.{/}', false);
        for (let i = 0; i < Math.min(6, this.maxLines - 1); i++) {
            this.simClockSeconds += 0.4;
            this.appendNextTemplate(false);
        }
    }

    formatTimestamp() {
        const total = Math.floor(this.simClockSeconds) % 86400;
        const hrs = String(Math.floor(total / 3600)).padStart(2, '0');
        const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const secs = String(total % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    appendNextTemplate(animate = true) {
        let idx = this.rng.int(0, LOG_TEMPLATES.length - 1);
        if (idx === this.lastTemplateIdx) {
            idx = (idx + 1) % LOG_TEMPLATES.length;
        }
        this.lastTemplateIdx = idx;
        const msg = LOG_TEMPLATES[idx](this.rng);
        this.appendLog(msg, animate);
    }

    appendLog(message, animate = true) {
        const timestamp = this.formatTimestamp();
        const line = `{secondary}[${timestamp}]{/} ${message}`;

        this.lines.push(line);

        const didScroll = this.lines.length > this.maxLines;
        if (didScroll) {
            this.lines.shift();
        }

        this.adapter.setLines(this.lines, animate && didScroll);
        const plain = line.replace(/\{(primary|secondary|dim|peak|error|inverse)\}|\{\/\}/g, '');
        this.adapter.setCursorGrid(
            Math.min(this.adapter.cols - 2, plain.length),
            this.lines.length - 1
        );
    }

    update(dt) {
        this.simClockSeconds += dt;
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            this.speed = 0.08 + this.rng() * 0.22;
            this.appendNextTemplate(true);
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
