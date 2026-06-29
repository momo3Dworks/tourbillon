import { useEffect, useRef, useCallback } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { useAdvancedGLTF, globalActions } from './SceneModels'
import * as THREE from 'three'
import gsap from 'gsap'
import { useExploded } from './ExplodedContext'
import { waypointCameraState } from './CameraRig'
import { applyChunkExplosion } from './utils/ChunkExplode'
import { audioStore } from './store/audioStore'

// Helper: get value based on isMobile flag
const mob = (desktopVal, mobileVal) => audioStore.getState().isMobile ? mobileVal : desktopVal

const _camPos = new THREE.Vector3()

// ─── Meshes to apply procedural dynamic chunk explosion ──────────────────────
const CHUNK_EXPLODE_TARGETS = [
  // Add exact mesh names here, e.g. 'Tourbillon_Base'
  'TourbillonNorthOutter',
  'TourbillonSouthOutter'
]

// ─── Pieces that stay visible during Exploded View (East) ────────────────────
const EXPLODE_EAST_PIECE_NAMES = [
  'InnerRingEast',
  'InnerRingEast2',
  'AlquimiaCircleOuter',
  'AlquimiaTriangle',
  'AlquimiaCircleInner',
  'AlquimiaSquare',
  'AlquimiaTourbillonDome'
]
const ANIMATED_EAST_PIECE_NAMES = [
  'InnerRingEast',
  'InnerRingEast2',
  'AlquimiaCircleOuter', // carries AlquimiaTriangle→AlquimiaCircleInner→AlquimiaSquare with it
  'AlquimiaTourbillonDome'
]

// ─── Pieces that stay visible during Exploded View (North) ───────────────────
const EXPLODE_NORTH_PIECE_NAMES = [
  'TourbillonNorthOutter',
  'TourbillonNorthInner',
  'TourbillonNorthInnerG2',
  'TourbillonNorthInnerG3',
  'TourbillonNorthInnerG4',
]
const ANIMATED_NORTH_PIECE_NAMES = [
  'TourbillonNorthOutter',
  'TourbillonNorthInner',
  'TourbillonNorthInnerG2',
  'TourbillonNorthInnerG3',
  'TourbillonNorthInnerG4',
]

// Child meshes parented to TourbillonNorthInner — animated separately with a delay
const NORTH_INNER_CHILD_NAMES = [
  'TourbillonNorthBolt1',
  'TourbillonNorthBolt2',
  'TourbillonNorthBolt3',
  'TourbillonNorthCenter'
]

// ─── Pieces that stay visible during Exploded View (South) ───────────────────
const EXPLODE_SOUTH_PIECE_NAMES = [
  'TourbillonSouthOutter',
  'TourbillonSouthInner',
  'TourbillonSouthInnerG2',
  'TourbillonSouthInnerG3',
  'TourbillonSouthInnerG4',
  'TourbillonSouthBolt1',
  'TourbillonSouthBolt2',
  'TourbillonSouthBolt3',
  'TourbillonSouthCenter',
]
const ANIMATED_SOUTH_PIECE_NAMES = [
  'TourbillonSouthOutter',
  'TourbillonSouthInner',
  'TourbillonSouthInnerG2',
  'TourbillonSouthInnerG3',
  'TourbillonSouthInnerG4',
]

// Child meshes parented to TourbillonSouthInner — animated separately with a delay
const SOUTH_INNER_CHILD_NAMES = [
  'TourbillonSouthBolt1',
  'TourbillonSouthBolt2',
  'TourbillonSouthBolt3',
  'TourbillonSouthCenter'
]

// ─── Pieces that stay visible during Exploded View (West) ───────────────────
const EXPLODE_WEST_PIECE_NAMES = [
  'TourbillonWestWeigth',
  'Gear_1',
  'G3',
  'G5',
  'G1',
]
const ANIMATED_WEST_PIECE_NAMES = [
  'TourbillonWestWeigth',
  'Gear_1',
  'G3',
  'G5',
  'G1',
]

const EXPLODE_ALL_PIECE_NAMES = [...EXPLODE_EAST_PIECE_NAMES, ...EXPLODE_NORTH_PIECE_NAMES, ...EXPLODE_SOUTH_PIECE_NAMES, ...EXPLODE_WEST_PIECE_NAMES]

// ─── Staggered sweep timing (duration and delay per group, in seconds) ─────────
const EXPLODE_TIMING = {
  tunnelFloor: { duration: 2.5 },
  crystals: { duration: 2.5 },
  dome: { duration: 2.5 },
  system: { duration: 2.5 },
}
const COLLAPSE_TIMING = {
  system: { duration: 2.0 },
  dome: { duration: 2.0 },
  crystals: { duration: 2.0 },
  tunnelFloor: { duration: 2.0 },
}

const TourbillonAnimations = () => {
  const { camera, scene } = useThree()
  const {
    isExploded, setExploded,
    activeModal, setActiveModal,
    transitionProgress,         // legacy ref — kept for compat
    progressTunnelFloor,
    progressCrystals,
    progressDome,
    progressSystem,
    setTooltip,
    activeSection, setActiveSection,
    hoverTitle, setHoverTitle,
  } = useExploded()

  // Retrieve the cached gltfs
  const gltf = useAdvancedGLTF('/TourbillonMainSystem.glb')
  const domeGltf = useAdvancedGLTF('/TourbillonDome.glb')

  const pivotRef = useRef(null)
  const triggered = useRef(false)

  // Refs for hover / collider on TourbillonEast (no electric shader)
  const eastColliderRef = useRef(null)
  const eastOriginalMat = useRef(null)
  const isHoveredEast = useRef(false)

  // Refs for hover / collider on TourbillonNorth (unexploded)
  const northColliderRef = useRef(null)
  const isHoveredNorth = useRef(false)

  // Refs for hover / collider on TourbillonSouth (unexploded)
  const southColliderRef = useRef(null)
  const isHoveredSouth = useRef(false)

  // Refs for hover / collider on TourbillonWest (unexploded)
  const westColliderRef = useRef(null)
  const isHoveredWest = useRef(false)

  // Refs for exploded pieces
  const domeRef = useRef(null)
  const explodedPiecesRef = useRef({})

  // ── Exploded-view interactive pieces — hover / spin / click ─────────────
  // East Explode Refs
  const alquimiaColliderRef = useRef(null)
  const isHoveredAlquimia = useRef(false)
  const innerRingColliderRef = useRef(null)
  const isHoveredInnerRing = useRef(false)
  const domeColliderRef = useRef(null)
  const isHoveredDome = useRef(false)

  // North Explode Refs
  const northOutterColliderRef = useRef(null)
  const isHoveredNorthOutter = useRef(false)

  const northInnerColliderRef = useRef(null)
  const isHoveredNorthInner = useRef(false)

  const northG4ColliderRef = useRef(null)
  const isHoveredNorthG4 = useRef(false)

  const northG2ColliderRef = useRef(null)
  const isHoveredNorthG2 = useRef(false)

  const northG3ColliderRef = useRef(null)
  const isHoveredNorthG3 = useRef(false)

  // South Explode Refs
  const southOutterColliderRef = useRef(null)
  const isHoveredSouthOutter = useRef(false)

  const southInnerColliderRef = useRef(null)
  const isHoveredSouthInner = useRef(false)

  const southG4ColliderRef = useRef(null)
  const isHoveredSouthG4 = useRef(false)

  const southG2ColliderRef = useRef(null)
  const isHoveredSouthG2 = useRef(false)

  const southG3ColliderRef = useRef(null)
  const isHoveredSouthG3 = useRef(false)

  // West Explode Refs
  const westWeigthColliderRef = useRef(null)
  const isHoveredWestWeigth = useRef(false)

  const gear1ColliderRef = useRef(null)
  const isHoveredGear1 = useRef(false)

  const g3ColliderRef = useRef(null)
  const isHoveredG3 = useRef(false)

  const g5ColliderRef = useRef(null)
  const isHoveredG5 = useRef(false)

  const g1ColliderRef = useRef(null)
  const isHoveredG1 = useRef(false)

  // ── Leva toggle: enable/disable GridTransition + mesh de-rendering ──
  const { enableGridTransition } = useControls('Exploded View', {
    enableGridTransition: { value: true, label: 'Grid Transition + Desrenderizado' },
  })
  // Keep a ref so the effect can read the latest value without re-running
  const enableGTRef = useRef(true)
  useEffect(() => { enableGTRef.current = enableGridTransition }, [enableGridTransition])

  // ── Helper: toggle visibility of all non-exploded meshes across the entire scene ──
  const setNonExplodedMeshesVisible = useCallback((visible, activePieces = [], explicitlyExclude = []) => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      if (child.name === 'TourbillonEastCollider' || child.name === 'TourbillonNorthCollider') return

      let isExplodedPiece = false
      let curr = child
      while (curr) {
        if (activePieces.includes(curr.name)) {
          isExplodedPiece = true
        }
        if (explicitlyExclude.includes(curr.name)) {
          isExplodedPiece = false
          break // Exclusion overrides preservation
        }
        curr = curr.parent
      }

      if (!isExplodedPiece) {
        child.visible = visible
      }
    })
  }, [scene])

  // ── Helper: reset all progress refs to value and update shader uniforms immediately ──
  const forceAllProgressTo = useCallback((value) => {
    ;[progressTunnelFloor, progressCrystals, progressDome, progressSystem, transitionProgress].forEach(ref => {
      ref.current = value
    })
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((mat) => {
          if (mat.userData.gridTransitionProtected) return
          if (mat.userData.shader && mat.userData.shader.uniforms.uTransitionProgress) {
            mat.userData.shader.uniforms.uTransitionProgress.value = value
            mat.transparent = value > 0.001 || !!mat.userData.originalTransparent
          }
        })
      }
    })
  }, [scene, progressTunnelFloor, progressCrystals, progressDome, progressSystem, transitionProgress])

  // ── Traverse TourbillonMainSystem ─────────────────────────────────────────
  useEffect(() => {
    if (!gltf?.scene) return
    gltf.scene.traverse((child) => {
      // CenterPivot
      if (child.name === 'CenterPivot') {
        pivotRef.current = child
        if (child.userData.initialY === undefined) {
          child.userData.initialY = child.position.y
        }
      }

      // TourbillonEast collider — no electric shader
      if (child.name === 'TourbillonEast' && !child.userData.colliderCreated) {
        child.userData.colliderCreated = true
        eastOriginalMat.current = child.material

        child.geometry.computeBoundingSphere()
        const sphereGeom = new THREE.SphereGeometry(
          child.geometry.boundingSphere.radius * 1.4, 12, 12
        )
        const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, visible: false })
        const collider = new THREE.Mesh(sphereGeom, colliderMat)
        collider.name = 'TourbillonEastCollider'
        child.add(collider)
        eastColliderRef.current = collider
      }

      // TourbillonNorth collider — no electric shader
      if (child.name === 'TourbillonNorth' && !child.userData.colliderCreated) {
        child.userData.colliderCreated = true

        child.geometry.computeBoundingSphere()
        const sphereGeom = new THREE.SphereGeometry(
          child.geometry.boundingSphere.radius * 1.4, 12, 12
        )
        const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, visible: false })
        const collider = new THREE.Mesh(sphereGeom, colliderMat)
        collider.name = 'TourbillonNorthCollider'
        child.add(collider)
        northColliderRef.current = collider
      }

      // TourbillonSouth collider
      if (child.name === 'TourbillonSouth' && !child.userData.colliderCreated) {
        child.userData.colliderCreated = true
        child.geometry.computeBoundingSphere()
        const sphereGeom = new THREE.SphereGeometry(
          child.geometry.boundingSphere.radius * 1.4, 12, 12
        )
        const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, visible: false })
        const collider = new THREE.Mesh(sphereGeom, colliderMat)
        collider.name = 'TourbillonSouthCollider'
        child.add(collider)
        southColliderRef.current = collider
      }

      // TourbillonWest collider
      if (child.name === 'TourbillonWestWeigth' && !child.userData.colliderCreated) {
        child.userData.colliderCreated = true
        const box = new THREE.Box3().setFromObject(child)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)
        const radius = (Math.max(size.x, size.y, size.z) / 2) * 1.4
        const sphereGeom = new THREE.SphereGeometry(radius, 12, 12)
        const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, visible: false })
        const collider = new THREE.Mesh(sphereGeom, colliderMat)
        collider.name = 'TourbillonWestCollider'
        // Position the collider at the center of the box in local space
        collider.position.copy(center).sub(child.position)
        child.add(collider)
        westColliderRef.current = collider
      }


      // Exploded pieces (root)
      if (EXPLODE_ALL_PIECE_NAMES.includes(child.name)) {
        explodedPiecesRef.current[child.name] = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }
      // North Inner child pieces — track for separate delayed Y animation
      if (NORTH_INNER_CHILD_NAMES.includes(child.name)) {
        explodedPiecesRef.current[child.name] = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }
      // South Inner child pieces — track for separate delayed Y animation
      if (SOUTH_INNER_CHILD_NAMES.includes(child.name)) {
        explodedPiecesRef.current[child.name] = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }

      // Apply procedural chunk explosion if targeted
      if (child.isMesh && CHUNK_EXPLODE_TARGETS.includes(child.name)) {
        applyChunkExplosion(child, { seed: 42, proximity: 0.4, quantity: 25, area: 1.2 })
      }
      if (child.name === 'AlquimiaTourbillonDome') {
        domeRef.current = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }
    })
  }, [gltf])

  // ── Traverse TourbillonDome ───────────────────────────────────────────────
  useEffect(() => {
    if (!domeGltf?.scene) return
    domeGltf.scene.traverse((child) => {
      if (EXPLODE_ALL_PIECE_NAMES.includes(child.name)) {
        explodedPiecesRef.current[child.name] = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }
      if (child.name === 'AlquimiaTourbillonDome') {
        domeRef.current = child
        if (!child.userData.defaultPos) {
          child.userData.defaultPos = child.position.clone()
          child.userData.defaultRot = child.rotation.clone()
        }
      }
    })
  }, [domeGltf])

  // ── Explode / Collapse animation ─────────────────────────────────────────
  useEffect(() => {
    const pieces = explodedPiecesRef.current

    if (isExploded) { // 'east', 'north', or 'south'
      // Clean up hover state
      isHoveredEast.current = false
      isHoveredNorth.current = false
      isHoveredSouth.current = false
      isHoveredWest.current = false
      setHoverTitle(null)
      document.body.style.cursor = 'auto'

      // Keep GEARS running during exploded view, except CenterPivotRotation
      if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.inOut' })
      if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.inOut' })
      if (globalActions['GEARS__CenterPivotRotation']) gsap.to(globalActions['GEARS__CenterPivotRotation'], { timeScale: 0, duration: 1.5, ease: 'power2.inOut' })

      // Determine active pieces and excludes
      const activePieces =
        isExploded === 'east' ? EXPLODE_EAST_PIECE_NAMES :
          isExploded === 'south' ? EXPLODE_SOUTH_PIECE_NAMES :
            isExploded === 'west' ? EXPLODE_WEST_PIECE_NAMES :
              EXPLODE_NORTH_PIECE_NAMES
      const explicitlyExclude = isExploded === 'north' ? ['G1002'] : []

      // Kill existing tweens on animated pieces
      ANIMATED_EAST_PIECE_NAMES.forEach(name => {
        const m = pieces[name]
        if (m) { gsap.killTweensOf(m.position); gsap.killTweensOf(m.rotation) }
      })
      ANIMATED_NORTH_PIECE_NAMES.forEach(name => {
        const m = pieces[name]
        if (m) { gsap.killTweensOf(m.position); gsap.killTweensOf(m.rotation) }
      })
      ANIMATED_SOUTH_PIECE_NAMES.forEach(name => {
        const m = pieces[name]
        if (m) { gsap.killTweensOf(m.position); gsap.killTweensOf(m.rotation) }
      })
      ANIMATED_WEST_PIECE_NAMES.forEach(name => {
        const m = pieces[name]
        if (m) { gsap.killTweensOf(m.position); gsap.killTweensOf(m.rotation) }
      })
        ;[progressTunnelFloor, progressCrystals, progressDome, progressSystem].forEach(ref => {
          gsap.killTweensOf(ref)
        })

      if (enableGTRef.current) {
        forceAllProgressTo(0.0)
        setNonExplodedMeshesVisible(true, activePieces, explicitlyExclude)

        // ── Unison sweep per group ───────────────────────────────────────
        const totalDuration = EXPLODE_TIMING.tunnelFloor.duration

        const groups = [
          { ref: progressSystem, t: EXPLODE_TIMING.system },
          { ref: progressTunnelFloor, t: EXPLODE_TIMING.tunnelFloor },
          { ref: progressCrystals, t: EXPLODE_TIMING.crystals },
          { ref: progressDome, t: EXPLODE_TIMING.dome },

        ]

        const tl = gsap.timeline()
        groups.forEach(({ ref, t }) => {
          tl.to(ref, {
            current: 1.0,
            duration: t.duration,
            ease: 'power2.inOut',
          }, 0)
        })

        // When ALL groups have finished, hide non-exploded meshes
        gsap.delayedCall(totalDuration, () => {
          setNonExplodedMeshesVisible(false, activePieces, explicitlyExclude)
        })
      }

      // ── De-parent active root pieces ─────────────────────────────────
      const activeAnimPieces =
        isExploded === 'east' ? ANIMATED_EAST_PIECE_NAMES :
          isExploded === 'south' ? ANIMATED_SOUTH_PIECE_NAMES :
            isExploded === 'west' ? ANIMATED_WEST_PIECE_NAMES :
              ANIMATED_NORTH_PIECE_NAMES
      activeAnimPieces.forEach(name => {
        const mesh = pieces[name]
        if (mesh) {
          if (!mesh.userData.originalParent) {
            mesh.userData.originalParent = mesh.parent
          }
          scene.attach(mesh)
        }
      })

      if (isExploded === 'east') {
        if (pieces['AlquimiaTourbillonDome']) {
          gsap.to(pieces['AlquimiaTourbillonDome'].position, { x: mob(-0.05, 0), y: mob(4.5, 3), z: mob(6, 2), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['AlquimiaTourbillonDome'].rotation, {
            x: pieces['AlquimiaTourbillonDome'].userData.defaultRot.x,
            y: pieces['AlquimiaTourbillonDome'].userData.defaultRot.y,
            z: pieces['AlquimiaTourbillonDome'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }

        if (pieces['InnerRingEast']) {
          gsap.to(pieces['InnerRingEast'].position, { x: mob(2, 1), y: mob(4.8, 7.5), z: mob(7, 1), duration: 2.0, ease: 'power3.out' })
          gsap.to(pieces['InnerRingEast'].rotation, {
            x: pieces['InnerRingEast'].userData.defaultRot.x,
            y: pieces['InnerRingEast'].userData.defaultRot.y,
            z: pieces['InnerRingEast'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }

        ['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare'].forEach(name => {
          if (pieces[name]) {
            if (!pieces[name].userData.overrideRot) {
              pieces[name].userData.overrideRot = pieces[name].rotation.clone()
            }
            gsap.killTweensOf(pieces[name].userData.overrideRot)
            gsap.to(pieces[name].userData.overrideRot, {
              x: pieces[name].userData.defaultRot.x,
              y: pieces[name].userData.defaultRot.y,
              z: pieces[name].userData.defaultRot.z,
              duration: 3.0, ease: 'power3.out',
            })
          }
        })

        if (pieces['AlquimiaCircleOuter']) {
          gsap.to(pieces['AlquimiaCircleOuter'].position, { x: mob(-2, -1), y: mob(4.8, 5.4), z: mob(7, 2), duration: 2.0, ease: 'power3.out' })
        }
      } else if (isExploded === 'north') {
        // North exploded animations (WORLD SPACE)
        ANIMATED_NORTH_PIECE_NAMES.forEach(name => {
          const mesh = pieces[name]
          if (mesh) {
            gsap.killTweensOf(mesh.position)
            gsap.killTweensOf(mesh.rotation)
          }
        })

        if (pieces['TourbillonNorthOutter']) {
          gsap.to(pieces['TourbillonNorthOutter'].position, { x: mob(0, 0), y: mob(4.8, 7.3), z: mob(4.8, 1), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonNorthOutter'].rotation, {
            x: pieces['TourbillonNorthOutter'].userData.defaultRot.x + 1,
            y: pieces['TourbillonNorthOutter'].userData.defaultRot.y,
            z: pieces['TourbillonNorthOutter'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonNorthInner']) {
          gsap.to(pieces['TourbillonNorthInner'].position, { x: mob(3.4, 1), y: mob(4.8, 4.8), z: mob(4.8, 2), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonNorthInner'].rotation, {
            x: pieces['TourbillonNorthInner'].userData.defaultRot.x + 1,
            y: pieces['TourbillonNorthInner'].userData.defaultRot.y,
            z: pieces['TourbillonNorthInner'].userData.defaultRot.z,
            duration: 13.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonNorthInnerG4']) {
          gsap.to(pieces['TourbillonNorthInnerG4'].position, {
            x: mob(-3.5, -1), y: mob(4.8, 3.5), z: mob(5.8, 2), duration: 2.8, ease: 'power3.out'
          })
          gsap.to(pieces['TourbillonNorthInnerG4'].rotation, {
            x: pieces['TourbillonNorthInnerG4'].userData.defaultRot.x,
            y: pieces['TourbillonNorthInnerG4'].userData.defaultRot.y,
            z: pieces['TourbillonNorthInnerG4'].userData.defaultRot.z + 5,
            duration: 2.8, ease: 'power3.out',
          })

        }
        if (pieces['TourbillonNorthInnerG2']) {
          gsap.to(pieces['TourbillonNorthInnerG2'].position, { x: mob(-1.9, 0), y: mob(5.2, 3), z: mob(6.5, 4), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonNorthInnerG2'].rotation, {
            x: pieces['TourbillonNorthInnerG2'].userData.defaultRot.x,
            y: pieces['TourbillonNorthInnerG2'].userData.defaultRot.y + 5,
            z: pieces['TourbillonNorthInnerG2'].userData.defaultRot.z + 5,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonNorthInnerG3']) {
          gsap.to(pieces['TourbillonNorthInnerG3'].position, { x: mob(-3.5, 1), y: mob(5.5, 3.5), z: mob(5.8, 4), duration: 3.5, ease: 'power3.out' })
          gsap.to(pieces['TourbillonNorthInnerG3'].rotation, {
            x: pieces['TourbillonNorthInnerG3'].userData.defaultRot.x,
            y: pieces['TourbillonNorthInnerG3'].userData.defaultRot.y - 12,
            z: pieces['TourbillonNorthInnerG3'].userData.defaultRot.z + 3,
            duration: 3.3, ease: 'power3.out',
          })
        }

        // Do NOT modify their rotation so they keep their original orientation from Blender

        // ── Animate North Inner children with 1s delay after parent settles (3s + 1s = 4s) ──
        const northChildren = [
          { name: 'TourbillonNorthBolt1', delay: 2.0, yOffset: 0.4 },
          { name: 'TourbillonNorthBolt2', delay: 2.2, yOffset: 0.8 },
          { name: 'TourbillonNorthBolt3', delay: 2.4, yOffset: 1.0 },
          { name: 'TourbillonNorthCenter', delay: 2.6, yOffset: 1.1 },
        ];

        northChildren.forEach(({ name, delay, yOffset }) => {
          gsap.delayedCall(delay, () => {
            const child = pieces[name]
            if (!child) return
            gsap.killTweensOf(child.position)
            gsap.killTweensOf(child.rotation)
            if (child.userData.orbitObj) gsap.killTweensOf(child.userData.orbitObj)

            child.userData.orbitObj = { angle: 0 }

            gsap.to(child.position, {
              y: child.userData.defaultPos.y + yOffset,
              duration: 1.5,
              ease: 'power3.out',
              onComplete: () => {
                gsap.to(child.userData.orbitObj, {
                  angle: Math.PI * 2,
                  duration: 10,
                  ease: "none",
                  repeat: -1,
                  onUpdate: () => {
                    const a = child.userData.orbitObj.angle;
                    child.position.x = child.userData.defaultPos.x * Math.cos(a) - child.userData.defaultPos.z * Math.sin(a);
                    child.position.z = child.userData.defaultPos.x * Math.sin(a) + child.userData.defaultPos.z * Math.cos(a);
                    child.rotation.y = child.userData.defaultRot.y + a;
                  }
                });
              }
            })
          })
        });
      } else if (isExploded === 'south') {
        // ── South exploded animations (WORLD SPACE) ────────────────────
        ANIMATED_SOUTH_PIECE_NAMES.forEach(name => {
          const mesh = pieces[name]
          if (mesh) { gsap.killTweensOf(mesh.position); gsap.killTweensOf(mesh.rotation) }
        })

        if (pieces['TourbillonSouthOutter']) {
          gsap.to(pieces['TourbillonSouthOutter'].position, { x: mob(0, 0), y: mob(4.8, 7.3), z: mob(4.8, 1), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonSouthOutter'].rotation, {
            x: pieces['TourbillonSouthOutter'].userData.defaultRot.x + 1,
            y: pieces['TourbillonSouthOutter'].userData.defaultRot.y,
            z: pieces['TourbillonSouthOutter'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonSouthInner']) {
          gsap.to(pieces['TourbillonSouthInner'].position, { x: mob(3.4, 0.3), y: mob(4.8, 4.5), z: mob(4.8, 2), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonSouthInner'].rotation, {
            x: pieces['TourbillonSouthInner'].userData.defaultRot.x + 1,
            y: pieces['TourbillonSouthInner'].userData.defaultRot.y,
            z: pieces['TourbillonSouthInner'].userData.defaultRot.z,
            duration: 13.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonSouthInnerG4']) {
          gsap.to(pieces['TourbillonSouthInnerG4'].position, { x: mob(-3.2, 1.2), y: mob(4.8, 2.8), z: mob(5.8, 2), duration: 2.8, ease: 'power3.out' })
          gsap.to(pieces['TourbillonSouthInnerG4'].rotation, {
            x: pieces['TourbillonSouthInnerG4'].userData.defaultRot.x,
            y: pieces['TourbillonSouthInnerG4'].userData.defaultRot.y,
            z: pieces['TourbillonSouthInnerG4'].userData.defaultRot.z + 5,
            duration: 2.8, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonSouthInnerG2']) {
          gsap.to(pieces['TourbillonSouthInnerG2'].position, { x: mob(-2.3, 0), y: mob(4.8, 2.5), z: mob(5.8, 3), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonSouthInnerG2'].rotation, {
            x: pieces['TourbillonSouthInnerG2'].userData.defaultRot.x,
            y: pieces['TourbillonSouthInnerG2'].userData.defaultRot.y + 7,
            z: pieces['TourbillonSouthInnerG2'].userData.defaultRot.z + 5,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['TourbillonSouthInnerG3']) {
          gsap.to(pieces['TourbillonSouthInnerG3'].position, { x: mob(-3.5, -1), y: mob(5.4, 3.5), z: mob(5.8, 4), duration: 3.5, ease: 'power3.out' })
          gsap.to(pieces['TourbillonSouthInnerG3'].rotation, {
            x: pieces['TourbillonSouthInnerG3'].userData.defaultRot.x,
            y: pieces['TourbillonSouthInnerG3'].userData.defaultRot.y - 12,
            z: pieces['TourbillonSouthInnerG3'].userData.defaultRot.z + 3,
            duration: 3.3, ease: 'power3.out',
          })
        }

        // ── Animate South Inner children with staggered delay ─────────
        const southChildren = [
          { name: 'TourbillonSouthBolt1', delay: 2.0, yOffset: 0.4 },
          { name: 'TourbillonSouthBolt2', delay: 2.2, yOffset: 0.8 },
          { name: 'TourbillonSouthBolt3', delay: 2.4, yOffset: 1.0 },
          { name: 'TourbillonSouthCenter', delay: 2.6, yOffset: 1.1 },
        ];

        southChildren.forEach(({ name, delay, yOffset }) => {
          gsap.delayedCall(delay, () => {
            const child = pieces[name]
            if (!child) return
            gsap.killTweensOf(child.position)
            gsap.killTweensOf(child.rotation)
            if (child.userData.orbitObj) gsap.killTweensOf(child.userData.orbitObj)

            child.userData.orbitObj = { angle: 0 }

            gsap.to(child.position, {
              y: child.userData.defaultPos.y + yOffset,
              duration: 1.5,
              ease: 'power3.out',
              onComplete: () => {
                gsap.to(child.userData.orbitObj, {
                  angle: Math.PI * 2,
                  duration: 10,
                  ease: "none",
                  repeat: -1,
                  onUpdate: () => {
                    const a = child.userData.orbitObj.angle;
                    child.position.x = child.userData.defaultPos.x * Math.cos(a) - child.userData.defaultPos.z * Math.sin(a);
                    child.position.z = child.userData.defaultPos.x * Math.sin(a) + child.userData.defaultPos.z * Math.cos(a);
                    child.rotation.y = child.userData.defaultRot.y + a;
                  }
                });
              }
            })
          })
        });
      } else if (isExploded === 'west') {
        // ── West exploded animations (WORLD SPACE) ────────────────────
        ANIMATED_WEST_PIECE_NAMES.forEach(name => {
          const mesh = pieces[name]
          if (mesh) { gsap.killTweensOf(mesh.position); gsap.killTweensOf(mesh.rotation) }
        })

        // Fully stop the per-object animation actions so the mixer releases rotation control.
        // timeScale=0 is not enough — the mixer still writes the paused frame every tick.
        const westMeshNames = ['TourbillonWestWeigth', 'Gear_1', 'G3', 'G3_2', 'G5', 'G5_2', 'G1', 'G1_1', 'G1_2']
        westMeshNames.forEach(name => {
          globalActions[`GEARS__${name}`]?.stop?.()
          globalActions[`TOPGEARS__${name}`]?.stop?.()
        })

        if (pieces['TourbillonWestWeigth']) {
          gsap.to(pieces['TourbillonWestWeigth'].position, { x: mob(1, 0.5), y: mob(4.8, 7.5), z: mob(4.8, 2), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['TourbillonWestWeigth'].rotation, {
            x: pieces['TourbillonWestWeigth'].userData.defaultRot.x + 1,
            y: pieces['TourbillonWestWeigth'].userData.defaultRot.y + 1,
            z: pieces['TourbillonWestWeigth'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['Gear_1']) {
          gsap.to(pieces['Gear_1'].position, { x: mob(3, 1), y: mob(4.8, 2.8), z: mob(4.8, 3), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['Gear_1'].rotation, {
            x: pieces['Gear_1'].userData.defaultRot.x,
            y: pieces['Gear_1'].userData.defaultRot.y + 1.5,
            z: pieces['Gear_1'].userData.defaultRot.z + 1,
            duration: 13.0, ease: 'power3.out',
          })
        }
        if (pieces['G3']) {
          gsap.to(pieces['G3'].position, { x: mob(-2.5, -1.2), y: mob(4.8, 6), z: mob(5.8, 3), duration: 2.8, ease: 'power3.out' })
          gsap.to(pieces['G3'].rotation, {
            x: pieces['G3'].userData.defaultRot.x + 5,
            y: pieces['G3'].userData.defaultRot.y + 1,
            z: pieces['G3'].userData.defaultRot.z + 5,
            duration: 2.8, ease: 'power3.out',
          })
        }
        if (pieces['G5']) {
          gsap.to(pieces['G5'].position, { x: mob(-0.7, -0.4), y: mob(4.8, 4.5), z: mob(7.8, 6), duration: 3.0, ease: 'power3.out' })
          gsap.to(pieces['G5'].rotation, {
            x: pieces['G5'].userData.defaultRot.x + 1,
            y: pieces['G5'].userData.defaultRot.y,
            z: pieces['G5'].userData.defaultRot.z,
            duration: 3.0, ease: 'power3.out',
          })
        }
        if (pieces['G1']) {
          gsap.to(pieces['G1'].position, { x: mob(-3.5, -1), y: mob(5, 5), z: mob(5.8, 2), duration: 3.5, ease: 'power3.out' })
          gsap.to(pieces['G1'].rotation, {
            x: pieces['G1'].userData.defaultRot.x,
            y: pieces['G1'].userData.defaultRot.y + 2,
            z: pieces['G1'].userData.defaultRot.z + 1,
            duration: 3.3, ease: 'power3.out',
          })
        }
      }

      // ── Build invisible sphere colliders for interactive exploded pieces ─────
      const buildCollider = (mesh, refHolder, radiusScale = 1.3) => {
        if (!mesh) return
        const old = mesh.getObjectByName('__explodedCollider')
        if (old) mesh.remove(old)

        const box = new THREE.Box3().setFromObject(mesh)
        const center = new THREE.Vector3()
        const size = new THREE.Vector3()
        box.getCenter(center)
        box.getSize(size)
        const radius = (Math.max(size.x, size.y, size.z) / 2) * radiusScale

        const col = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 8, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, visible: false })
        )
        col.name = '__explodedCollider'
        col.position.copy(center).sub(mesh.position)
        mesh.add(col)
        refHolder.current = col
      }

      setTimeout(() => {
        if (isExploded === 'east') {
          buildCollider(pieces['AlquimiaCircleOuter'], alquimiaColliderRef, 0.9)
          buildCollider(pieces['InnerRingEast'], innerRingColliderRef, 0.85)
          buildCollider(pieces['AlquimiaTourbillonDome'], domeColliderRef, 0.9)
        } else if (isExploded === 'north') {
          buildCollider(pieces['TourbillonNorthOutter'], northOutterColliderRef, 0.85)
          buildCollider(pieces['TourbillonNorthInner'], northInnerColliderRef, 0.85)
          buildCollider(pieces['TourbillonNorthInnerG4'], northG4ColliderRef, 0.85)
          buildCollider(pieces['TourbillonNorthInnerG2'], northG2ColliderRef, 0.85)
          buildCollider(pieces['TourbillonNorthInnerG3'], northG3ColliderRef, 0.85)
        } else if (isExploded === 'south') {
          buildCollider(pieces['TourbillonSouthOutter'], southOutterColliderRef, 0.85)
          buildCollider(pieces['TourbillonSouthInner'], southInnerColliderRef, 0.85)
          buildCollider(pieces['TourbillonSouthInnerG4'], southG4ColliderRef, 0.85)
          buildCollider(pieces['TourbillonSouthInnerG2'], southG2ColliderRef, 0.85)
          buildCollider(pieces['TourbillonSouthInnerG3'], southG3ColliderRef, 0.85)
        } else if (isExploded === 'west') {
          buildCollider(pieces['TourbillonWestWeigth'], westWeigthColliderRef, 0.85)
          buildCollider(pieces['Gear_1'], gear1ColliderRef, 0.85)
          buildCollider(pieces['G3'], g3ColliderRef, 0.85)
          buildCollider(pieces['G5'], g5ColliderRef, 0.85)
          buildCollider(pieces['G1'], g1ColliderRef, 0.85)
        }
      }, 2200)

    } else {
      // ── Collapse ────────────────────────────────────────────────────
      waypointCameraState.hoveredObject = null
      // Reset section camera waypoint
      setActiveSection(null)
        ;[
          alquimiaColliderRef, innerRingColliderRef, domeColliderRef,
          northOutterColliderRef, northInnerColliderRef, northG4ColliderRef, northG2ColliderRef, northG3ColliderRef,
          southOutterColliderRef, southInnerColliderRef, southG4ColliderRef, southG2ColliderRef, southG3ColliderRef,
          westWeigthColliderRef, gear1ColliderRef, g3ColliderRef, g5ColliderRef, g1ColliderRef,
        ].forEach(ref => {
          if (ref.current) {
            ref.current.parent?.remove(ref.current)
            ref.current = null
          }
        })
      isHoveredAlquimia.current = false
      isHoveredInnerRing.current = false
      isHoveredDome.current = false
      isHoveredNorthOutter.current = false
      isHoveredNorthInner.current = false
      isHoveredNorthG4.current = false
      isHoveredNorthG2.current = false
      isHoveredNorthG3.current = false
      isHoveredSouthOutter.current = false
      isHoveredSouthInner.current = false
      isHoveredSouthG4.current = false
      isHoveredSouthG2.current = false
      isHoveredSouthG3.current = false
      isHoveredWestWeigth.current = false
      isHoveredGear1.current = false
      isHoveredG3.current = false
      isHoveredG5.current = false
      isHoveredG1.current = false
      setTooltip(null)
      document.body.style.cursor = 'auto'
      if (globalActions['GEARS'])
        gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
      if (globalActions['TOPGEARS'])
        gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
      if (globalActions['GEARS__CenterPivotRotation'])
        gsap.to(globalActions['GEARS__CenterPivotRotation'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })

          // Restore West per-object animations (stopped with .stop() on West explode)
          ;['TourbillonWestWeigth', 'Gear_1', 'G3', 'G3_2', 'G5', 'G5_2', 'G1', 'G1_1', 'G1_2'].forEach(name => {
            globalActions[`GEARS__${name}`]?.play?.()
            globalActions[`TOPGEARS__${name}`]?.play?.()
          })

      if (enableGTRef.current) {
        forceAllProgressTo(1.0)
      }

      // Always re-show all meshes (handles both GT-on and GT-off modes)
      setNonExplodedMeshesVisible(true, [], [])

      // Re-parent East, North, South and West pieces
      const allAnimatedPieces = [...ANIMATED_EAST_PIECE_NAMES, ...ANIMATED_NORTH_PIECE_NAMES, ...ANIMATED_SOUTH_PIECE_NAMES, ...ANIMATED_WEST_PIECE_NAMES]

      allAnimatedPieces.forEach(name => {
        const mesh = pieces[name]
        if (mesh && mesh.userData.originalParent) {
          mesh.userData.originalParent.attach(mesh)
          delete mesh.userData.originalParent
        }
      })

      allAnimatedPieces.forEach(name => {
        const mesh = pieces[name]
        if (mesh && mesh.userData.defaultPos) {
          gsap.killTweensOf(mesh.position)
          gsap.killTweensOf(mesh.rotation)
          gsap.to(mesh.position, {
            x: mesh.userData.defaultPos.x,
            y: mesh.userData.defaultPos.y,
            z: mesh.userData.defaultPos.z,
            duration: 2.0, ease: 'power2.inOut',
          })
          gsap.to(mesh.rotation, {
            x: mesh.userData.defaultRot.x,
            y: mesh.userData.defaultRot.y,
            z: mesh.userData.defaultRot.z,
            duration: 2.0, ease: 'power2.inOut',
          })
        }
      })

      // Also return North Inner children to their defaultPos
      gsap.killTweensOf(NORTH_INNER_CHILD_NAMES)
      NORTH_INNER_CHILD_NAMES.forEach(name => {
        const child = pieces[name]
        if (child && child.userData.defaultPos) {
          gsap.killTweensOf(child.position)
          gsap.killTweensOf(child.rotation)
          if (child.userData.orbitObj) gsap.killTweensOf(child.userData.orbitObj)
          gsap.to(child.position, {
            x: child.userData.defaultPos.x,
            y: child.userData.defaultPos.y,
            z: child.userData.defaultPos.z,
            duration: 2.0, ease: 'power2.inOut',
          })
          gsap.to(child.rotation, {
            x: child.userData.defaultRot.x,
            y: child.userData.defaultRot.y,
            z: child.userData.defaultRot.z,
            duration: 2.0, ease: 'power2.inOut',
          })
        }
      })

      // Also return South Inner children to their defaultPos
      gsap.killTweensOf(SOUTH_INNER_CHILD_NAMES)
      SOUTH_INNER_CHILD_NAMES.forEach(name => {
        const child = pieces[name]
        if (child && child.userData.defaultPos) {
          gsap.killTweensOf(child.position)
          gsap.killTweensOf(child.rotation)
          if (child.userData.orbitObj) gsap.killTweensOf(child.userData.orbitObj)
          gsap.to(child.position, {
            x: child.userData.defaultPos.x,
            y: child.userData.defaultPos.y,
            z: child.userData.defaultPos.z,
            duration: 2.0, ease: 'power2.inOut',
          })
          gsap.to(child.rotation, {
            x: child.userData.defaultRot.x,
            y: child.userData.defaultRot.y,
            z: child.userData.defaultRot.z,
            duration: 2.0, ease: 'power2.inOut',
          })
        }
      })

      const groups = [
        { ref: progressSystem, t: COLLAPSE_TIMING.system },
        { ref: progressDome, t: COLLAPSE_TIMING.dome },
        { ref: progressCrystals, t: COLLAPSE_TIMING.crystals },
        { ref: progressTunnelFloor, t: COLLAPSE_TIMING.tunnelFloor },
      ]
        ;[progressTunnelFloor, progressCrystals, progressDome, progressSystem].forEach(ref => {
          gsap.killTweensOf(ref)
        })
      const tl = gsap.timeline()
      groups.forEach(({ ref, t }) => {
        tl.to(ref, {
          current: 0.0,
          duration: t.duration,
          ease: 'power2.inOut',
        }, 0)
      })
    }
  }, [isExploded, scene, forceAllProgressTo, setNonExplodedMeshesVisible,
    progressTunnelFloor, progressCrystals, progressDome, progressSystem, setTooltip, setActiveSection])

  // ── Per-frame logic ───────────────────────────────────────────────────────
  const _raycaster = new THREE.Raycaster()

  useFrame((state, delta) => {

    if (pivotRef.current) {
      camera.getWorldPosition(_camPos)
      const cameraY = _camPos.y
      const isTriggered = cameraY <= 20.0
      if (isTriggered && !triggered.current) {
        triggered.current = true
        gsap.killTweensOf(pivotRef.current.position)
        gsap.to(pivotRef.current.position, {
          y: pivotRef.current.userData.initialY + 2.0,
          duration: 1.5, delay: 1.25, ease: 'bounce.out',
        })
      } else if (!isTriggered && triggered.current) {
        triggered.current = false
        gsap.killTweensOf(pivotRef.current.position)
        gsap.to(pivotRef.current.position, {
          y: pivotRef.current.userData.initialY,
          duration: 1.0, ease: 'power2.inOut',
        })
      }
    }

    if (!isExploded) {
      _raycaster.setFromCamera(state.mouse, state.camera)
      // East hover
      const eastTarget = eastColliderRef.current
      if (eastTarget) {
        const intersects = _raycaster.intersectObject(eastTarget, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredEast.current) {
          isHoveredEast.current = true
          document.body.style.cursor = 'pointer'
          setHoverTitle('THEapothecary')
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (domeRef.current) {
            gsap.killTweensOf(domeRef.current.rotation)
            gsap.to(domeRef.current.rotation, {
              x: (domeRef.current.userData.defaultRot?.x ?? 0) + Math.PI,
              duration: 1.5, ease: 'power2.inOut',
            })
          }
        } else if (!currentlyHovered && isHoveredEast.current) {
          isHoveredEast.current = false
          document.body.style.cursor = 'auto'
          setHoverTitle(null)
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (domeRef.current) {
            gsap.killTweensOf(domeRef.current.rotation)
            gsap.to(domeRef.current.rotation, {
              x: domeRef.current.userData.defaultRot?.x ?? 0,
              duration: 1.5, ease: 'power2.inOut',
            })
          }
        }
      }

      // North hover
      const northTarget = northColliderRef.current
      if (northTarget) {
        const intersects = _raycaster.intersectObject(northTarget, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredNorth.current) {
          isHoveredNorth.current = true
          document.body.style.cursor = 'pointer'
          setHoverTitle('THEhotel')
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
        } else if (!currentlyHovered && isHoveredNorth.current) {
          isHoveredNorth.current = false
          document.body.style.cursor = 'auto'
          setHoverTitle(null)
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
        }
      }

      // South hover
      const southTarget = southColliderRef.current
      if (southTarget) {
        const intersects = _raycaster.intersectObject(southTarget, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredSouth.current) {
          isHoveredSouth.current = true
          document.body.style.cursor = 'pointer'
          setHoverTitle('THEstore')
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
        } else if (!currentlyHovered && isHoveredSouth.current) {
          isHoveredSouth.current = false
          document.body.style.cursor = 'auto'
          setHoverTitle(null)
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
        }
      }

      // West hover
      const westTarget = westColliderRef.current
      if (westTarget) {
        const intersects = _raycaster.intersectObject(westTarget, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredWest.current) {
          isHoveredWest.current = true
          document.body.style.cursor = 'pointer'
          setHoverTitle('Food & Beverage')
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
        } else if (!currentlyHovered && isHoveredWest.current) {
          isHoveredWest.current = false
          document.body.style.cursor = 'auto'
          setHoverTitle(null)
          if (globalActions['GEARS']) gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS']) gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
        }
      }
    } else {
      // If we are in an exploded view, force reset all unexploded hover refs
      // This prevents accidental clicks when clicking the "Back" button
      if (isHoveredEast.current) isHoveredEast.current = false
      if (isHoveredNorth.current) isHoveredNorth.current = false
      if (isHoveredSouth.current) isHoveredSouth.current = false
      if (isHoveredWest.current) isHoveredWest.current = false
    }

    if (isExploded === 'east') {
      if (activeModal) {
        if (isHoveredAlquimia.current || isHoveredInnerRing.current) {
          isHoveredAlquimia.current = false
          isHoveredInnerRing.current = false
          waypointCameraState.hoveredObject = null
          setTooltip(null)
          document.body.style.cursor = 'auto'
        }
      } else {
        _raycaster.setFromCamera(state.mouse, state.camera)

        const alquimiaCollider = alquimiaColliderRef.current
        const alquimiaMesh = explodedPiecesRef.current['AlquimiaCircleOuter']
        if (alquimiaCollider) {
          const hit = _raycaster.intersectObject(alquimiaCollider, false).length > 0

          if (hit && !isHoveredAlquimia.current) {
            isHoveredAlquimia.current = true
            document.body.style.cursor = 'pointer'
            setTooltip({ text: 'Go to Alquimia Apothecary' })
            waypointCameraState.hoveredObject = 'AlquimiaCircleOuter'
            const childNames = ['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare']
            childNames.forEach(name => {
              const m = explodedPiecesRef.current[name]
              if (m && m.userData.overrideRot) {
                gsap.killTweensOf(m.userData.overrideRot)
              }
            })
            if (CHUNK_EXPLODE_TARGETS.includes('AlquimiaCircleOuter') && alquimiaMesh && alquimiaMesh.material.userData.uChunkProgress) {
              gsap.killTweensOf(alquimiaMesh.material.userData.uChunkProgress)
              gsap.to(alquimiaMesh.material.userData.uChunkProgress, { value: 1.0, duration: 0.8, ease: 'power2.out' })
            }
          } else if (!hit && isHoveredAlquimia.current) {
            isHoveredAlquimia.current = false
            document.body.style.cursor = 'auto'
            setTooltip(null)
            if (waypointCameraState.hoveredObject === 'AlquimiaCircleOuter') {
              waypointCameraState.hoveredObject = null
            }

            // Return rotation smoothly
            const childNames = ['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare']
            childNames.forEach(name => {
              const m = explodedPiecesRef.current[name]
              if (m && m.userData.overrideRot) {
                gsap.killTweensOf(m.userData.overrideRot)
                gsap.to(m.userData.overrideRot, {
                  x: m.userData.defaultRot.x,
                  y: m.userData.defaultRot.y,
                  z: m.userData.defaultRot.z,
                  duration: 1.0, ease: 'power2.out',
                })
              }
            })
            if (CHUNK_EXPLODE_TARGETS.includes('AlquimiaCircleOuter') && alquimiaMesh && alquimiaMesh.material.userData.uChunkProgress) {
              gsap.killTweensOf(alquimiaMesh.material.userData.uChunkProgress)
              gsap.to(alquimiaMesh.material.userData.uChunkProgress, { value: 0.0, duration: 0.8, ease: 'power2.out' })
            }
          }

          if (isHoveredAlquimia.current && alquimiaMesh) {
            const speed = 5.6
            if (!alquimiaMesh.userData.overrideRot) alquimiaMesh.userData.overrideRot = alquimiaMesh.rotation.clone()
            alquimiaMesh.userData.overrideRot.y += delta * speed
            alquimiaMesh.userData.overrideRot.x += delta * speed * 0.3

            const childNames = ['AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare']
            childNames.forEach((n, i) => {
              const m = explodedPiecesRef.current[n]
              if (m) {
                const dir = i % 2 === 0 ? 1 : -1
                if (!m.userData.overrideRot) m.userData.overrideRot = m.rotation.clone()
                m.userData.overrideRot.y += delta * speed * dir * (1 + i * 0.2)
                m.userData.overrideRot.z += delta * speed * 0.2 * dir
              }
            })
          }
        }

        const innerCollider = innerRingColliderRef.current
        const innerMesh = explodedPiecesRef.current['InnerRingEast']
        if (innerCollider) {
          const hit = _raycaster.intersectObject(innerCollider, false).length > 0

          if (hit && !isHoveredInnerRing.current) {
            isHoveredInnerRing.current = true
            document.body.style.cursor = 'pointer'
            setTooltip({ text: 'The Science / Information' })
            waypointCameraState.hoveredObject = 'InnerRingEast'
            if (innerMesh) gsap.killTweensOf(innerMesh.rotation)
            if (CHUNK_EXPLODE_TARGETS.includes('InnerRingEast') && innerMesh && innerMesh.material.userData.uChunkProgress) {
              gsap.killTweensOf(innerMesh.material.userData.uChunkProgress)
              gsap.to(innerMesh.material.userData.uChunkProgress, { value: 1.0, duration: 0.8, ease: 'power2.out' })
            }
          } else if (!hit && isHoveredInnerRing.current) {
            isHoveredInnerRing.current = false
            document.body.style.cursor = 'auto'
            setTooltip(null)
            if (waypointCameraState.hoveredObject === 'InnerRingEast') {
              waypointCameraState.hoveredObject = null
            }

            if (innerMesh) {
              gsap.killTweensOf(innerMesh.rotation)
              gsap.to(innerMesh.rotation, {
                x: innerMesh.userData.defaultRot.x,
                y: innerMesh.userData.defaultRot.y,
                z: innerMesh.userData.defaultRot.z,
                duration: 1.0, ease: 'power2.out',
              })
            }
            if (CHUNK_EXPLODE_TARGETS.includes('InnerRingEast') && innerMesh && innerMesh.material.userData.uChunkProgress) {
              gsap.killTweensOf(innerMesh.material.userData.uChunkProgress)
              gsap.to(innerMesh.material.userData.uChunkProgress, { value: 0.0, duration: 0.8, ease: 'power2.out' })
            }
          }

          if (isHoveredInnerRing.current && innerMesh) {
            innerMesh.rotation.y += delta * 5.7
            innerMesh.rotation.x += delta * 3.25
          }
        }

        const domeCollider = domeColliderRef.current
        const domeMesh = explodedPiecesRef.current['AlquimiaTourbillonDome']
        if (domeCollider) {
          const hit = _raycaster.intersectObject(domeCollider, false).length > 0
          if (hit && !isHoveredDome.current) {
            isHoveredDome.current = true
            document.body.style.cursor = 'pointer'
            setTooltip({ text: 'The Store (Buy Nootropics)' })
            waypointCameraState.hoveredObject = 'AlquimiaTourbillonDome'
            if (domeMesh) {
              gsap.killTweensOf(domeMesh.position)
              gsap.to(domeMesh.position, { y: '+=0.03', duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
            }
          } else if (!hit && isHoveredDome.current) {
            isHoveredDome.current = false
            document.body.style.cursor = 'auto'
            setTooltip(null)
            if (waypointCameraState.hoveredObject === 'AlquimiaTourbillonDome') {
              waypointCameraState.hoveredObject = null
            }
            if (domeMesh) {
              gsap.killTweensOf(domeMesh.position)
              gsap.to(domeMesh.position, { y: 4.8, duration: 1.0, ease: 'power2.out' })
            }
          }
          if (isHoveredDome.current && domeMesh) {
            domeMesh.rotation.y += delta * 1.0
          }
        }
      }

      ;['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare'].forEach(name => {
        const mesh = explodedPiecesRef.current[name]
        if (mesh && mesh.userData.overrideRot) {
          mesh.rotation.copy(mesh.userData.overrideRot)
        }
      })
    }

    if (isExploded === 'north') {
      if (activeModal) {
        if (isHoveredNorthOutter.current || isHoveredNorthInner.current || isHoveredNorthG4.current) {
          isHoveredNorthOutter.current = false
          isHoveredNorthInner.current = false
          isHoveredNorthG4.current = false
          waypointCameraState.hoveredObject = null
          setTooltip(null)
          document.body.style.cursor = 'auto'
        }
      } else {
        _raycaster.setFromCamera(state.mouse, state.camera)

        const updateNorthPiece = (colliderRef, isHoveredRef, meshName, tooltipText) => {
          const collider = colliderRef.current
          const mesh = explodedPiecesRef.current[meshName]
          if (collider && mesh) {
            const hit = _raycaster.intersectObject(collider, false).length > 0

            if (hit && !isHoveredRef.current) {
              isHoveredRef.current = true
              document.body.style.cursor = 'pointer'
              setTooltip({ text: tooltipText })
              waypointCameraState.hoveredObject = meshName
              gsap.killTweensOf(mesh.position)
              gsap.to(mesh.position, { y: '+=0.03', duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 1.0, duration: 0.8, ease: 'power2.out' })
              }
            } else if (!hit && isHoveredRef.current) {
              isHoveredRef.current = false
              document.body.style.cursor = 'auto'
              setTooltip(null)
              if (waypointCameraState.hoveredObject === meshName) waypointCameraState.hoveredObject = null
              if (mesh.userData.worldExplodedY !== undefined) {
                gsap.killTweensOf(mesh.position)
                gsap.to(mesh.position, { y: mesh.userData.worldExplodedY, duration: 1.0, ease: 'power2.out' })
              }
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 0.0, duration: 0.8, ease: 'power2.out' })
              }
            }
            if (isHoveredRef.current) mesh.rotation.y += delta * 1.0
          }
        }

        updateNorthPiece(northOutterColliderRef, isHoveredNorthOutter, 'TourbillonNorthOutter', 'Book a Room')
        updateNorthPiece(northInnerColliderRef, isHoveredNorthInner, 'TourbillonNorthInner', 'THEsuites')
        updateNorthPiece(northG4ColliderRef, isHoveredNorthG4, 'TourbillonNorthInnerG4', 'Events / General Info')
        updateNorthPiece(northG2ColliderRef, isHoveredNorthG2, 'TourbillonNorthInnerG2', 'THEadventures')
        updateNorthPiece(northG3ColliderRef, isHoveredNorthG3, 'TourbillonNorthInnerG3', 'Events / General Info')
      }
    }

    if (isExploded === 'south') {
      if (activeModal) {
        if (isHoveredSouthOutter.current || isHoveredSouthInner.current || isHoveredSouthG4.current || isHoveredSouthG2.current || isHoveredSouthG3.current) {
          isHoveredSouthOutter.current = false
          isHoveredSouthInner.current = false
          isHoveredSouthG4.current = false
          isHoveredSouthG2.current = false
          isHoveredSouthG3.current = false
          waypointCameraState.hoveredObject = null
          setTooltip(null)
          document.body.style.cursor = 'auto'
        }
      } else {
        _raycaster.setFromCamera(state.mouse, state.camera)

        const updateSouthPiece = (colliderRef, isHoveredRef, meshName, tooltipText) => {
          const collider = colliderRef.current
          const mesh = explodedPiecesRef.current[meshName]
          if (collider && mesh) {
            const hit = _raycaster.intersectObject(collider, false).length > 0

            if (hit && !isHoveredRef.current) {
              isHoveredRef.current = true
              document.body.style.cursor = 'pointer'
              setTooltip({ text: tooltipText })
              waypointCameraState.hoveredObject = meshName
              gsap.killTweensOf(mesh.position)
              gsap.to(mesh.position, { y: '+=0.03', duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 1.0, duration: 0.8, ease: 'power2.out' })
              }
            } else if (!hit && isHoveredRef.current) {
              isHoveredRef.current = false
              document.body.style.cursor = 'auto'
              setTooltip(null)
              if (waypointCameraState.hoveredObject === meshName) waypointCameraState.hoveredObject = null
              if (mesh.userData.worldExplodedY !== undefined) {
                gsap.killTweensOf(mesh.position)
                gsap.to(mesh.position, { y: mesh.userData.worldExplodedY, duration: 1.0, ease: 'power2.out' })
              }
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 0.0, duration: 0.8, ease: 'power2.out' })
              }
            }
            if (isHoveredRef.current) mesh.rotation.y += delta * 1.0
          }
        }

        updateSouthPiece(southOutterColliderRef, isHoveredSouthOutter, 'TourbillonSouthOutter', 'Merch/Apparel')
        updateSouthPiece(southInnerColliderRef, isHoveredSouthInner, 'TourbillonSouthInner', 'The Codex / Drunk GPT\'ing')
        updateSouthPiece(southG4ColliderRef, isHoveredSouthG4, 'TourbillonSouthInnerG4', 'Sacred Symbols / Our Story')
        updateSouthPiece(southG2ColliderRef, isHoveredSouthG2, 'TourbillonSouthInnerG2', 'Sacred Symbols / Our Story')
        updateSouthPiece(southG3ColliderRef, isHoveredSouthG3, 'TourbillonSouthInnerG3', 'Sacred Symbols / Our Story')
      }
    }

    if (isExploded === 'west') {
      if (activeModal) {
        if (isHoveredWestWeigth.current || isHoveredGear1.current || isHoveredG3.current || isHoveredG5.current || isHoveredG1.current) {
          isHoveredWestWeigth.current = false
          isHoveredGear1.current = false
          isHoveredG3.current = false
          isHoveredG5.current = false
          isHoveredG1.current = false
          waypointCameraState.hoveredObject = null
          setTooltip(null)
          document.body.style.cursor = 'auto'
        }
      } else {
        _raycaster.setFromCamera(state.mouse, state.camera)

        const updateWestPiece = (colliderRef, isHoveredRef, meshName, tooltipText) => {
          const collider = colliderRef.current
          const mesh = explodedPiecesRef.current[meshName]
          if (collider && mesh) {
            const hit = _raycaster.intersectObject(collider, false).length > 0

            if (hit && !isHoveredRef.current) {
              isHoveredRef.current = true
              document.body.style.cursor = 'pointer'
              setTooltip({ text: tooltipText })
              waypointCameraState.hoveredObject = meshName
              gsap.killTweensOf(mesh.position)
              gsap.to(mesh.position, { y: '+=0.03', duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 1.0, duration: 0.8, ease: 'power2.out' })
              }
            } else if (!hit && isHoveredRef.current) {
              isHoveredRef.current = false
              document.body.style.cursor = 'auto'
              setTooltip(null)
              if (waypointCameraState.hoveredObject === meshName) waypointCameraState.hoveredObject = null
              if (mesh.userData.worldExplodedY !== undefined) {
                gsap.killTweensOf(mesh.position)
                gsap.to(mesh.position, { y: mesh.userData.worldExplodedY, duration: 1.0, ease: 'power2.out' })
              }
              if (CHUNK_EXPLODE_TARGETS.includes(meshName) && mesh.material.userData.uChunkProgress) {
                gsap.killTweensOf(mesh.material.userData.uChunkProgress)
                gsap.to(mesh.material.userData.uChunkProgress, { value: 0.0, duration: 0.8, ease: 'power2.out' })
              }
            }
            if (isHoveredRef.current) mesh.rotation.y += delta * 1.0
          }
        }

        updateWestPiece(westWeigthColliderRef, isHoveredWestWeigth, 'TourbillonWestWeigth', 'Menus & Reservations')
        updateWestPiece(gear1ColliderRef, isHoveredGear1, 'Gear_1', 'THErestaurant')
        updateWestPiece(g3ColliderRef, isHoveredG3, 'G3', 'THEbar & THEmartini-bar')
        updateWestPiece(g5ColliderRef, isHoveredG5, 'G5', 'THEbag (Delivery/Sandwiches)')
        updateWestPiece(g1ColliderRef, isHoveredG1, 'G1', 'THEcatering & Tastings')
      }
    }
  })

  // ── Click handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onClick = (e) => {
      if (e.target.tagName !== 'CANVAS') return
      if (activeModal) {
        return
      }

      if (!isExploded) {
        if (isHoveredEast.current) {
          setExploded('east')
          document.body.style.cursor = 'auto'
        } else if (isHoveredNorth.current) {
          setExploded('north')
          document.body.style.cursor = 'auto'
        } else if (isHoveredSouth.current) {
          setExploded('south')
          document.body.style.cursor = 'auto'
        } else if (isHoveredWest.current) {
          setExploded('west')
          document.body.style.cursor = 'auto'
        }
        return
      }


      if (isExploded === 'east') {
        if (isHoveredAlquimia.current) {
          window.open('https://hotelherrera.com/alquimia', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredInnerRing.current) {
          setActiveModal('science')
          return
        }
        if (isHoveredDome.current) {
          setActiveSection('events')
          setActiveModal('nootropics')
          return
        }
      } else if (isExploded === 'north') {
        if (isHoveredNorthOutter.current) {
          window.open('https://live.ipms247.com/booking/book-rooms-hotelherrera', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredNorthInner.current) {
          window.open('https://hotelherrera.com/suites-casco-viejo/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredNorthG4.current) {
          window.open('https://hotelherrera.com/the-reaping/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredNorthG2.current) {
          setActiveSection('adventures')
          setActiveModal('adventures_coming_soon')
          return
        }
        if (isHoveredNorthG3.current) {
          window.open('https://hotelherrera.com/the-reaping/', '_blank', 'noopener,noreferrer')
          return
        }
      } else if (isExploded === 'south') {
        if (isHoveredSouthOutter.current) {
          setActiveSection('bookroom')
          setActiveModal('merch_apparel')
          return
        }
        if (isHoveredSouthInner.current) {
          window.open('https://hotelherrera.com/drunk-gpting/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredSouthG4.current) {
          window.open('https://hotelherrera.com/sacred-symbols/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredSouthG2.current) {
          window.open('https://hotelherrera.com/sacred-symbols/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredSouthG3.current) {
          window.open('https://hotelherrera.com/sacred-symbols/', '_blank', 'noopener,noreferrer')
          return
        }
      } else if (isExploded === 'west') {
        if (isHoveredWestWeigth.current) {
          window.open('https://hotelherrera.com/elrestaurant-menu/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredGear1.current) {
          window.open('https://hotelherrera.com/restaurant/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredG3.current) {
          window.open('https://hotelherrera.com/themartinibar/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredG5.current) {
          window.open('https://hotelherrera.com/thebag/', '_blank', 'noopener,noreferrer')
          return
        }
        if (isHoveredG1.current) {
          setActiveSection('catering')
          setActiveModal('catering')
          return
        }
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [isExploded, activeModal, setExploded, setActiveModal, setActiveSection])

  return null
}

export default TourbillonAnimations
