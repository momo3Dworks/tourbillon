/**
 * Refactored HexReveal Utility
 * Based on Yeberson Shader Lab Production Export
 */

import * as THREE from 'three';
import * as TSL from 'three/tsl';
import { hitPoint, hitVelocity, hitAcceleration, hitIntensity } from './TSLInteractionManager';

// --- Hexagonal Grid Helper ---
export const getHexDist = TSL.Fn(([p]) => {
  const s = TSL.vec2(1.7320508, 1.5);
  const h = s.mul(0.5);
  const a = TSL.mod(p, s).sub(h);
  const b = TSL.mod(p.sub(h), s).sub(h);
  const distA = TSL.max(TSL.abs(a.y), TSL.abs(a.y.mul(0.5).add(TSL.abs(a.x).mul(0.866025))));
  const distB = TSL.max(TSL.abs(b.y), TSL.abs(b.y.mul(0.5).add(TSL.abs(b.x).mul(0.866025))));
  return TSL.select(distA.lessThan(distB), distA, distB);
});

export const hexGrid = TSL.Fn(([uv, scale, thickness]) => {
  const p = uv.mul(scale);
  const d = getHexDist(p);
  const grid = TSL.step(TSL.float(0.5).sub(thickness), d);
  const grain = TSL.mx_noise_float(p.mul(40.0)).mul(0.05);
  return TSL.max(grid, grain);
});

/**
 * Applies the HexReveal effect to a MeshStandardNodeMaterial.
 * Preserves existing textures and adds the hex effect to the emission channel.
 */
export const applyHexReveal = (material) => {
  const worldPos = TSL.positionWorld;
  const time = TSL.time;
  const dynamicMask = TSL.float(0);

  const cursorSpeed = TSL.length(hitVelocity);
  const safeVel = hitVelocity.add(TSL.vec3(0.0001, 0.0, 0.0));
  const dir = TSL.normalize(safeVel);

  let p = worldPos.sub(hitPoint);
  let proj = TSL.dot(p, dir);

  const accelParallel = dir.mul(TSL.dot(hitAcceleration, dir));
  const turnAccel = hitAcceleration.sub(accelParallel);
  const distBehind = TSL.max(TSL.float(0.0), proj.negate());
  const bendFactor = distBehind.mul(distBehind).mul(0.1);
  p = p.sub(turnAccel.mul(bendFactor));
  proj = TSL.dot(p, dir);

  const isWake = TSL.smoothstep(TSL.float(0.5), TSL.float(-0.5), proj);
  const stretch = TSL.clamp(cursorSpeed.mul(3.0), TSL.float(0.0), TSL.float(6.0));

  const parallelP = dir.mul(proj);
  const perpP = p.sub(parallelP);
  const scaleFactor = TSL.float(1.0).add(stretch.mul(isWake));
  const stretchedP = perpP.add(parallelP.div(scaleFactor));

  const distToHit = TSL.length(stretchedP);

  const colorNoise = TSL.mx_noise_float(worldPos.mul(2).add(time.mul(0.2)));
  const finalColor = TSL.mix(TSL.color('#0088ff'), TSL.color('#f4d2f4'), colorNoise);

  const edgeNoise = TSL.mx_noise_float(worldPos.mul(5.0).add(time)).mul(0.15);
  const noisyRadius = TSL.float(0.2).add(edgeNoise);
  const baseFalloff = TSL.smoothstep(noisyRadius, TSL.float(0.0), distToHit).mul(0.4);

  const speedFactor = TSL.clamp(cursorSpeed.mul(15.0), TSL.float(0.0), TSL.float(2.0));

  const baseMask = baseFalloff.add(dynamicMask);
  const finalMask = baseMask.mul(hitIntensity);

  const swRadius = TSL.fract(time.mul(0.3)).mul(TSL.float(40.0));
  const swLine = TSL.smoothstep(swRadius.sub(TSL.float(0.8)), swRadius, distToHit)
    .mul(TSL.smoothstep(swRadius.add(TSL.float(0.8)), swRadius, distToHit));
  const swIntensity = swLine.mul(speedFactor).mul(TSL.float(.5));
  const swColor = TSL.mix(TSL.color('#0088ff'), TSL.color('#ffffff'), TSL.float(0.3));

  const uv = TSL.uv();
  const gridScale = TSL.vec2(80, 40);
  const grid = hexGrid(uv, gridScale, TSL.float(0.05));

  // Normal generation (Perturbation)
  const eps = TSL.float(0.01);
  const pOff = uv.mul(gridScale);
  const d0 = getHexDist(pOff);
  const dX = getHexDist(pOff.add(TSL.vec2(eps, 0.0)));
  const dY = getHexDist(pOff.add(TSL.vec2(0.0, eps)));


  // Add to existing emission
  const gridEmission = finalColor.mul(grid).mul(finalMask).mul(10).mul(2.25);
  const shockwaveEmission = swColor.mul(grid).mul(swIntensity).mul(5).mul(1.25);
  const totalHexEmission = gridEmission.add(shockwaveEmission);

  if (material.emissiveNode) {
    material.emissiveNode = material.emissiveNode.add(totalHexEmission);
  } else {
    material.emissiveNode = totalHexEmission;
  }

  // Combine normals
  material.normalNode = (TSL.normalView || TSL.transformedNormalView).normalize();
};
