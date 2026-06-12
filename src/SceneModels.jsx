import React, { useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as THREE from 'three'

// Custom hook to load GLTF with Draco and KTX2 Support
const useAdvancedGLTF = (url) => {
  const gl = useThree((state) => state.gl)
  
  const gltf = useGLTF(url, true, true, (loader) => {
    // Setup Draco
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
    loader.setDRACOLoader(dracoLoader)

    // Setup KTX2
    const ktx2Loader = new KTX2Loader()
    // Using unpkg CDN for three.js basis transcoders matching the three version (or latest 0.160.0+)
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })
  
  return gltf
}

// Global store/ref to keep track of animations
export const animationActions = []

const SceneModels = ({ 
  emissiveIntensity = 3.0,
  
  // Individual position/rotation parameters for separate adjustment
  doorsCameraPos = [0, 0, 0],
  doorsCameraRot = [0, 0, 0],
  
  tunnelFloorPos = [0, 0, 0],
  tunnelFloorRot = [0, 0, 0],
  
  tunnelLightsPos = [0, 0, 0],
  tunnelLightsRot = [0, 0, 0],
  
  crystalsPos = [0, 0, 0],
  crystalsRot = [0, 0, 0],
  
  tourbillonDomePos = [0, 0, 0],
  tourbillonDomeRot = [0, 0, 0],
  
  tourbillonSystemPos = [0, 0, 0],
  tourbillonSystemRot = [0, 0, 0],
}) => {
  // Load Models
  const doorsCamera = useAdvancedGLTF('/src/assets/Doors_camera.glb')
  const tunnelFloor = useAdvancedGLTF('/src/assets/Tunnel_Floor_Chains.glb')
  const tunnelLights = useAdvancedGLTF('/src/assets/Tunnel_Lights.glb')
  const crystals = useAdvancedGLTF('/src/assets/Crystals.glb')
  const tourbillonDome = useAdvancedGLTF('/src/assets/TourbillonDome.glb')
  const tourbillonSystem = useAdvancedGLTF('/src/assets/TourbillonMainSystem.glb')

  // Setup Animations
  const allAnimations = useMemo(() => {
    return [
      ...doorsCamera.animations,
      ...tunnelFloor.animations,
      ...tunnelLights.animations,
      ...crystals.animations,
      ...tourbillonDome.animations,
      ...tourbillonSystem.animations
    ]
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem])

  const mainGroupRef = useRef()
  const { actions } = useAnimations(allAnimations, mainGroupRef)

  // Expose actions to the global array
  useEffect(() => {
    if (actions) {
      animationActions.length = 0 // clear
      Object.keys(actions).forEach(key => animationActions.push(key))
      console.log('Available Actions:', animationActions)
    }
  }, [actions])

  // Process Doors_camera to swap Y and Z
  const extractedCamera = useMemo(() => {
    let cam = null
    doorsCamera.scene.traverse((child) => {
      if (child.isCamera) cam = child
    })
    return cam
  }, [doorsCamera])

  // Process Tunnel_Lights materials
  useEffect(() => {
    tunnelLights.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // If it's an emissive material or we just force it
        child.material.emissiveIntensity = emissiveIntensity
        // In WebGPU, we might need to set toneMapped to false for bloom to pop properly
        child.material.toneMapped = false
      }
    })
  }, [tunnelLights, emissiveIntensity])

  // Extract crystals
  const crystalMeshes = useMemo(() => {
    const arr = []
    crystals.scene.traverse((child) => {
      if (child.isMesh && child.name.includes('Crystals')) {
        arr.push(child)
      }
    })
    return arr
  }, [crystals])

  // Fix WebGPU Buffer Array Stride requirement (must be multiple of 4) BEFORE first render
  useMemo(() => {
    const fixWebGPUBufferAlignment = (scene) => {
      scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const attributes = child.geometry.attributes
          for (const key in attributes) {
            const attr = attributes[key]
            if (attr.array && attr.array.BYTES_PER_ELEMENT) {
              const bytesPerElement = attr.array.BYTES_PER_ELEMENT
              const stride = attr.itemSize * bytesPerElement
              // If the stride is not a multiple of 4, we must convert it to Float32
              if (stride % 4 !== 0 && !(attr.array instanceof Float32Array)) {
                const floatArray = new Float32Array(attr.array.length)
                for (let i = 0; i < attr.array.length; i++) {
                  floatArray[i] = attr.normalized ? attr.array[i] / (Math.pow(2, bytesPerElement * 8 - 1) - 1) : attr.array[i]
                }
                child.geometry.setAttribute(key, new THREE.BufferAttribute(floatArray, attr.itemSize))
              }
            }
          }
        }
      })
    }

    fixWebGPUBufferAlignment(doorsCamera.scene)
    fixWebGPUBufferAlignment(tunnelFloor.scene)
    fixWebGPUBufferAlignment(tunnelLights.scene)
    fixWebGPUBufferAlignment(crystals.scene)
    fixWebGPUBufferAlignment(tourbillonDome.scene)
    fixWebGPUBufferAlignment(tourbillonSystem.scene)
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem])

  // Rotate crystals in useFrame
  useFrame((state, delta) => {
    crystalMeshes.forEach((mesh, index) => {
      // Alternate rotation direction and speed
      const dir = index % 2 === 0 ? 1 : -1
      const speed = 0.2 + (index * 0.05)
      mesh.rotation.y += delta * speed * dir
    })
  })

  return (
    <group ref={mainGroupRef}>
      {/* If there's a camera in the GLB, we can either use it or just place it as an object */}
      {extractedCamera && (
        <group 
          position={[extractedCamera.position.x, extractedCamera.position.z, extractedCamera.position.y]}
          rotation={[extractedCamera.rotation.x, extractedCamera.rotation.z, extractedCamera.rotation.y]}
        >
          {/* We place a visual representation or attach a real R3F camera here if needed */}
          <mesh>
            <boxGeometry args={[0.2, 0.2, 0.5]} />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
        </group>
      )}

      {/* Assembly of the rest of the models with separate customizable transforms */}
      <primitive object={doorsCamera.scene} position={doorsCameraPos} rotation={doorsCameraRot} />
      <primitive object={tunnelFloor.scene} position={tunnelFloorPos} rotation={tunnelFloorRot} />
      <primitive object={tunnelLights.scene} position={tunnelLightsPos} rotation={tunnelLightsRot} />
      <primitive object={crystals.scene} position={crystalsPos} rotation={crystalsRot} />
      <primitive object={tourbillonDome.scene} position={tourbillonDomePos} rotation={tourbillonDomeRot} />
      <primitive object={tourbillonSystem.scene} position={tourbillonSystemPos} rotation={tourbillonSystemRot} />
    </group>
  )
}

export default SceneModels


