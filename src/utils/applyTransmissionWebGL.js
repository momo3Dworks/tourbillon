import * as THREE from 'three';

export const applyTransmissionWebGL = (material, isMobile = false) => {
  material.transmission = 1.0;
  material.opacity = isMobile ? 0.3 : 0.85;
  material.transparent = true;
  material.thickness = 0.3;
  material.roughness = 0.0;
  material.metalness = isMobile ? 1.0 : 0.0;

  material.userData = {
    ...material.userData,
    uProgress: 0.0,
    uTime: 0.0,
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = { value: material.userData.uProgress !== undefined ? material.userData.uProgress : 0.0 };
    shader.uniforms.uTime = { value: 0.0 };
    material.userData.shader = shader;

    // Inject uniforms
    shader.fragmentShader = `
      uniform float uProgress;
      uniform float uTime;
      ${shader.fragmentShader}
    `;

    // Inject the custom refraction logic at the end of the shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      
      #ifdef USE_TRANSMISSION
        vec2 customUv = gl_FragCoord.xy / transmissionSamplerSize;
        vec3 customN = normalize( vNormal );
        vec3 customV = normalize( vViewPosition );
        
        float uTh = 2.55;
        float uIor = 1.15;
        float uDisp = 1.0;
        float uCaus = 0.0;
        
        vec2 refractionOffset = customN.xy * uTh * (uIor - 1.0) * 0.05;
        
        float refR = texture2D( transmissionSamplerMap, customUv + refractionOffset + uDisp * 0.02 ).r;
        float refG = texture2D( transmissionSamplerMap, customUv + refractionOffset ).g;
        float refB = texture2D( transmissionSamplerMap, customUv + refractionOffset - uDisp * 0.02 ).b;
        
        vec3 refractedColor = vec3(refR, refG, refB);
        float fresnel = pow( max(0.0, 1.5 - abs(dot(customN, customV))), 2.0 );
        vec3 customReflection = mix(refractedColor, vec3(1.5), fresnel * 1.0);
        
        float timeNode = uTime * 0.5;
        float wave1 = sin(customUv.x * 80.0 + timeNode) + sin(customUv.y * 50.0 - timeNode);
        float wave2 = sin(customUv.x * -60.0 + timeNode * 1.5) + sin(customUv.y * 70.0 + timeNode);
        float combinedWaves = (wave1 + wave2) * 0.5;
        float sharpCaustics = pow(max(0.0, 1.0 - abs(combinedWaves)), 3.0);
        vec3 causticPattern = vec3(sharpCaustics * uCaus * 0.5);
        
        vec3 finalRefraction = customReflection + causticPattern;
        
        ${isMobile ? `
          // Mobile optimization: simpler reflection
          float mobFresnel = pow( max(0.0, 1.2 - abs(dot(customN, customV))), 3.0 );
          vec3 mobReflection = mix(gl_FragColor.rgb, vec3(1.2), mobFresnel);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mobReflection, uProgress);
        ` : `
          gl_FragColor.rgb = mix(gl_FragColor.rgb, finalRefraction, uProgress);
        `}
      #endif
      `
    );
  };
};
