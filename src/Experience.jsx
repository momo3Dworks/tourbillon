import React, { useMemo, useEffect, useRef, useState } from 'react'
import { Environment, useProgress, Html } from '@react-three/drei'
import SceneModels, { useAdvancedGLTF } from './SceneModels'
import DoorAnimations from './DoorAnimations'
import DomeAnimation from './DomeAnimation'
import TourbillonAnimations from './TourbillonAnimations'
import SpatialAudioController from './components/SpatialAudioController'
import { useThree, useFrame } from '@react-three/fiber'

// Three.js postprocessing passes
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js'

// Three.js shaders
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js'
import { ACESFilmicToneMappingShader } from 'three/addons/shaders/ACESFilmicToneMappingShader.js'
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'

import useLevaControls from './LevaControls'
import * as THREE from 'three'
import { waypointCameraState } from './CameraRig'
import { useExploded } from './ExplodedContext'

// ─────────────────────────────────────────────────────────────────────────────
// Chromatic Aberration shader — radial falloff from viewport center.
// Ported from the three.js WebGPU CA example logic, adapted for WebGL ShaderPass.
//
// Uses lens-space coordinates: maps UV → [-1, 1], computes radial distance,
// applies barrel-style R/G/B channel separation that is exactly 0 at center.
// ─────────────────────────────────────────────────────────────────────────────
const ChromaticAberrationShader = {
  name: 'ChromaticAberrationShader',
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.005 }, // max aberration magnitude in UV space
    uFalloff: { value: 2.0 },   // power: 1=linear, 2=quadratic, higher=edge-only
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uFalloff;
    varying vec2 vUv;

    void main() {
      // Map UV [0,1] to lens-space [-1,1]
      vec2 lens = vUv * 2.0 - 1.0;

      // Radial distance from center in lens space (0 at center, √2 at corner)
      float r = length(lens);

      // Falloff: 0 at center, grows as r^uFalloff outward
      float strength = uAmount * pow(r, uFalloff);

      // Direction from center (normalized)
      vec2 dir = (r > 0.0001) ? normalize(lens) : vec2(0.0);

      // Channel offsets in UV space (convert back from lens to UV scale)
      vec2 offsetR = dir * strength * 0.5;        // R shifted outward
      vec2 offsetB = dir * strength * -0.5;       // B shifted inward

      float col_r = texture2D(tDiffuse, vUv + offsetR).r;
      float col_g = texture2D(tDiffuse, vUv).g;          // G unshifted
      float col_b = texture2D(tDiffuse, vUv + offsetB).b;

      gl_FragColor = vec4(col_r, col_g, col_b, texture2D(tDiffuse, vUv).a);
    }
  `,
}

// ─────────────────────────────────────────────────────────────────────────────
// PostProcessing — single composer managing the full pipeline:
//   RenderPass → UnrealBloom → BokehDoF → BrightnessContrast
//   → ToneMapping → ChromaticAberration → Vignette → OutputPass
// ─────────────────────────────────────────────────────────────────────────────
const PostProcessing = ({ bloom, dof, color, vignette, ca, ssr }) => {
  const { gl, scene, camera, size } = useThree()
  const { isExploded } = useExploded()

  // Build the full composer once per renderer/scene/camera
  const passes = useMemo(() => {
    const comp = new EffectComposer(gl)

    // 1. Scene render
    const renderPass = new RenderPass(scene, camera)
    comp.addPass(renderPass)

    // 1.5 SSR Pass (Screen Space Reflections)
    const selects = []
    scene.traverse((c) => {
      if (c.isMesh) selects.push(c)
    })
    const ssrPass = new SSRPass({
      renderer: gl,
      scene: scene,
      camera: camera,
      width: size.width,
      height: size.height,
      groundReflector: null,
      selects: selects
    })
    comp.addPass(ssrPass)

    // 2. Unreal Bloom
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloom.strength,
      bloom.radius,
      bloom.threshold,
    )
    comp.addPass(bloomPass)

    // 3. Depth of Field (Bokeh)
    const bokehPass = new BokehPass(scene, camera, {
      focus: dof.focusDistance,
      aperture: dof.focalLength * 0.00001,
      maxblur: dof.bokehScale * 0.01,
    })
    bokehPass.enabled = dof.enabled
    comp.addPass(bokehPass)

    // 4. Brightness / Contrast
    const bcPass = new ShaderPass(BrightnessContrastShader)
    bcPass.uniforms.brightness.value = color.brightness
    bcPass.uniforms.contrast.value = color.contrast
    comp.addPass(bcPass)

    // 5. ACES Tone Mapping + Exposure
    const tmPass = new ShaderPass(ACESFilmicToneMappingShader)
    tmPass.uniforms.exposure.value = color.exposure
    tmPass.enabled = color.toneMapping !== 'none'
    comp.addPass(tmPass)

    // 6. Chromatic Aberration (radial, center-zero falloff)
    const caPass = new ShaderPass(ChromaticAberrationShader)
    caPass.uniforms.uAmount.value = ca.enabled ? ca.amount : 0
    caPass.uniforms.uFalloff.value = ca.falloff
    comp.addPass(caPass)

    // 7. Vignette
    const vigPass = new ShaderPass(VignetteShader)
    vigPass.uniforms.offset.value = vignette.offset
    vigPass.uniforms.darkness.value = vignette.enabled ? vignette.darkness : 0
    comp.addPass(vigPass)

    // 8. Output (sRGB gamma)
    const outputPass = new OutputPass()
    comp.addPass(outputPass)

    return { comp, renderPass, ssrPass, bloomPass, bokehPass, bcPass, tmPass, caPass, vigPass }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  // Resize
  useEffect(() => {
    passes.comp.setSize(size.width, size.height)
    if (passes.ssrPass) {
      passes.ssrPass.setSize(size.width * ssr.ssrResolutionScale, size.height * ssr.ssrResolutionScale)
    }
  }, [passes.comp, passes.ssrPass, size, ssr.ssrResolutionScale])

  // ── Sync SSR ────────────────────────────────────────────────
  useEffect(() => {
    if (!passes.ssrPass) return
    passes.ssrPass.enabled = ssr.ssrEnabled
    passes.ssrPass.thickness = ssr.ssrThickness
    passes.ssrPass.maxDistance = ssr.ssrMaxDistance
    passes.ssrPass.opacity = ssr.ssrOpacity
  }, [passes.ssrPass, ssr.ssrEnabled, ssr.ssrThickness, ssr.ssrMaxDistance, ssr.ssrOpacity])

  // ── Sync Bloom ────────────────────────────────────────────────
  useEffect(() => {
    passes.bloomPass.strength = bloom.enabled ? bloom.strength : 0
    passes.bloomPass.radius = bloom.radius
    passes.bloomPass.threshold = bloom.threshold
  }, [passes.bloomPass, bloom.enabled, bloom.strength, bloom.radius, bloom.threshold])

  // ── Sync DoF ──────────────────────────────────────────────────
  useEffect(() => {
    passes.bokehPass.enabled = dof.enabled
    passes.bokehPass.uniforms['focus'].value = dof.focusDistance
    passes.bokehPass.uniforms['aperture'].value = dof.focalLength * 0.00001
    passes.bokehPass.uniforms['maxblur'].value = dof.bokehScale * 0.01
  }, [passes.bokehPass, dof.enabled, dof.focusDistance, dof.focalLength, dof.bokehScale])

  // ── Sync Color Grading ────────────────────────────────────────
  useEffect(() => {
    passes.bcPass.uniforms.brightness.value = color.brightness
    passes.bcPass.uniforms.contrast.value = color.contrast
  }, [passes.bcPass, color.brightness, color.contrast])

  useEffect(() => {
    passes.tmPass.enabled = color.toneMapping !== 'none'
    passes.tmPass.uniforms.exposure.value = color.exposure
  }, [passes.tmPass, color.toneMapping, color.exposure])

  // ── Sync Chromatic Aberration ─────────────────────────────────
  useEffect(() => {
    passes.caPass.uniforms.uAmount.value = ca.enabled ? ca.amount : 0
    passes.caPass.uniforms.uFalloff.value = ca.falloff
  }, [passes.caPass, ca.enabled, ca.amount, ca.falloff])

  // ── Sync Vignette ─────────────────────────────────────────────
  useEffect(() => {
    passes.vigPass.uniforms.offset.value = vignette.offset
    passes.vigPass.uniforms.darkness.value = vignette.enabled ? vignette.darkness : 0
  }, [passes.vigPass, vignette.enabled, vignette.offset, vignette.darkness])

  // Cleanup
  useEffect(() => {
    return () => { passes.comp.dispose() }
  }, [passes.comp])

  // ── Sync Per-Waypoint DoF & FOV ───────────────────────────────
  const wasEnabledRef = useRef(false)

  useFrame(() => {
    const isEnabled = waypointCameraState.perWaypointEnabled || !!isExploded
    if (isEnabled) {
      const { focusDistance, focalLength, bokehScale } = waypointCameraState
      passes.bokehPass.uniforms['focus'].value = focusDistance
      passes.bokehPass.uniforms['aperture'].value = focalLength * 0.00001
      passes.bokehPass.uniforms['maxblur'].value = bokehScale * 0.01
      passes.bokehPass.enabled = true
      wasEnabledRef.current = true
    } else if (wasEnabledRef.current) {
      // Restore Leva controls values once when toggled off
      passes.bokehPass.enabled = dof.enabled
      passes.bokehPass.uniforms['focus'].value = dof.focusDistance
      passes.bokehPass.uniforms['aperture'].value = dof.focalLength * 0.00001
      passes.bokehPass.uniforms['maxblur'].value = dof.bokehScale * 0.01
      wasEnabledRef.current = false
    }
  }, 0)

  // Take over render loop (priority 1)
  useFrame(() => { passes.comp.render() }, 1)

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// GlassTransmission — finds the TourbillonGlass mesh inside TourbillonDome.glb
// and replaces its material with a MeshPhysicalMaterial featuring real-time
// transmission, IOR, thickness, and simulated dispersion (via CA-style tint).
// ─────────────────────────────────────────────────────────────────────────────
const GlassTransmission = ({ config }) => {
  const gltf = useAdvancedGLTF('/TourbillonDome.glb')

  const matRef = useRef(null)

  // Create and apply the physical glass material once
  useEffect(() => {
    if (!gltf?.scene) return

    gltf.scene.traverse((child) => {
      if (!child.isMesh) return

      // Match by material name or mesh name
      const matName = Array.isArray(child.material)
        ? child.material[0]?.name
        : child.material?.name
      const isGlass = matName === 'TourbillonGlass' || child.name === 'TourbillonGlass'
      if (!isGlass) return

      // Build a premium physical glass material
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        transmission: config.transmission,
        thickness: config.thickness,
        ior: config.ior,
        roughness: 0.0,
        metalness: 0.0,
        transparent: true,
        side: THREE.FrontSide,
        // Slight tint for dispersion illusion via color
        attenuationColor: new THREE.Color(0xffffff),
        attenuationDistance: 0.5,
      })
      glassMat.name = 'TourbillonGlass'

      // Dispose old material if it's a clone
      if (child.material && child.material !== glassMat) {
        child.material.dispose?.()
      }

      child.material = glassMat
      matRef.current = glassMat
      child.castShadow = false     // glass doesn't cast hard shadows
      child.receiveShadow = true
    })
  }, [gltf])

  // Live-update material properties from Leva without recreating
  useEffect(() => {
    const mat = matRef.current
    if (!mat) return

    if (!config.enabled) {
      mat.visible = false
      return
    }

    mat.visible = true
    mat.transmission = config.transmission
    mat.thickness = config.thickness
    mat.ior = config.ior
    mat.roughness = config.roughness
    mat.color.set(config.color)
    mat.attenuationColor.set(config.color)
    mat.needsUpdate = true
  }, [config])

  return null
}

const CaseTransmission = ({ config }) => {
  const gltf = useAdvancedGLTF('/TourbillonMainSystem.glb')

  const matRef = useRef(null)

  // Create and apply the physical glass material once
  useEffect(() => {
    if (!gltf?.scene) return

    gltf.scene.traverse((child) => {
      if (!child.isMesh) return

      // Match by material name or mesh name
      const matName = Array.isArray(child.material)
        ? child.material[0]?.name
        : child.material?.name
      const isGlass = matName === 'TourbillonGlass' || child.name === 'TourbillonSouthOutter' || child.name === 'TourbillonNorthOutter'
      if (!isGlass) return

      // Build a premium physical glass material
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffffff),
        transmission: config.transmission,
        thickness: config.thickness,
        ior: config.ior,
        roughness: 0.0,
        metalness: 0.0,
        transparent: true,
        side: THREE.FrontSide,
        // Slight tint for dispersion illusion via color
        attenuationColor: new THREE.Color(0xffffff),
        attenuationDistance: 0.5,
      })
      glassMat.name = 'TourbillonGlass'

      // Dispose old material if it's a clone
      if (child.material && child.material !== glassMat) {
        child.material.dispose?.()
      }

      child.material = glassMat
      matRef.current = glassMat
      child.castShadow = false     // glass doesn't cast hard shadows
      child.receiveShadow = true
    })
  }, [gltf])

  // Live-update material properties from Leva without recreating
  useEffect(() => {
    const mat = matRef.current
    if (!mat) return

    if (!config.enabled) {
      mat.visible = false
      return
    }

    mat.visible = true
    mat.transmission = config.transmission
    mat.thickness = config.thickness
    mat.ior = config.ior
    mat.roughness = config.roughness
    mat.color.set(config.color)
    mat.attenuationColor.set(config.color)
    mat.needsUpdate = true
  }, [config])

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// FadeIn: overlay HTML negro que desaparece suavemente al cargar la escena
// ─────────────────────────────────────────────────────────────────────────────
const FadeIn = ({ delayMs = 1500 }) => {
  const { active, progress } = useProgress()
  const [startFade, setStartFade] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (progress === 100 && !active) {
      const timer = setTimeout(() => {
        setStartFade(true)
        setTimeout(() => setVisible(false), 2000)
      }, delayMs)
      return () => clearTimeout(timer)
    }
  }, [active, progress, delayMs])

  if (!visible) return null

  return (
    <Html
      fullscreen
      style={{
        pointerEvents: 'none',
        backgroundColor: 'black',
        transition: 'opacity 2s ease-in-out',
        opacity: startFade ? 0 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'sans-serif',
        fontSize: '24px',
        letterSpacing: '2px',
        zIndex: 999999
      }}
    >
      Entering Tourbillon
    </Html>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience: escena principal
// ─────────────────────────────────────────────────────────────────────────────
const Experience = () => {
  const controls = useLevaControls()
  const { ambient, dirLight, shadow, env, bloom, dof, color, vignette, ca, transmission, ssr } = controls

  return (
    <>
      {/* Unified post-processing pipeline */}
      <PostProcessing
        bloom={bloom}
        dof={dof}
        color={color}
        vignette={vignette}
        ca={ca}
        ssr={ssr}
      />

      {/* Glass transmission on TourbillonGlass mesh */}
      <GlassTransmission config={transmission} />
      <CaseTransmission config={transmission} />
      {/* Fade negro inicial al entrar */}
      <FadeIn delayMs={1500} />

      {/* Luces */}
      {ambient.enabled && (
        <ambientLight intensity={ambient.intensity} color={ambient.color} />
      )}
      {dirLight.enabled && (
        <directionalLight
          position={dirLight.position}
          intensity={dirLight.intensity}
          color={dirLight.color}
          castShadow={shadow.enabled}
          shadow-bias={shadow.bias}
          shadow-mapSize-width={shadow.mapSize}
          shadow-mapSize-height={shadow.mapSize}
          shadow-camera-far={250}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-near={0.1}
        />
      )}

      {/* HDRI Environment para IBL */}
      <Environment
        files="/citrus_orchard_road_puresky_1k.hdr"
        background={false}
        environmentIntensity={env.envIntensity}
      />

      {/* Modelos 3D de la escena */}
      <SceneModels
        envMapIntensity={env.envIntensity}
        emissiveIntensity={controls.emissive.intensity}
      />

      {/* Animaciones de puertas, domo y sistema tourbillon por proximidad */}
      <DoorAnimations />
      <DomeAnimation />
      <TourbillonAnimations />
      <SpatialAudioController />
    </>
  )
}

export default Experience
