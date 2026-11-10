import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

const CHAR_WIDTH_CACHE = new Map();

export function ensureBitmapFontsInstalled() {
    // High-DPI crisp canvas Text is used for 4K sharpness; retained for API compatibility.
}

function getHighDpiResolution() {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    // Render text at 2.5x–3x resolution so scaling 1600x900 up to 3840x2160 (4K) stays razor-sharp
    return Math.min(4, Math.max(2.5, dpr * 2));
}

/**
 * Measures and caches the exact pixel width of a monospace character at `fontSize`.
 */
export function getMonoCharWidth(fontSize = 14) {
    if (CHAR_WIDTH_CACHE.has(fontSize)) {
        return CHAR_WIDTH_CACHE.get(fontSize);
    }
    let width = fontSize * 0.6;
    try {
        const sample = createRetroText('MMMMMMMMMM', { fontSize, fill: 0xffffff });
        if (sample.width > 0) {
            width = sample.width / 10;
        }
        sample.destroy();
    } catch {
        width = fontSize * 0.6;
    }
    CHAR_WIDTH_CACHE.set(fontSize, width);
    return width;
}

/**
 * Creates a crisp, high-DPI monospace Text object optimized for 4K displays.
 */
export function createRetroText(text = '', options = {}) {
    const fontSize = options.fontSize ?? 14;
    const fill = options.fill ?? 0x00FF00;
    const lineHeight = options.lineHeight ?? Math.round(fontSize * 1.2);
    const wordWrap = options.wordWrap ?? false;
    const wordWrapWidth = options.wordWrapWidth ?? 400;

    const style = new TextStyle({
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize,
        fill,
        lineHeight,
        wordWrap,
        wordWrapWidth
    });

    const txt = new Text({
        text,
        style,
        resolution: getHighDpiResolution(),
        roundPixels: true
    });
    return txt;
}

const ANSI_TAG_REGEX = /\{(primary|secondary|dim|peak|error|inverse)\}([\s\S]*?)\{\/\}/g;

/**
 * Parses a line containing Fake ANSI inline tags (e.g. "{peak}OK{/}", "{error}FAIL{/}", "{inverse}ROOT{/}")
 * into a base string (with tagged regions replaced by spaces) and positioned span descriptors.
 */
export function parseFakeAnsiLine(line) {
    if (typeof line !== 'string' || !line.includes('{')) {
        return { baseLine: line, spans: [] };
    }

    let baseLine = '';
    const spans = [];
    let lastIndex = 0;
    let visualCol = 0;

    ANSI_TAG_REGEX.lastIndex = 0;
    let match;
    while ((match = ANSI_TAG_REGEX.exec(line)) !== null) {
        const before = line.slice(lastIndex, match.index);
        baseLine += before;
        visualCol += before.length;

        const tag = match[1];
        const content = match[2];
        if (content.length > 0) {
            spans.push({
                tag,
                text: content,
                col: visualCol
            });
            baseLine += ' '.repeat(content.length);
            visualCol += content.length;
        }
        lastIndex = ANSI_TAG_REGEX.lastIndex;
    }

    const tail = line.slice(lastIndex);
    baseLine += tail;

    return { baseLine, spans };
}

/**
 * GridAdapter: Provides terminal-style character grid addressing, crisp 4K Text
 * rendering, Fake ANSI multi-color / inverse span overlays, cursor positioning,
 * and GSAP scroll animations.
 */
export class GridAdapter {
    constructor(container, width, height, cursor, options = {}) {
        this.container = container;
        this.width = width;
        this.height = height;
        this.cursor = cursor;

        this.fontSize = options.fontSize ?? 14;
        this.lineHeight = options.lineHeight ?? Math.round(this.fontSize * 1.2);
        this.color = options.color ?? 0x00FF00;
        this.theme = options.theme || {
            primary: this.color,
            secondary: 0x00AA00,
            dim: 0x003300,
            peak: 0x55FF55,
            bg: 0x000000,
            error: 0xFF3300
        };
        this.charWidth = getMonoCharWidth(this.fontSize);

        this.cols = Math.max(1, Math.floor(this.width / this.charWidth));
        this.rows = Math.max(1, Math.floor(this.height / this.lineHeight));

        this.scrollContainer = new Container();
        this.ansiBgGraphics = new Graphics();
        this.textObject = createRetroText('', {
            fontSize: this.fontSize,
            lineHeight: this.lineHeight,
            fill: this.color,
            wordWrap: Boolean(options.wordWrap),
            wordWrapWidth: this.width
        });
        this.ansiSpanContainer = new Container();
        this.spanPool = [];

        this.scrollContainer.addChild(this.ansiBgGraphics);
        this.scrollContainer.addChild(this.textObject);
        this.scrollContainer.addChild(this.ansiSpanContainer);
        this.container.addChild(this.scrollContainer);
    }

    resolveTagColor(tag) {
        switch (tag) {
            case 'peak':
                return this.theme.peak ?? 0x55FF55;
            case 'secondary':
                return this.theme.secondary ?? 0x00AA00;
            case 'dim':
                return this.theme.dim ?? 0x005500;
            case 'error':
                return this.theme.error ?? 0xFF3300;
            case 'inverse':
                return this.theme.bg ?? 0x000000;
            case 'primary':
            default:
                return this.theme.primary ?? this.color;
        }
    }

    setLines(lines, animateScroll = false) {
        const baseLines = [];
        let activeSpans = 0;
        this.ansiBgGraphics.clear();

        for (let row = 0; row < lines.length; row++) {
            const { baseLine, spans } = parseFakeAnsiLine(lines[row]);
            baseLines.push(baseLine);

            for (let s = 0; s < spans.length; s++) {
                const span = spans[s];
                const x = span.col * this.charWidth;
                const y = row * this.lineHeight;

                if (span.tag === 'inverse') {
                    const bgW = span.text.length * this.charWidth;
                    this.ansiBgGraphics
                        .rect(x, y, bgW, this.lineHeight)
                        .fill(this.theme.primary ?? this.color);
                }

                let spanTextObj = this.spanPool[activeSpans];
                if (!spanTextObj) {
                    spanTextObj = createRetroText('', {
                        fontSize: this.fontSize,
                        lineHeight: this.lineHeight,
                        fill: this.color
                    });
                    this.spanPool.push(spanTextObj);
                    this.ansiSpanContainer.addChild(spanTextObj);
                }

                spanTextObj.visible = true;
                spanTextObj.text = span.text;
                spanTextObj.style.fill = this.resolveTagColor(span.tag);
                spanTextObj.x = Math.round(x);
                spanTextObj.y = Math.round(y);
                activeSpans++;
            }
        }

        for (let i = activeSpans; i < this.spanPool.length; i++) {
            this.spanPool[i].visible = false;
        }

        this.textObject.text = baseLines.join('\n');

        if (animateScroll) {
            gsap.killTweensOf(this.scrollContainer);
            gsap.fromTo(
                this.scrollContainer,
                { y: this.lineHeight * 0.35 },
                { y: 0, duration: 0.08, ease: 'power1.out' }
            );
        }
    }

    setText(text) {
        if (!text) {
            this.setLines([], false);
            return;
        }
        this.setLines(String(text).split('\n'), false);
    }

    setCursorGrid(col, row) {
        if (!this.cursor) return;
        this.cursor.setPosition(col * this.charWidth, row * this.lineHeight);
    }

    enableCursor(type = 'block', color = this.color) {
        if (!this.cursor) return;
        this.cursor.setColor(color);
        this.cursor.setType(type);
        this.cursor.setSize(this.charWidth, this.lineHeight);
        this.cursor.setEnabled(true);
    }

    destroy() {
        gsap.killTweensOf(this.scrollContainer);
        this.spanPool = [];
    }
}

/**
 * FreeformAdapter: Provides background graphics, dynamic vector graphics, and text labels.
 * Crispness vs. analog fuzziness is controlled globally via CRTFilter presets.
 */
export class FreeformAdapter {
    constructor(container, width, height) {
        this.container = container;
        this.width = width;
        this.height = height;

        this.bgGraphics = new Graphics();
        this.graphics = new Graphics();
        this.uiContainer = new Container();

        this.container.addChild(this.bgGraphics);
        this.container.addChild(this.graphics);
        this.container.addChild(this.uiContainer);
    }

    clear() {
        this.graphics.clear();
    }

    clearBackground() {
        this.bgGraphics.clear();
    }

    strokeLine(x1, y1, x2, y2, strokeStyle = { width: 1, color: 0x00FF00 }, target = this.graphics) {
        target.moveTo(x1, y1);
        target.lineTo(x2, y2);
        target.stroke(strokeStyle);
    }

    strokeSegments(segments, strokeStyle = { width: 1, color: 0x00FF00 }, target = this.graphics) {
        if (!segments || segments.length === 0) return;
        for (let i = 0; i < segments.length; i++) {
            const [x1, y1, x2, y2] = segments[i];
            target.moveTo(x1, y1);
            target.lineTo(x2, y2);
        }
        target.stroke(strokeStyle);
    }

    strokePolyline(points, strokeStyle = { width: 1, color: 0x00FF00 }, closePath = false, target = this.graphics) {
        if (!points || points.length < 2) return;
        target.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            target.lineTo(points[i].x, points[i].y);
        }
        if (closePath) {
            target.closePath();
        }
        target.stroke(strokeStyle);
    }

    strokeCircle(x, y, radius, strokeStyle = { width: 1, color: 0x00FF00 }, target = this.graphics) {
        target.circle(x, y, radius);
        target.stroke(strokeStyle);
    }

    fillRect(x, y, w, h, fillStyle = 0x00FF00, target = this.graphics) {
        target.rect(x, y, w, h);
        target.fill(fillStyle);
    }

    createLabel(text = '', options = {}) {
        const lbl = createRetroText(text, options);
        if (options.x !== undefined) lbl.x = Math.round(options.x);
        if (options.y !== undefined) lbl.y = Math.round(options.y);
        if (options.anchorX !== undefined || options.anchorY !== undefined) {
            lbl.anchor?.set(options.anchorX ?? 0, options.anchorY ?? 0);
        }
        this.uiContainer.addChild(lbl);
        return lbl;
    }
}
