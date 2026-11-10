const TARGET_KEYS = [
    'CPE-1704-TKS // LAUNCH_AUTH',
    '0x9F4A-77C1-B80E-DEAD-BEEF',
    'JOSHUA // WOPR-NORAD-ROOT',
    'AES256:88A1-F04C-39D2-7E11',
    'SAT-UPLINK:KEY-OMEGA-9941'
];

const HEX_POOL = '0123456789ABCDEF#$%&*@!?<>';

export class DecryptPlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.targetKey = '';
        this.lockedMask = [];
        this.lockedCount = 0;
        this.attemptCount = 0;
        this.timer = 0;
        this.lockTimer = 0;
        this.holdTimer = 0;
        this.state = 'cracking'; // 'cracking' | 'unlocked'
        this.history = [];
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

        this.startNewTarget();
    }

    startNewTarget() {
        this.targetKey = this.rng.pick(TARGET_KEYS);
        this.lockedMask = new Array(this.targetKey.length).fill(false);
        for (let i = 0; i < this.targetKey.length; i++) {
            if (this.targetKey[i] === ' ' || this.targetKey[i] === '/' || this.targetKey[i] === ':' || this.targetKey[i] === '-') {
                this.lockedMask[i] = true;
            }
        }
        this.lockedCount = this.lockedMask.filter(Boolean).length;
        this.state = 'cracking';
        this.timer = 0;
        this.lockTimer = 0;
        this.holdTimer = 0;
        this.renderFrame();
    }

    buildCipherLine() {
        let out = '';
        for (let i = 0; i < this.targetKey.length; i++) {
            if (this.lockedMask[i]) {
                out += `{peak}${this.targetKey[i]}{/}`;
            } else {
                const idx = this.rng.int(0, HEX_POOL.length - 1);
                out += `{secondary}${HEX_POOL[idx]}{/}`;
            }
        }
        return out;
    }

    update(dt) {
        this.timer += dt;
        this.lockTimer += dt;

        if (this.state === 'cracking') {
            if (this.lockTimer >= 0.16) {
                this.lockTimer = 0;
                const unlockedIndices = [];
                for (let i = 0; i < this.lockedMask.length; i++) {
                    if (!this.lockedMask[i]) unlockedIndices.push(i);
                }

                if (unlockedIndices.length > 0) {
                    const pickIdx = this.rng.pick(unlockedIndices);
                    this.lockedMask[pickIdx] = true;
                    this.lockedCount = this.lockedMask.filter(Boolean).length;
                } else {
                    this.state = 'unlocked';
                    this.holdTimer = 0;
                    this.history.unshift(this.targetKey);
                    if (this.history.length > 4) this.history.pop();
                }
            }

            if (this.timer >= 0.05) {
                this.timer = 0;
                this.attemptCount += this.rng.int(128, 940);
                this.renderFrame();
            }
        } else if (this.state === 'unlocked') {
            this.holdTimer += dt;
            if (this.holdTimer >= 2.2) {
                this.startNewTarget();
            }
        }
    }

    renderFrame() {
        const total = Math.max(1, this.targetKey.length);
        const pct = Math.floor((this.lockedCount / total) * 100);
        const barWidth = 20;
        const filled = Math.floor((pct / 100) * barWidth);
        const bar = '#'.repeat(filled) + '.'.repeat(Math.max(0, barWidth - filled));

        const statusBadge =
            this.state === 'unlocked'
                ? '{inverse} KEY DECRYPTED // ACCESS GRANTED {/}'
                : '{secondary}BRUTE-FORCE CIPHER SEARCH ACTIVE...{/}';

        const lines = [
            'WARGAMES CRYPTO ENGINE v4.2',
            `ATTEMPTS : ${this.attemptCount.toLocaleString('en-US')}`,
            `PROGRESS : [{peak}${bar}{/}] ${pct}%`,
            '',
            'ACTIVE CIPHER VECTOR:',
            `  ${this.buildCipherLine()}`,
            '',
            statusBadge,
            '',
            'RECENTLY CRACKED KEYS:'
        ];

        if (this.history.length === 0) {
            lines.push('  {secondary}-- NONE --{/}');
        } else {
            for (const item of this.history) {
                lines.push(`  {peak}[OK]{/} ${item}`);
            }
        }

        this.adapter.setLines(lines, false);
    }

    destroy() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        this.history = [];
    }
}
