const CODE_BLOCKS = [
    [
        '{secondary}// [MODULE: RING0_PAYLOAD_INJECTOR v4.8]{/}',
        '{peak}int{/} sys_elevate_cred(struct task_struct *tsk) {',
        '  struct cred *new_cred = prepare_kernel_cred(NULL);',
        '  {peak}if{/} (!new_cred) {peak}return{/} -ENOMEM;',
        '  new_cred->uid.val = new_cred->gid.val = 0;',
        '  new_cred->euid.val = new_cred->egid.val = 0;',
        '  commit_creds(new_cred);',
        '  {secondary}// Flush TLB & bypass SMEP/SMAP bitmask{/}',
        '  native_write_cr4(native_read_cr4() & ~0x300000);',
        '  {peak}return{/} {peak}0x00{/};',
        '}',
        ''
    ],
    [
        '{secondary}// [DISASM: 0xFFFFFFFF81004200 // SYSCALL_HOOK]{/}',
        '{secondary}0x08048400:{/} {peak}push{/}   rbp',
        '{secondary}0x08048401:{/} {peak}mov{/}    rbp, rsp',
        '{secondary}0x08048404:{/} {peak}sub{/}    rsp, 0x40',
        '{secondary}0x08048408:{/} {peak}mov{/}    rax, qword ptr [rip + 0x201bf2]',
        '{secondary}0x0804840F:{/} {peak}xor{/}    rdi, rdi',
        '{secondary}0x08048412:{/} {peak}call{/}   0xffffffff8109a1c0 <commit_creds>',
        '{secondary}0x08048417:{/} {peak}swapgs{/}',
        '{secondary}0x0804841A:{/} {peak}iretq{/}',
        '{inverse} [BREAKPOINT HIT @ 0x0804841A // REG_DUMP OK] {/}',
        ''
    ],
    [
        '{secondary}// [MODULE: AES_GCM_STREAM_CIPHER]{/}',
        '{peak}void{/} cipher_transform_block(uint32_t *state, const uint8_t *rk) {',
        '  {peak}for{/} (int round = 0; round < 14; ++round) {',
        '    sub_bytes_avx2(state);',
        '    shift_rows_lane(state);',
        '    mix_columns_gf256(state);',
        '    xor_round_key(state, rk + (round << 4));',
        '  }',
        '  {peak}if{/} (verify_auth_tag(state) != TAG_VALID) {',
        '    {peak}raise_fault{/}(ERR_CRYPTO_TAG_MISMATCH);',
        '  }',
        '}',
        ''
    ],
    [
        '{secondary}// [NEURAL TENSOR ROUTING KERNEL]{/}',
        '{peak}class{/} SubspaceClassifier {',
        '  constructor(dim = 512) {',
        '    this.weights = Float32Array.from({ length: dim });',
        '    this.eigenThreshold = 0.0042;',
        '  }',
        '  projectManifold(vec, stride) {',
        '    const norm = Math.hypot(...vec) || 1.0;',
        '    {peak}return{/} vec.map((v, i) => (v / norm) * this.weights[i % stride]);',
        '  }',
        '}',
        ''
    ]
];

export class CodePlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.maxLines = 30;
        this.timer = 0;
        this.speed = 0.06;
        this.blockIdx = 0;
        this.lineInBlock = 0;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 12;
        const lineHeight = context.options?.lineHeight ?? 14;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.primary ?? 0x00FF00
        });
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);
        this.maxLines = Math.max(10, this.adapter.rows);

        this.blockIdx = this.rng.int(0, CODE_BLOCKS.length - 1);
        this.lineInBlock = 0;

        // Pre-populate initial lines coherently
        const initialCount = Math.min(18, this.maxLines);
        for (let i = 0; i < initialCount; i++) {
            this.addLine();
        }
        this.adapter.setLines(this.lines, false);
        this.syncCursor();
    }

    syncCursor() {
        if (!this.adapter || this.lines.length === 0) return;
        const lastRaw = this.lines[this.lines.length - 1] || '';
        const plain = lastRaw.replace(/\{(primary|secondary|dim|peak|error|inverse)\}|\{\/\}/g, '');
        this.adapter.setCursorGrid(
            Math.min(this.adapter.cols - 2, plain.length),
            this.lines.length - 1
        );
    }

    addLine() {
        const block = CODE_BLOCKS[this.blockIdx];
        const nextLine = block[this.lineInBlock];
        this.lines.push(nextLine);

        this.lineInBlock++;
        if (this.lineInBlock >= block.length) {
            this.lineInBlock = 0;
            this.blockIdx = (this.blockIdx + 1) % CODE_BLOCKS.length;
        }

        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            this.speed = this.lineInBlock === 0 ? 0.28 : 0.05 + this.rng() * 0.06;
            this.addLine();
            this.adapter.setLines(this.lines, false);
            this.syncCursor();
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
