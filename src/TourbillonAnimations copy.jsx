import { useEffect, useRef, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAdvancedGLTF, globalActions } from './SceneModels'
import * as THREE from 'three'
import gsap from 'gsap'
import { useExploded } from './ExplodedContext'

const _camPos = new THREE.Vector3()

// ─── Pieces that stay visible during Exploded View ────────────────────────────
const EXPLODE_PIECE_NAMES = [
  'InnerRingEast',
  'InnerRingEast2',
  'AlquimiaCircleOuter',
  'AlquimiaTriangle',
  'AlquimiaCircleInner',
  'AlquimiaSquare',
]

// Root pieces that are animated and de-parented (children of these retain their hierarchy)
const ANIMATED_PIECE_NAMES = [
  'InnerRingEast',
  'InnerRingEast2',
  'AlquimiaCircleOuter', // carries AlquimiaTriangle→AlquimiaCircleInner→AlquimiaSquare with it
]

// ─── Staggered sweep timing (duration and delay per group, in seconds) ─────────
// Explode order: unison
const EXPLODE_TIMING = {
  tunnelFloor: { duration: 2.5 },
  crystals: { duration: 2.5 },
  dome: { duration: 2.5 },
  system: { duration: 2.5 },
}
// Collapse order: unison
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
    transitionProgress,         // legacy ref — kept for compat
    progressTunnelFloor,
    progressCrystals,
    progressDome,
    progressSystem,
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

  // Refs for exploded pieces
  const domeRef = useRef(null)
  const explodedPiecesRef = useRef({})

  // ── Helper: toggle visibility of all non-exploded meshes across the entire scene ──
  const setNonExplodedMeshesVisible = useCallback((visible) => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      if (child.name === 'TourbillonEastCollider') return

      // Walk up the ancestor chain — if any ancestor is an exploded piece, preserve it
      let isExplodedPiece = false
      let curr = child
      while (curr) {
        if (EXPLODE_PIECE_NAMES.includes(curr.name)) {
          isExplodedPiece = true
          break
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
          // gridTransitionProtected = cloned material on exploded pieces — never dissolve them
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
        const colliderMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          visible: false,
        })
        const collider = new THREE.Mesh(sphereGeom, colliderMat)
        collider.name = 'TourbillonEastCollider'
        child.add(collider)
        eastColliderRef.current = collider
      }

      // Exploded pieces
      if (EXPLODE_PIECE_NAMES.includes(child.name)) {
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
  }, [gltf])

  // ── Traverse TourbillonDome ───────────────────────────────────────────────
  useEffect(() => {
    if (!domeGltf?.scene) return
    domeGltf.scene.traverse((child) => {
      if (EXPLODE_PIECE_NAMES.includes(child.name)) {
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

    if (isExploded) {
      // Clean up hover state
      isHoveredEast.current = false
      document.body.style.cursor = 'auto'

      // Kill existing tweens on animated pieces
      ANIMATED_PIECE_NAMES.forEach(name => {
        const m = pieces[name]
        if (m) { gsap.killTweensOf(m.position); gsap.killTweensOf(m.rotation) }
      })
        ;[progressTunnelFloor, progressCrystals, progressDome, progressSystem].forEach(ref => {
          gsap.killTweensOf(ref)
        })

      // Force all progress to 0 with immediate shader update (prevents first-frame pops)
      forceAllProgressTo(0.0)
      setNonExplodedMeshesVisible(true)

      // ── Unison sweep per group ─────────────────────────────────────────
      const totalDuration = EXPLODE_TIMING.tunnelFloor.duration

      const groups = [
        { ref: progressTunnelFloor, t: EXPLODE_TIMING.tunnelFloor },
        { ref: progressCrystals, t: EXPLODE_TIMING.crystals },
        { ref: progressDome, t: EXPLODE_TIMING.dome },
        { ref: progressSystem, t: EXPLODE_TIMING.system },
      ]

      const tl = gsap.timeline()
      groups.forEach(({ ref, t }) => {
        tl.to(ref, {
          current: 1.0,
          duration: t.duration,
          ease: 'power2.inOut',
        }, 0)
      })

      // When ALL groups have finished, desrender everything
      gsap.delayedCall(totalDuration, () => {
        setNonExplodedMeshesVisible(false)
      })

      // ── De-parent root pieces and animate simultaneously ─────────────────
      ANIMATED_PIECE_NAMES.forEach(name => {
        const mesh = pieces[name]
        if (mesh) {
          if (!mesh.userData.originalParent) {
            mesh.userData.originalParent = mesh.parent
          }
          scene.attach(mesh)
        }
      })

      if (pieces['AlquimiaTourbillonDome']) {
        gsap.to(pieces['AlquimiaTourbillonDome'].position, { x: 0, y: 8, z: 0, duration: 3.0, ease: 'power3.out' })
        // Reset rotation to defaultRot (not the hover-flipped rotation)
        gsap.to(pieces['AlquimiaTourbillonDome'].rotation, {
          x: pieces['AlquimiaTourbillonDome'].userData.defaultRot.x,
          y: pieces['AlquimiaTourbillonDome'].userData.defaultRot.y,
          z: pieces['AlquimiaTourbillonDome'].userData.defaultRot.z,
          duration: 3.0, ease: 'power3.out',
        })
      }

      if (pieces['InnerRingEast']) {
        gsap.to(pieces['InnerRingEast'].position, { x: 1, y: 5, z: 8, duration: 3.0, ease: 'power3.out' })
        gsap.to(pieces['InnerRingEast'].rotation, {
          x: pieces['InnerRingEast'].userData.defaultRot.x,
          y: pieces['InnerRingEast'].userData.defaultRot.y,
          z: pieces['InnerRingEast'].userData.defaultRot.z,
          duration: 3.0, ease: 'power3.out',
        })
      }

      if (pieces['InnerRingEast2']) {
        gsap.to(pieces['InnerRingEast2'].position, { x: -1, y: 5, z: 8, duration: 3.0, ease: 'power3.out' })
        gsap.to(pieces['InnerRingEast2'].rotation, {
          x: pieces['InnerRingEast2'].userData.defaultRot.x,
          y: pieces['InnerRingEast2'].userData.defaultRot.y,
          z: pieces['InnerRingEast2'].userData.defaultRot.z,
          duration: 3.0, ease: 'power3.out',
        })
      }

      // AlquimiaCircleOuter carries the nested hierarchy (Triangle→Inner→Square) as one unit
      // Force their custom override rotations using GSAP on a separate dummy vector,
      // and we apply it in useFrame to defeat the AnimationMixer overwriting them.
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
        gsap.to(pieces['AlquimiaCircleOuter'].position, { x: 0, y: 5, z: 8, duration: 3.0, ease: 'power3.out' })
      }

    } else {
      // ── Collapse ──────────────────────────────────────────────────────────
      // Resume GEARS / TOPGEARS unconditionally when returning to Tourbillon
      if (globalActions['GEARS'])
        gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
      if (globalActions['TOPGEARS'])
        gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })

      // Force all progress to 1.0 immediately so meshes render as fully dissolved
      // when we setVisible(true) — prevents any pop-in on the first frame
      forceAllProgressTo(1.0)
      setNonExplodedMeshesVisible(true)

      // Re-parent animated pieces back to their original parent immediately
      ANIMATED_PIECE_NAMES.forEach(name => {
        const mesh = pieces[name]
        if (mesh) {
          const origParent = mesh.userData.originalParent || pivotRef.current
          if (origParent) {
            origParent.attach(mesh)
            delete mesh.userData.originalParent
          }
        }
      })

      // Animate pieces back to their default local positions (now in CenterPivot space)
      ANIMATED_PIECE_NAMES.forEach(name => {
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
          // Always return dome rotation to defaultRot (not the hover-flipped one)
          gsap.to(mesh.rotation, {
            x: mesh.userData.defaultRot.x,
            y: mesh.userData.defaultRot.y,
            z: mesh.userData.defaultRot.z,
            duration: 2.0, ease: 'power2.inOut',
          })
        }
      })

      // ── Unison reverse sweep — same timing groups in reverse order ──────
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
    progressTunnelFloor, progressCrystals, progressDome, progressSystem])

  // ── Per-frame logic ───────────────────────────────────────────────────────
  useFrame((state, delta) => {
    // 1. CenterPivot elevation based on camera Y
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

    // 2. TourbillonEast hover — NO electric shader, just gear slow-down + dome flip
    if (!isExploded) {
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(state.mouse, state.camera)
      const target = eastColliderRef.current
      if (target) {
        const intersects = raycaster.intersectObject(target, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredEast.current) {
          isHoveredEast.current = true
          document.body.style.cursor = 'pointer'

          // Slow GEARS / TOPGEARS to a halt
          if (globalActions['GEARS'])
            gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS'])
            gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })

          // Flip dome 180°
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

          // Resume GEARS / TOPGEARS
          if (globalActions['GEARS'])
            gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS'])
            gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })

          // Return dome to default rotation
          if (domeRef.current) {
            gsap.killTweensOf(domeRef.current.rotation)
            gsap.to(domeRef.current.rotation, {
              x: domeRef.current.userData.defaultRot?.x ?? 0,
              duration: 1.5, ease: 'power2.inOut',
            })
          }
        }
      }
    }

    // Force default rotation overrides for artifact pieces when exploded
    if (isExploded) {
      ['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare'].forEach(name => {
        const mesh = explodedPiecesRef.current[name]
        if (mesh && mesh.userData.overrideRot) {
          mesh.rotation.copy(mesh.userData.overrideRot)
        }
      })
    }
  })

  // ── Click handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onClick = () => {
      if (isHoveredEast.current && !isExploded) {
        setExploded(true)
        document.body.style.cursor = 'auto'
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [isExploded, setExploded])

  return null
}

export default TourbillonAnimations
