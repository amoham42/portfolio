varying vec3 vWorldPos;
varying vec2 vUvVar;
void main() {
    vUvVar = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}