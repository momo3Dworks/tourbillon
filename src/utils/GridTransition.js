import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// injectGridTransition
// Injects a holographic grid-sweep dissolve into any standard Three.js material
// via onBeforeCompile. The sweep travels bottom→up (Y axis) as uTransitionProgress
// goes 0 → 1, dissolving the mesh into a glowing cyan grid.
//
// uTransitionProgress = 0 → fully visible, no effect
// uTransitionProgress = 1 → fully dissolved / invisible
// ─────────────────────────────────────────────────────────────────────────────
export const injectGridTransition = (shader) => {
  // Add our uniforms
  shader.uniforms.uTransitionProgress = { value: 0.0 }
  shader.uniforms.uGridColor = { value: new THREE.Color(0x00ffff) }

  // ── Vertex: pass world position ──────────────────────────────────────────
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWorldPosGrid;`
  )

  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    vWorldPosGrid = (modelMatrix * vec4(position, 1.0)).xyz;`
  )

  // ── Fragment: dissolve logic ─────────────────────────────────────────────
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    uniform float uTransitionProgress;
    uniform vec3 uGridColor;
    varying vec3 vWorldPosGrid;`
  )

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>

    if (uTransitionProgress > 0.001) {
      // Grid lines based on world position
      vec3 scaledPos = vWorldPosGrid * 4.0;
      float gx = step(0.95, fract(scaledPos.x));
      float gy = step(0.95, fract(scaledPos.y));
      float gz = step(0.95, fract(scaledPos.z));
      float grid = max(gx, max(gy, gz));

      // Sweep front: sweepEdge ascends as progress goes 0→1
      // At progress=0 sweepEdge is far below the scene (everything untouched)
      // At progress=1 sweepEdge is far above (everything dissolved)
      float sweepEdge = -15.0 + uTransitionProgress * 75.0;
      float distFromEdge = vWorldPosGrid.y - sweepEdge; // positive = above edge (still solid)

      // Narrow band at the sweep front (±2 units)
      float frontBand = 1.0 - smoothstep(0.0, 2.5, distFromEdge);

      if (distFromEdge < 0.0) {
        // Below the sweep front → fully dissolved
        if (grid > 0.0) {
          // Show a fading cyan grid ghost
          float fade = max(0.0, 1.0 + distFromEdge / 8.0); // fades over 8 units below
          gl_FragColor = vec4(uGridColor, fade * 0.35);
        } else {
          discard;
        }
      } else if (distFromEdge < 2.5) {
        // On the sweep edge → bright cyan glow
        float edgeGlow = 1.0 - smoothstep(0.0, 2.5, distFromEdge);
        if (grid > 0.0) {
          // Super-bright grid line at the edge
          gl_FragColor = vec4(uGridColor * (1.5 + edgeGlow * 2.0), 1.0);
        } else {
          // Surface fades into cyan at the edge
          vec3 glowCol = mix(gl_FragColor.rgb, uGridColor, edgeGlow * 0.8);
          gl_FragColor = vec4(glowCol, mix(gl_FragColor.a, 0.0, edgeGlow));
        }
      }
      // Above edge (distFromEdge >= 2.5): render normally, no change
    }
    `
  )
}
