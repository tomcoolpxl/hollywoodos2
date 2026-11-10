import { Filter, GlProgram, UniformGroup } from 'pixi.js';

export const CRT_PRESETS = [
    {
        id: 'super_crisp',
        label: 'SUPER CRISP (RAW 4K)',
        enabled: false,
        resolutionScale: 1.0,
        softness: 0.0,
        scanlineIntensity: 0.0,
        chromaticAberration: 0.0,
        vignette: 0.0,
        noise: 0.0
    },
    {
        id: 'sharp_crt',
        label: 'SHARP CRT',
        enabled: true,
        resolutionScale: 1.0,
        softness: 0.15,
        scanlineIntensity: 0.14,
        chromaticAberration: 0.18,
        vignette: 0.12,
        noise: 0.012
    },
    {
        id: 'soft_phosphor',
        label: 'SOFT PHOSPHOR',
        enabled: true,
        resolutionScale: 0.85,
        softness: 0.75,
        scanlineIntensity: 0.20,
        chromaticAberration: 0.42,
        vignette: 0.16,
        noise: 0.018
    },
    {
        id: 'retro_lowres',
        label: 'RETRO LOW-RES',
        enabled: true,
        resolutionScale: 0.55,
        softness: 1.05,
        scanlineIntensity: 0.26,
        chromaticAberration: 0.65,
        vignette: 0.20,
        noise: 0.026
    },
    {
        id: 'heavy_analog',
        label: 'HEAVY ANALOG',
        enabled: true,
        resolutionScale: 0.36,
        softness: 1.45,
        scanlineIntensity: 0.34,
        chromaticAberration: 1.05,
        vignette: 0.26,
        noise: 0.038
    }
];

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
uniform float uSoftness;
uniform float uScanlineIntensity;
uniform float uChromaticAberration;
uniform float uVignette;
uniform float uNoise;

float hash(vec2 co) {
    return fract(sin(dot( mod(co.xy, 1024.0), vec2(12.9898, 78.233) )) * 43758.5453);
}

vec4 sampleClamped(vec2 uv) {
    return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw));
}

vec3 sampleChromatic(vec2 uv, vec2 shift) {
    float r = sampleClamped(uv + shift).r;
    float g = sampleClamped(uv).g;
    float b = sampleClamped(uv - shift).b;
    return vec3(r, g, b);
}

void main(void)
{
    vec2 sampleUV = clamp(vTextureCoord, uInputClamp.xy, uInputClamp.zw);
    vec2 texel = uInputSize.zw;
    vec2 shift = vec2(uChromaticAberration * texel.x, 0.0);

    // Center sample with RGB chromatic shift
    vec3 centerCol = sampleChromatic(sampleUV, shift);
    float a = sampleClamped(sampleUV).a;
    vec3 col = centerCol;

    // Unified 9-tap phosphor beam softness & halation bloom
    if (uSoftness > 0.01) {
        vec2 radius = texel * (0.85 * uSoftness);
        vec3 blurSum = centerCol * 0.28;
        blurSum += sampleChromatic(sampleUV + vec2( radius.x, 0.0), shift) * 0.14;
        blurSum += sampleChromatic(sampleUV + vec2(-radius.x, 0.0), shift) * 0.14;
        blurSum += sampleChromatic(sampleUV + vec2(0.0,  radius.y), shift) * 0.12;
        blurSum += sampleChromatic(sampleUV + vec2(0.0, -radius.y), shift) * 0.12;
        blurSum += sampleChromatic(sampleUV + vec2( radius.x,  radius.y), shift) * 0.05;
        blurSum += sampleChromatic(sampleUV + vec2(-radius.x,  radius.y), shift) * 0.05;
        blurSum += sampleChromatic(sampleUV + vec2( radius.x, -radius.y), shift) * 0.05;
        blurSum += sampleChromatic(sampleUV + vec2(-radius.x, -radius.y), shift) * 0.05;

        float blend = clamp(uSoftness * 0.55, 0.0, 0.85);
        // Combine softened beam with subtle phosphor halation boost on bright features
        col = mix(centerCol, blurSum, blend) + blurSum * (0.14 * uSoftness);
    }

    // CRT scanline modulation
    float scanWave = sin(gl_FragCoord.y * 3.14159265 + uTime * 1.5);
    float scanFactor = 1.0 - uScanlineIntensity * (0.5 - 0.5 * scanWave);
    col *= scanFactor;

    // Analog grain
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
            uSoftness: { value: options.softness ?? 0.15, type: 'f32' },
            uScanlineIntensity: { value: options.scanlineIntensity ?? 0.14, type: 'f32' },
            uChromaticAberration: { value: options.chromaticAberration ?? 0.18, type: 'f32' },
            uVignette: { value: options.vignette ?? 0.12, type: 'f32' },
            uNoise: { value: options.noise ?? 0.012, type: 'f32' }
        });

        super({
            glProgram,
            resolution: 'inherit',
            antialias: 'inherit',
            resources: {
                crtUniforms
            }
        });

        this.currentPreset = CRT_PRESETS[1]; // default: 'sharp_crt'
        this.applyPreset(options.preset || 'sharp_crt');
    }

    applyPreset(presetId) {
        const preset =
            CRT_PRESETS.find((p) => p.id === presetId) ||
            CRT_PRESETS[1]; // fallback to 'sharp_crt'
        this.currentPreset = preset;

        const u = this.resources.crtUniforms.uniforms;
        u.uSoftness = preset.softness;
        u.uScanlineIntensity = preset.scanlineIntensity;
        u.uChromaticAberration = preset.chromaticAberration;
        u.uVignette = preset.vignette;
        u.uNoise = preset.noise;

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
        this.resolution = Math.max(0.25, dpr * (preset.resolutionScale ?? 1.0));
        return preset;
    }

    update(dt) {
        this.resources.crtUniforms.uniforms.uTime = (this.resources.crtUniforms.uniforms.uTime + dt) % 1000;
    }

    resize() {}
}
