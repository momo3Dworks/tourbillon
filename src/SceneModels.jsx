import React, { useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as THREE from 'three'
import { scrollProgress } from './CameraRig'

import { useControls } from 'leva'

let dracoLoaderInstance = null
let ktx2LoaderInstance = null

// Custom hook to load GLTF with Draco and KTX2 Support
export const useAdvancedGLTF = (url) => {
  const gl = useThree((state) => state.gl)

  const gltf = useGLTF(url, true, true, (loader) => {
    // Setup Draco
    if (!dracoLoaderInstance) {
      dracoLoaderInstance = new DRACOLoader()
      dracoLoaderInstance.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
    }
    loader.setDRACOLoader(dracoLoaderInstance)

    // Setup KTX2
    if (!ktx2LoaderInstance) {
      ktx2LoaderInstance = new KTX2Loader()
      // Using unpkg CDN for three.js basis transcoders matching the three version (or latest 0.160.0+)
      ktx2LoaderInstance.setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
      ktx2LoaderInstance.detectSupport(gl)
    }
    loader.setKTX2Loader(ktx2LoaderInstance)
  })

  return gltf
}

// Global store/ref to keep track of animations
export const animationActions = []

// Intensidad emissive global — ajustar para tuning del bloom
const EMISSIVE_INTENSITY_LIGHTS = 4.0  // luces del túnel (warm white)
const EMISSIVE_INTENSITY_CRYSTALS = 8.0  // cristales (cyan)
const EMISSIVE_INTENSITY_BOOST = 2.0  // boost para materiales que ya tienen emissive en el GLB

const SceneModels = ({
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

  vaultDoorPos = [0, 3, 0],
  vaultDoorRot = [0, 0, 0],

  TopGearsPos = [0, 3, 0],
  TopGearsRot = [0, 0, 0],

  envMapIntensity = 1.0,
  emissiveIntensity = 10.0,
}) => {
  // Load Models
  const doorsCamera = useAdvancedGLTF('/Doors_camera.glb')
  const tunnelFloor = useAdvancedGLTF('/Tunnel_Floor_Chains.glb')
  const tunnelLights = useAdvancedGLTF('/Tunnel_Lights.glb')
  const crystals = useAdvancedGLTF('/Crystals.glb')
  const tourbillonDome = useAdvancedGLTF('/TourbillonDome.glb')
  const tourbillonSystem = useAdvancedGLTF('/TourbillonMainSystem.glb')
  const vaultDoor = useAdvancedGLTF('/VaultDoor.glb')
  const TopGears = useAdvancedGLTF('/TopGears.glb')

  // Tunnel Lights Leva Controls
  const tunnelLightsConfig = useControls('Tunnel Lights', {
    color: '#db5e5e',
    metallic: { value: 0.5, min: 0, max: 1 },
    roughness: { value: 0.5, min: 0, max: 1 },
    emissive: '#f2dbab',
    emissiveIntensity: { value: EMISSIVE_INTENSITY_LIGHTS, min: 0, max: 20 },
  })

  // Setup VaultDoor Animations
  const vaultDoorAnims = useAnimations(vaultDoor.animations, vaultDoor.scene)

  // Setup Animations
  const allAnimations = useMemo(() => {
    return [
      ...doorsCamera.animations,
      ...tunnelFloor.animations,
      ...tunnelLights.animations,
      ...crystals.animations,
      ...tourbillonDome.animations,
      ...tourbillonSystem.animations,
      ...TopGears.animations
    ]
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem, TopGears])

  const mainGroupRef = useRef()
  const { actions } = useAnimations(allAnimations, mainGroupRef)

  // Expose actions to the global array and play GEARS action in loop
  useEffect(() => {
    if (actions) {
      animationActions.length = 0 // clear
      Object.keys(actions).forEach(key => animationActions.push(key))
      console.log('Available Actions:', animationActions)

      const gearsAction = actions['GEARS']
      if (gearsAction) {
        gearsAction.reset().setLoop(THREE.LoopRepeat, Infinity).play()
      }
    }
  }, [actions])


  useEffect(() => {
    if (actions) {
      animationActions.length = 0 // clear
      Object.keys(actions).forEach(key => animationActions.push(key))
      console.log('Available Actions:', animationActions)

      const gearsAction = actions['TOPGEARS']
      if (gearsAction) {
        gearsAction.reset().setLoop(THREE.LoopRepeat, Infinity).play()
      }
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

  // ── Enable shadows (cast & receive) on all meshes ──────────────────────────
  useEffect(() => {
    const allScenes = [
      doorsCamera.scene,
      tunnelFloor.scene,
      tunnelLights.scene,
      crystals.scene,
      tourbillonDome.scene,
      tourbillonSystem.scene,
      vaultDoor.scene,
      TopGears.scene,
    ]
    allScenes.forEach((scn) => {
      scn.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
          if (child.material) {
            child.material.needsUpdate = true
          }
        }
      })
    })
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem, vaultDoor, TopGears])

  // ── Aplicar materiales emissive para que el Bloom tenga objetivos ──────────
  // Los materiales emissive son lo que el BloomNode convierte en glow.
  // Sin emissive > threshold, el bloom no se ve aunque esté configurado.
  useEffect(() => {
    // 1. Cristales: emissive cian intenso para un glow místico (scaled by emissiveIntensity control)
    crystalMeshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat) => {
        if (mat.emissive) {
          mat.emissive.set(0.1, 0.7, 1.0) // cian
          mat.emissiveIntensity = emissiveIntensity
          mat.needsUpdate = true
        }
      })
    })

    // 2. Luces del túnel: Leva controls scaled by global emissiveIntensity control
    tunnelLights.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((mat) => {
          mat.color.set(tunnelLightsConfig.color)
          mat.metalness = tunnelLightsConfig.metallic
          mat.roughness = tunnelLightsConfig.roughness
          if (mat.emissive) {
            mat.emissive.set(tunnelLightsConfig.emissive)
            // Scale emissive intensity based on global emissive intensity control relative to default 10.0
            mat.emissiveIntensity = tunnelLightsConfig.emissiveIntensity * (emissiveIntensity / 10.0)
          }
          mat.needsUpdate = true
        })
      }
    })

    // 3. Boost general: amplifica materiales que ya tienen emissive definido en los GLBs
    const otherScenes = [
      doorsCamera.scene,
      tunnelFloor.scene,
      tourbillonDome.scene,
      tourbillonSystem.scene,
      vaultDoor.scene,
      TopGears.scene,
    ]
    otherScenes.forEach((scn) => {
      scn.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            // Solo boostear si el material ya tiene un emissive color no-negro
            if (mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.01) {
              mat.emissiveIntensity = Math.max(mat.emissiveIntensity, EMISSIVE_INTENSITY_BOOST * (emissiveIntensity / 10.0))
              mat.needsUpdate = true
            }
          })
        }
      })
    })
  }, [crystalMeshes, tunnelLights, doorsCamera, tunnelFloor, tourbillonDome, tourbillonSystem, vaultDoor, tunnelLightsConfig, emissiveIntensity])

  // Apply envMapIntensity to all materials in the scene
  useEffect(() => {
    const allScenes = [
      doorsCamera.scene,
      tunnelFloor.scene,
      tunnelLights.scene,
      crystals.scene,
      tourbillonDome.scene,
      tourbillonSystem.scene,
      vaultDoor.scene,
      TopGears.scene,
    ]
    allScenes.forEach((scn) => {
      scn.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((mat) => {
            if ('envMapIntensity' in mat) {
              mat.envMapIntensity = envMapIntensity
              mat.needsUpdate = true
            }
          })
        }
      })
    })
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem, vaultDoor, TopGears, envMapIntensity])

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
    fixWebGPUBufferAlignment(vaultDoor.scene)
    fixWebGPUBufferAlignment(TopGears.scene)
  }, [doorsCamera, tunnelFloor, tunnelLights, crystals, tourbillonDome, tourbillonSystem, vaultDoor, TopGears])

  // Rotate crystals and animate vault door based on scroll progress in useFrame
  useFrame((state, delta) => {
    // 1. Crystal rotation
    crystalMeshes.forEach((mesh, index) => {
      // Alternate rotation direction and speed
      const dir = index % 2 === 0 ? 1 : -1
      const speed = 0.2 + (index * 0.05)
      mesh.rotation.y += delta * speed * dir
    })

    // 2. Vault Door Scroll Animation
    const vaultAction = vaultDoorAnims.actions['VaultDoorMain']
    if (vaultAction) {
      if (!vaultAction.isRunning()) {
        vaultAction.play()
      }
      vaultAction.paused = true
      // progress is in [-1.0, 0.0] for the vault door animation segment. Map to [0.0, 1.0].
      const t = THREE.MathUtils.clamp(scrollProgress.current + 1.0, 0, 1)
      vaultAction.time = t * vaultAction.getClip().duration
    }
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
      <primitive object={vaultDoor.scene} position={vaultDoorPos} rotation={vaultDoorRot} />
      <primitive object={TopGears.scene} position={TopGearsPos} rotation={TopGearsRot} />
    </group>
  )
}

export default SceneModels


