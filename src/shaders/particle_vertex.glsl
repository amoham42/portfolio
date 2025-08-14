uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;
uniform sampler2D uPositions;

uniform float uBasePointSize;     // base pixel scale
uniform float uMinSize;           // per-particle min size multiplier
uniform float uMaxSize;           // per-particle max size multiplier
uniform vec3  uTargetPos;         // world-space target to shrink near
uniform float uNearRadius;        // radius within which size is reduced
uniform float uShrinkSpeed;       // exponential decay factor

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vUv = uv;
    vec4 pos = texture2D(uPositions, uv);

    vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
    float r = rand(uv + 0.317);
    float baseSize = mix(uMaxSize, uMinSize, r);

    float age = pos.w;
    float decay = exp(-uShrinkSpeed * age);
    baseSize *= clamp(decay, 0.0, 1.0);

    float d = distance(pos.xyz, uTargetPos);
    float atten = smoothstep(0.0, uNearRadius, d);

    gl_PointSize = uBasePointSize * baseSize * atten * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}