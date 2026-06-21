import * as THREE from 'three';
import * as TSL from 'three/tsl';

/**
 * Applies a holographic grid transition effect to a material.
 * @param {THREE.MeshStandardNodeMaterial} material - The material to apply the effect to.
 * @param {Object} options - Configuration options.
 * @returns {TSL.Uniform} - The progress uniform (0.0 to 1.0).
 */
export const applyGridTransition = (material, options = {}) => {
  const {
    color = '#00ffff',
    gridScale = 20,
    thickness = 0.02
  } = options;

  // We use a uniform node that can be animated from outside
  const progress = TSL.uniform(0);

  const uv = TSL.uv();
  const worldPos = TSL.positionWorld;

  const p = uv.mul(gridScale);

  // Square grid pattern
  const gridX = TSL.abs(TSL.fract(p.x).sub(0.5));
  const gridY = TSL.abs(TSL.fract(p.y).sub(0.5));
  const grid = TSL.step(0.5 - thickness, TSL.max(gridX, gridY));

  // Discard logic based on progress
  const noise = TSL.mx_noise_float(worldPos.mul(5.0));

  // Threshold logic
  const discardThreshold = progress.mul(3.0).sub(1.5);
  const mask = noise.add(grid.mul(0.2)).sub(discardThreshold);

  // Apply discard via opacity
  const baseOpacity = material.opacityNode || TSL.float(material.opacity ?? 1.0);

  // Critical fix: Ensure no discard at progress 0 and handle existing transparency better
  const maskResult = TSL.select(mask.lessThan(0.0), TSL.float(0.0), TSL.float(1.0));

  // We use a more conservative alphaTest or just rely on opacity discard
  // Actually, setting alphaTest to 0.5 is dangerous for objects with low base opacity.
  // We'll only enable alphaTest-like behavior when progress is significant.
  material.opacityNode = TSL.select(
    progress.lessThan(0.01),
    baseOpacity,
    baseOpacity.mul(maskResult)
  );

  // Preserve transmission (Task 2)
  if (material.transmission > 0 || material.transmissionNode) {
    const baseTransmission = material.transmissionNode || TSL.float(material.transmission ?? 0.0);
    material.transmissionNode = TSL.select(
      progress.lessThan(0.01),
      baseTransmission,
      baseTransmission.mul(maskResult)
    );
  }

  // Only use alphaTest if the object is supposed to be fully opaque at start
  // or if we are deep into the transition.
  material.alphaTest = 0.1;
  material.transparent = true;

  // Grid emission effect
  const gridIntensity = TSL.smoothstep(0.0, 0.3, progress).mul(TSL.smoothstep(1.0, 0.7, progress));
  const gridEmission = TSL.color(color).mul(grid).mul(gridIntensity).mul(5.0);

  if (material.emissiveNode) {
    material.emissiveNode = material.emissiveNode.add(gridEmission);
  } else {
    material.emissiveNode = gridEmission;
  }

  return progress;
};
