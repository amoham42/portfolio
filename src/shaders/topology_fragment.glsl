varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uRadius;

#define CURLINESS_INTENSITY 0.2

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2(i + vec2(1.1, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float curlyCircle(vec2 p, float baseRadius, float intensity) {
    float angle = atan(p.y, p.x);
    float dist = length(p);
    
    // Animate the curliness patterns with time and seed variation
    float timeOffset = uTime * 0.3;
    float seedOffset = uSeed * 0.1;
    float curliness = (sin(angle * 3.0 + timeOffset + seedOffset) * 0.15 +
                      sin(angle * 7.0 + timeOffset * 1.5 + seedOffset * 2.0) * 0.08 +
                      sin(angle * 11.0 + timeOffset * 2.0 + seedOffset * 3.0) * 0.05) * intensity;
    
    // Add time-varying noise with seed variation for more organic movement
    curliness += noise(vec2(angle * 2.0 + timeOffset * 0.5 + seedOffset, uTime * 0.2 + uSeed)) * 0.1 * intensity;
   
    float dentAngle = 0.0;
    float angleDiff = abs(atan(sin(angle - dentAngle), cos(angle - dentAngle)));
    float dentZone = smoothstep(1.2, 0.8, angleDiff);
    float dentDepth = -0.5 * intensity;
    curliness += dentDepth * dentZone;
    float distortedRadius = baseRadius + curliness;
    
    return dist - distortedRadius;
}

void main() {
    vec2 centeredUV = (vUv - 0.5) * 2.0;
    
    float heightValue = 0.0;
    
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        
        // Add time-based pulsing to layer sizes with seed variation
        float timePhase = uTime * 0.5 + fi * 0.2 + uSeed * 0.05;
        float pulse = sin(timePhase) * 0.02 + 1.0;
        
        // Vary the layer reduction rate based on seed
        float layerReduction = 0.08 + sin(uSeed + fi) * 0.02;
        float sizeMultiplier = (1.0 - (fi * layerReduction)) * pulse;
        float baseRadius = uRadius;
        float layerRadius = baseRadius * sizeMultiplier;
        if (layerRadius <= 0.0) continue;
        
        // Add subtle rotation to each layer with seed variation
        float rotationSpeed = 0.1 + fi * 0.05 + sin(uSeed * 2.0 + fi) * 0.03;
        float rotation = uTime * rotationSpeed + uSeed * 0.5;
        vec2 rotatedUV = vec2(
            centeredUV.x * cos(rotation) - centeredUV.y * sin(rotation),
            centeredUV.x * sin(rotation) + centeredUV.y * cos(rotation)
        );
        
        float d = curlyCircle(rotatedUV, layerRadius, CURLINESS_INTENSITY);
        float circle = smoothstep(0.02, 0.0, d);
        float layerHeight = (1.0 - sizeMultiplier) * circle;
        heightValue = max(heightValue, layerHeight);
    }
    heightValue = mix(0.05, 1.0, heightValue);
    gl_FragColor = vec4(heightValue, 0.0, 0.0, 1.0);
}