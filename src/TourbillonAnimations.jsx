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
    sciencePanelOpen,
    transitionProgress,         // legacy ref — kept for compat
    progressTunnelFloor,
    progressCrystals,
    progressDome,
    progressSystem,
    setTooltip,
    setSciencePanelOpen,
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

  // ── Exploded-view interactive pieces — hover / spin / click ─────────────
  // AlquimiaCircleOuter group
  const alquimiaColliderRef = useRef(null)  // invisible sphere collider
  const isHoveredAlquimia = useRef(false)
  const alquimiaSpinRef = useRef({ x: 0, y: 0, z: 0 }) // accumulator
  // InnerRingEast
  const innerRingColliderRef = useRef(null)
  const isHoveredInnerRing = useRef(false)
  const innerRingSpinRef = useRef({ x: 0, y: 0, z: 0 })

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
        gsap.to(pieces['InnerRingEast'].position, { x: 1.4, y: 4.8, z: 7, duration: 2.0, ease: 'power3.out' })
        gsap.to(pieces['InnerRingEast'].rotation, {
          x: pieces['InnerRingEast'].userData.defaultRot.x,
          y: pieces['InnerRingEast'].userData.defaultRot.y,
          z: pieces['InnerRingEast'].userData.defaultRot.z,
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
        gsap.to(pieces['AlquimiaCircleOuter'].position, { x: -1.2, y: 4.8, z: 7.5, duration: 2.0, ease: 'power3.out' })
      }

      // ── Build invisible sphere colliders for interactive exploded pieces ─────
      // We do this AFTER de-parenting so world-space bounding boxes are valid.
      // Colliders are attached as children so they move with the piece.
      const buildCollider = (mesh, refHolder, radiusScale = 1.3) => {
        if (!mesh) return
        // Remove any pre-existing collider
        const old = mesh.getObjectByName('__explodedCollider')
        if (old) mesh.remove(old)

        // Compute bounding sphere from all mesh children
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
        // offset to world center of bounding box, relative to mesh
        col.position.copy(center).sub(mesh.position)
        mesh.add(col)
        refHolder.current = col
      }

      // Delay building colliders slightly so GSAP has moved pieces to final positions
      setTimeout(() => {
        buildCollider(pieces['AlquimiaCircleOuter'], alquimiaColliderRef, 0.9)
        buildCollider(pieces['InnerRingEast'], innerRingColliderRef, 0.85)
      }, 2200)

    } else {
      // ── Collapse ────────────────────────────────────────────────────
      // Clean up interactive colliders and hover state
      ;[alquimiaColliderRef, innerRingColliderRef].forEach(ref => {
        if (ref.current) {
          ref.current.parent?.remove(ref.current)
          ref.current = null
        }
      })
      isHoveredAlquimia.current = false
      isHoveredInnerRing.current = false
      setTooltip(null)
      document.body.style.cursor = 'auto'
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
  // Reuse a single Raycaster across frames (avoid allocations)
  const _raycaster = new THREE.Raycaster()

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

    // 2. TourbillonEast hover (non-exploded) — gear slow-down + dome flip
    if (!isExploded) {
      _raycaster.setFromCamera(state.mouse, state.camera)
      const target = eastColliderRef.current
      if (target) {
        const intersects = _raycaster.intersectObject(target, false)
        const currentlyHovered = intersects.length > 0

        if (currentlyHovered && !isHoveredEast.current) {
          isHoveredEast.current = true
          document.body.style.cursor = 'pointer'
          if (globalActions['GEARS'])
            gsap.to(globalActions['GEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
          if (globalActions['TOPGEARS'])
            gsap.to(globalActions['TOPGEARS'], { timeScale: 0, duration: 1.5, ease: 'power2.out' })
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
          if (globalActions['GEARS'])
            gsap.to(globalActions['GEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
          if (globalActions['TOPGEARS'])
            gsap.to(globalActions['TOPGEARS'], { timeScale: 1, duration: 1.5, ease: 'power2.in' })
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

    // 3. Exploded-view interactive hover (AlquimiaCircleOuter + InnerRingEast)
    if (isExploded) {
      if (sciencePanelOpen) {
        if (isHoveredAlquimia.current || isHoveredInnerRing.current) {
          isHoveredAlquimia.current = false
          isHoveredInnerRing.current = false
          setTooltip(null)
          document.body.style.cursor = 'auto'
        }
      } else {
        _raycaster.setFromCamera(state.mouse, state.camera)

        // ── AlquimiaCircleOuter group ──────────────────────────────────────────
        const alquimiaCollider = alquimiaColliderRef.current
        const alquimiaMesh = explodedPiecesRef.current['AlquimiaCircleOuter']
        if (alquimiaCollider) {
          const hit = _raycaster.intersectObject(alquimiaCollider, false).length > 0

          if (hit && !isHoveredAlquimia.current) {
            isHoveredAlquimia.current = true
            document.body.style.cursor = 'pointer'
            setTooltip({ text: 'Go to Alquimia Apothecary' })
          } else if (!hit && isHoveredAlquimia.current) {
            isHoveredAlquimia.current = false
            document.body.style.cursor = 'auto'
            setTooltip(null)
          }

          // Continuous spin on all axes while hovered
          if (isHoveredAlquimia.current && alquimiaMesh) {
            const speed = 5.6
            // AlquimiaCircleOuter uses the overrideRot system to defeat AnimationMixer
            if (!alquimiaMesh.userData.overrideRot) {
              alquimiaMesh.userData.overrideRot = alquimiaMesh.rotation.clone()
            }
            alquimiaMesh.userData.overrideRot.y += delta * speed
            alquimiaMesh.userData.overrideRot.x += delta * speed * 0.3

            // Spin child pieces on their own axes too
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

        // ── InnerRingEast ──────────────────────────────────────────────────────
        const innerCollider = innerRingColliderRef.current
        const innerMesh = explodedPiecesRef.current['InnerRingEast']
        if (innerCollider) {
          const hit = _raycaster.intersectObject(innerCollider, false).length > 0

          if (hit && !isHoveredInnerRing.current) {
            isHoveredInnerRing.current = true
            document.body.style.cursor = 'pointer'
            setTooltip({ text: 'The Science / Information' })
          } else if (!hit && isHoveredInnerRing.current) {
            isHoveredInnerRing.current = false
            document.body.style.cursor = 'auto'
            setTooltip(null)
          }

          // Continuous spin on its own axes while hovered
          if (isHoveredInnerRing.current && innerMesh) {
            innerMesh.rotation.y += delta * 5.7
            innerMesh.rotation.x += delta * 3.25
          }
        }
      }

      // Apply overrideRot to AlquimiaCircleOuter group (defeats AnimationMixer)
      ;['AlquimiaCircleOuter', 'AlquimiaTriangle', 'AlquimiaCircleInner', 'AlquimiaSquare'].forEach(name => {
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
      if (sciencePanelOpen) {
        return
      }

      if (!isExploded) {
        // Trigger explode view on TourbillonEast hover
        if (isHoveredEast.current) {
          setExploded(true)
          document.body.style.cursor = 'auto'
        }
        return
      }

      // Exploded view clicks
      if (isHoveredAlquimia.current) {
        window.open('https://hotelherrera.com/alquimia', '_blank', 'noopener,noreferrer')
        return
      }
      if (isHoveredInnerRing.current) {
        setSciencePanelOpen(true)
        return
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [isExploded, sciencePanelOpen, setExploded, setSciencePanelOpen])

  return null
}

export default TourbillonAnimations

