import { Filter, GlProgram } from 'pixi.js';

const vertex = `
    attribute vec2 aPosition;
    uniform mat3 uProjectionMatrix;
    uniform vec4 uInputSize; // [width, height, 1/width, 1/height]
    varying vec2 vTextureCoord;

    void main() {
        gl_Position = vec4((uProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
        vTextureCoord = aPosition * uInputSize.zw; // Multiply by inverse size to get 0..1
    }
`;

const fragment = `
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main() {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`;

export class CRTFilter extends Filter {
    constructor() {
        super({
            glProgram: new GlProgram({
                vertex,
                fragment,
            })
        });
    }

    update(dt) {}
    resize(width, height) {}
}