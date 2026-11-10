const CODE_SNIPPETS = [
    'void inject_payload(buffer* b) {',
    '  if (b->size < MAX_OVERFLOW) return;',
    '  memcpy(0x8000000, b->data, b->size);',
    '  system.flush_cache();',
    '  // Critical failure if hash mismatch',
    '  if (crc32(b) != TARGET_HASH) abort();',
    '}',
    'class NeuralNet extends Node {',
    '  constructor(layers) {',
    '    this.weights = new Float32Array(layers);',
    '    this.bias = 0.01;',
    '  }',
    '  forward(input) {',
    '    return sigmoid(dot(input, this.weights));',
    '  }',
    '}',
    'section .text',
    'global _start',
    '_start:',
    '  mov eax, 4',
    '  mov ebx, 1',
    '  mov ecx, msg',
    '  mov edx, len',
    '  int 0x80',
    '  mov eax, 1',
    '  int 0x80',
    '// DECRYPTING BLOCK A...',
    '// KEY_FOUND: 0x9F2A',
    '// REROUTING PROXY...'
];

export class CodePlugin {
    constructor() {
        this.adapter = null;
        this.rng = null;
        this.lines = [];
        this.maxLines = 30;
        this.timer = 0;
        this.speed = 0.05;
    }

    init(context) {
        this.rng = context.rng;
        const fontSize = context.options?.fontSize ?? 12;
        const lineHeight = context.options?.lineHeight ?? 14;

        this.adapter = context.createGridAdapter({
            fontSize,
            lineHeight,
            color: context.theme?.secondary ?? 0x00AA00
        });
        this.maxLines = Math.max(10, this.adapter.rows);

        for (let i = 0; i < Math.min(10, this.maxLines); i++) {
            this.addLine();
        }
        this.adapter.setLines(this.lines, false);
    }

    addLine() {
        const line = this.rng.pick(CODE_SNIPPETS);
        const indent = '  '.repeat(this.rng.int(0, 3));
        this.lines.push(indent + line);

        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.timer = 0;
            this.speed = this.rng() > 0.8 ? 0.2 : 0.04;
            this.addLine();
            this.adapter.setLines(this.lines, false);
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
