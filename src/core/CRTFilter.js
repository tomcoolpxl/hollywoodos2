import { Filter, GlProgram, UniformGroup } from 'pixi.js';

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;

uniform float uTime;
uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uChromaticAberration;
uniform float uVignette;
uniform float uNoise;

float hash(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 curveUV(vec2 uv, float curvature) {
    vec2 centered = uv * 2.0 - 1.0;
    vec2 offset = abs(centered.yx) / vec2(6.0, 4.0);
    centered = centered + centered * offset * offset * curvature;
    return centered * 0.5 + 0.5;
}

void main(void)
{
    // Normalize UV to 0..1 within the output frame
    vec2 frameUV = (vTextureCoord * uInputSize.xy) / max(uOutputFrame.zw, vec2(1.0));
    vec2 curvedFrameUV = curveUV(frameUV, uCurvature);

    if (curvedFrameUV.x < 0.0 || curvedFrameUV.x > 1.0 || curvedFrameUV.y < 0.0 || curvedFrameUV.y > 1.0) {
        finalColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec2 sampleUV = (curvedFrameUV * uOutputFrame.zw) * uInputSize.zw;

    // Subtle RGB chromatic shift
    vec2 shift = vec2(uChromaticAberration * uInputSize.z, 0.0);
    float r = texture(uTexture, sampleUV + shift).r;
    float g = texture(uTexture, sampleUV).g;
    float b = texture(uTexture, sampleUV - shift).b;
    float a = texture(uTexture, sampleUV).a;
    vec3 col = vec3(r, g, b);

    // Scanline effect + subtle phosphor bloom
    float scanlineY = gl_FragCoord.y;
    float scanWave = sin(scanlineY * 3.14159265 + uTime * 2.0);
    float scanFactor = 1.0 - uScanlineIntensity * (0.5 - 0.5 * scanWave);
    col *= scanFactor;

    // Subtle analog grain
    float grain = (hash(gl_FragCoord.xy + vec2(uTime * 37.0, uTime * 13.0)) - 0.5) * uNoise;
    col += grain;

    // Corner vignette
    vec2 vigUV = curvedFrameUV * (1.0 - curvedFrameUV.yx);
    float vig = clamp(pow(vigUV.x * vigUV.y * 15.0, uVignette), 0.0, 1.0);
    col *= vig;

    finalColor = vec4(col, a);
}
`;

export class CRTFilter extends Filter {
    constructor(options = {}) {
        const glProgram = GlProgram.from({
            vertex,
            fragment,
            name: 'crt-filter'
        });

        const crtUniforms = new UniformGroup({
            uTime: { value: 0.0, type: 'f32' },
            uCurvature: { value: options.curvature ?? 0.35, type: 'f32' },
            uScanlineIntensity: { value: options.scanlineIntensity ?? 0.22, type: 'f32' },
            uChromaticAberration: { value: options.chromaticAberration ?? 0.65, type: 'f32' },
            uVignette: { value: options.vignette ?? 0.18, type: 'f32' },
            uNoise: { value: options.noise ?? 0.025, type: 'f32' }
        });

        super({
            glProgram,
            resources: {
                crtUniforms
            }
        });
    }

    update(dt) {
        this.resources.crtUniforms.uniforms.uTime += dt;
    }

    resize() {
        // Handled dynamically via uOutputFrame and uInputSize
    }
}
