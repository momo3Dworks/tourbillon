// src/shaders/electricShader.js
// Simple electric arc shader using time-based noise
export const ElectricVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ElectricFragmentShader = `
  uniform float uTime;
  uniform float uHover;
  varying vec2 vUv;

  // 2D noise function (simple hash)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // four corners
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    // Animate noise over time and UVs
    float n = noise(vUv * 10.0 + uTime * 3.0);
    // Create bright arcs where noise crosses threshold
    float intensity = smoothstep(0.6, 0.7, n);
    // Modulate intensity by hover (0 or 1)
    intensity *= uHover;
    vec3 color = mix(vec3(0.0, 0.0, 0.2), vec3(0.4, 0.8, 1.0), intensity);
    // Add emissive glow
    gl_FragColor = vec4(color, intensity);
  }
`;
