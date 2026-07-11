import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// applyMagicShockwave
// Injects two animated shockwave rings as additive emissive on any Three.js mesh
// material via onBeforeCompile.
//
// The effect is invisible until uMSHover > 0. Animate it 0→1 on hover enter and
// back 1→0 on hover leave. Update uMSTime each frame with state.clock.elapsedTime.
//
// Port of utils/MagicShockwave.js (TSL/WebGPU) to standard GLSL onBeforeCompile,
// using the same pattern as src/utils/GridTransition.js.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SHOCKWAVE_PARAMS = {
  ring1Color:   '#6366f1', // indigo — first ring colour
  ring2Color:   '#ffea00', // yellow — second ring colour
  ring1Offset:  0.5,       // phase offset for ring 1 (shifts its timing)
  ring2Offset:  0.7,       // phase offset for ring 2
  noiseScale:   10.0,      // how fine the noise pattern is
  noiseMag:     0.2,       // overall noise amplitude
  noiseMix:     0.1,       // how much noise warps the ring radius
  smoothEdge:   0.1,       // smoothstep edge width (smaller = sharper rings)
  uvScale:      1.0,       // UV space scale — larger = smaller rings relative to mesh
  brightness:   10.0,      // emissive brightness multiplier
  falloffOuter: 0.5,       // vignette: distance from centre where rings start fading
  falloffInner: 0.3,       // vignette: distance from centre where rings are fully bright
}

/**
 * Applies the MagicShockwave emissive ring effect to a Three.js material.
 * Composes with any existing onBeforeCompile hook already on the material.
 *
 * @param {THREE.Material} material  The material to inject the shader into.
 * @returns {Object} uniforms        Live uniform objects — update their .value each frame.
 *   Key uniforms for animation:
 *     uniforms.uMSHover  — GSAP-animate 0 to 1 on hover enter, 1 to 0 on leave
 *     uniforms.uMSTime   — set to state.clock.elapsedTime every frame
 *   All other uniforms mirror DEFAULT_SHOCKWAVE_PARAMS and can be updated live.
 */
export const applyMagicShockwave = (material) => {
  const d = DEFAULT_SHOCKWAVE_PARAMS

  // Uniform objects (stable references, mutate .value, never replace the object)
  const uniforms = {
    uMSTime:         { value: 0.0 },
    uMSHover:        { value: 0.0 },
    uMSRing1Offset:  { value: d.ring1Offset },
    uMSRing2Offset:  { value: d.ring2Offset },
    uMSRing1Color:   { value: new THREE.Color(d.ring1Color) },
    uMSRing2Color:   { value: new THREE.Color(d.ring2Color) },
    uMSNoiseScale:   { value: d.noiseScale },
    uMSNoiseMag:     { value: d.noiseMag },
    uMSNoiseMix:     { value: d.noiseMix },
    uMSSmoothEdge:   { value: d.smoothEdge },
    uMSUVScale:      { value: d.uvScale },
    uMSBrightness:   { value: d.brightness },
    uMSFalloffOuter: { value: d.falloffOuter },
    uMSFalloffInner: { value: d.falloffInner },
  }

  // Compose with any already-existing onBeforeCompile (e.g. GridTransition)
  const prevOBC = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    if (prevOBC) prevOBC(shader, renderer)

    if (!shader || !shader.uniforms) return

    // Merge our uniforms into the program
    Object.assign(shader.uniforms, uniforms)

    // Vertex: pass UV to fragment stage
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\n      varying vec2 vMSUv;'
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n      vMSUv = uv;'
    )

    // Fragment: declarations + noise helpers
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vMSUv;
      uniform float uMSTime;
      uniform float uMSHover;
      uniform float uMSRing1Offset;
      uniform float uMSRing2Offset;
      uniform vec3  uMSRing1Color;
      uniform vec3  uMSRing2Color;
      uniform float uMSNoiseScale;
      uniform float uMSNoiseMag;
      uniform float uMSNoiseMix;
      uniform float uMSSmoothEdge;
      uniform float uMSUVScale;
      uniform float uMSBrightness;
      uniform float uMSFalloffOuter;
      uniform float uMSFalloffInner;
      float msHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float msNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = msHash(i);
        float b = msHash(i + vec2(1.0, 0.0));
        float c = msHash(i + vec2(0.0, 1.0));
        float dn = msHash(i + vec2(1.0, 1.0));
        vec2  u = f * f * (3.0 - 2.0 * f);
        return (mix(mix(a, b, u.x), mix(c, dn, u.x), u.y) * 2.0 - 1.0);
      }`
    )

    // Fragment: additive shockwave rings after dithering
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (uMSHover > 0.001) {
        vec2  msP    = (vMSUv - 0.5) / max(uMSUVScale, 0.001);
        float msDist = length(msP);
        float msN1     = msNoise(msP * uMSNoiseScale + uMSTime) * uMSNoiseMag;
        float msPhase1 = fract(uMSRing1Offset + uMSTime);
        float msRing1  = smoothstep(uMSSmoothEdge, 0.0, abs(msDist + msN1 * uMSNoiseMix - msPhase1));
        float msN2     = msNoise(msP * uMSNoiseScale + uMSTime + 3.7) * uMSNoiseMag;
        float msPhase2 = fract(uMSRing2Offset + uMSTime);
        float msRing2  = smoothstep(uMSSmoothEdge, 0.0, abs(msDist + msN2 * uMSNoiseMix - msPhase2));
        float msFalloff = smoothstep(uMSFalloffOuter, uMSFalloffInner, msDist);
        vec3 msColor = uMSRing1Color * msRing1 + uMSRing2Color * msRing2;
        msColor *= msFalloff * uMSBrightness * uMSHover;
        gl_FragColor.rgb += msColor;
      }`
    )

    material.userData.shockwaveShader = shader
  }

  material.userData.shockwaveUniforms = uniforms
  material.needsUpdate = true
  return uniforms
}
