uniform float uTime;
uniform float progress;
uniform sampler2D uPositions;
uniform vec3 uColor;
uniform float uColorVariation;
varying vec2 vUv;
varying vec3 vPosition;

float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 p = gl_PointCoord - 0.5;
    float alpha = smoothstep(0.5, 0.0, length(p));
    
    // Base color from uniform
    vec3 col = uColor;
    
    // Add color variation if specified
    if (uColorVariation > 0.0) {
        float r1 = rand(vUv + 0.317);
        float r2 = rand(vUv + 0.759);
        float r3 = rand(vUv + 0.123);
        
        vec3 variation = vec3(r1, r2, r3) - 0.5;
        col += variation * uColorVariation;
        col = clamp(col, 0.0, 1.0);
    }
    
    gl_FragColor = vec4(col, alpha);
}