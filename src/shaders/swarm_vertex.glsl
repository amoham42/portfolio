precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;

attribute vec3 position;
attribute vec2 uv;
attribute vec3 translate;

varying vec2 vUv;
varying float vScale;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main() {

    float t = uTime * 1.2;

    vec2 cell = floor(translate.xz + 0.5);
    float jitter = hash12(cell) * 6.2831; // random phase per lane

    float wavePhase = translate.y * 0.35 - t * 2.0 + jitter;
    float wave = 0.5 + 0.5 * sin(wavePhase);
    float widthRand = mix(0.05, 0.35, hash12(translate.xz));
    float pulse = smoothstep(1.0 - widthRand, 1.0, wave);

    float subtle = 0.45 * (sin((translate.x + translate.y + translate.z) * 0.35 + t * 0.25) * 0.5 + 0.5);

    float baseScale = 0.65 + subtle;
    float minScale = 0.45;
    float scale = mix(baseScale, minScale, pulse);

    vScale = scale;

    vec4 modelPosition = vec4(translate + position * scale, 1.0);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * modelPosition;

}