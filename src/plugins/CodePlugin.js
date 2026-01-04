import { Text, TextStyle, Container } from 'pixi.js';

const CODE_SNIPPETS = [
    "void inject_payload(buffer* b) {",
    "  if (b->size < MAX_OVERFLOW) return;",
    "  memcpy(0x8000000, b->data, b->size);",
    "  system.flush_cache();",
    "  // Critical failure if hash mismatch",
    "  if (crc32(b) != TARGET_HASH) abort();",
    "}",
    "class NeuralNet extends Node {",
    "  constructor(layers) {",
    "    this.weights = new Float32Array(layers);",
    "    this.bias = 0.01;",
    "  }",
    "  forward(input) {",
    "    return sigmoid(dot(input, this.weights));",
    "  }",
    "}",
    "section .text",
    "global _start",
    "_start:",
    "  mov eax, 4",
    "  mov ebx, 1",
    "  mov ecx, msg",
    "  mov edx, len",
    "  int 0x80",
    "  mov eax, 1",
    "  int 0x80",
    "// DECRYPTING BLOCK A...",
    "// KEY_FOUND: 0x9F2A",
    "// REROUTING PROXY...",
];

export class CodePlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.lines = [];
        this.textObject = null;
        this.timer = 0;
        this.speed = 0.05;
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;

        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 12,
            fill: '#00AA00', // Darker green for code
            lineHeight: 14
        });

        this.textObject = new Text({ text: '', style });
        this.container.addChild(this.textObject);

        // Pre-fill some lines
        for(let i=0; i<10; i++) this.addLine();
    }

    addLine() {
        const line = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
        // Add random indentation
        const indent = "  ".repeat(Math.floor(Math.random() * 4));
        this.lines.push(indent + line);
        
        // Keep visible amount roughly
        if (this.lines.length > 30) this.lines.shift();
    }

    update(dt) {
        this.timer += dt;
        if (this.timer > this.speed) {
            this.timer = 0;
            // Variable speed
            this.speed = Math.random() > 0.8 ? 0.2 : 0.03; 
            this.addLine();
            this.textObject.text = this.lines.join('\n');
        }
    }

    destroy() {
        this.container.removeChildren();
    }
}
