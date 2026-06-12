import * as TSL from 'three/tsl';

/**
 * Reusable transmission/dispersion shader effect based on Transmission.js
 * @param {THREE.MeshPhysicalNodeMaterial} material 
 * @returns {TSL.Uniform} - Progress uniform (0.0 to 1.0)
 */
export const applyTransmission = (material) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const progress = TSL.uniform(0);

  // Configuraciones base del material
  material.transmission = isMobile ? 0.0 : 1.0; // Desactivar transmisión nativa en móvil
  material.opacity = isMobile ? 0.3 : 0.85;
  material.metalness = isMobile ? 1.0 : 0.0;
  material.roughness = isMobile ? 0.0 : 0.0;
  material.color = '#be460eff';
  material.thickness = 0.3;
  material.transparent = true;

  const originalColorNode = material.colorNode || TSL.color(material.color);

  material.colorNode = TSL.Fn(() => {
    if (isMobile) {
      // Optimizacion Mobile: Solo fresnel y brillo simple sin refraccion de fondo
      const N = (TSL.normalView || TSL.transformedNormalView).normalize();
      const V = (TSL.viewDirection || TSL.positionViewDirection).normalize();
      const fresnel = TSL.pow(TSL.float(1.2).sub(N.dot(V).abs()), TSL.float(3.0));
      const mobileReflection = TSL.mix(originalColorNode, TSL.vec3(1.2), fresnel);
      return TSL.mix(originalColorNode, mobileReflection, progress);
    }

    // Version Desktop: Refraccion TSL completa (cara pero hermosa)
    const uTr = TSL.float(1).mul(progress);
    const uTh = TSL.float(2.55);
    const uIor = TSL.float(1.15);
    const uDisp = TSL.float(1.0);
    const uCaus = TSL.float(0.0);

    const N = (TSL.normalView || TSL.transformedNormalView).normalize();
    const V = (TSL.viewDirection || TSL.positionViewDirection).normalize();
    const refractionOffset = N.xy.mul(uTh).mul(uIor.sub(1.0)).mul(0.05);
    const uv = TSL.viewportUV;
    const background = TSL.viewportTexture();

    const r = background.sample(uv.add(refractionOffset.add(uDisp.mul(0.02)))).r;
    const g = background.sample(uv.add(refractionOffset)).g;
    const b = background.sample(uv.add(refractionOffset.sub(uDisp.mul(0.02)))).b;

    const refractedColor = TSL.vec3(r, g, b);
    const fresnel = TSL.pow(TSL.float(1.5).sub(N.dot(V).abs()), TSL.float(2.0));
    const reflection = TSL.mix(refractedColor, TSL.vec3(1.5), fresnel.mul(1.0));

    const timeNode = TSL.time.mul(0.5);
    const wave1 = TSL.sin(uv.x.mul(80).add(timeNode)).add(TSL.sin(uv.y.mul(50).sub(timeNode)));
    const wave2 = TSL.sin(uv.x.mul(-60).add(timeNode.mul(1.5))).add(TSL.sin(uv.y.mul(70).add(timeNode)));
    const combinedWaves = wave1.add(wave2).mul(0.5);
    const sharpCaustics = TSL.max(0.0, TSL.float(1.0).sub(combinedWaves.abs())).pow(3.0);
    const causticPattern = sharpCaustics.mul(uCaus).mul(0.5);

    const finalRefraction = reflection.add(TSL.vec3(causticPattern));

    return TSL.mix(originalColorNode, finalRefraction, progress);
  })();

  return progress;
};
