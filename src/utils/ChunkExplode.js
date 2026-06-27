import * as THREE from 'three'

/**
 * applyChunkExplosion
 *
 * Adds a `aChunkDirection` vertex attribute to the mesh geometry and patches
 * the material's onBeforeCompile to drive chunk separation via `uChunkProgress`.
 *
 * Key design decisions:
 * - Does NOT clone the material — mutates in place so the GPU recompiles it correctly.
 * - Chains into any existing onBeforeCompile (e.g. GridTransition) instead of replacing it.
 * - Forces needsUpdate=true so Three.js recompiles the shader program.
 * - Guards via mesh.userData.isChunked to prevent double-application.
 *
 * Parameters exposed via config:
 *   seed      — deterministic PRNG seed (change to get a different break pattern)
 *   proximity — how much random scatter each chunk gets (0=uniform, 1=noisy)
 *   quantity  — number of Voronoi cluster centers = number of "broken pieces"
 *   area      — distance multiplier for the separation travel
 */
export function applyChunkExplosion(mesh, { seed = 1234, proximity = 0.5, quantity = 20, area = 1.0 } = {}) {
  if (mesh.userData.isChunked) return
  mesh.userData.isChunked = true

  // ── 1. Decouple geometry via toNonIndexed so every triangle is independent ──
  let geometry = mesh.geometry
  if (geometry.index) {
    geometry = geometry.toNonIndexed()
  }

  const posAttribute = geometry.attributes.position
  const vertexCount = posAttribute.count
  const triangleCount = vertexCount / 3

  const aChunkDirection = new Float32Array(vertexCount * 3)

  // Seeded PRNG — same seed = same break pattern across hot reloads
  const prng = (s) => () => (2 ** 31 - 1 & (s = Math.imul(48271, s))) / 2 ** 31
  const rand = prng(seed)

  // Cluster centers distributed randomly inside the mesh bounding box
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = new THREE.Vector3()
  box.getSize(size)

  const clusters = []
  for (let i = 0; i < quantity; i++) {
    clusters.push(new THREE.Vector3(
      box.min.x + rand() * size.x,
      box.min.y + rand() * size.y,
      box.min.z + rand() * size.z
    ))
  }

  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3()
  const faceCenter = new THREE.Vector3()
  const dir = new THREE.Vector3()

  // Assign each triangle to its nearest cluster, compute outward direction
  for (let i = 0; i < triangleCount; i++) {
    v1.fromBufferAttribute(posAttribute, i * 3)
    v2.fromBufferAttribute(posAttribute, i * 3 + 1)
    v3.fromBufferAttribute(posAttribute, i * 3 + 2)
    faceCenter.addVectors(v1, v2).add(v3).divideScalar(3)

    let nearestDist = Infinity
    let nearestCluster = clusters[0]
    for (let c = 0; c < quantity; c++) {
      const d = faceCenter.distanceToSquared(clusters[c])
      if (d < nearestDist) { nearestDist = d; nearestCluster = clusters[c] }
    }

    // Outward direction from cluster center + noise
    dir.subVectors(faceCenter, nearestCluster).normalize()
    dir.multiplyScalar(area * (1.0 + (rand() - 0.5) * proximity))

    for (let v = 0; v < 3; v++) {
      const idx = (i * 3 + v) * 3
      aChunkDirection[idx] = dir.x
      aChunkDirection[idx + 1] = dir.y
      aChunkDirection[idx + 2] = dir.z
    }
  }

  geometry.setAttribute('aChunkDirection', new THREE.BufferAttribute(aChunkDirection, 3))
  mesh.geometry = geometry

  // ── 2. Patch the material's shader — chain into existing onBeforeCompile ──
  // Store the uniform reference directly on userData so GSAP can animate it
  mesh.material.userData.uChunkProgress = { value: 0.0 }

  const existingOBC = mesh.material.onBeforeCompile

  mesh.material.onBeforeCompile = (shader, renderer) => {
    // Run any existing onBeforeCompile first (e.g. GridTransition)
    if (existingOBC) existingOBC(shader, renderer)

    // Attach the uniform to the shader (shared object reference = live updates)
    shader.uniforms.uChunkProgress = mesh.material.userData.uChunkProgress

    // Inject attribute + uniform declarations at the top of the vertex shader
    if (!shader.vertexShader.includes('aChunkDirection')) {
      shader.vertexShader = `
        uniform float uChunkProgress;
        attribute vec3 aChunkDirection;
      ` + shader.vertexShader

      // Offset each vertex along its cluster's outward direction
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += aChunkDirection * uChunkProgress;`
      )
    }
  }

  // Force Three.js to recompile the shader program on next render
  mesh.material.needsUpdate = true
}
