import React, { useMemo, useEffect, Suspense, useRef, useState } from 'react'
import { useFrame, useThree, useLoader, extend, Canvas } from '@react-three/fiber'
import { TorusKnot, OrbitControls, Environment, Html, useGLTF, PerspectiveCamera } from '@react-three/drei'
import { createPortal } from '@react-three/fiber'
import Fire from './utils/Fire'
import * as THREE from 'three'
import { RenderPipeline, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { pass, renderOutput, add, texture, uv, reflector } from 'three/tsl'
import * as TSL from 'three/tsl'
import { hitPoint, hitIntensity } from './utils/TSLInteractionManager'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import gsap from 'gsap'
import { TSLInteractionManager, updateTSLHit, updateTSLOffset } from './utils/TSLInteractionManager'
import { applyHexReveal } from './utils/HexReveal'
import { applyRingsDos } from './utils/RingsDos'
import { applyGridTransition } from './utils/GridTransition'
import { applyTransmission } from './utils/applyTransmission'
import { applyGlitch } from './utils/Glitch'
import Singularity from './utils/Singularity/Singularity'
import { applyWormholeMaterials } from './utils/Wormhole'
import { WebGPURenderer } from 'three/webgpu'
import useAlquimiaStore from './store/useAlquimiaStore'
import translations from './locales/translations.json'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const mobileFactor = isMobile ? 0.65 : 1.0 // Factor de escala para calidad visual
const RENDER_ALQUIMIA_ROOM = true

const hudMobilePositions = [
  { bottom: -125, left: 15 },
  { bottom: -171, left: 76 },
  { bottom: -57, left: 0 },
  { bottom: -54, left: 4 },
  { bottom: -40, left: 2 }
]

// --- CONFIGURACIÓN DE DEBUG Y MAPPING ---
const SHOW_HITBOXES = false // CAMBIAR A true PARA VER LAS ESFERAS DE DETECCIÓN

// --- TRANSFORMS DE HITBOXES GLB (ajusta posición y escala de cada colisionador) ---
const COLLISION_TRANSFORMS = {
  'AlquimiaCircleOuter': { pos: [0, 0, 0], scale: [0.9, 0.9, 0.9] },
  'AlquimiaTriangle': { pos: [0, -0.2, 0], scale: [1.2, 1.2, 1.2] },
  'AlquimiaCircleInner': { pos: [0, 0, 0], scale: [2.2, 2.2, 2.2] },
  'AlquimiaSquare': { pos: [0, 0, 0], scale: [3, 3, 3] },
}
const MESH_NAME_TO_KEY = {
  'AlquimiaCircleOuter': 'circleOuter',
  'AlquimiaTriangle': 'triangle',
  'AlquimiaCircleInner': 'circleInner',
  'AlquimiaSquare': 'square',
  'AlquimiaFlask': 'flask',
  'AlquimiaDNA': 'flask'
}

// Configuración de UI
const WP4_LOGO_CONFIG = {
  opacity: 0.1,
  color: 'white' // 'white' aplica el filtro invert(1)
}

const SHOW_FORCE_TIME_EVENT = false // CAMBIAR A false PARA PRODUCCIÓN

// --- DRUNK ORB & PARTICLES CONFIG ---
const DRUNK_ORB_CONFIG = {
  color: '#00ffff',
  emissiveIntensity: 0.7,
  particleCount: 55,
  particleColor: '#5ac404ff',
  particleSize: 0.05
}

extend({ MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, MeshBasicNodeMaterial })

// KTX2 Transcoder path (using CDN)
const KTX2_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/'

// Estado de navegación a nivel de módulo (inmune a re-renders de React/R3F)
// Movido a useAlquimiaStore.js

const MovingLensFlare = ({ scrollRef }) => {
  const texture = useLoader(THREE.TextureLoader, '/assets/lensFlare_2.webp')
  const meshRef = useRef()

  useFrame(() => {
    if (meshRef.current && scrollRef.current !== undefined) {
      const scroll = scrollRef.current // 0.0 a 2.0

      // Mapeamos el scroll de 0.0 a 1.0 (WP1 a WP2)
      // WP1: Centro-Arriba -> WP2: Abajo-Derecha
      const t = THREE.MathUtils.clamp(scroll, 0, 1.5)

      // Posición: de [0, 2, -5] a [5, -2, -5] (por ejemplo)
      // Posición: ajustada para asegurar visibilidad en el intro
      meshRef.current.position.x = THREE.MathUtils.lerp(4, 2, t)
      meshRef.current.position.y = THREE.MathUtils.lerp(3.3, 8, t)
      meshRef.current.position.z = 2 // Más cerca de la cámara (que está en z=8)
      meshRef.current.lookAt(0, 0.5, 8)

      // Opacidad: Bien brillante al inicio, fade out hacia el WP2
      meshRef.current.material.opacity = THREE.MathUtils.lerp(0.7, 0, t)
      meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(1, 0, t)

      // Escala: Un poco más grande al inicio
      const scale = THREE.MathUtils.lerp(10, 2, t)
      meshRef.current.scale.set(scale, scale, 1.5)
    }
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        map={texture}
        transparent
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        opacity={1}
      />
    </mesh>
  )
}

const SciFiTooltip = ({ text }) => {
  return (
    <div className={`sci-fi-tooltip ${isMobile ? 'mobile-tooltip' : ''}`}>
      <div className="tooltip-text">{text}</div>
      <div className="tooltip-line"></div>
    </div>
  )
}

const BloomEffect = ({ glitchUniformRef }) => {
  const { gl, scene, camera } = useThree()

  const composer = useMemo(() => {
    const renderPipeline = new RenderPipeline(gl)
    const scenePass = pass(scene, camera)

    // Glitch (usamos el TextureNode del pase de escena)
    const glitchedScene = applyGlitch(scenePass.getTextureNode(), glitchUniformRef.current, {
      speed: 2.0,
      intensity: 0.5, // Mucho más intenso
      scanlines: 250
    })

    // Bloom estándar (ahora sobre la escena glitcheada)
    const bloomPass = bloom(glitchedScene, 1.5, 0.5, 0.9)

    // Composición final
    renderPipeline.outputNode = renderOutput(add(glitchedScene, bloomPass))

    return renderPipeline
  }, [gl, scene, camera])

  useFrame(() => {
    if (composer) {
      composer.render()
    }
  }, 1)

  return null
}

const SimpleBloomEffect = ({ strength = 1.5, radius = 0.5, threshold = 0.9 }) => {
  const { gl, scene, camera } = useThree()

  const composer = useMemo(() => {
    const renderPipeline = new RenderPipeline(gl)
    const scenePass = pass(scene, camera)

    // Bloom con parámetros independientes
    const bloomPass = bloom(scenePass, strength, radius, threshold)

    renderPipeline.outputNode = renderOutput(add(scenePass, bloomPass))

    return renderPipeline
  }, [gl, scene, camera, strength, radius, threshold])

  useFrame(() => {
    if (composer) {
      composer.render()
    }
  }, 1)

  return null
}

// Vectores de uso global para evitar Garbage Collection spikes en useFrame
const _tempWorldPos = new THREE.Vector3()
const _tempTargetPos = new THREE.Vector3()
const _tempFrontVec = new THREE.Vector3()
const _tempOffsetVec = new THREE.Vector3()
const _tempBrakeVec = new THREE.Vector3()

const Model = ({
  url,
  scrollRef,
  isReflective,
  isExploded: externalIsExploded,
  setIsExploded: externalSetIsExploded,
  detailedPart,
  setDetailedPart,
  hoveredPart,
  setHoveredPart,
  isOverlayVisible,
  setIsOverlayVisible,
  isFlaskSubExploded,
  setIsFlaskSubExploded,
  expandedNarrativePanel,
  setExpandedNarrativePanel,
  isMainArtifact = false,
  ...props
}) => {
  const { gl, scene: globalScene, camera: globalCamera, pointer } = useThree()
  const isTabActive = useAlquimiaStore((state) => state.isTabActive)
  const [isNear, setIsNear] = useState(false)
  const consoleGlassRef = useRef()
  const tlRef = useRef()
  const buttonRef = useRef()
  const tlButtonRef = useRef()
  const clickUnconstructRef = useRef()
  const gridUniformsRef = useRef([])
  const transmissionUniformRef = useRef()
  const domeRefs = useRef({
    top: [],
    right: [],
    left: []
  })
  const drunkOrbRef = useRef()
  const trailMeshRef = useRef()
  const trailPositions = useRef(Array(DRUNK_ORB_CONFIG.particleCount).fill().map(() => new THREE.Vector3()))
  const _dummyOrb = useMemo(() => new THREE.Object3D(), [])
  const holoTimeUniform = useRef(TSL.uniform(0))
  const artifactPartsRef = useRef({
    circleOuter: null,
    triangle: null,
    circleInner: null,
    // circleInnerCircle: null,
    flask: null,
    square: null,
    dna: null,
    reflectorMesh: null,
    holoOpacity: null
  })
  const initialPositionsRef = useRef({})
  // Acceso al store global para coordinar animaciones y estados
  const isAnimatingCinematic = useAlquimiaStore((state) => state.isAnimatingCinematic)
  const setIsAnimatingCinematic = useAlquimiaStore((state) => state.setIsAnimatingCinematic)
  const setScrollPhase = useAlquimiaStore((state) => state.setScrollPhase)
  const setTargetScrollStore = useAlquimiaStore((state) => state.setTargetScroll)
  const isArtifactActive = useAlquimiaStore((state) => state.isArtifactActive)
  const isTimeAnomalyActive = useAlquimiaStore((state) => state.isTimeAnomalyActive)
  const language = useAlquimiaStore((state) => state.language)
  const t = translations[language]

  const journeyMode = useAlquimiaStore((state) => state.journeyMode)
  const setJourneyMode = useAlquimiaStore((state) => state.setJourneyMode)
  const targetScroll = useAlquimiaStore((state) => state.targetScroll)

  const isExploded = externalIsExploded
  const setIsExploded = externalSetIsExploded

  // Control de performance dinámico (DPR) - AHORA DIFERIDO
  useEffect(() => {
    // Solo bajamos el DPR si el overlay ya es visible para ocultar el pixelado inicial
    if ((detailedPart === 'circleOuter' || detailedPart === 'triangle' || detailedPart === 'circleInner' || detailedPart === 'square') && isOverlayVisible) {
      gl.setPixelRatio(isMobile ? 0.1 : 0.2)
    } else {
      // Restauramos DPR optimizado para móvil
      gl.setPixelRatio(isMobile ? 0.7 : 1)
    }
  }, [detailedPart, isOverlayVisible, gl])

  const explosionProgress = useRef(0)
  const subExplodeProgress = useRef(0)
  const dpRef = useRef({
    circleOuter: 0, triangle: 0, circleInner: 0, /* circleInnerCircle: 0, */ square: 0, flask: 0, dna: 0
  })

  // Física de arrastre para DrunkOrb
  const drunkOrbDragRef = useRef({
    isDragging: false,
    wasDragged: false,
    grabPointer: new THREE.Vector2(),
    dragOffset: new THREE.Vector3(0, 0, 0),
    dragVelocity: new THREE.Vector3(0, 0, 0)
  })

  const explosionKeys = ['circleOuter', 'triangle', 'circleInner', /* 'circleInnerCircle', */ 'flask', 'square', 'dna', 'holoOpacity']

  const artifactConfig = {
    circleOuter: { speed: 1.8, pos: [0, 0, 0], rotDir: [-0.5, 0.5, 1], explodedPos: isMobile ? [-2, 5.8, -0.5] : [-5.8, 4.5, -0.5], inspectPos: isMobile ? [-0.7, 4, 3] : [-0.6, 4.95, 4.4], brakePos: [0, 0, 0.2], floatAmp: 0.15, floatSpeed: 0.6 },
    triangle: { speed: 6.5, pos: [0, 0, 0], rotDir: [0, 1, 0], explodedPos: isMobile ? [-2, 2.5, -0.5] : [-2.8, 4.5, -0.5], inspectPos: isMobile ? [-0.7, 4, 3] : [-0.6, 4.98, 4.8], brakePos: [0, 0, 0.3], floatAmp: 0.12, floatSpeed: 0.9 },
    circleInner: { speed: 5.7, pos: [0, 0, 0], rotDir: [0, -1.5, -1], explodedPos: isMobile ? [1, 2.5, -0.5] : [1.5, 4.5, -0.5], inspectPos: isMobile ? [-0.7, 4, 3] : [-0.6, 4.95, 5], brakePos: [0, 0, 0.45], floatAmp: 0.1, floatSpeed: 1.2 },
    flask: { floatAmp: 0.05, floatSpeed: 1.5, rotSpeed: 0.3, pos: [0, 0, 0], explodedPos: isMobile ? [-0.5, 4.2, 2] : [-0.5, 4.5, -0.5], inspectPos: isMobile ? [-0.64, 4, 4.5] : [-0.6, 4.9, 5.8], brakePos: [0.05, -0.005, 1.2] },
    square: { speed: 8.0, pos: [0, 0, 0], rotDir: [1, 1, 1], explodedPos: isMobile ? [1, 5.8, -0.5] : [4, 4.5, -0.5], inspectPos: isMobile ? [-0.7, 4, 3] : [-0.6, 5, 5], brakePos: [0.05, -0.12, 1], floatAmp: 0.18, floatSpeed: 0.5 },
    dna: { emissionIntensity: 1.2, pos: [0, 0, 0], explodedPos: isMobile ? [-0.5, 4.15, 2] : [-0.5, 4.4, -0.5], inspectPos: isMobile ? [-0.64, 3.93, 4.5] : [-0.6, 4.82, 5.8], brakePos: [0.045, -0.02, 1.2] },
    holoOpacity: { speed: 0.8, emissionIntensity: 0.8, emissionColor: '#0d0f0fff' }
  }

  // Reflector TSL
  const reflectorNode = useMemo(() => {
    if (!isReflective) return null
    return reflector({
      resolutionScale: 1.0,
      bounces: true,
      scene: globalScene,
      camera: globalCamera
    })
  }, [isReflective, globalScene, globalCamera])

  const model = useLoader(GLTFLoader, url, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
    loader.setDRACOLoader(dracoLoader)

    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath(KTX2_TRANSCODER_PATH)
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  // Cargamos el archivo de colisiones personalizadas
  const collisionsGLTF = useGLTF('/assets/Alquimia_collisions.glb')

  // Pre-extraemos los meshes de colisión por nombre para usarlos en lugar de esferas
  const collisionMeshMap = useMemo(() => {
    const map = {}
    if (!collisionsGLTF?.scene) return map
    collisionsGLTF.scene.traverse((child) => {
      if (child.isMesh) {
        map[child.name] = child
      }
    })
    return map
  }, [collisionsGLTF])

  const fireTexture = useLoader(THREE.TextureLoader, '/assets/Fire4.webp')

  const scene = useMemo(() => {
    const clonedScene = model.scene.clone()
    gridUniformsRef.current = [] // Limpiar uniformes al reconstruir escena
    let glassMesh = null
    let pivotNode = null
    let buttonMesh = null

    domeRefs.current.top = [] // Reset
    domeRefs.current.right = []
    domeRefs.current.left = []

    clonedScene.traverse((child) => {
      if (child.name === 'ConsoleGlass') {
        glassMesh = child
      }
      if (child.name === 'ConsoleGlassRotate') pivotNode = child
      if (child.name.includes('Button') || (child.isMesh && child.material && child.material.name.includes('Button'))) {
        buttonMesh = child
      }
      if (child.name === 'ClickUnconstruct') {
        clickUnconstructRef.current = child
        initialPositionsRef.current.clickUnconstruct = child.position.clone()

        // Ajuste de posición manual (modifica estos valores para mover el mesh)
        child.position.set(child.position.x + 0, child.position.y + 0, child.position.z + 2)

        if (child.material) {
          if (SHOW_HITBOXES) {
            child.material = new THREE.MeshBasicMaterial({
              visible: true,
              color: 0xff0000, // Rojo para diferenciar de los otros
              wireframe: true,
              transparent: true,
              opacity: 0.8,
              depthWrite: false
            })
          } else {
            child.material.transparent = true
            child.material.opacity = 0
            child.material.depthWrite = false
          }
        }
      }

      // Domes
      if (child.name.startsWith('TopDomeGrabber')) domeRefs.current.top.push(child)
      if (child.name.startsWith('RightDome')) domeRefs.current.right.push(child)
      if (child.name.startsWith('LeftDome')) domeRefs.current.left.push(child)

      // Fix para LeftDome_2 y Glass2 para asegurar visibilidad constante
      if (child.name === 'LeftDome_2' || child.name === 'Glass2' || child.name === 'LeftDomeGrabber_2') {
        child.frustumCulled = false
        if (child.material) {
          child.material.depthWrite = true
          child.material.depthTest = true
          child.material.transparent = true
        }
      }

      // Artifact Parts
      if (child.name === 'AlquimiaCircleOuter') {
        artifactPartsRef.current.circleOuter = child
        initialPositionsRef.current.circleOuter = child.position.clone()
      }
      if (child.name === 'AlquimiaTriangle') {
        artifactPartsRef.current.triangle = child
        initialPositionsRef.current.triangle = child.position.clone()
      }
      if (child.name === 'AlquimiaCircleInner') {
        artifactPartsRef.current.circleInner = child
        initialPositionsRef.current.circleInner = child.position.clone()
      }
      if (child.name === 'AlquimiaCircleInnerCircle') {
        child.visible = false // Ocultado de la escena a petición
        // artifactPartsRef.current.circleInnerCircle = child
        // initialPositionsRef.current.circleInnerCircle = child.position.clone()
      }
      if (child.name === 'AlquimiaFlask') {
        artifactPartsRef.current.flask = child
        initialPositionsRef.current.flask = child.position.clone()
      }
      if (child.name === 'AlquimiaSquare') {
        artifactPartsRef.current.square = child
        initialPositionsRef.current.square = child.position.clone()
      }
      if (child.name === 'AlquimiaDNA') {
        artifactPartsRef.current.dna = child
        initialPositionsRef.current.dna = child.position.clone()
        if (child.material) {
          const oldMat = child.material
          const nodeMat = new MeshStandardNodeMaterial({
            color: oldMat.color,
            map: oldMat.map,
            normalMap: oldMat.normalMap,
            roughness: oldMat.roughness,
            metalness: oldMat.metalness,
            transparent: oldMat.transparent,
            opacity: oldMat.opacity,
            emissive: oldMat.emissive || new THREE.Color(0xffffff),
            emissiveMap: oldMat.emissiveMap,
            emissiveIntensity: artifactConfig.dna.emissionIntensity
          })
          child.material = nodeMat
        }
      }
      if (child.name === 'HoloOpacity') {
        artifactPartsRef.current.holoOpacity = child
        if (child.material) {
          // Reemplazamos por un material de nodos para el gradiente dinámico
          const oldMat = child.material
          const nodeMat = new MeshStandardNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            opacity: oldMat.opacity,
            alphaMap: oldMat.alphaMap,
            map: oldMat.map,
            roughness: 1,
            metalness: 1,
            color: '#000000', // Base negra para que solo resalte la emisión
            blending: THREE.AdditiveBlending, // Mezcla aditiva para efecto holograma
            depthWrite: false // Evita problemas de orden con transparencia
          })

          // Re-aplicamos el wrapping forzado en el nuevo material
          const maps = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']
          maps.forEach(mapName => {
            if (nodeMat[mapName]) {
              nodeMat[mapName].wrapS = THREE.RepeatWrapping
              nodeMat[mapName].wrapT = THREE.RepeatWrapping
            }
          })

          // Aplicamos el shader RingsDos en vez de RingsUp
          applyRingsDos(nodeMat, {
            color1: artifactConfig.holoOpacity.emissionColor,
            color2: '#00ffff',
            speed: artifactConfig.holoOpacity.speed,
            intensity: artifactConfig.holoOpacity.emissionIntensity * 2.0,
            scale: 0.5,
            timeNode: holoTimeUniform.current
          })

          child.material = nodeMat
        }
      }

      // Aplicar HexReveal a los meshes del artefacto
      const hexMeshes = [
        'AlquimiaCircleOuter',
        'AlquimiaTriangle',
        'AlquimiaCircleInner',
        // 'AlquimiaCircleInnerCircle',
        'AlquimiaSquare',
        'AlquimiaFlask',


      ]

      // Meshes de ambiente para transición de grid
      const environmentMeshes = [
        'Walls', 'TV', 'Cabinet1', 'Glass1', 'FloorNew', 'Tables',
        'Wood_chair', 'Plants', 'Plant', 'Leaves', 'Lamp_1'
      ]

      if (environmentMeshes.some(name => child.name.startsWith(name))) {
        if (child.material) {
          const oldMat = child.material
          const nodeMat = new MeshStandardNodeMaterial({
            color: oldMat.color,
            map: oldMat.map || null,
            normalMap: oldMat.normalMap || null,
            roughness: oldMat.roughness ?? 1.0,
            metalness: oldMat.metalness ?? 0.0,
            roughnessMap: oldMat.roughnessMap || null,
            metalnessMap: oldMat.metalnessMap || null,
            emissive: oldMat.emissive || new THREE.Color(0x000000),
            emissiveMap: oldMat.emissiveMap || null,
            emissiveIntensity: oldMat.emissiveIntensity ?? 1.0,
            envMapIntensity: oldMat.envMapIntensity ?? 1.0,
            aoMap: oldMat.aoMap || null,
            aoMapIntensity: oldMat.aoMapIntensity ?? 1.0,
            side: oldMat.side ?? THREE.FrontSide,
            transparent: true,
            opacity: oldMat.opacity ?? 1.0
          })

          const progress = applyGridTransition(nodeMat)
          gridUniformsRef.current.push(progress)

          // Forzar emisión en la lámpara usando su mapa original si existe
          if (child.name.startsWith('Lamp_1')) {
            const emissiveMap = oldMat.emissiveMap
            if (emissiveMap) {
              // Multiplicamos el mapa de emisión por una intensidad mayor
              nodeMat.emissiveNode = texture(emissiveMap).mul(75.0)
            } else {
              nodeMat.emissiveNode = TSL.color('#FFD700').mul(0.1)
            }
          }

          child.material = nodeMat
        }
      }

      if (hexMeshes.includes(child.name) && !child.name.endsWith('_Hitbox')) {
        if (child.material) {
          const oldMat = child.material
          const isFlask = child.name === 'AlquimiaFlask'

          const nodeMat = isFlask ? new MeshPhysicalNodeMaterial({
            color: oldMat.color,
            map: oldMat.map || null,
            normalMap: oldMat.normalMap || null,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: oldMat.opacity ?? 1,
            transmission: 1.0,
            thickness: 1.0,
            ior: 1.5
          }) : new MeshStandardNodeMaterial({
            color: oldMat.color,
            map: oldMat.map || null,
            normalMap: oldMat.normalMap || null,
            roughness: oldMat.roughness ?? 0.5,
            metalness: oldMat.metalness ?? 0.5,
            transparent: oldMat.transparent ?? false,
            opacity: oldMat.opacity ?? 1
          })

          applyHexReveal(nodeMat)

          if (isFlask) {
            transmissionUniformRef.current = applyTransmission(nodeMat)
          }

          child.material = nodeMat

          // --- COLISIONES PRECISAS (GLB) o Hitbox de Fallback ---
          // Mapeo de nombre de artefacto a nombre de mesh de colisión en el GLB
          const collisionNameMap = {
            'AlquimiaCircleOuter': 'circleOuter_collision',
            'AlquimiaTriangle': 'triangle_collision',
            'AlquimiaCircleInner': 'circleInner_collision',
            'AlquimiaSquare': 'square_collision',
          }
          const collisionMeshName = collisionNameMap[child.name]
          const sourceMesh = collisionMeshName ? collisionMeshMap[collisionMeshName] : null

          if (sourceMesh) {
            // Clonamos el mesh de colisión y lo hacemos invisible pero raycasteable
            const collisionClone = sourceMesh.clone()
            collisionClone.material = new THREE.MeshBasicMaterial({
              visible: SHOW_HITBOXES,
              color: 0xff00ff,
              wireframe: true,
              transparent: true,
              opacity: 0.5,
            })
            collisionClone.name = child.name + '_Hitbox'
            // Aplicamos el transform configurable desde COLLISION_TRANSFORMS
            const ct = COLLISION_TRANSFORMS[child.name] || { pos: [0, 0, 0], scale: [1, 1, 1] }
            collisionClone.position.set(...ct.pos)
            collisionClone.rotation.set(0, 0, 0)
            collisionClone.scale.set(...ct.scale)
            child.add(collisionClone)
          } else if (child.name !== 'AlquimiaDNA' || SHOW_HITBOXES) {
            // Fallback: esfera genérica para Flask y otros meshes sin colisión GLB
            const hitBox = new THREE.Mesh(
              new THREE.SphereGeometry(1.5, 8, 8),
              new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                wireframe: true,
                visible: SHOW_HITBOXES,
                transparent: true,
                opacity: 0.5
              })
            )
            hitBox.name = child.name + '_Hitbox'
            child.add(hitBox)
          }
        }
      }
    })

    if (glassMesh && pivotNode) {
      pivotNode.attach(glassMesh)
      consoleGlassRef.current = pivotNode
    } else if (pivotNode) {
      consoleGlassRef.current = pivotNode
    } else if (glassMesh) {
      consoleGlassRef.current = glassMesh
    }

    if (buttonMesh) buttonRef.current = buttonMesh

    if (isReflective && reflectorNode) {
      clonedScene.traverse((child) => {
        if (child.isMesh && child.name !== 'HoloOpacity') {
          const material = new MeshStandardNodeMaterial({
            color: '#004d1a',
            metalness: 0.5, // El reflector maneja la intensidad
            roughness: 0,
            envMapIntensity: 0, // Priorizar reflexión real

          })
          material.colorNode = reflectorNode
          child.material = material

          // Guardar referencia para sincronizar en useFrame
          artifactPartsRef.current.reflectorMesh = child
        }
      })
    }

    return clonedScene
  }, [model, reflectorNode, collisionMeshMap])

  // Configuración de la animación (Scrubbing)
  useEffect(() => {
    if (consoleGlassRef.current) {
      const initialX = consoleGlassRef.current.rotation.x
      const initialPos = consoleGlassRef.current.position.clone()

      tlRef.current = gsap.timeline({ paused: true })

      // PARTE 1: WP1 a WP2 (0.0 a 1.0)
      // Agregamos un retraso inicial para que la animación ocurra más cerca del W2
      tlRef.current
        .to({}, { duration: 1.5 }) // Delay de 1.5s (el 50% del recorrido al W2)
        .to(consoleGlassRef.current.rotation, { x: initialX - 0.25, duration: 0.5, ease: 'none' })
        .to(consoleGlassRef.current.position, { y: initialPos.y + 0.2, z: initialPos.z + 0, duration: 0.5, ease: 'none' }, '<')
        .to(consoleGlassRef.current.rotation, { x: initialX - 1.5, duration: 0.5, ease: 'none' })
        .to(consoleGlassRef.current.position, { y: initialPos.y + 0.2, z: initialPos.z - 0.30, duration: 0.5, ease: 'none' }, '<')
        .to(consoleGlassRef.current.rotation, { x: initialX - 1.3, duration: 0.5, ease: 'none' })
        .to(consoleGlassRef.current.position, { y: initialPos.y + 0.25, z: initialPos.z - 0.30, duration: 0.5, ease: 'none' }, '<')

      // PARTE 2: WP2 a WP3 (1.0 a 2.0) - Animaciones de Domes
      const startTime = 3 // El final de la parte 1

      // TopDomeGrabbers
      domeRefs.current.top.forEach((mesh, i) => {
        const initX = mesh.rotation.x
        const initPos = mesh.position.clone()
        tlRef.current.to(mesh.rotation, { x: initX - 1.2, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.2)
        tlRef.current.to(mesh.position, { y: initPos.y + 0.1, z: initPos.z - 3, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.2)

        tlRef.current.to(mesh.rotation, { x: initX - 1.8, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.2)
        tlRef.current.to(mesh.position, { y: initPos.y + 0.3, z: initPos.z - 2.3, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.2)

        tlRef.current.to(mesh.rotation, { x: initX - 1, duration: 1, ease: 'power2.inOut' }, startTime + 2 + i * 0.2)
        tlRef.current.to(mesh.position, { y: initPos.y - 1.5, z: initPos.z - 2, duration: 1, ease: 'power2.inOut' }, startTime + 2 + i * 0.2)
      })

      // RightDomes
      domeRefs.current.right.forEach((mesh, i) => {
        const initY = mesh.rotation.y
        const initPos = mesh.position.clone()
        tlRef.current.to(mesh.rotation, { y: initY - 0.5, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x + 0.2, z: initPos.z - 0.1, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.1)

        tlRef.current.to(mesh.rotation, { y: initY - 1.6, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x - 1, z: initPos.z - 1.8, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.1)

        tlRef.current.to(mesh.rotation, { y: initY - 1.2, duration: 1, ease: 'power2.inOut' }, startTime + 2 + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x - 1.2, z: initPos.z - 1.5, duration: 0.5, ease: 'power2.inOut' }, startTime + 2 + i * 0.1)
      })

      // LeftDomes
      domeRefs.current.left.forEach((mesh, i) => {
        const initY = mesh.rotation.y
        const initPos = mesh.position.clone()
        tlRef.current.to(mesh.rotation, { y: initY + 0.5, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x - 0.2, z: initPos.z - 0.1, duration: 1, ease: 'power2.inOut' }, startTime + i * 0.1)

        tlRef.current.to(mesh.rotation, { y: initY + 1.6, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x + 1, z: initPos.z - 2, duration: 1, ease: 'power2.inOut' }, startTime + 1 + i * 0.1)

        tlRef.current.to(mesh.rotation, { y: initY + 1.6, duration: 1, ease: 'power2.inOut' }, startTime + 2 + i * 0.1)
        tlRef.current.to(mesh.position, { x: initPos.x + 1.2, z: initPos.z - 2, duration: 0.5, ease: 'power2.inOut' }, startTime + 2 + i * 0.1)
      })

      return () => tlRef.current.kill()
    }
  }, [scene])

  // Animar la transición de grid del ambiente
  useEffect(() => {
    if (gridUniformsRef.current.length > 0) {
      const target = isExploded ? 1 : 0
      gsap.to(gridUniformsRef.current, {
        value: target,
        duration: 2.5,
        ease: 'power3.inOut',
        stagger: {
          amount: 1.0,
          from: 'center'
        }
      })
    }
  }, [isExploded])

  // Animar el efecto de transmisión del Flask
  useEffect(() => {
    if (transmissionUniformRef.current) {
      const target = isExploded ? 1 : 0
      gsap.to(transmissionUniformRef.current, {
        value: target,
        duration: 1.5,
        ease: 'power2.inOut'
      })
    }
  }, [isExploded])

  // Configuración de la animación del Botón (Clickable)
  useEffect(() => {
    if (buttonRef.current) {
      const initialY = buttonRef.current.position.y
      const initialXRot = buttonRef.current.rotation.x

      tlButtonRef.current = gsap.timeline({ paused: true })

      tlButtonRef.current
        .to(buttonRef.current.position, { y: initialY - 0.05, duration: 0.1, ease: 'power2.out' })
        .to(buttonRef.current.rotation, { x: initialXRot + 0.1, duration: 0.1, ease: 'power2.out' }, '<')
        .to(buttonRef.current.position, { y: initialY + 0.02, duration: 0.2, ease: 'elastic.out(1, 0.3)' })
        .to(buttonRef.current.rotation, { x: initialXRot, duration: 0.2, ease: 'elastic.out(1, 0.3)' }, '<')
        .to(buttonRef.current.position, { y: initialY, duration: 0.1 })

      return () => tlButtonRef.current.kill()
    }
  }, [scene])

  // Vincular el progreso de la animación al scroll (Scrubbing) y animaciones de loop
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()

    if (tlRef.current && scrollRef?.current !== undefined) {
      // Mapeamos el scroll de 0.0 a 2.0 al progreso de la animación (que dura 6s en total)
      const progress = THREE.MathUtils.clamp(scrollRef.current, 0, 2)
      tlRef.current.progress(progress / 2)

      // Actualizar visibilidad del botón de forma reactiva
      const near = Math.abs(scrollRef.current - 1) < 0.2
      if (near !== isNear) setIsNear(near)
    }

    // --- LÓGICA DE DESEMSAMBLE (EXPLOSIÓN) ---
    const targetExplosion = isExploded ? 1 : 0
    explosionProgress.current = THREE.MathUtils.lerp(explosionProgress.current, targetExplosion, 0.05)
    const ep = explosionProgress.current

    // Animaciones del Artefacto (Loop)
    const parts = artifactPartsRef.current
    const initPos = initialPositionsRef.current

    // Helper para el efecto Rewind / Slow Motion por proximidad del cursor
    const getBrakeFactor = (mesh) => {
      if (!mesh || !hitPoint.value) return 1.0;
      // Solo activamos el Rewind/Brake si estamos cerca del WP 4 (THEawakening / scroll = 3.0)
      if (scrollRef?.current !== undefined && Math.abs(scrollRef.current - 3.0) > 0.8) return 1.0;
      mesh.getWorldPosition(_tempWorldPos);
      const dist = _tempWorldPos.distanceTo(hitPoint.value);
      // factor va de 0.0 a 1.0 (siendo 0.0 muy cerca)
      // Ajustamos el divisor a 3.0 ya que las hitboxes tienen radio 1.5
      const factor = THREE.MathUtils.clamp(dist / 3.0, 0, 1.0);
      return THREE.MathUtils.lerp(1.0, factor, hitIntensity.value);
    };

    // Helper para actualizar el tiempo local con soporte para Rewind simbólico (rápido)
    const updateLocalTime = (mesh, brake, delta, speedFactor = 1.0) => {
      if (mesh.userData.localTime === undefined) mesh.userData.localTime = 0;

      const isHovered = brake < 0.5;

      if (isHovered) {
        // Rebobinado rápido hacia 0 (dura aprox 1s gracias al lerp de 0.1 a 60fps)
        mesh.userData.localTime = THREE.MathUtils.lerp(mesh.userData.localTime, 0, 0.1);
      } else {
        // Avance normal (o retroceso a doble velocidad si la anomalía temporal está activa)
        // Multiplicamos por 1 - ep para detener la rotación al desensamblar
        const loopFactor = THREE.MathUtils.clamp(1.0 - ep * 1.5, 0, 1)
        const directionMultiplier = isTimeAnomalyActive ? -2.0 : 1.0
        mesh.userData.localTime += delta * speedFactor * loopFactor * directionMultiplier;
      }

      return mesh.userData.localTime;
    };

    // --- LÓGICA DE DETALLE (ZOOM) PARA CUALQUIER PIEZA ---
    for (const k in dpRef.current) {
      const isThisDetailed = detailedPart === k || (detailedPart === 'flask' && k === 'dna')
      const target = isThisDetailed ? 1 : 0
      dpRef.current[k] = THREE.MathUtils.lerp(dpRef.current[k], target, 0.05)
    }

    // Helper para aplicar posición y rotación con lerp de explosión
    const applyTransform = (key, loopPos, loopRot = new THREE.Euler(), brake = 1.0) => {
      const mesh = parts[key]
      if (!mesh) return

      // Aplicar brakePos si existe y el brake factor es < 1 (hover activo)
      const config = artifactConfig[key]
      if (config?.brakePos && brake < 0.99) {
        const brakeFactor = 1.0 - brake
        _tempBrakeVec.set(config.brakePos[0], config.brakePos[1], config.brakePos[2])
        loopPos.add(_tempBrakeVec.multiplyScalar(brakeFactor))
      }

      // Posición explotada dinámica
      let configPos = artifactConfig[key]?.explodedPos || [0, 0, 0]
      _tempTargetPos.set(configPos[0], configPos[1], configPos[2])
      const dp = dpRef.current[key] || 0

      if (dp > 0.001) {
        // Interpolar hacia el frente si esta pieza es la detallada (usando posición configurada)
        const frontPos = artifactConfig[key]?.inspectPos || [-0.6, 5, 5]
        _tempFrontVec.set(frontPos[0], frontPos[1], frontPos[2])
        _tempTargetPos.lerp(_tempFrontVec, dp)

        // Interacción especial: Separar Flask y DNA si estamos en inspección
        if (detailedPart === 'flask' && (key === 'flask' || key === 'dna')) {
          const sepAmount = 0.3 * subExplodeProgress.current
          if (key === 'flask') _tempTargetPos.x += sepAmount
          if (key === 'dna') _tempTargetPos.x -= sepAmount
        }
      }

      // Efecto de flotación y rotación sutil en Exploded View
      if (ep > 0.1) {
        // Sincronizar flask y dna con la misma semilla para el movimiento
        const config = artifactConfig[key]
        let amp = config?.floatAmp || 0.1
        let speed = config?.floatSpeed || 0.5

        // DNA hereda parámetros de Flask para estar "emparentado"
        if (key === 'dna' && artifactConfig.flask) {
          amp = artifactConfig.flask.floatAmp
          speed = artifactConfig.flask.floatSpeed
        }

        const syncSeed = (key === 'flask' || key === 'dna') ? 999 : mesh.id
        const floatY = Math.sin(t * speed + syncSeed) * amp * ep
        const rotSutil = Math.sin(t * 0.3 + syncSeed) * 0.05 * ep

        _tempTargetPos.y += floatY

        // Rotación de inspección con el mouse (para cualquier pieza detallada)
        let finalTargetRotX = rotSutil
        let finalTargetRotY = rotSutil
        let finalTargetRotZ = rotSutil

        if (dp > 0.001) {
          // Rotación multi-eje más responsiva y natural
          finalTargetRotX = rotSutil + (state.pointer.y * -0.8 * dp)
          finalTargetRotY = rotSutil + (state.pointer.x * 0.8 * dp)
          // Agregamos una sutil inclinación en Z basada en la posición diagonal para más profundidad
          finalTargetRotZ = rotSutil + (state.pointer.x * state.pointer.y * 0.3 * dp)
        }

        // Mezclamos la rotación de la animación (loopRot) con la rotación limpia de la vista explotada
        // Usamos ep para una transición perfecta y determinista durante el desensamblaje
        mesh.rotation.x = THREE.MathUtils.lerp(loopRot.x, finalTargetRotX, ep)
        mesh.rotation.y = THREE.MathUtils.lerp(loopRot.y, finalTargetRotY, ep)
        mesh.rotation.z = THREE.MathUtils.lerp(loopRot.z, finalTargetRotZ, ep)
      } else {
        // Si no estamos en fase de explosión, seguimos la rotación de loop original
        mesh.rotation.copy(loopRot)
      }

      // Interpolar posición final entre loop y target (que ya incluye el zoom si dp > 0)
      mesh.position.lerpVectors(loopPos, _tempTargetPos, ep)
    }

    // Actualizar rotaciones de loop SOLO si no está explotado (o estamos volviendo)
    const loopFactor = 1.0 - ep

    if (parts.circleOuter && initPos.circleOuter) {
      const brake = getBrakeFactor(parts.circleOuter)
      const localT = updateLocalTime(parts.circleOuter, brake, delta)

      parts.circleOuter.rotation.x = localT * artifactConfig.circleOuter.speed * artifactConfig.circleOuter.rotDir[0]
      parts.circleOuter.rotation.y = localT * artifactConfig.circleOuter.speed * artifactConfig.circleOuter.rotDir[1]
      parts.circleOuter.rotation.z = localT * artifactConfig.circleOuter.speed * artifactConfig.circleOuter.rotDir[2]

      const lPos = initPos.circleOuter.clone().add(new THREE.Vector3(...artifactConfig.circleOuter.pos))
      applyTransform('circleOuter', lPos, parts.circleOuter.rotation, brake)
    }

    if (parts.triangle && initPos.triangle) {
      const brake = getBrakeFactor(parts.triangle)
      const localT = updateLocalTime(parts.triangle, brake, delta)

      parts.triangle.rotation.x = localT * artifactConfig.triangle.speed * artifactConfig.triangle.rotDir[0]
      parts.triangle.rotation.y = localT * artifactConfig.triangle.speed * artifactConfig.triangle.rotDir[1]
      parts.triangle.rotation.z = localT * artifactConfig.triangle.speed * artifactConfig.triangle.rotDir[2]

      const lPos = initPos.triangle.clone().add(new THREE.Vector3(...artifactConfig.triangle.pos))
      applyTransform('triangle', lPos, parts.triangle.rotation, brake)
    }

    if (parts.circleInner && initPos.circleInner) {
      const brake = getBrakeFactor(parts.circleInner)
      const localT = updateLocalTime(parts.circleInner, brake, delta)
      parts.circleInner.rotation.z = localT * artifactConfig.circleInner.speed

      const lPos = initPos.circleInner.clone().add(new THREE.Vector3(...artifactConfig.circleInner.pos))
      applyTransform('circleInner', lPos, parts.circleInner.rotation, brake)
    }

    if (parts.circleInnerCircle && initPos.circleInnerCircle) {
      const brake = getBrakeFactor(parts.circleInnerCircle)
      const localT = updateLocalTime(parts.circleInnerCircle, brake, delta)

      parts.circleInnerCircle.rotation.x = localT * artifactConfig.circleInnerCircle.speed * artifactConfig.circleInnerCircle.rotDir[0]
      parts.circleInnerCircle.rotation.y = localT * artifactConfig.circleInnerCircle.speed * artifactConfig.circleInnerCircle.rotDir[1]
      parts.circleInnerCircle.rotation.z = localT * artifactConfig.circleInnerCircle.speed * artifactConfig.circleInnerCircle.rotDir[2]

      const lPos = initPos.circleInnerCircle.clone().add(new THREE.Vector3(...artifactConfig.circleInnerCircle.pos))
      applyTransform('circleInnerCircle', lPos, parts.circleInnerCircle.rotation, brake)
    }

    if (parts.square && initPos.square) {
      const brake = getBrakeFactor(parts.square)
      const localT = updateLocalTime(parts.square, brake, delta)

      parts.square.rotation.x = localT * artifactConfig.square.speed * artifactConfig.square.rotDir[0]
      parts.square.rotation.y = localT * artifactConfig.square.speed * artifactConfig.square.rotDir[1]
      parts.square.rotation.z = localT * artifactConfig.square.speed * artifactConfig.square.rotDir[2]

      const lPos = initPos.square.clone().add(new THREE.Vector3(...artifactConfig.square.pos))
      applyTransform('square', lPos, parts.square.rotation, brake)
    }

    if (parts.flask && initPos.flask) {
      const brake = getBrakeFactor(parts.flask)
      const localT = updateLocalTime(parts.flask, brake, delta)

      const floatY = Math.sin(localT * artifactConfig.flask.floatSpeed) * artifactConfig.flask.floatAmp
      const rotZ = Math.sin(localT * 0.5) * 0.1

      const lPos = initPos.flask.clone().setY(initPos.flask.y + floatY).add(new THREE.Vector3(...artifactConfig.flask.pos))
      const lRot = new THREE.Euler(0, 0, rotZ)
      applyTransform('flask', lPos, lRot, brake)

      if (parts.dna && initPos.dna) {
        const brakeDna = getBrakeFactor(parts.dna)
        const lPosDna = initPos.dna.clone().setY(initPos.dna.y + floatY).add(new THREE.Vector3(...artifactConfig.dna.pos))
        applyTransform('dna', lPosDna, lRot, brakeDna)
      }
    }

    // Sincronizar Reflector cada frame
    if (isReflective && reflectorNode && parts.reflectorMesh) {
      parts.reflectorMesh.getWorldPosition(reflectorNode.target.position)
      parts.reflectorMesh.getWorldQuaternion(reflectorNode.target.quaternion)
      reflectorNode.target.rotateX(-Math.PI / 2)
    }

    // Animación HoloOpacity (Sin soporte para Rewind, avance constante)
    if (parts.holoOpacity) {
      holoTimeUniform.current.value = t

      if (scrollRef?.current !== undefined) {
        const holoScale = THREE.MathUtils.clamp(0.4 - Math.abs(scrollRef.current - 1.0), 0, 1)
        parts.holoOpacity.scale.setScalar(holoScale)
        parts.holoOpacity.visible = holoScale > 0.001
      }
    }

    // Animación de visibilidad para ClickUnconstruct (WP 4 / scroll = 3.0)
    if (clickUnconstructRef.current && scrollRef?.current !== undefined) {
      const distToWP4 = Math.abs(scrollRef.current - 3.0)
      const targetOpacity = THREE.MathUtils.clamp(1.0 - distToWP4 * 2.5, 0, 1)

      if (clickUnconstructRef.current.material) {
        if (SHOW_HITBOXES) {
          clickUnconstructRef.current.visible = true
          clickUnconstructRef.current.material.opacity = 0.8
        } else {
          clickUnconstructRef.current.material.opacity = THREE.MathUtils.lerp(
            clickUnconstructRef.current.material.opacity,
            targetOpacity,
            0.1
          )
          clickUnconstructRef.current.visible = clickUnconstructRef.current.material.opacity > 0.01
        }
      }
    }

    // Actualizar progreso de sub-explosión (Flask/DNA)
    subExplodeProgress.current = THREE.MathUtils.lerp(subExplodeProgress.current, isFlaskSubExploded ? 1 : 0, 0.1)

    // Animación y físicas del DrunkOrb (Solo en WP4)
    if (drunkOrbRef.current && scrollRef?.current !== undefined) {
      // 1. Visibilidad controlada por proximidad a WP 4 (scroll = 3.0)
      const distToWP4 = Math.abs(scrollRef.current - 3.0)
      const opacityTarget = THREE.MathUtils.clamp(1.0 - distToWP4 * 2.5, 0, 1)

      drunkOrbRef.current.material.opacity = opacityTarget
      drunkOrbRef.current.visible = opacityTarget > 0.01

      const orbDrag = drunkOrbDragRef.current
      const orbitSpeed = 0.8
      const orbitRadius = 0.8

      // La órbita base en estado de reposo (oculta tras la escena, girando)
      const orbitX = Math.cos(t * orbitSpeed) * orbitRadius
      const orbitZ = Math.sin(t * orbitSpeed * 1.5) * 0.5 + 1.2
      const orbitY = Math.sin(t * orbitSpeed * 1.5) * 0.5 + 0

      if (orbDrag.isDragging) {
        // Multiplicador más agresivo para seguir el cursor
        const deltaX = (state.pointer.x - orbDrag.grabPointer.x) * 12.0
        const deltaY = (state.pointer.y - orbDrag.grabPointer.y) * 8.0

        orbDrag.dragOffset.x = THREE.MathUtils.lerp(orbDrag.dragOffset.x, deltaX, 0.2)
        orbDrag.dragOffset.y = THREE.MathUtils.lerp(orbDrag.dragOffset.y, deltaY, 0.2)
      } else {
        const tension = 0.08
        const friction = 0.82

        orbDrag.dragVelocity.x += (0 - orbDrag.dragOffset.x) * tension
        orbDrag.dragVelocity.y += (0 - orbDrag.dragOffset.y) * tension

        orbDrag.dragVelocity.multiplyScalar(friction)
        orbDrag.dragOffset.add(orbDrag.dragVelocity)

        // Cuando sueltas y se calma, lanzar redirección
        if (orbDrag.wasDragged && Math.abs(orbDrag.dragVelocity.x) < 0.01 && Math.abs(orbDrag.dragOffset.x) < 0.01) {
          orbDrag.wasDragged = false

          let overlay = document.getElementById('drunk-gpting-overlay')
          if (!overlay) {
            overlay = document.createElement('div')
            overlay.id = 'drunk-gpting-overlay'
            overlay.style.position = 'fixed'
            overlay.style.top = '0'
            overlay.style.left = '0'
            overlay.style.width = '100vw'
            overlay.style.height = '100vh'
            overlay.style.backgroundColor = '#000'
            overlay.style.zIndex = '999999999'
            overlay.style.opacity = '0'
            overlay.style.pointerEvents = 'auto'
            overlay.style.transition = 'opacity 0.8s ease'
            overlay.style.backdropFilter = 'blur(10px)'
            overlay.style.display = 'flex'
            overlay.style.alignItems = 'center'
            overlay.style.justifyContent = 'center'
            
            const btn = document.createElement('button')
            btn.id = 'drunk-gpting-btn'
            btn.innerText = 'BACK TO ALQUIMIA'
            btn.style.padding = '15px 40px'
            btn.style.background = 'transparent'
            btn.style.border = '1px solid #00ffff'
            btn.style.color = '#00ffff'
            btn.style.fontFamily = 'monospace'
            btn.style.fontSize = '14px'
            btn.style.letterSpacing = '4px'
            btn.style.cursor = 'pointer'
            btn.style.opacity = '0'
            btn.style.transition = 'all 0.3s'
            btn.onmouseenter = () => { btn.style.background = 'rgba(0, 255, 255, 0.1)'; btn.style.transform = 'scale(1.05)' }
            btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.transform = 'scale(1)' }
            
            btn.onclick = () => {
              overlay.style.opacity = '0'
              btn.style.opacity = '0'
              setTimeout(() => overlay.remove(), 800)
              
              useAlquimiaStore.getState().setIsTimeAnomalyActive(false)
              useAlquimiaStore.getState().setIsAnimatingCinematic(false)
              useAlquimiaStore.getState().navigateToWaypoint(3)
            }
            
            overlay.appendChild(btn)
            document.body.appendChild(overlay)
          }

          setTimeout(() => {
            if (overlay) overlay.style.opacity = '1'
            const btn = document.getElementById('drunk-gpting-btn')
            if (btn) btn.style.opacity = '1'
          }, 50)

          setTimeout(() => {
            window.open('https://hotelherrera.com/drunk-gpting/', '_blank')
          }, 800)
        }
      }

      // Sumamos el offset a la posición orbital base
      const targetPos = new THREE.Vector3(
        orbitX + orbDrag.dragOffset.x,
        orbitY + orbDrag.dragOffset.y,
        orbitZ
      )
      drunkOrbRef.current.position.copy(targetPos)

      // Actualizar estela de partículas
      if (trailMeshRef.current && trailPositions.current) {
        trailPositions.current.pop()
        trailPositions.current.unshift(targetPos.clone())

        for (let i = 0; i < DRUNK_ORB_CONFIG.particleCount; i++) {
          const pos = trailPositions.current[i]
          _dummyOrb.position.copy(pos)
          const scale = Math.max(0, 1 - i / DRUNK_ORB_CONFIG.particleCount)
          _dummyOrb.scale.setScalar(scale)
          _dummyOrb.updateMatrix()
          trailMeshRef.current.setMatrixAt(i, _dummyOrb.matrix)
        }
        trailMeshRef.current.instanceMatrix.needsUpdate = true
        trailMeshRef.current.material.opacity = opacityTarget * 0.6 // Opacidad base atenuada para la estela
        trailMeshRef.current.visible = opacityTarget > 0.01
      }
    }
  })

  // El evento secreto ahora se maneja centralizado en el componente Experience

  const handlePointerDown = (e) => {
    // Debug: ver qué estamos tocando y en qué scroll estamos
    console.log('Clicked object:', e.object.name, '| Material:', e.object.material?.name, '| Scroll:', scrollRef.current)

    // Check si el objeto es el centro (Flask) o el mesh ClickUnconstruct para activar el desensamble
    const isFlask = e.object.name === 'AlquimiaFlask' || e.object.parent?.name === 'AlquimiaFlask'
    const isUnconstruct = e.object.name === 'ClickUnconstruct' || e.object.parent?.name === 'ClickUnconstruct'

    if ((isFlask || isUnconstruct) && scrollRef.current > 1.5 && !isExploded) {
      e.stopPropagation()
      setIsExploded(true)
      return
    }

    // Check si el objeto, su padre o su material es el botón
    const isButton =
      e.object.name.includes('Button') ||
      e.object.parent?.name.includes('Button') ||
      (e.object.material && e.object.material.name.includes('Button'))

    // Normalizar el nombre quitando el sufijo _Hitbox si existe para buscar en el mapping unificado
    const cleanName = e.object.name.replace('_Hitbox', '')
    const cleanParentName = e.object.parent?.name.replace('_Hitbox', '') || ''
    const clickedKey = MESH_NAME_TO_KEY[cleanName] || MESH_NAME_TO_KEY[cleanParentName]

    if (isExploded && clickedKey) {
      // Si ya estamos inspeccionando el flask y volvemos a clickearlo, activamos la separación
      if (detailedPart === 'flask' && (clickedKey === 'flask' || clickedKey === 'dna')) {
        e.stopPropagation()
        setIsFlaskSubExploded(prev => !prev)
        return
      }

      if (detailedPart) return // Bloqueo: si ya estamos inspeccionando algo más, ignorar
      e.stopPropagation()
      setDetailedPart(clickedKey)
      console.log('Detailed part toggle:', clickedKey)
      return
    }

    if (isNear && isButton) {
      e.stopPropagation()
      tlButtonRef.current.play(0)

      // Misma lógica que el botón HUD "Activate"
      setIsAnimatingCinematic(true)
      setScrollPhase('artifact')

      // No podemos llamar setIsArtifactActive aquí (está en Experience),
      // pero el scroll ya funcionará correctamente
      if (props.onActivateArtifact) props.onActivateArtifact()

      if (props.targetScrollRef) {
        gsap.to(props.targetScrollRef, {
          current: 2.0,
          duration: 5,
          ease: 'power2.inOut',
          onUpdate: () => setTargetScrollStore(props.targetScrollRef.current),
          onComplete: () => {
            setIsAnimatingCinematic(false)
          }
        })
      }
      console.log('Botón activado!')
    }
  }

  // --- EVENTOS NATIVOS R3F ---
  const handlePointerMove = (e) => {
    // El evento de R3F (e) contiene un array con TODOS los objetos que atraviesa el rayo.
    // Buscamos el primero que no sea el cristal transparente para ignorarlo.
    const validHit = e.intersections.find(hit => hit.object.name !== 'ConsoleGlass')

    if (validHit) {
      e.stopPropagation()

      const obj = validHit.object
      const cleanName = obj.name.replace('_Hitbox', '')
      const cleanParentName = obj.parent?.name.replace('_Hitbox', '') || ''
      const partKey = MESH_NAME_TO_KEY[cleanName] || MESH_NAME_TO_KEY[cleanParentName]

      // Prevent HexReveal on flask and dna during their specific inspection mode
      const preventHexReveal = detailedPart === 'flask' && partKey === 'flask'

      if (!preventHexReveal) {
        updateTSLHit(validHit.point, true)
      } else {
        updateTSLHit(new THREE.Vector3(), false)
      }

      // Detección de piezas para títulos y cursor en Exploded View
      if (isExploded) {
        if (partKey && !detailedPart) {
          setHoveredPart(partKey)
          document.body.style.cursor = 'pointer'
        } else {
          setHoveredPart(null)
          // No volvemos a 'auto' aquí para no sobreescribir botones
        }
      }

      // Detección de botones para el cursor
      const isButton =
        validHit.object.name.includes('Button') ||
        validHit.object.parent?.name.includes('Button') ||
        (validHit.object.material && validHit.object.material.name.includes('Button'))

      const isUnconstruct =
        validHit.object.name === 'ClickUnconstruct' ||
        validHit.object.parent?.name === 'ClickUnconstruct'

      if ((isButton && isNear) || (isUnconstruct && clickUnconstructRef.current?.visible)) {
        document.body.style.cursor = 'pointer'
      } else if (!isExploded || (isExploded && !hoveredPart)) {
        // Solo resetear si no estamos sobre una pieza en modo explotado
        // document.body.style.cursor = 'auto'
      }
    } else {
      setHoveredPart(null)
      document.body.style.cursor = 'auto'
    }
  }

  const handlePointerOut = () => {
    document.body.style.cursor = 'auto'
    updateTSLHit(new THREE.Vector3(), false)
  }

  return (
    <>
      <group visible={isTabActive}>
        <primitive
          object={scene}
          {...props}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerOver={(e) => {
            // Ya manejado en handlePointerMove para mayor fiabilidad
          }}
          onPointerOut={(e) => {
            handlePointerOut()
            if (typeof setHoveredPart === 'function') setHoveredPart(null)
          }}
        />

        {isReflective && reflectorNode && (
          <primitive object={reflectorNode.target} />
        )}

        {/* DrunkOrb interactivo */}
        {isMainArtifact && (
          <mesh
            ref={drunkOrbRef}
            onPointerDown={(e) => {
              e.stopPropagation()
              try { e.target.setPointerCapture(e.pointerId) } catch (err) { }
              drunkOrbDragRef.current.isDragging = true
              drunkOrbDragRef.current.wasDragged = false
              drunkOrbDragRef.current.grabPointer.copy(pointer)
              document.body.style.cursor = 'grabbing'
            }}
            onPointerUp={(e) => {
              if (drunkOrbDragRef.current.isDragging) {
                drunkOrbDragRef.current.isDragging = false
                drunkOrbDragRef.current.wasDragged = true
                try { e.target.releasePointerCapture(e.pointerId) } catch (err) { }
                document.body.style.cursor = 'auto'
              }
            }}
            onPointerOver={() => { if (!drunkOrbDragRef.current.isDragging) document.body.style.cursor = 'grab' }}
            onPointerOut={() => { if (!drunkOrbDragRef.current.isDragging) document.body.style.cursor = 'auto' }}
          >
            <sphereGeometry args={[0.1, 32, 32]} />
            <meshStandardNodeMaterial
              colorNode={TSL.color(DRUNK_ORB_CONFIG.color)}
              emissiveNode={TSL.color(DRUNK_ORB_CONFIG.color).mul(DRUNK_ORB_CONFIG.emissiveIntensity)}
              transparent
              opacity={0.8}
            />
          </mesh>
        )}

        {/* Partículas TSL del DrunkOrb */}
        {isMainArtifact && (
          <instancedMesh ref={trailMeshRef} args={[null, null, DRUNK_ORB_CONFIG.particleCount]}>
            <sphereGeometry args={[DRUNK_ORB_CONFIG.particleSize, 16, 16]} />
            <meshStandardNodeMaterial
              colorNode={TSL.color(DRUNK_ORB_CONFIG.particleColor)}
              emissiveNode={TSL.color(DRUNK_ORB_CONFIG.particleColor).mul(DRUNK_ORB_CONFIG.emissiveIntensity * 0.05)}
              transparent
              depthWrite={false}
              opacity={0.2}
            />
          </instancedMesh>
        )}

        {/* Fuego emparentado al AlquimiaFlask - Triple llama (Ignición, Claridad, Transmutación) */}
        {artifactPartsRef.current.flask && createPortal(
          <group>
            {/* Llama Central - El Corazón */}
            <Fire
              texture={fireTexture}
              color={0xffcc33}
              magnitude={0.2}
              opacity={1.0}
              lacunarity={1.5}
              iterations={isMobile ? 10 : 20}
              intensity={isMobile ? 0.05 : 1.0}
              emmisiveIntensity={10.1}
              scale={[0.55, 1.95, 0.55]}
              position={[0, 1.8, 0.1]}
              speed={isMobile ? 8 : 25}
            />
            {/* Llama Central2 - El Corazón2 */}
            <Fire
              texture={fireTexture}
              color={0x00ffff}
              magnitude={0.1}
              opacity={1.0}
              lacunarity={1.5}
              iterations={isMobile ? 10 : 20}
              intensity={isMobile ? 0.05 : 1.0}
              emmisiveIntensity={10.1}
              scale={[0.48, 1.9, 0.48]}
              position={[0, 1.8, 0.1]}
              rotation={[0, 1.8, 0]}
              speed={isMobile ? 8 : 25}
            />
            {/* Llama Izquierda - La Chispa */}
            <Fire
              texture={fireTexture}
              color={0xffcc33}
              magnitude={0.1}
              opacity={0.7}
              lacunarity={1}
              iterations={isMobile ? 10 : 20}
              intensity={isMobile ? 0.03 : 0.6}
              emmisiveIntensity={8}
              scale={[0.3, 1, 0.3]}
              position={[-0.18, 1.5, 0]}
              rotation={[0, 0, 0.3]}
              speed={isMobile ? 10 : 35}
            />
            {/* Llama Derecha - El Aliento */}
            <Fire
              texture={fireTexture}
              color={0xffcc33}
              magnitude={0.18}
              opacity={0.7}
              lacunarity={1}
              iterations={isMobile ? 10 : 20}
              intensity={isMobile ? 0.03 : 0.6}
              emmisiveIntensity={8}
              scale={[0.3, 1, 0.3]}
              position={[0.18, 1.5, 0]}
              rotation={[0, 0, -0.3]}
              speed={isMobile ? 12 : 40}
            />
          </group>,
          artifactPartsRef.current.flask
        )}

        {/* Tooltip Sci-Fi para el Botón de Activación */}
        {isMainArtifact && buttonRef.current && isNear && !isArtifactActive && createPortal(
          <Html
            position={isMobile ? [0, 2.5, 0] : [0.2, 1.5, 0]}
            center
            distanceFactor={isMobile ? 2.5 : 1.5}
            pointerEvents="none"
          >
            <SciFiTooltip text={t.tooltips.press_activate} />
          </Html>,
          buttonRef.current
        )}

        {/* Tooltip Sci-Fi para el Deconstruct (WP 4) */}
        {isMainArtifact && clickUnconstructRef.current && clickUnconstructRef.current.visible && isNear && !isExploded && (scrollRef.current > 2.5) && createPortal(
          <Html
            position={isMobile ? [0, 1.5, 0] : [0, 0, 0]}
            center
            distanceFactor={isMobile ? 2.5 : 1.5}
            pointerEvents="none"
          >
            <SciFiTooltip text={t.tooltips.click_deconstruct} />
          </Html>,
          clickUnconstructRef.current
        )}

        {/* HUD de Títulos en Exploded View */}
        {isMainArtifact && isExploded && hoveredPart && !detailedPart && (
          <Html fullscreen style={{ pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              color: '#b4ff05ff',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '24px',
              letterSpacing: '10px',

              fontWeight: '300',
              textShadow: '0 0 20px rgba(255, 77, 77, 0.4)',
              transition: 'all 0.3s ease'
            }}>
              <span style={{
                width: '60px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, #ff4d4d)'
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {hoveredPart === 'circleOuter' && t.narrative.cosmos.title}
                {hoveredPart === 'triangle' && t.narrative.vision.title}
                {hoveredPart === 'circleInner' && t.narrative.veil_vessel.title}
                {hoveredPart === 'square' && t.narrative.structure.title}
                {hoveredPart === 'flask' && t.narrative.soul_code.title}
              </div>

              <span style={{
                width: '60px',
                height: '1px',
                background: 'linear-gradient(90deg, #ff4d4d, transparent)'
              }} />
            </div>
          </Html>
        )}

        {/* Overlay de Inspección - Pre-cargado cuando isExploded es true */}
        {isMainArtifact && isExploded && (
          <Html portal={document.body} fullscreen style={{
            zIndex: 9999,
            pointerEvents: isOverlayVisible ? 'all' : 'none',
            display: (detailedPart || isOverlayVisible) ? 'block' : 'none'
          }}>
            <div style={{
              position: 'fixed',
              top: '-54.1vh',
              left: '-49vw',
              width: '101vw',
              height: '100vh',
              backgroundColor: detailedPart === 'flask' ? 'transparent' : 'rgba(0, 0, 0, 0.4)',
              backdropFilter: detailedPart === 'flask' ? 'none' : 'blur(15px)',
              WebkitBackdropFilter: detailedPart === 'flask' ? 'none' : 'blur(15px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isOverlayVisible ? 1 : 0,
              transition: 'all 0.8s ease-in-out',
              pointerEvents: isOverlayVisible ? 'all' : 'none'
            }}>
              {/* Botón de Cierre (X) - Esquina Superior Derecha */}
              <button className='close-btn-inspect'
                onClick={() => {
                  setIsOverlayVisible(false)
                  setDetailedPart(null)
                }}
                style={{
                  position: 'absolute',
                  top: '5rem',
                  right: '5rem',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(0, 255, 255, 0.5)',
                  color: '#00ffff',
                  padding: '12px 18px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '20px',
                  borderRadius: '50%',
                  zIndex: 100000,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#00ffff'; e.target.style.color = '#000' }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(0,0,0,0.5)'; e.target.style.color = '#00ffff' }}
              >
                ✕
              </button>

              <div style={{
                width: '120%',
                height: '100%',
                position: 'absolute',
                top: '0%',
                left: '0%',
                zIndex: -1,
                background: detailedPart === 'flask' ? 'none' : 'radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 100%)'
              }} />

              {/* Contenedor del Canvas de la Singularidad - SOLO PARA CIRCLEOUTER */}
              {detailedPart === 'circleOuter' && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <Suspense fallback={null}>
                    <SingularityCanvas isVisible={isOverlayVisible} isMobile={isMobile} />
                  </Suspense>
                </div>
              )}

              {/* Contenedor del Canvas del Loto - SOLO PARA TRIANGLE */}
              {detailedPart === 'triangle' && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <Suspense fallback={null}>
                    <LotusCanvas isVisible={isOverlayVisible} isMobile={isMobile} />
                  </Suspense>
                </div>
              )}

              {/* Contenedor del Canvas de la Soul - SOLO PARA CIRCLEINNER */}
              {detailedPart === 'circleInner' && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <Suspense fallback={null}>
                    <SoulCanvas isVisible={isOverlayVisible} isMobile={isMobile} />
                  </Suspense>
                </div>
              )}

              {/* Contenedor del Canvas de la Estructura - SOLO PARA SQUARE */}
              {detailedPart === 'square' && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <Suspense fallback={null}>
                    <StructureCanvas isVisible={isOverlayVisible} isMobile={isMobile} />
                  </Suspense>
                </div>
              )}

              {/* ─── PANELES DE NARRATIVA ─── */}

              {/* MOBILE ONLY: Solapas (botones para desplegar panel derecho) */}
              {isMobile && isOverlayVisible && detailedPart && detailedPart !== 'flask' && expandedNarrativePanel !== detailedPart && (
                <button
                  onClick={() => setExpandedNarrativePanel(detailedPart)}
                  style={{
                    position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
                    padding: '28px 14px', background: 'rgba(10, 20, 25, 0.92)',
                    border: '1px solid rgba(0,255,255,0.7)', borderRight: 'none',
                    borderRadius: '10px 0 0 10px', cursor: 'pointer',
                    animation: 'smoothFlapGlow 2.5s infinite ease-in-out',
                    zIndex: 200010, color: '#00ffff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexDirection: 'column', gap: '8px',
                    writingMode: 'vertical-rl', letterSpacing: '3px', fontSize: '9px',
                    fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', pointerEvents: 'auto', whiteSpace: 'nowrap'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  {detailedPart === 'circleOuter' && t.narrative.cosmos.title}
                  {detailedPart === 'triangle' && t.narrative.vision.title}
                  {detailedPart === 'circleInner' && t.narrative.veil_vessel.title}
                  {detailedPart === 'square' && t.narrative.structure.title}
                </button>
              )}

              {/* MOBILE ONLY: Solapa flask derecha (soul_code) */}
              {isMobile && isOverlayVisible && detailedPart === 'flask' && expandedNarrativePanel !== 'flask-right' && (
                <button
                  onClick={() => setExpandedNarrativePanel('flask-right')}
                  style={{
                    position: 'fixed', right: '-54vw', top: '50%', transform: 'translateY(-50%)',
                    padding: '28px 14px', background: 'rgba(10, 20, 25, 0.92)',
                    border: '1px solid rgba(0,255,255,0.7)', borderRight: 'none',
                    borderRadius: '10px 0 0 10px', cursor: 'pointer',
                    animation: 'smoothFlapGlow 2.5s infinite ease-in-out',
                    zIndex: 200010, color: '#00ffff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexDirection: 'column', gap: '8px',
                    writingMode: 'vertical-rl', letterSpacing: '3px', fontSize: '9px',
                    fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', pointerEvents: 'auto', whiteSpace: 'nowrap'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  {t.narrative.soul_code.title}
                </button>
              )}

              {/* MOBILE ONLY: Solapa flask izquierda (catalyst/DNA) */}
              {isMobile && isOverlayVisible && detailedPart === 'flask' && expandedNarrativePanel !== 'flask-left' && (
                <button
                  onClick={() => setExpandedNarrativePanel('flask-left')}
                  style={{
                    position: 'fixed', left: '-50vw', top: '50%', transform: 'translateY(-50%)',
                    padding: '28px 14px', background: 'rgba(10, 20, 25, 0.92)',
                    border: '1px solid rgba(0,255,255,0.7)', borderLeft: 'none',
                    borderRadius: '0 10px 10px 0', cursor: 'pointer',
                    animation: 'smoothFlapGlow 2.5s infinite ease-in-out',
                    zIndex: 200010, color: '#00ffff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexDirection: 'column', gap: '8px',
                    writingMode: 'vertical-rl', letterSpacing: '3px', fontSize: '9px',
                    fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase', pointerEvents: 'auto', whiteSpace: 'nowrap'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                  {t.narrative.catalyst.title}
                </button>
              )}

              {/* Panel derecho (circleOuter / triangle / circleInner / square / flask-soul)
                  DESKTOP: siempre visible cuando isOverlayVisible && detailedPart
                  MOBILE : controlado por expandedNarrativePanel (solapa) */}
              {isOverlayVisible && detailedPart && (
                <div
                  className={isMobile
                    ? `narrativePanelRight ${(expandedNarrativePanel === detailedPart || (detailedPart === 'flask' && expandedNarrativePanel === 'flask-right')) ? 'narrativePanel--expanded' : ''} ${detailedPart === 'flask' && (expandedNarrativePanel === 'flask-right') ? 'narrativePanelRightSoul' : ''}`
                    : ''}
                  style={isMobile ? {
                    position: 'fixed', right: 0, top: '50%',
                    transform: 'translateY(-50%) translateX(100%)',
                    width: '82vw', maxHeight: '80vh', overflowY: 'auto',
                    color: '#00ffff', fontFamily: "'Outfit', sans-serif", textAlign: 'right',
                    zIndex: 200005, opacity: 0, pointerEvents: 'none',
                    backdropFilter: 'blur(12px)', background: 'rgba(8, 16, 20, 0.92)',
                    padding: '1.5rem 1.2rem', borderRadius: '12px 0 0 12px',
                    borderLeft: '2px solid rgba(0,255,255,0.8)',
                    transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1), opacity 0.35s ease',
                    boxShadow: '-8px 0 30px rgba(0,255,255,0.08)',
                    zIndex: '100000000000',
                  } : {
                    position: 'absolute', right: '5vw', top: '50%',
                    transform: 'translateY(-50%)', width: '350px',
                    color: '#00ffff', fontFamily: "'Outfit', sans-serif",
                    textAlign: 'right', zIndex: 100001, opacity: 0.8,
                    backdropFilter: 'blur(5px)', padding: '5px',
                    borderRadius: '10px', borderLeft: '2px solid #00ffff',
                  }}
                >
                  {/* Botón X — solo en mobile */}
                  {isMobile && (
                    <button
                      onClick={() => setExpandedNarrativePanel(null)}
                      style={{
                        position: 'absolute', top: '10px', left: '12px',
                        background: 'transparent', border: 'none', color: '#00ffff',
                        fontSize: '1rem', cursor: 'pointer', fontFamily: 'monospace',
                        pointerEvents: 'auto', opacity: 0.7, lineHeight: 1
                      }}
                    >✕</button>
                  )}

                  {detailedPart === 'circleOuter' && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.cosmos.title}</div>
                      <div style={{ fontSize: '18px', padding: '0.5rem', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)' }}>"{t.narrative.cosmos.text}"</div>
                    </>
                  )}
                  {detailedPart === 'triangle' && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.vision.title}</div>
                      <div style={{ fontSize: '18px', padding: '0.5rem', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)' }}>"{t.narrative.vision.text}"</div>
                    </>
                  )}
                  {detailedPart === 'circleInner' && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.veil_vessel.title}</div>
                      <div style={{ fontSize: '18px', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)' }} dangerouslySetInnerHTML={{ __html: `"${t.narrative.veil_vessel.text}"` }} />
                    </>
                  )}
                  {detailedPart === 'square' && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.structure.title}</div>
                      <div style={{ fontSize: '18px', padding: '0.5rem', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)' }}>"{t.narrative.structure.text}"</div>
                    </>
                  )}
                  {detailedPart === 'flask' && (
                    <>
                      <div style={{ fontSize: '10px', letterSpacing: '5px', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.soul_code.title}</div>
                      <div style={{ fontSize: '18px', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)' }}>"{t.narrative.soul_code.text}"</div>
                    </>
                  )}
                </div>
              )}

              {/* Panel izquierdo: flask-catalyst (DNA)
                  DESKTOP: siempre visible
                  MOBILE : controlado por expandedNarrativePanel (solapa izquierda) */}
              {isOverlayVisible && detailedPart === 'flask' && (
                <div
                  className={isMobile
                    ? `narrativePanelLeft dnaHelix ${expandedNarrativePanel === 'flask-left' ? 'narrativePanelLeft--expanded' : ''} ${expandedNarrativePanel === 'flask-left' ? 'narrativePanelLeftCatalyst' : ''}`
                    : 'dnaHelix'}
                  style={isMobile ? {
                    position: 'fixed', left: '-48vw', top: '50%',
                    transform: 'translateY(-50%) translateX(-100%)',
                    width: '82vw', maxHeight: '80vh', overflowY: 'auto',
                    color: '#7cbbbbff', fontFamily: "'Outfit', sans-serif", textAlign: 'left',
                    zIndex: 200005, opacity: 0, pointerEvents: 'none',
                    backdropFilter: 'blur(12px)', background: 'rgba(8, 16, 20, 0.92)',
                    padding: '1.5rem 1.2rem', borderRadius: '0 12px 12px 0',
                    borderRight: '2px solid rgba(0,255,255,0.8)',
                    transition: 'transform 0.45s cubic-bezier(0.23,1,0.32,1), opacity 0.35s ease',
                    boxShadow: '8px 0 30px rgba(0,255,255,0.08)'
                  } : {
                    position: 'absolute', left: '5vw', top: '50%',
                    transform: 'translateY(-50%)', width: '350px',
                    color: '#00ffff', fontFamily: "'Outfit', sans-serif",
                    textAlign: 'left', zIndex: 100001, opacity: 0.8,
                    backdropFilter: 'blur(5px)', padding: '5px',
                    borderRadius: '10px', borderRight: '2px solid #00ffff',
                    msScrollbarTrackColor: 'black',
                  }}
                >
                  {/* Botón X — solo en mobile */}
                  {isMobile && (
                    <button
                      onClick={() => setExpandedNarrativePanel(null)}
                      style={{
                        position: 'absolute', top: '10px', right: '12px',
                        background: 'transparent', border: 'none', color: '#00ffff',
                        fontSize: '1rem', cursor: 'pointer', fontFamily: 'monospace',
                        pointerEvents: 'auto', opacity: 0.7, lineHeight: 1
                      }}
                    >✕</button>
                  )}
                  <div style={{ fontSize: '10px', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.5 }}>{t.narrative.catalyst.title}</div>
                  <div className='theDNAText' style={{ fontSize: '18px', fontStyle: 'italic', lineHeight: '1.6', fontWeight: '300', textShadow: '0 0 10px rgba(0,255,255,0.3)', overflow: 'auto', maxHeight: '350px', maxWidth: '340px', padding: '5px' }}>
                    "{t.narrative.catalyst.text}"
                  </div>
                </div>
              )}

              {/* Tooltip de interacción para Inspección */}
              {isOverlayVisible && (detailedPart === 'circleOuter' || detailedPart === 'triangle' || detailedPart === 'circleInner' || detailedPart === 'square' || detailedPart === 'flask') && (
                <div className='tooltipMobile2' style={{
                  position: 'absolute',
                  top: '5.5rem',
                  zIndex: 100001,
                  color: '#00ffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '12px',
                  letterSpacing: '2px',

                  background: 'rgba(15, 95, 5, 0.5)',
                  padding: '8px 20px',
                  borderRadius: '5px',
                  borderLeft: '2px solid #00ffff',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  textShadow: '0 0 8px rgba(0, 255, 255, 0.8)',

                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(0, 255, 255, 0.5))' }}>
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                      <polyline points="21 3 21 8 16 8"></polyline>
                    </svg>
                    <span>
                      {detailedPart === 'flask'
                        ? t.inspect.move_beaker
                        : (detailedPart === 'circleOuter'
                          ? t.inspect.rotate_singularity
                          : (detailedPart === 'triangle' ? t.inspect.rotate_lotus : (detailedPart === 'circleInner' ? t.inspect.rotate_soul : t.inspect.hover_hypercube)))}
                    </span>
                  </div>
                </div>
              )}

              {/* Botón RETURN */}
              <button
                onClick={() => {
                  setIsOverlayVisible(false)
                  setDetailedPart(null)
                  setIsFlaskSubExploded(false)
                }}
                style={{
                  position: 'absolute',
                  bottom: '52px',
                  zIndex: 100000,
                  background: 'rgba(0, 0, 0, 1)',
                  border: '2px solid #00ffff',
                  color: '#00ffff',
                  padding: '20px 48px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  letterSpacing: '5px',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  borderRadius: '10rem',
                  transform: 'translateX(-2%)',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  opacity: isOverlayVisible ? 1 : 0
                }}
                onMouseEnter={(e) => { e.target.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.5)'; e.target.style.background = '#00ffff'; e.target.style.color = '#000' }}
                onMouseLeave={(e) => { e.target.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.2)'; e.target.style.background = 'rgba(0, 0, 0, 1)'; e.target.style.color = '#00ffff' }}
              >
                {t.inspect.return}
              </button>

              {/* Loader minimalista - Omitir para el flask */}
              {!isOverlayVisible && detailedPart && detailedPart !== 'flask' && (
                <div style={{
                  color: '#00ffff',
                  fontFamily: 'monospace',
                  letterSpacing: '8px',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  {detailedPart === 'circleOuter' ? t.inspect.init_singularity : (detailedPart === 'triangle' ? t.inspect.scanning : (detailedPart === 'circleInner' ? t.inspect.revealing_soul : (detailedPart === 'square' ? t.inspect.calibrating : t.inspect.stabilizing)))}
                </div>
              )}

              {detailedPart === 'circleInner' && (
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  color: 'rgba(0, 255, 255, 0.4)',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  fontSize: '10px'
                }}>
                  {t.inspect.soul_active}
                </div>
              )}

              {detailedPart === 'circleOuter' && (
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  color: 'rgba(0, 255, 255, 0.4)',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  fontSize: '10px'
                }}>
                  SINGULARITY CORE ACTIVE
                </div>
              )}
            </div>
          </Html>
        )}
      </group>
    </>
  )
}

const SingularityCanvas = ({ isVisible, isMobile }) => {
  const [ready, setReady] = useState(false)

  return (
    <Canvas
      dpr={isMobile ? 0.7 : 1}
      frameloop={(ready && isVisible) ? 'always' : 'never'}
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: '-2vh', left: '0vw', pointerEvents: 'auto', zIndex: 9999 }}
      gl={(props) => {
        const renderer = new WebGPURenderer({ ...props, forceWebGL: false, antialias: true, sampleCount: 4 })
        renderer.init().then(() => setReady(true))
        return renderer
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 2, 5.5]} fov={isMobile ? 70 : 45} />
      {ready && (
        <Suspense fallback={null}>
          <SimpleBloomEffect strength={0.2} radius={0.2} threshold={0.9} />
          <Singularity scale={[2, 2, 2]} isMobile={isMobile} />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        </Suspense>
      )}
    </Canvas>
  )
}

const LotusModel = ({ emissiveIntensity = 2.0 }) => {
  const { gl } = useThree()

  // Configuramos el cargador para soportar KTX2 (Basis) y DRACO
  const gltf = useLoader(GLTFLoader, '/assets/Lotus_pose.glb', (loader) => {
    // DRACO
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    loader.setDRACOLoader(dracoLoader)

    // KTX2
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  const scene = gltf.scene

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          // Clonamos el colorMap al emissiveMap para que el loto brille
          if (child.material.map) {
            child.material.emissiveMap = child.material.map
            child.material.emissive = new THREE.Color(0xffffff)
            child.material.emissiveIntensity = emissiveIntensity
          }
        }
      })
    }
  }, [scene, emissiveIntensity])

  return <primitive object={scene} scale={[1.5, 1.5, 1.5]} position={[0, -1, 0]} />
}

const LotusCanvas = ({ isVisible, isMobile }) => {
  const [ready, setReady] = useState(false)
  const fireTexture = useLoader(THREE.TextureLoader, '/assets/Fire3.webp')
  const fire2Texture = useLoader(THREE.TextureLoader, '/assets/Fire5.webp')
  return (
    <Canvas
      dpr={isMobile ? 0.7 : 1}
      frameloop={(ready && isVisible) ? 'always' : 'never'}
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, pointerEvents: 'auto', zIndex: 9999 }}
      gl={(props) => {
        // Volvemos a WebGPU nativo para que el Fire TSL funcione
        const renderer = new WebGPURenderer({ ...props, forceWebGL: false, antialias: true, sampleCount: 4 })
        renderer.init().then(() => setReady(true))
        return renderer
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={isMobile ? 70 : 45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 2]} intensity={10.5} />

      {ready && (
        <Suspense fallback={null}>
          <SimpleBloomEffect strength={0.5} radius={0.02} threshold={0.9} />
          <group position={[0, 0.95, 0]}>
            <LotusModel emissiveIntensity={10.5} />

            <Fire
              texture={fireTexture}
              color={0x00ff00ff} // Cian brillante con alfa
              magnitude={0.8}
              opacity={0.01}
              lacunarity={2.5}
              iterations={isMobile ? 6 : 10}
              intensity={isMobile ? 0.05 : 0.1}
              emmisiveIntensity={0.1}
              scale={[1.8, 3.0, 1.8]}
              position={[0, -0.4, 0]}
              speed={isMobile ? 8 : 13}
            />

          </group>
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        </Suspense>
      )}
    </Canvas>
  )
}

const SoulModel = () => {
  const { gl } = useThree()
  const [hovered, setHovered] = useState(false)

  const gltf = useLoader(GLTFLoader, '/assets/SoulCrystal_compressed.glb', (loader) => {
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  // Capa de Wireframe emparentada
  const wireframeScene = useMemo(() => {
    const clone = gltf.scene.clone()
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          wireframe: true,
          transparent: true,
          color: new THREE.Color(0x00ffff),
          emissive: new THREE.Color(0x00ffff),
          emissiveIntensity: 0,
          opacity: 0
        })
      }
    })
    return clone
  }, [gltf.scene])

  const pulseTimer = useRef(0)
  const isPulsing = useRef(false)

  useEffect(() => {
    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
            child.material.needsUpdate = true
            if (child.material.map && !child.material.emissiveMap) {
              child.material.emissiveMap = child.material.map
              child.material.emissive = new THREE.Color(0xffffff)
              child.material.emissiveIntensity = 0.2
            }
          }
        }
      })
    }
  }, [gltf.scene])

  useFrame((state, delta) => {
    if (isPulsing.current) {
      pulseTimer.current += delta
      if (pulseTimer.current > 1.5) {
        isPulsing.current = false
        pulseTimer.current = 0
      }
    }

    const p = pulseTimer.current

    if (gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child.isMesh && child.material) {
          let target = 0.2

          if (hovered) {
            // Estado de inspección activa: Emisión alta inmediata
            target = 5.5
          } else if (isPulsing.current) {
            // Estado de salida: bajando intensidad mientras ocurre el wireframe
            target = THREE.MathUtils.lerp(5.5, 0.2, p / 1.0)
          }

          child.material.emissiveIntensity = THREE.MathUtils.lerp(
            child.material.emissiveIntensity,
            target,
            0.15
          )
        }
      })
    }

    if (wireframeScene) {
      wireframeScene.traverse((child) => {
        if (child.isMesh && child.material) {
          let wIntensity = 0
          let wOpacity = 0

          // El barrido ocurre solo al salir (cuando isPulsing es true)
          if (isPulsing.current) {
            const sweepY = THREE.MathUtils.mapLinear(p, 0, 1.2, -1.0, 1.0)
            const meshY = child.position.y
            const dist = Math.abs(meshY - sweepY)
            const influence = Math.exp(-Math.pow(dist, 2) * 20.0)

            wIntensity = influence * 40.0
            wOpacity = influence * 1.0
          }

          child.material.emissiveIntensity = THREE.MathUtils.lerp(child.material.emissiveIntensity, wIntensity, 0.2)
          child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, wOpacity, 0.2)
        }
      })
    }
  })

  return (
    <group
      scale={[1, 1, 1]}
      position={[-0.1, -0.8, 0.05]}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
        // Al entrar, cancelamos cualquier pulso de salida y subimos emisión
        isPulsing.current = false
        pulseTimer.current = 0
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
        // Al salir, disparamos el efecto de barrido wireframe
        isPulsing.current = true
        pulseTimer.current = 0
      }}
    >
      <primitive object={gltf.scene} />
      <primitive object={wireframeScene} />
    </group>
  )
}

const TheVeilTheVesselModel = () => {
  const { gl } = useThree()
  const initialPositions = useRef({})

  const gltf = useLoader(GLTFLoader, '/assets/TheVeil_TheVessel.glb', (loader) => {
    const ktx2Loader = new KTX2Loader()
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/jsm/libs/basis/')
    ktx2Loader.detectSupport(gl)
    loader.setKTX2Loader(ktx2Loader)
  })

  useEffect(() => {
    if (gltf.scene) {
      const veil = gltf.scene.getObjectByName('TheVeil')
      if (veil && !initialPositions.current.TheVeil) {
        initialPositions.current.TheVeil = veil.position.clone()
      }
      const vessel = gltf.scene.getObjectByName('TheVessel')
      if (vessel && !initialPositions.current.TheVessel) {
        initialPositions.current.TheVessel = vessel.position.clone()
      }

      // Aplicar los materiales definidos en Wormhole.js
      applyWormholeMaterials(gltf.scene)
    }
  }, [gltf.scene])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (gltf.scene) {
      const veil = gltf.scene.getObjectByName('TheVeil')
      if (veil && initialPositions.current.TheVeil) {
        veil.position.y = initialPositions.current.TheVeil.y + Math.sin(t * 1.5) * 0.1
      }
      const vessel = gltf.scene.getObjectByName('TheVessel')
      if (vessel && initialPositions.current.TheVessel) {
        vessel.position.y = initialPositions.current.TheVessel.y + Math.sin(t * 1.5 + Math.PI) * 0.1
      }
    }
  })

  const handlePointerEnter = (e) => {
    e.stopPropagation()
    let obj = e.object
    while (obj && obj.name !== 'TheVeil' && obj.name !== 'TheVessel' && obj.name !== 'Scene') {
      obj = obj.parent
    }

    if (obj && (obj.name === 'TheVeil' || obj.name === 'TheVessel')) {
      if (obj.userData.isSpinning) return
      obj.userData.isSpinning = true

      const signX = Math.random() > 0.5 ? 1 : -1
      const signY = Math.random() > 0.5 ? 1 : -1
      const signZ = Math.random() > 0.5 ? 1 : -1

      gsap.to(obj.rotation, {
        x: obj.rotation.x + signX * Math.PI * 2,
        y: obj.rotation.y + signY * Math.PI * 2,
        z: obj.rotation.z + signZ * Math.PI * 2,
        duration: 1.5,
        ease: 'power2.out',
        onComplete: () => {
          obj.userData.isSpinning = false
        }
      })
    }
  }

  return (
    <group scale={[1, 1, 1]} position={[0, -0.2, 0]}>
      <primitive object={gltf.scene} onPointerEnter={handlePointerEnter} />
    </group>
  )
}

const SoulCanvas = ({ isVisible, isMobile }) => {
  const [ready, setReady] = useState(false)

  return (
    <Canvas
      dpr={isMobile ? 0.7 : 1}
      frameloop={(ready && isVisible) ? 'always' : 'never'}
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, pointerEvents: 'auto', zIndex: 9999 }}
      gl={(props) => {
        const renderer = new WebGPURenderer({ ...props, forceWebGL: false, antialias: true, sampleCount: 4 })
        renderer.init().then(() => setReady(true))
        return renderer
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={isMobile ? 70 : 45} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 3, 3]} intensity={0.5} />
      <Environment preset="city" />

      {ready && (
        <Suspense fallback={null}>
          <SimpleBloomEffect strength={1.2} radius={0.4} threshold={0.8} />
          <TheVeilTheVesselModel />
          <OrbitControls enableZoom={false} />
        </Suspense>
      )}
    </Canvas>
  )
}

const HypercubeInstance = ({ position, scale, morph, corners, cubeEdges, edgeGeo, innerBoxGeo, opacity }) => {
  const hyperEdgesRef = useRef([])
  const innerCubeRef = useRef()

  // Sincronizar escala del cubo interior con el morphing global
  const innerScale = 0.5 + morph * 0.45

  // Usar uniform explícito para la opacidad para asegurar actualización en WebGPU
  const opacityUniform = useMemo(() => TSL.uniform(opacity), [])

  // Material único por instancia
  const instanceMaterial = useMemo(() => {
    const mat = new MeshPhysicalNodeMaterial({
      color: '#e0e0e0ff',
      roughness: 0.1,
      metalness: 1,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })

    if (isMobile) {
      // --- VERSIÓN OPTIMIZADA PARA MÓVIL (Gradiente Rojo a Magenta) ---
      const color1 = TSL.color('#ff0000')
      const color2 = TSL.color('#ff00ff')

      // Aplicamos el gradiente al color base (colorNode) para que tiña toda la malla
      mat.colorNode = TSL.mix(color1, color2, TSL.uv().y)

      // Apagamos la iridiscencia en móvil para optimizar aún más (ya que el gradiente da el look)
      mat.iridescence = 0.0
    } else {
      // --- VERSIÓN ULTRA-REALISTA PARA DESKTOP ---
      mat.metalnessNode = TSL.mul(TSL.float(1).sub(TSL.mul(TSL.float(3.21), TSL.float(3.86))), TSL.float(-0.13))
      mat.iridescenceNode = TSL.mul(TSL.color('#2a6305ff'), TSL.mul(TSL.float(8.21), TSL.float(3.86)))
      mat.iridescence = 1.0
    }

    mat.iridescenceIOR = 1.1
    mat.opacityNode = opacityUniform
    return mat
  }, [opacityUniform])

  // Actualizar opacidad dinámicamente
  useEffect(() => {
    opacityUniform.value = opacity
  }, [opacity, opacityUniform])

  useFrame(() => {
    // Actualizar las 8 Hyper-aristas (tubos de conexión)
    hyperEdgesRef.current.forEach((mesh, i) => {
      if (!mesh) return
      const c = corners[i]
      const start = new THREE.Vector3(...c).multiplyScalar(innerScale)
      const end = new THREE.Vector3(...c)

      const dist = start.distanceTo(end)
      mesh.position.copy(start).add(end).multiplyScalar(0.5)
      mesh.scale.set(0.02, dist, 0.02)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())
    })
  })

  return (
    <group position={position} scale={scale}>
      {/* Cubo Exterior */}
      <group>
        {cubeEdges.map((e, i) => (
          <mesh key={`outer-${i}`} position={e.pos} rotation={e.rot} scale={[0.045, 2, 0.045]} material={instanceMaterial} geometry={edgeGeo} frustumCulled={false} />
        ))}
      </group>
      {/* Cubo Interior */}
      <group ref={innerCubeRef} scale={[innerScale, innerScale, innerScale]}>
        <mesh material={instanceMaterial} geometry={innerBoxGeo} frustumCulled={false} />
        {cubeEdges.map((e, i) => (
          <mesh key={`inner-${i}`} position={e.pos} rotation={e.rot} scale={[0.05, 2, 0.05]} material={instanceMaterial} geometry={edgeGeo} frustumCulled={false} />
        ))}
      </group>
      {/* Hyper-aristas */}
      {corners.map((_, i) => (
        <mesh key={`hyper-${i}`} ref={el => hyperEdgesRef.current[i] = el} material={instanceMaterial} geometry={edgeGeo} frustumCulled={false} />
      ))}
    </group>
  )
}

const Hypercube = () => {
  const [active, setActive] = useState(false)
  const towerProgress = useRef(0)
  const [morph, setMorph] = useState(0)

  // Geometría compartida
  const edgeGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), [])
  const innerBoxGeo = useMemo(() => new THREE.BoxGeometry(1.98, 1.98, 1.98), [])
  const cubeEdges = useMemo(() => [
    { pos: [0, 1, 1], rot: [0, 0, Math.PI / 2] }, { pos: [0, -1, 1], rot: [0, 0, Math.PI / 2] },
    { pos: [0, 1, -1], rot: [0, 0, Math.PI / 2] }, { pos: [0, -1, -1], rot: [0, 0, Math.PI / 2] },
    { pos: [1, 0, 1], rot: [0, 0, 0] }, { pos: [-1, 0, 1], rot: [0, 0, 0] },
    { pos: [1, 0, -1], rot: [0, 0, 0] }, { pos: [-1, 0, -1], rot: [0, 0, 0] },
    { pos: [1, 1, 0], rot: [Math.PI / 2, 0, 0] }, { pos: [1, -1, 0], rot: [Math.PI / 2, 0, 0] },
    { pos: [-1, 1, 0], rot: [Math.PI / 2, 0, 0] }, { pos: [-1, -1, 0], rot: [Math.PI / 2, 0, 0] }
  ], [])
  const corners = useMemo(() => [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ], [])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    setMorph((Math.sin(t * 0.5) + 1) / 2)

    // Animación de la torre (mitosis)
    if (active) {
      towerProgress.current = THREE.MathUtils.lerp(towerProgress.current, 4.2, delta * 1.2)
    } else {
      towerProgress.current = THREE.MathUtils.lerp(towerProgress.current, 0, delta * 2.5)
    }
  })

  // Generar instancias de la torre
  const instances = []
  const maxLevels = 5
  for (let i = 0; i < maxLevels; i++) {
    const levelProgress = THREE.MathUtils.clamp(towerProgress.current - i + 1, 0, 1)
    if (levelProgress <= 0 && i > 0) continue

    // Efecto de apilamiento: cada nivel sube y se escala un poco menos
    const yPos = i * 2.1 * levelProgress
    const scale = 1.0 - (i * 0.15 * levelProgress)

    // Opacidad: la base siempre es visible.
    // Los niveles superiores permanecen en opacidad 0 hasta que ya se han desplazado
    // lo suficiente para no superponerse (evitando z-fighting visual).
    let displayOpacity = 1
    if (i > 0) {
      displayOpacity = THREE.MathUtils.clamp((levelProgress - 0.2) / 0.8, 0, 1)
    }

    // Omitir render si la opacidad es 0
    if (displayOpacity <= 0 && i > 0) continue

    instances.push(
      <HypercubeInstance
        key={i}
        position={[0, yPos - (towerProgress.current * 1.0), 0]} // Centrar la torre mientras crece
        scale={[scale, scale, scale]}
        morph={morph}
        corners={corners}
        cubeEdges={cubeEdges}
        edgeGeo={edgeGeo}
        innerBoxGeo={innerBoxGeo}
        opacity={displayOpacity}
      />
    )
  }

  return (
    <group
      scale={[1.8, 1.8, 1.8]}
      onClick={(e) => {
        e.stopPropagation()
        if (!isMobile) setActive(!active)
      }}
      onPointerDown={() => { if (isMobile) setActive(true) }}
      onPointerUp={() => { if (isMobile) setActive(false) }}
      onPointerOver={() => { if (!isMobile) document.body.style.cursor = 'pointer' }}
      onPointerOut={() => {
        if (isMobile) setActive(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {instances}
    </group>
  )
}

const StructureCanvas = ({ isVisible, isMobile }) => {
  const [ready, setReady] = useState(false)

  return (
    <Canvas
      dpr={isMobile ? 0.7 : 1}
      frameloop={(ready && isVisible) ? 'always' : 'never'}
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, pointerEvents: 'auto', zIndex: 9999 }}
      gl={(props) => {
        const renderer = new WebGPURenderer({ ...props, forceWebGL: false, antialias: true, sampleCount: 6 })
        renderer.init().then(() => setReady(true))
        return renderer
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={isMobile ? 70 : 45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <Environment preset="city" />

      {ready && (
        <Suspense fallback={null}>
          <SimpleBloomEffect strength={0.02} radius={0.02} threshold={0.9} />
          <Hypercube />
          <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
        </Suspense>
      )}
    </Canvas>
  )
}

const CameraDebugger = () => {
  const { camera } = useThree()
  const [debugInfo, setDebugInfo] = React.useState({ pos: [0, 0, 0], rot: [0, 0, 0] })

  useFrame(() => {
    setDebugInfo({
      pos: [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2)],
      rot: [camera.rotation.x.toFixed(2), camera.rotation.y.toFixed(2), camera.rotation.z.toFixed(2)]
    })
  })

  return (
    <Html fullscreen>
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        padding: '15px',
        background: 'rgba(0,0,0,0.7)',
        color: '#00ffff',
        fontFamily: 'monospace',
        borderRadius: '8px',
        pointerEvents: 'none',
        zIndex: 100,
        border: '1px solid #00ffff'
      }}>
        <div>POS: {debugInfo.pos.join(', ')}</div>
        <div>ROT: {debugInfo.rot.join(', ')}</div>
        <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.7 }}>Scroll to move between waypoints</div>
      </div>
    </Html>
  )
}

const Experience = () => {
  const { camera, scene: globalScene, gl } = useThree()
  const controlsRef = useRef()

  useEffect(() => {
    camera.fov = isMobile ? 70 : 45
    camera.updateProjectionMatrix()
  }, [camera])

  // Usar el store global
  const targetScroll = useRef(useAlquimiaStore.getState().targetScroll)
  const scrollProgress = useRef(useAlquimiaStore.getState().targetScroll)

  const isArtifactActive = useAlquimiaStore((state) => state.isArtifactActive)
  const setIsArtifactActive = useAlquimiaStore((state) => state.setIsArtifactActive)
  const isExploded = useAlquimiaStore((state) => state.isExploded)
  const setIsExploded = useAlquimiaStore((state) => state.setIsExploded)
  const scrollPhase = useAlquimiaStore((state) => state.scrollPhase)
  const setScrollPhase = useAlquimiaStore((state) => state.setScrollPhase)
  const setTargetScrollStore = useAlquimiaStore((state) => state.setTargetScroll)
  const isAnimatingCinematic = useAlquimiaStore((state) => state.isAnimatingCinematic)
  const setIsAnimatingCinematic = useAlquimiaStore((state) => state.setIsAnimatingCinematic)

  const [isHudHovered, setIsHudHovered] = useState(false)
  const [isDrunkBtnHovered, setIsDrunkBtnHovered] = useState(false)
  const [detailedPart, setDetailedPart] = useState(null)
  const [hoveredPart, setHoveredPart] = useState(null)
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [isFlaskSubExploded, setIsFlaskSubExploded] = useState(false)
  const [isCrestExpanded, setIsCrestExpanded] = useState(false)
  const [expandedNarrativePanel, setExpandedNarrativePanel] = useState(null) // 'circleOuter' | 'triangle' | 'circleInner' | 'square' | 'flask-right' | 'flask-left'
  const [activeWaypoint, setActiveWaypoint] = useState(() => Math.round(useAlquimiaStore.getState().targetScroll))
  const [isApproachingWP4, setIsApproachingWP4] = useState(() => {
    const val = useAlquimiaStore.getState().targetScroll
    return val > 2.05 && val <= 3.5
  })

  useEffect(() => {
    const unsub = useAlquimiaStore.subscribe(
      (state) => state.targetScroll,
      (val) => {
        const wp = Math.round(val)
        setActiveWaypoint((prev) => prev !== wp ? wp : prev)
        setIsApproachingWP4(val > 2.05 && val <= 3.5)
      }
    )
    return unsub
  }, [])

  useEffect(() => {
    if (activeWaypoint !== 3 && isCrestExpanded) {
      setIsCrestExpanded(false)
    }
  }, [activeWaypoint, isCrestExpanded])

  // Cerrar paneles de narrativa al salir del modo inspección
  useEffect(() => {
    if (!detailedPart) {
      setExpandedNarrativePanel(null)
    }
  }, [detailedPart])

  // Deshabilitar eventos de puntero en el canvas principal cuando hay inspección en mobile
  useEffect(() => {
    if (isMobile && detailedPart) {
      gl.domElement.style.pointerEvents = 'none'
    } else {
      gl.domElement.style.pointerEvents = 'auto'
    }
  }, [isMobile, detailedPart, gl])

  const isTimeAnomalyActive = useAlquimiaStore((state) => state.isTimeAnomalyActive)
  const setIsTimeAnomalyActive = useAlquimiaStore((state) => state.setIsTimeAnomalyActive)

  const language = useAlquimiaStore((state) => state.language)
  const t = translations[language]

  const setPendingInspect = useAlquimiaStore((state) => state.setPendingInspect)

  const wp3TooltipRef = useRef()
  const wp4AwakeningRef = useRef()
  const drunkGptingBtnRef = useRef()
  const crestFlapBtnRef = useRef()
  const isDrunkGptingRef = useRef(false)

  const handleDrunkGpting = () => {
    // 1. Trigger Temporal Anomaly state
    setIsTimeAnomalyActive(true)
    setIsAnimatingCinematic(true)
    isDrunkGptingRef.current = true

    // 2. Create or get full-screen overlay for fade out
    let overlay = document.getElementById('drunk-gpting-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'drunk-gpting-overlay'
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100vw'
      overlay.style.height = '100vh'
      overlay.style.backgroundColor = 'black'
      overlay.style.zIndex = '999999999'
      overlay.style.opacity = '0'
      overlay.style.pointerEvents = 'auto'
      overlay.style.transition = 'opacity 0.5s ease'
      overlay.style.backdropFilter = 'blur(10px)'
      overlay.style.display = 'flex'
      overlay.style.alignItems = 'center'
      overlay.style.justifyContent = 'center'
      
      const btn = document.createElement('button')
      btn.id = 'drunk-gpting-btn'
      btn.innerText = 'BACK TO ALQUIMIA'
      btn.style.padding = '15px 40px'
      btn.style.background = 'transparent'
      btn.style.border = '1px solid #00ffff'
      btn.style.color = '#00ffff'
      btn.style.fontFamily = 'monospace'
      btn.style.fontSize = '14px'
      btn.style.letterSpacing = '4px'
      btn.style.cursor = 'pointer'
      btn.style.opacity = '0'
      btn.style.transition = 'all 0.3s'
      btn.onmouseenter = () => { btn.style.background = 'rgba(0, 255, 255, 0.1)'; btn.style.transform = 'scale(1.05)' }
      btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.transform = 'scale(1)' }
      
      btn.onclick = () => {
        overlay.style.opacity = '0'
        btn.style.opacity = '0'
        setTimeout(() => overlay.remove(), 600)
        
        gsap.to(camera, {
          fov: isMobile ? 70 : 45,
          duration: 1.5,
          ease: 'power2.inOut',
          onUpdate: () => camera.updateProjectionMatrix()
        })
        
        useAlquimiaStore.getState().setIsTimeAnomalyActive(false)
        useAlquimiaStore.getState().setIsAnimatingCinematic(false)
        isDrunkGptingRef.current = false
        
        useAlquimiaStore.getState().navigateToWaypoint(3)
      }
      
      overlay.appendChild(btn)
      document.body.appendChild(overlay)
    }

    // 3. Determine target coordinate (Flask)
    const flaskPos = new THREE.Vector3()
    const flaskMesh = globalScene?.getObjectByName('AlquimiaFlask')
    if (flaskMesh) {
      flaskMesh.getWorldPosition(flaskPos)
    } else {
      flaskPos.set(0, 4.5, -0.5) // Fallback rough coordinates
    }

    // 4. Dynamic FOV modification with updateProjectionMatrix
    gsap.to(camera, {
      fov: 10, // dramatic zoom in
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix()
    })

    // 5. Camera positional tween towards Flask & Redirection
    gsap.to(camera.position, {
      x: flaskPos.x,
      y: flaskPos.y + 0,
      z: flaskPos.z + 1.2, // Close but not clipping
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        overlay.style.opacity = '1'
        const btn = document.getElementById('drunk-gpting-btn')
        if (btn) btn.style.opacity = '1'
        
        setTimeout(() => {
          window.open('https://hotelherrera.com/drunk-gpting/', '_blank')
        }, 800)
      }
    })
  }

  // Resetear el modo de inspección si salimos de la vista Deconstructed (isExploded = false)
  useEffect(() => {
    if (!isExploded) {
      setDetailedPart(null)
      setIsOverlayVisible(false)
      setIsFlaskSubExploded(false)
    }
  }, [isExploded])

  // Escuchar pendingInspect desde el Navbar para abrir la inspección directa
  useEffect(() => {
    const unsub = useAlquimiaStore.subscribe(
      (state) => state.pendingInspect,
      (part) => {
        if (!part) return

        // 1. Matar animaciones cruzadas y bloquear scroll inmediatamente
        setIsAnimatingCinematic(true)
        gsap.killTweensOf(targetScroll)

        // 2. Forzar modo Deconstructed en el store (bypasea requerimientos y fases)
        useAlquimiaStore.getState().setScrollPhase('artifact')
        useAlquimiaStore.getState().setIsArtifactActive(true)
        useAlquimiaStore.getState().setIsExploded(true)
        useAlquimiaStore.getState().setTargetScroll(4.0)

        // 3. Vuelo directo y forzado a la inspección (bypasea WP2 validation lock)
        gsap.to(targetScroll, {
          current: 4.0,
          duration: 2.0,
          ease: 'power3.inOut',
          onUpdate: () => setTargetScrollStore(targetScroll.current),
          onComplete: () => {
            targetScroll.current = 4.0
            setTargetScrollStore(4.0)
            // Activar la vista detallada al llegar al destino
            setDetailedPart(part)
            useAlquimiaStore.getState().setPendingInspect(null)
            setIsAnimatingCinematic(false)
          }
        })
      }
    )
    return unsub
  }, [setPendingInspect, setIsAnimatingCinematic])

  // Efecto para manejar la aparición diferida del overlay para CUALQUIER pieza
  useEffect(() => {
    if (detailedPart) {
      const timer = setTimeout(() => {
        setIsOverlayVisible(true)
      }, 1200) // Delay universal para la animación de inspección
      return () => clearTimeout(timer)
    } else {
      setIsOverlayVisible(false)
    }
  }, [detailedPart])

  // Sincronizar el ref local con el store cuando este cambia (desde el Navbar)
  useEffect(() => {
    const unsub = useAlquimiaStore.subscribe(
      (state) => state.targetScroll,
      (val) => {
        // Ignorar si estamos en una transición directa de Nootropics
        if (useAlquimiaStore.getState().pendingInspect) return

        // Obtenemos el valor actual de scrollProgress para comparar el salto real
        const currentProgress = scrollProgress.current

        // Si el salto es significativo (más de 0.7), usamos GSAP para un viaje cinematográfico
        // Un umbral de 0.7 asegura que el scroll manual no dispare accidentalmente la animación
        if (Math.abs(currentProgress - val) > 0.7) {
          console.log(`Cinematic jump triggered: from ${currentProgress} to ${val}`)

          setIsAnimatingCinematic(true)
          // Matar cualquier animación previa en targetScroll
          gsap.killTweensOf(targetScroll)

          gsap.to(targetScroll, {
            current: val,
            duration: 2.5,
            ease: 'power2.inOut',
            onUpdate: () => setTargetScrollStore(targetScroll.current),
            onComplete: () => {
              targetScroll.current = val
              setTargetScrollStore(val)
              setIsAnimatingCinematic(false)
            }
          })
        } else {
          targetScroll.current = val
        }
      }
    )
    return unsub
  }, [setIsAnimatingCinematic])

  const hudRef = useRef()
  const scrollHintRef = useRef()
  const wp4LightHintRef = useRef()
  const glitchUniform = useMemo(() => TSL.uniform(0), [])
  const glitchUniformRef = useRef(glitchUniform)

  // Configuración de Waypoints (Ajustables manualmente)
  const waypoints = useMemo(() => isMobile ? [
    { pos: [0.2, 0.5, 8.7], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] },        // WP 1: Entrance
    { pos: [-0.6, -0.1, 2.3], rot: [0, 0, 0], target: [1.5, - 5, 0], offset: [0.5, 0.5, 0] }, // WP 2: THEArtifact
    { pos: [2.5, 1.5, 4.5], rot: [0, -Math.PI / 2, 0], target: [-1, -1.5, -1.5], offset: [0, 0, 0] }, // WP 3: Arise
    { pos: [0.22, -0.4, 3], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] }, // WP 4: THEawakening
    { pos: [0.2, 0, 7], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] }, // WP 5: Deconstructed
  ] : [
    { pos: [0.2, 0.5, 8], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] },        // WP 1: Entrance (Index 0)
    { pos: [-0.6, -0.1, 2.5], rot: [0, 0, 0], target: [1.5, - 5, 0], offset: [0.5, 0.5, 0] }, // WP 2: THEArtifact (Index 1)
    { pos: [2, 1.5, 3], rot: [0, -Math.PI / 2, 0], target: [-1, -1.5, -1.5], offset: [0, 0, 0] }, // WP 3: Arise (Index 2)
    { pos: [0.3, 0, 3], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] }, // WP 4: THEawakening (Index 3)
    { pos: [0.2, 0.5, 7.5], rot: [0, 0, 0], target: [0, 0, -10], offset: [0, 0, 0] }, // WP 5: Deconstructed (Index 4)
  ], [])

  // Lógica de Scroll con Acumulador y Damping (Touch + Wheel)
  useEffect(() => {
    let touchStartY = 0;

    const handleScrollLogic = (deltaY, sensitivity) => {
      // Usar getState() para obtener el valor más reciente sin depender del closure del useEffect
      const state = useAlquimiaStore.getState()
      if (state.isAnimatingCinematic) return

      if (isMobile && detailedPart) return // Guarda contra swipes en mobile durante inspección

      // Extraer el journeyMode
      const jMode = state.journeyMode

      if (jMode === 'scroll') {
        targetScroll.current += deltaY * sensitivity
        targetScroll.current = Math.max(0, Math.min(targetScroll.current, 4.0))

        // Si llegamos a 4.0, activamos isExploded automáticamente
        if (targetScroll.current >= 3.8 && !state.isExploded) {
          useAlquimiaStore.getState().setIsExploded(true)
        } else if (targetScroll.current < 3.8 && state.isExploded) {
          useAlquimiaStore.getState().setIsExploded(false)
        }

        // Activamos isArtifactActive automáticamente al pasar WP 2
        if (targetScroll.current >= 1.5 && !state.isArtifactActive) {
          useAlquimiaStore.getState().setIsArtifactActive(true)
        } else if (targetScroll.current < 1.5 && state.isArtifactActive) {
          useAlquimiaStore.getState().setIsArtifactActive(false)
        }
      } else {
        // MAD adventure mode (default)
        if (state.isExploded) {
          targetScroll.current = 4.0
          setTargetScrollStore(4.0) // Sincronizar el store explícitamente
          return
        }

        targetScroll.current += deltaY * sensitivity

        // Límites dinámicos según la fase
        if (state.scrollPhase === 'intro') {
          targetScroll.current = Math.max(0, Math.min(targetScroll.current, 1.0))
        } else {
          targetScroll.current = Math.max(2.0, Math.min(targetScroll.current, 3.0))
        }
      }

      // Actualizar el store para que el Navbar sepa dónde estamos
      setTargetScrollStore(targetScroll.current)
    }

    const handleWheel = (e) => {
      handleScrollLogic(e.deltaY, 0.0008)
    }

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    }

    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;
      handleScrollLogic(deltaY, 0.002); // Sensibilidad ajustada para touch
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [waypoints, isExploded, detailedPart])

  const triggerSFX = useAlquimiaStore((state) => state.triggerSFX)
  const prevIsArtifactActive = useRef(isArtifactActive)
  const prevScroll = useRef(targetScroll.current)
  const prevIsExploded = useRef(isExploded)

  // Disparar OpenArtifact cuando se activa el artefacto
  useEffect(() => {
    if (isArtifactActive && !prevIsArtifactActive.current) {
      triggerSFX('OpenArtifact')
    }
    prevIsArtifactActive.current = isArtifactActive
  }, [isArtifactActive])

  // Disparar Glitch cuando el artefacto se deconstruye
  useEffect(() => {
    if (isExploded && !prevIsExploded.current) {
      triggerSFX('Glitch')
    }
    prevIsExploded.current = isExploded
  }, [isExploded])

  // Disparar CloseArtifact cuando retrocedemos del WP 3 al WP 2
  useEffect(() => {
    const unsub = useAlquimiaStore.subscribe(
      (state) => state.targetScroll,
      (val) => {
        // Si bajamos del umbral del WP 3 (2.0) al WP 2 (1.0)
        if (prevScroll.current >= 2.0 && val < 2.0) {
          triggerSFX('CloseArtifact')
        }
        prevScroll.current = val
      }
    )
    return unsub
  }, [])

  // --- LÓGICA CENTRALIZADA DE ANOMALÍA TEMPORAL ---
  useEffect(() => {
    const checkNaturalAnomaly = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const totalMinutes = hours * 60 + minutes
      const start = 1 * 60 + 11 // 1:11 AM
      const end = 3 * 60 + 33   // 3:33 AM

      const isAnomalyTime = totalMinutes >= start && totalMinutes <= end
      const currentAnomalyState = useAlquimiaStore.getState().isTimeAnomalyActive

      if (isAnomalyTime && !currentAnomalyState) {
        console.log('%c🔮 ANOMALY DETECTED: Temporal flow reversed.', 'color: #00ffff; font-weight: bold;')
        setIsTimeAnomalyActive(true)
      } else if (!isAnomalyTime && currentAnomalyState) {
        // Solo restauramos si no está forzado por el usuario (o si queremos que el simulador expire cada minuto, lo dejamos así)
        console.log('%c✅ Reality Restored: Temporal flow normalized.', 'color: #00ffff; font-weight: bold;')
        setIsTimeAnomalyActive(false)
      }
    }

    checkNaturalAnomaly()
    const interval = setInterval(checkNaturalAnomaly, 60000)
    return () => clearInterval(interval)
  }, [setIsTimeAnomalyActive])

  // --- EFECTO VISUAL DE ANOMALÍA TEMPORAL (GLITCH CORTO DE BAJA INTENSIDAD) ---
  useEffect(() => {
    if (!glitchUniformRef.current) return

    gsap.killTweensOf(glitchUniformRef.current)

    if (isTimeAnomalyActive) {
      triggerSFX('Glitch')
      // Secuencia de Glitch que dura exactamente 1.5s y regresa a 0
      const tl = gsap.timeline()
      tl.to(glitchUniformRef.current, { value: 0.4, duration: 0.1 })
        .to(glitchUniformRef.current, { value: 0.1, duration: 0.05 })
        .to(glitchUniformRef.current, { value: 0.25, duration: 0.1 })
        .to(glitchUniformRef.current, { value: 0.0, duration: 1.25, ease: 'power2.out' })
    } else {
      // Asegurar que quede en 0 si se desactiva manualmente rápido
      gsap.to(glitchUniformRef.current, {
        value: 0.0,
        duration: 0.5,
        ease: 'power2.in'
      })
    }
  }, [isTimeAnomalyActive, triggerSFX])

  // Animación automática al WP de Explosión
  useEffect(() => {
    if (isExploded) {
      // Disparar Glitch al desensamblar (Agresivo y con parpadeo)
      triggerSFX('Glitch')
      if (glitchUniform) {
        console.log('--- GLITCH TRIGGERED (AGGRESSIVE) ---')
        const tl = gsap.timeline()
        tl.to(glitchUniform, { value: 1.0, duration: 0.05 })
          .to(glitchUniform, { value: 0.2, duration: 0.01 })
          .to(glitchUniform, { value: 0.7, duration: 0.03 })
          .to(glitchUniform, { value: 0.4, duration: 0.05 })
          .to(glitchUniform, { value: 0, duration: 1.2, ease: 'power3.in' })
      }

      // Evitar animar la cámara si Nootropics ya está forzando la transición
      if (useAlquimiaStore.getState().pendingInspect) return

      setIsAnimatingCinematic(true)
      gsap.to(targetScroll, {
        current: 4.0, // WP 5
        duration: 1.0,
        ease: 'power2.out',
        onUpdate: () => setTargetScrollStore(targetScroll.current),
        onComplete: () => {
          targetScroll.current = 4.0
          setTargetScrollStore(4.0)
          setIsAnimatingCinematic(false)
        }
      })
    } else if (scrollPhase === 'artifact' && scrollProgress.current > 3.5) {
      // Si re-ensamblamos y estábamos en el WP de explosión, volvemos al WP frontal
      setIsAnimatingCinematic(true)
      gsap.to(targetScroll, {
        current: 3.0, // WP 4
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => setTargetScrollStore(targetScroll.current),
        onComplete: () => {
          targetScroll.current = 3.0
          setTargetScrollStore(3.0)
          setIsAnimatingCinematic(false)
        }
      })
    }
  }, [isExploded])

  useFrame((state, delta) => {
    // Suavizado (Lerp) de la posición del scroll para inercia
    // 0.05 es la "fricción", un valor menor es más suave/lento (aceleración/desaceleración)
    scrollProgress.current = THREE.MathUtils.lerp(scrollProgress.current, targetScroll.current, 0.08)

    // Sincronizar suavemente el store con el progreso real para el Navbar
    if (Math.abs(useAlquimiaStore.getState().targetScroll - scrollProgress.current) > 0.01) {
      // Solo actualizamos el store si hay un cambio significativo para evitar bucles infinitos
      // y mantener el Navbar sincronizado con la animación suave
      // setTargetScrollStore(scrollProgress.current) 
    }

    // Determinar entre qué waypoints estamos (0.0 a waypoints.length - 1)
    const index = Math.floor(scrollProgress.current)
    const nextIndex = Math.min(index + 1, waypoints.length - 1)
    const alpha = scrollProgress.current % 1

    const wpA = waypoints[index]
    const wpB = waypoints[nextIndex]

    if (wpA && wpB && !isDrunkGptingRef.current) {
      // Interpolar posición de la cámara suavemente
      camera.position.x = THREE.MathUtils.lerp(wpA.pos[0], wpB.pos[0], alpha)
      camera.position.y = THREE.MathUtils.lerp(wpA.pos[1], wpB.pos[1], alpha)
      camera.position.z = THREE.MathUtils.lerp(wpA.pos[2], wpB.pos[2], alpha)

      // Interpolar el target de los controles para un movimiento orgánico
      if (controlsRef.current) {
        controlsRef.current.target.x = THREE.MathUtils.lerp(wpA.target[0], wpB.target[0], alpha)
        controlsRef.current.target.y = THREE.MathUtils.lerp(wpA.target[1], wpB.target[1], alpha)
        controlsRef.current.target.z = THREE.MathUtils.lerp(wpA.target[2], wpB.target[2], alpha)
        controlsRef.current.update()
      }

      // Interpolar el Offset Dinámico del HitPoint
      const currentOffsetX = THREE.MathUtils.lerp(wpA.offset[0], wpB.offset[0], alpha)
      const currentOffsetY = THREE.MathUtils.lerp(wpA.offset[1], wpB.offset[1], alpha)
      const currentOffsetZ = THREE.MathUtils.lerp(wpA.offset[2], wpB.offset[2], alpha)

      _tempOffsetVec.set(currentOffsetX, currentOffsetY, currentOffsetZ)
      updateTSLOffset(_tempOffsetVec)
    }

    // Actualizar opacidad y posición del HUD globalmente
    if (hudRef.current) {
      if (isArtifactActive) {
        // Cuando el artefacto está activo, el botón Close siempre es visible
        hudRef.current.style.opacity = 1
        hudRef.current.style.pointerEvents = 'auto'
      } else {
        // Estado inicial: aparece solo cerca del WP2 (scroll ~1.0)
        const distance = Math.abs(scrollProgress.current - 1.0)
        const opacity = THREE.MathUtils.clamp(1 - distance * 5, 0, 1)
        hudRef.current.style.opacity = opacity
        hudRef.current.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
      }

      // Actualizar opacidad de Scroll Hint
      if (scrollHintRef.current) {
        // En scroll = 0 (WP1), opacity = 1. Fade out a 0 al llegar a WP2 (scroll = 1)
        const hintOpacity = THREE.MathUtils.clamp(1 - scrollProgress.current * 2.5, 0, 1)
        scrollHintRef.current.style.opacity = hintOpacity
      }

      // Posiciones del HUD por waypoint (bottom en vh, left en vw)
      // WP1(0): oculto, WP2(1): consola, WP3(2): lateral, WP4(3): frontal
      const hudPositions = isMobile ? hudMobilePositions : [
        { bottom: -125, left: 15 },  // WP1 (igual que WP2)
        { bottom: -245, left: 110 },  // WP2
        { bottom: -60, left: 0 },  // WP3
        { bottom: -47, left: 8.5 },  // WP4
        { bottom: -40, left: 2 },  // WP5
      ]

      const sp = scrollProgress.current
      const idx = Math.floor(sp)
      const nxt = Math.min(idx + 1, hudPositions.length - 1)
      const a = sp % 1

      const hBottom = THREE.MathUtils.lerp(hudPositions[idx].bottom, hudPositions[nxt].bottom, a)
      const hLeft = THREE.MathUtils.lerp(hudPositions[idx].left, hudPositions[nxt].left, a)

      hudRef.current.style.bottom = hBottom + 'vh'
      hudRef.current.style.left = hLeft + 'vh'
    }
  })

  // Control del fondo (HDRI vs Negro)
  useEffect(() => {
    if (isExploded || isMobile) {
      globalScene.background = new THREE.Color('#000000')
    } else {
      globalScene.background = null
    }
  }, [isExploded, isMobile, globalScene])

  // useFrame del Experience para manejar UI global
  useFrame((state) => {
    // Animación de visibilidad para Tooltip WP 3 (Arise / scroll = 2.0)
    if (wp3TooltipRef.current && scrollProgress?.current !== undefined) {
      const distToWP3 = Math.abs(scrollProgress.current - 2.0)
      const opacityTarget = THREE.MathUtils.clamp(1.0 - distToWP3 * 4.0, 0, 1)
      wp3TooltipRef.current.style.opacity = opacityTarget
      wp3TooltipRef.current.style.display = opacityTarget > 0.01 ? 'flex' : 'none'
    }

    // Animación de visibilidad para WP 4 (Awakening / scroll = 3.0)
    if (wp4AwakeningRef.current && scrollProgress?.current !== undefined) {
      const distToWP4 = Math.abs(scrollProgress.current - 3.0)
      const opacityTarget = THREE.MathUtils.clamp(1.0 - distToWP4 * 2.5, 0, 1)
      wp4AwakeningRef.current.style.opacity = opacityTarget
      wp4AwakeningRef.current.style.display = opacityTarget > 0.01 ? 'block' : 'none'

      // Anticipar solapa The Living Crest (WP4 Flap)
      if (crestFlapBtnRef.current && isMobile && !isCrestExpanded) {
        const isNear = distToWP4 < 0.2
        crestFlapBtnRef.current.style.opacity = isNear ? '1' : '0'
        crestFlapBtnRef.current.style.pointerEvents = isNear ? 'auto' : 'none'
        crestFlapBtnRef.current.style.transform = `translateY(-50%) translateX(${isNear ? '0px' : '20px'})`
        crestFlapBtnRef.current.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
      }

      // Control opacity for CTA button 
      if (drunkGptingBtnRef.current) {
        drunkGptingBtnRef.current.style.opacity = opacityTarget
        drunkGptingBtnRef.current.style.pointerEvents = opacityTarget > 0.5 ? 'auto' : 'none'
      }

      if (wp4LightHintRef.current) {
        wp4LightHintRef.current.style.opacity = opacityTarget
        wp4LightHintRef.current.style.display = opacityTarget > 0.01 ? 'block' : 'none'
      }
    }
  })

  return (
    <>
      <TSLInteractionManager />
      <CameraDebugger />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableRotate={false}
        enableZoom={false}
        minDistance={1}
        maxDistance={105}
      />

      {/* Ambient Light */}
      <ambientLight intensity={1.5} />

      {/* Lens Flare Animado */}
      <MovingLensFlare scrollRef={scrollProgress} />

      {/* Environment Map / HDRI - background solo en desktop */}
      <Environment files="/assets/AlquimiaHDRI.exr" background={!isMobile && !isExploded} blur={0.05} />

      {/* Directional Light */}
      <directionalLight
        position={[3.5, 5, 0]}
        intensity={1.0}
        castShadow
      />

      <Suspense fallback={null}>
        {/* Alquimia Room Model */}
        {RENDER_ALQUIMIA_ROOM && (
          <Model
            url="/assets/AlquimiaRoom_compressed.glb"
            scrollRef={scrollProgress}
            targetScrollRef={targetScroll}
            onActivateArtifact={() => setIsArtifactActive(true)}
            isExploded={isExploded}
            detailedPart={detailedPart}
            setDetailedPart={setDetailedPart}
            hoveredPart={hoveredPart}
            setHoveredPart={setHoveredPart}
            isOverlayVisible={isOverlayVisible}
            setIsOverlayVisible={setIsOverlayVisible}
            isFlaskSubExploded={isFlaskSubExploded}
            setIsFlaskSubExploded={setIsFlaskSubExploded}
            scale={0.5}
            rotation={[0, 0, 0]}
            position={[0.5, -2, 4]}
          />
        )}

        {/* Alquimia Door Model - Solo en Desktop por rendimiento */}
        {!isMobile && (
          <Model
            url="/assets/AlquimiaDoor_compressed.glb"
            scrollRef={scrollProgress}
            targetScrollRef={targetScroll}
            onActivateArtifact={() => setIsArtifactActive(true)}
            isExploded={isExploded}
            detailedPart={detailedPart}
            setDetailedPart={setDetailedPart}
            hoveredPart={hoveredPart}
            setHoveredPart={setHoveredPart}
            isOverlayVisible={isOverlayVisible}
            setIsOverlayVisible={setIsOverlayVisible}
            isFlaskSubExploded={isFlaskSubExploded}
            setIsFlaskSubExploded={setIsFlaskSubExploded}
            scale={0.5}
            rotation={[0, 0, 0]}
            position={[0.5, -2, 4]}
          />
        )}

        {/* Alquimia Artifact Model */}
        <Model
          url="/assets/AlquimiaArtifact_compressed.glb"
          isMainArtifact={true}
          scrollRef={scrollProgress}
          targetScrollRef={targetScroll}
          onActivateArtifact={() => setIsArtifactActive(true)}
          isExploded={isExploded}
          setIsExploded={setIsExploded}
          detailedPart={detailedPart}
          setDetailedPart={setDetailedPart}
          hoveredPart={hoveredPart}
          setHoveredPart={setHoveredPart}
          isOverlayVisible={isOverlayVisible}
          setIsOverlayVisible={setIsOverlayVisible}
          isFlaskSubExploded={isFlaskSubExploded}
          setIsFlaskSubExploded={setIsFlaskSubExploded}
          expandedNarrativePanel={expandedNarrativePanel}
          setExpandedNarrativePanel={setExpandedNarrativePanel}
          scale={0.5}
          rotation={[0, 0, 0]}
          position={[0.5, -2, 4]}
        />

        {/* Reflective Floor/Plane */}
        <Model
          url="/assets/reflectiveCircle.glb"
          scale={0.5}
          position={[0.5, -2, 4]}
          isReflective={true}
        />
      </Suspense>

      {/* Post Processing */}
      <BloomEffect glitchUniformRef={glitchUniformRef} />

      {/* Global UI HUD Overlay */}
      <Html fullscreen pointerEvents="none">
        {/* Scroll Hint */}
        <div
          ref={scrollHintRef} className='approach'
          style={{
            position: 'fixed',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            padding: '8px 20px',
            borderRadius: '5px',
            borderLeft: '2px solid #00ffff',
            bottom: '-40vh',
            left: '49%',
            whiteSpace: 'nowrap',
            transform: 'translateX(-48%)',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: '300',
            letterSpacing: '2px',
            fontSize: '12px',
            width: 'auto',

            textShadow: '0 0 10px rgba(0, 255, 255, 0.6)',
            pointerEvents: 'auto',
            opacity: 1,
            transition: 'opacity 0.1s linear',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="7" ry="7"></rect>
            <path d="M12 6v4"></path>
          </svg>
          <span>{isMobile ? t.tooltips.approach_mobile : t.tooltips.approach_desktop}</span>
        </div>

        {/* Tooltip para WP 3 (Arise) */}
        <div
          ref={wp3TooltipRef}
          style={{
            position: 'fixed',
            whiteSpace: 'nowrap',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            padding: '8px 20px',
            borderRadius: '5px',
            borderLeft: '2px solid #00ffff',
            bottom: '20vh',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: '300',
            letterSpacing: '2px',
            fontSize: '12px',
            width: 'auto',
            textShadow: '0 0 10px rgba(0, 255, 255, 0.6)',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.3s ease',
            zIndex: 10,
            display: 'none',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="7" ry="7"></rect>
            <path d="M12 6v4"></path>
          </svg>
          <span>{t.tooltips.keep_going}</span>
        </div>

        {/* Botón Solapa para Mobile */}
        {isMobile && !isCrestExpanded && (
          <button
            ref={crestFlapBtnRef}
            onClick={() => setIsCrestExpanded(true)}
            style={{
              position: 'fixed',
              right: '-60vw',
              top: '50%',
              transform: 'translateY(-50%) translateX(20px)',
              padding: '25px 18px',
              opacity: 0,
              pointerEvents: 'none',
              background: 'rgba(10, 20, 25, 0.9)',
              border: '1px solid #00ffff',
              borderRight: 'none',
              borderRadius: '8px 0 0 8px',
              cursor: 'pointer',
              animation: 'smoothFlapGlow 2.5s infinite ease-in-out',
              zIndex: 100,
              color: '#00ffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}

        {/* Panel de Narrativa WP 4 - THE AWAKENING */}
        <div className={`awakeningNarrative ${isCrestExpanded ? 'expanded' : ''}`}
          ref={wp4AwakeningRef}
          style={{
            position: 'fixed',
            right: '15vw',
            width: '380px',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            textAlign: 'left',
            zIndex: 10,
            opacity: 0,
            pointerEvents: 'none',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '1.5rem',
            backdropFilter: 'blur(10px)',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '1rem',
            borderRight: '2px solid #00ffff'
          }}
        >
          {isMobile && (
            <div className='close-btn'
              onClick={(e) => {
                e.stopPropagation()
                setIsCrestExpanded(false)
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                cursor: 'pointer',
                zIndex: 105,
                color: '#00ffff',
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                textShadow: '0 0 5px rgba(0,255,255,0.5)',
                pointerEvents: 'auto'
              }}
            >
              X
            </div>
          )}
          {/* Logo de Fondo para Narrativa */}
          <img
            src="/assets/AlquimaLogo.svg"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '85%',
              opacity: WP4_LOGO_CONFIG.opacity,
              filter: WP4_LOGO_CONFIG.color === 'white' ? 'invert(1) brightness(2)' : 'none',
              pointerEvents: 'none',
              zIndex: -1
            }}
            alt="Alquimia Logo Background"
          />
          <div className='title-awakening' style={{
            fontSize: '10px',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            marginBottom: '20px',
            opacity: 0.5
          }}>
            {t.narrative.awakening.title}
          </div>
          <div className='awakeningText' style={{
            fontSize: '18px',
            fontStyle: 'italic',
            lineHeight: '1.6',
            fontWeight: '300',
            textShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
          }}>
            <p style={{ marginBottom: '15px' }}>{t.narrative.awakening.intro}</p>
            <p style={{ marginBottom: '15px' }}>{t.narrative.awakening.middle}</p>
            <p style={{ marginTop: '20px', fontWeight: '400', opacity: 0.8 }}>
              {t.narrative.awakening.truth}
              <br />
              <span style={{ color: '#fff', letterSpacing: '2px', textTransform: 'none' }}></span> {t.narrative.awakening.desc}
            </p>
          </div>
        </div>

        {/* Tooltip inferior izquierdo de WP4 */}
        <div className='catchLight'
          ref={wp4LightHintRef}
          style={{
            position: 'fixed',
            bottom: '-25vh',
            left: '-37vw',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '12px',
            letterSpacing: '2px',
            background: 'rgba(15, 95, 5, 0.5)',
            padding: '8px 20px',
            borderRadius: '5px',
            borderLeft: '2px solid #00ffff',
            whiteSpace: 'nowrap',
            zIndex: 10,
            opacity: 0,
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(0, 255, 255, 0.8)'
          }}
        >
          ...try to catch the light
        </div>

        {/* Drunk GPTing CTA & Tooltip Container */}
        <div className='DrunkGPtingButton'
          ref={drunkGptingBtnRef}
          style={{
            position: 'absolute',
            right: '20%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            opacity: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}
        >
          {/* Tooltip */}
          <div style={{
            opacity: isDrunkBtnHovered ? 1 : 0,
            transform: `translateY(${isDrunkBtnHovered ? '0px' : '10px'})`,
            transition: 'all 0.3s ease-out',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '12px',
            letterSpacing: '2px',
            background: 'rgba(15, 95, 5, 0.5)',
            padding: '5px 15px',
            borderRadius: '5px',
            borderLeft: '2px solid #00ffff',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(0, 255, 255, 0.8)'
          }}>
            To Hotel Herrera Drunk AI page
          </div>

          {/* Button */}
          <button
            onClick={handleDrunkGpting}
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid #00ffff',
              color: '#00ffff',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '14px',
              letterSpacing: '4px',
              padding: '15px 30px',
              borderRadius: '10rem',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)'
            }}
            onMouseEnter={(e) => {
              setIsDrunkBtnHovered(true)
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.15)'
              e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.5)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              setIsDrunkBtnHovered(false)
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Drunk GPTing
          </button>
        </div>

        {/* Tooltip para Exploded View (Deconstructed) */}
        {isExploded && !detailedPart && (
          <div className='tooltipMobile'
            style={{
              position: 'fixed',
              whiteSpace: 'nowrap',
              background: 'rgba(15, 95, 5, 0.5)',
              padding: '8px 20px',
              borderRadius: '5px',
              borderLeft: '2px solid #00ffff',
              bottom: '32vh',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#00ffff',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: '300',
              letterSpacing: '2px',
              fontSize: '12px',
              width: 'auto',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.6)',
              pointerEvents: 'none',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              backdropFilter: 'blur(5px)',
              borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px #00ffff)' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span style={{ letterSpacing: '3px' }}>{t.tooltips.click_select}</span>
          </div>
        )}

        <div
          ref={hudRef}
          style={{
            position: 'fixed',
            bottom: '-40vh',
            left: '5vw',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0,
            transition: 'opacity 0.3s ease',
            zIndex: 10
          }}
        >
          {/* Tooltip para el botón HUD */}
          <div style={{
            opacity: (isHudHovered && !isAnimatingCinematic) ? 1 : 0,
            transform: `translateY(${(isHudHovered && !isAnimatingCinematic) ? '-10px' : '0px'})`,
            transition: 'all 0.3s ease-out',
            color: '#00ffff',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '12px',
            letterSpacing: '2px',

            background: 'rgba(15, 95, 5, 0.5)',
            padding: '5px 15px',
            borderRadius: '5px',
            borderLeft: '2px solid #00ffff',
            marginBottom: '10px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(0, 255, 255, 0.8)'
          }}>
            {isArtifactActive
              ? (isExploded ? t.tooltips.press_assemble : t.tooltips.press_close)
              : t.tooltips.press_activate}
          </div>

          <div className='assembleMobile'
            onClick={() => {
              if (scrollPhase === 'intro') {
                // ACTIVAR: animar al WP3, luego desbloquear scroll para WP3↔WP4
                setIsAnimatingCinematic(true)
                setScrollPhase('artifact')
                setIsArtifactActive(true)
                gsap.to(targetScroll, {
                  current: 2.0,
                  duration: 5,
                  ease: 'power3.easeOut',
                  onUpdate: () => setTargetScrollStore(targetScroll.current),
                  onComplete: () => {
                    setIsAnimatingCinematic(false)
                  }
                })
              } else {
                if (isExploded) {
                  // Si están en "Exploded View" que vuelvan a su posición inicial
                  setIsExploded(false)
                } else {
                  // CERRAR: volver al WP2
                  setIsAnimatingCinematic(true)
                  gsap.killTweensOf(targetScroll)
                  setScrollPhase('intro')
                  setIsArtifactActive(false)
                  gsap.to(targetScroll, {
                    current: 1.0,
                    duration: 4,
                    ease: 'power2.inOut',
                    onUpdate: () => setTargetScrollStore(targetScroll.current),
                    onComplete: () => {
                      setIsAnimatingCinematic(false)
                    }
                  })
                }
              }
            }}
            style={{
              color: isArtifactActive ? '#ffffffff' : '#FFD700',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              textShadow: ' 5px 4px 4px rgba(0, 0, 0, 1)',
              background: 'rgba(0,0,0,0.8)',
              border: '2px solid #00ffff',
              borderRadius: '10rem',
              backdropFilter: 'blur(5px)',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: '300',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              pointerEvents: 'auto',
              textShadow: isArtifactActive ? '0 0 20px rgba(255, 77, 77, 0.6)' : '0 0 20px rgba(255, 215, 0, 0.6)',
              padding: '20px',
              transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}
            onMouseEnter={(e) => {
              setIsHudHovered(true)
              e.currentTarget.style.letterSpacing = '6px'
              e.currentTarget.style.textShadow = isArtifactActive ? '0 0 40px rgba(255, 77, 77, 0.9)' : '0 0 40px rgba(255, 215, 0, 0.9)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseLeave={(e) => {
              setIsHudHovered(false)
              e.currentTarget.style.letterSpacing = '4px'
              e.currentTarget.style.textShadow = isArtifactActive ? '0 0 20px rgba(255, 77, 77, 0.6)' : '0 0 20px rgba(255, 215, 0, 0.6)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            <span className='linesMobile' style={{
              width: '40px',
              height: '1px',
              background: isArtifactActive
                ? 'linear-gradient(90deg, transparent, #ff4d4d)'
                : 'linear-gradient(90deg, transparent, #FFD700)'
            }} />

            {isArtifactActive
              ? (isExploded ? t.inspect.assemble : <img src="/assets/CloseArtifact.svg" alt={t.tooltips.press_close} style={{ height: '50px', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(255, 77, 77, 0.4))' }} />)
              : <img src="/assets/WakeArtifact.svg" alt={t.tooltips.press_activate} style={{ height: '50px', width: 'auto', filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))', }} />}

            <span className='linesMobile' style={{
              width: '40px',
              height: '1px',
              background: isArtifactActive
                ? 'linear-gradient(90deg, #ff4d4d, transparent)'
                : 'linear-gradient(90deg, #FFD700, transparent)'
            }} />
          </div>
        </div>
      </Html >

      <Html pointerEvents="none" >
        <style>{`
          .sci-fi-tooltip {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            pointer-events: none;
            user-select: none;
            filter: drop-shadow(0 0 5px rgba(11, 80, 80, 0.88));
           
          }

          .tooltip-text {
            font-family: 'Outfit';
            font-size: 0.35rem;
            color: #00ffff;
            background: rgba(0, 255, 255, 0.1);
            padding: 0.3rem 0.7rem;
            border-radius: 10rem;
            white-space: nowrap;
            letter-spacing: 2px;
            
            transform: translateX(-50%) translateY(-100%);
            margin-bottom: 10px;
            animation: tooltipFadeIn 0.5s ease-out forwards;
            position: relative;
          }

          .tooltip-text::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 1px;
            background: linear-gradient(90deg, #00ffff, transparent);
          }

          .tooltip-line {
            width: 2px;
            height: 1px;
            background: #00ffff;
            transform-origin: left center;
            transform: rotate(135deg) translateX(-5px);
            animation: lineGrow 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
          }

          @keyframes tooltipFadeIn {
            from { opacity: 0; transform: translateX(-60%) translateY(-100%); }
            to { opacity: 1; transform: translateX(75%) translateY(-100%); }
          }

          @keyframes lineGrow {
            from { width: 0; }
            to { width: 30px; transform: translateX(158px) rotate(135deg) translateY(36px);}
          }

          .sci-fi-tooltip.mobile-tooltip {
            transform: scale(0.65);
          }
          .sci-fi-tooltip.mobile-tooltip .tooltip-line {
            width: 1.5px;
          }

          @keyframes smoothFlapGlow {
            0% { box-shadow: 0 0 4px rgba(0, 255, 255, 0.3); border-color: rgba(0, 255, 255, 0.5); }
            50% { box-shadow: 0 0 16px rgba(0, 255, 255, 0.8); border-color: rgba(0, 255, 255, 1); }
            100% { box-shadow: 0 0 4px rgba(0, 255, 255, 0.3); border-color: rgba(0, 255, 255, 0.5); }
          }
          
          .awakeningNarrative.expanded {
            transform: translateX(75%) translateY(65%) !important;
            transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
            width: 80vw !important;
            font-size: 8px !important;
          }

          /* ─── Paneles de narrativa de Inspección ─── */
          .narrativePanelRight {
            transform: translateY(-50%) translateX(100%);
            opacity: 0;
            pointer-events: none;
          }
          .narrativePanelRight.narrativePanel--expanded {
            transform: translateY(-50%) translateX(0%) !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }

          .narrativePanelLeft {
            transform: translateY(-50%) translateX(-100%);
            opacity: 0;
            pointer-events: none;
          }
          .narrativePanelLeft.narrativePanelLeft--expanded {
            transform: translateY(-50%) translateX(0%) !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }

          .narrativePanelRightSoul {
            position: fixed !important;
            right: -55vw !important;
            left: auto !important;
            transform: translateY(-50%) translateX(0px) !important;
            width: 80vw !important;
            max-width: 340px !important;
          }
          .narrativePanelLeftCatalyst {
            position: fixed !important;
            left: -50vw !important;
            right: auto !important;
            transform: translateY(-50%) translateX(0px) !important;
            width: 80vw !important;
            max-width: 340px !important;
          }
        
        `}</style>
      </Html>
    </>
  )
}



export default Experience

// Pre-carga de assets críticos para optimizar rendimiento y TTI (Time to Interactive)
useGLTF.preload('/assets/AlquimiaRoom_compressed.glb')
useGLTF.preload('/assets/AlquimiaArtifact_compressed.glb')
useGLTF.preload('/assets/reflectiveCircle.glb')
useGLTF.preload('/assets/Alquimia_collisions.glb')
