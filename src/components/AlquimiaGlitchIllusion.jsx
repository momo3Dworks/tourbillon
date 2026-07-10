import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { useControls } from 'leva'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uHover;
  varying vec2 vUv;

  float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  void main() {
    if (uHover < 0.01) {
      discard;
    }

    vec2 uv = vUv;

    // Glitch effect based on time
    float glitchTime = uTime * 8.0;
    
    // Random displacement for slicing (blocky cuts)
    float sliceY = rand(vec2(floor(uv.y * 15.0), floor(glitchTime)));
    if (sliceY > 0.9) {
      uv.x += (rand(vec2(floor(glitchTime), 0.0)) - 0.5) * 0.1;
    }

    // RGB shift
    float shiftAmount = 0.03 * uHover;
    float rOffset = (rand(vec2(glitchTime, 1.0)) - 0.5) * shiftAmount;
    float bOffset = (rand(vec2(glitchTime, 2.0)) - 0.5) * shiftAmount;

    vec4 texR = texture2D(tDiffuse, vec2(uv.x + rOffset, uv.y));
    vec4 texG = texture2D(tDiffuse, uv);
    vec4 texB = texture2D(tDiffuse, vec2(uv.x + bOffset, uv.y));

    // Combine channels
    float alpha = max(max(texR.a, texG.a), texB.a) * uHover;
    
    // Scanlines
    float scanline = sin(uv.y * 200.0 + uTime * 5.0) * 0.04;

    vec3 color = vec3(texR.r, texG.g, texB.b);
    color += vec3(scanline);

    gl_FragColor = vec4(color, alpha);
  }
`

export default function AlquimiaGlitchIllusion({ map, hovered = false, pos = [0,0,1.5], scale = 1.0, rot = [0,0,0] }) {
  const materialRef = useRef()
  
  const uniforms = useMemo(() => {
    // Basic setup for the texture
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 16
    }
    return {
      tDiffuse: { value: map },
      uTime: { value: 0 },
      uHover: { value: 0 }
    }
  }, [map])

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      
      const targetHover = hovered ? 1 : 0
      materialRef.current.uniforms.uHover.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uHover.value, 
        targetHover, 
        1 - Math.pow(0.001, delta)
      )
    }
  })

  // Determine aspect ratio from the loaded texture to keep the plane proportioned
  const aspect = map && map.image ? map.image.width / map.image.height : 1

  return (
    <mesh position={pos} scale={[scale * aspect, scale, 1]} rotation={rot}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
