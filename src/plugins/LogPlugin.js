const LOG_MESSAGES = [
    'INITIALIZING KERNEL SUBROUTINE...',
    'BYPASSING SECURITY NODE 42...',
    'DECRYPTING 256-BIT STREAM...',
    'ACCESS GRANTED: {peak}LEVEL 5 CLEARANCE{/}',
    'UPLOADING VIRUS.EXE {secondary}[||||||....]{/}',
    'SCANNING PORTS 8080-9000...',
    'TRACE COMPLETE. IP: {peak}192.168.0.1{/}',
    'ESTABLISHING SECURE HANDSHAKE...',
    'PACKET LOSS DETECTED. {error}RETRYING...{/}',
    '{inverse} ROOT ACCESS: CONFIRMED {/}',
    'COMPILING SOURCE CODE...',
    'EXECUTING BUFFER OVERFLOW...',
    'FIREWALL BREACH {peak}SUCCESSFUL{/}',
    "DOWNLOADING DATABASE 'USERS_TABLE'...",
    'ENCRYPTING PAYLOAD...',
    'CLEANING LOG FILES...',
    'TERMINATING CONNECTION...',
    '{error}SYSTEM REBOOT REQUIRED{/}',
    'MOUNTING VIRTUAL DRIVE Z:...',
    'ALLOCATING MEMORY BLOCK {secondary}0x4F2A{/}...'
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
        this.maxLines = Math.max(5, this.adapter.rows);

        this.appendLog('{peak}SYSTEM READY.{/}', false);
    }

    formatTimestamp() {
        const total = Math.floor(this.simClockSeconds) % 86400;
        const hrs = String(Math.floor(total / 3600)).padStart(2, '0');
        const mins = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        const secs = String(total % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
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
    }

    update(dt) {
        this.simClockSeconds += dt;
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            this.speed = 0.06 + this.rng() * 0.22;

            const randomMsg = this.rng.pick(LOG_MESSAGES);
            this.appendLog(randomMsg, true);
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
