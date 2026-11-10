import { Filter, GlProgram, UniformGroup } from 'pixi.js';

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFrameCoord;

uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uOutputTexture;

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
    vFrameCoord = aPosition;
}
`;

const fragment = `
in vec2 vTextureCoord;
in vec2 vFrameCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uInputClamp;

uniform float uTime;
uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uChromaticAberration;
uniform float uVignette;
uniform float uNoise;

float hash(vec2 co) {
    return fract(sin(dot( mod(co.xy, 1024.0), vec2(12.9898, 78.233) )) * 43758.5453);
}

void main(void)
{
    vec2 sampleUV = clamp(vTextureCoord, uInputClamp.xy, uInputClamp.zw);

    // Very subtle RGB chromatic shift so 4K text remains crisp
    vec2 shift = vec2(uChromaticAberration * uInputSize.z, 0.0);
    float r = texture(uTexture, clamp(sampleUV + shift, uInputClamp.xy, uInputClamp.zw)).r;
    float g = texture(uTexture, sampleUV).g;
    float b = texture(uTexture, clamp(sampleUV - shift, uInputClamp.xy, uInputClamp.zw)).b;
    float a = texture(uTexture, sampleUV).a;
    vec3 col = vec3(r, g, b);

    // Subtle scanline modulation
    float scanWave = sin(gl_FragCoord.y * 3.14159265 + uTime * 1.5);
    float scanFactor = 1.0 - uScanlineIntensity * (0.5 - 0.5 * scanWave);
    col *= scanFactor;

    // Subtle analog grain
    float grain = (hash(gl_FragCoord.xy + vec2(uTime * 37.0, uTime * 13.0)) - 0.5) * uNoise;
    col = max(vec3(0.0), col + grain);

    // Corner vignette using normalized 0..1 frame coordinates
    vec2 vigUV = clamp(vFrameCoord, 0.0, 1.0);
    vigUV = vigUV * (1.0 - vigUV.yx);
    float vig = clamp(pow(max(0.0, vigUV.x * vigUV.y * 15.0), uVignette), 0.0, 1.0);
    col *= vig;

    finalColor = vec4(col, a);
}
`;

export class CRTFilter extends Filter {
    constructor(options = {}) {
        const glProgram = GlProgram.from({
            vertex,
            fragment,
            name: 'crt-filter',
            preferredVertexPrecision: 'highp',
            preferredFragmentPrecision: 'highp'
        });

        const crtUniforms = new UniformGroup({
            uTime: { value: 0.0, type: 'f32' },
            uCurvature: { value: options.curvature ?? 0.15, type: 'f32' },
            uScanlineIntensity: { value: options.scanlineIntensity ?? 0.14, type: 'f32' },
            uChromaticAberration: { value: options.chromaticAberration ?? 0.18, type: 'f32' },
            uVignette: { value: options.vignette ?? 0.12, type: 'f32' },
            uNoise: { value: options.noise ?? 0.015, type: 'f32' }
        });

        super({
            glProgram,
            resolution: 'inherit',
            antialias: 'inherit',
            resources: {
                crtUniforms
            }
        });
    }

    update(dt) {
        this.resources.crtUniforms.uniforms.uTime = (this.resources.crtUniforms.uniforms.uTime + dt) % 1000;
    }

    resize() {}
}
