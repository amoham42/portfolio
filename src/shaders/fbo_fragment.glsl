uniform float uTime;
uniform float progress;
uniform float uDelta;
uniform float uCurlScale;
uniform vec3 uForwardSpeed;
uniform float uNoiseScale;
uniform float uSpeedMultiplier;
uniform sampler2D uPositions;
uniform vec3 uStartPos;
uniform vec3 uStartArea;
uniform vec3 uEndPos;
varying vec2 vUv;
varying vec3 vPosition;
float PI = 3.141592653589793238;

float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

float noiseX(vec3 p) { return valueNoise(p + vec3(13.1, 7.2, 5.3)); }
float noiseY(vec3 p) { return valueNoise(p + vec3(5.7, 19.3, 23.4)); }
float noiseZ(vec3 p) { return valueNoise(p + vec3(17.0, 3.1, 11.1)); }

vec3 curlNoise(vec3 p) {
    float e = 0.25;
    float twoE = 2.0 * e;

    // d/dy Fz - d/dz Fy
    float dFz_dy = (noiseZ(p + vec3(0.0, e, 0.0)) - noiseZ(p - vec3(0.0, e, 0.0))) / twoE;
    float dFy_dz = (noiseY(p + vec3(0.0, 0.0, e)) - noiseY(p - vec3(0.0, 0.0, e))) / twoE;
    float cx = dFz_dy - dFy_dz;

    // d/dz Fx - d/dx Fz
    float dFx_dz = (noiseX(p + vec3(0.0, 0.0, e)) - noiseX(p - vec3(0.0, 0.0, e))) / twoE;
    float dFz_dx = (noiseZ(p + vec3(e, 0.0, 0.0)) - noiseZ(p - vec3(e, 0.0, 0.0))) / twoE;
    float cy = dFx_dz - dFz_dx;

    // d/dx Fy - d/dy Fx
    float dFy_dx = (noiseY(p + vec3(e, 0.0, 0.0)) - noiseY(p - vec3(e, 0.0, 0.0))) / twoE;
    float dFx_dy = (noiseX(p + vec3(0.0, e, 0.0)) - noiseX(p - vec3(0.0, e, 0.0))) / twoE;
    float cz = dFy_dx - dFx_dy;

    vec3 c = vec3(cx, cy, cz);
    return normalize(c);
}

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 prev = texture2D(uPositions, vUv);
    vec3 p = prev.xyz;
    float age = prev.w;

    float t = uTime * 0.25;
    vec3 curl = curlNoise(p * uNoiseScale + vec3(t, t * 0.5, -t * 0.25));

    float speedJitter = mix(0.6, 1.4, rand(vUv + 0.137));
    vec3 velocity = uForwardSpeed * speedJitter + curl * (uCurlScale * speedJitter);

    // Apply speed multiplier to movement and aging
    float effectiveDelta = uDelta * uSpeedMultiplier;
    p += velocity * effectiveDelta;
    age += effectiveDelta;

    float particleDistance = distance(p, uStartPos);
    float travelDistance = distance(uStartPos, uEndPos) * 1.2;

    if (particleDistance > travelDistance) {
        float rx = rand(vUv + 0.711);
        float ry = rand(vUv + 0.373);
        float rz = rand(vUv + 0.927);
        p = uStartPos + vec3(rx * uStartArea.x, ry * uStartArea.y, rz * uStartArea.z);
        age = 0.0;
    }

    gl_FragColor = vec4(p, age);
}