import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// INTRO NAVIGATION MODE
// ─────────────────────────────────────────────────────────────────────────────
// Set USE_AUTO_INTRO to `true` to use the automatic "Meet The Tourbillon" button intro,
// which automatically opens the Vault Door and moves the camera to waypoint 4.
// Set to `false` to revert to the manual scroll-based intro.
export const USE_AUTO_INTRO = true;

// Speed parameter for the automatic intro (progress units per second).
// Adjust this to sync the camera movement with the doors opening animation.
export const AUTO_INTRO_SPEED = 0.5;

// Global trigger state for automatic intro
export const triggerAutoIntro = { current: false };

// Global trigger state for automatic back to entrance
export const triggerAutoBack = { current: false };

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL TUNING
// ─────────────────────────────────────────────────────────────────────────────
// SCROLL_SENSITIVITY: progress units per pixel of wheel delta.
//   Lower  → more scroll needed between waypoints (0.0003 = very slow)
//   Higher → fewer scrolls needed                  (0.003  = very fast)
export const SCROLL_SENSITIVITY = 0.00002

// FRICTION: how fast the camera decelerates after you stop scrolling.
//   Closer to 0 → stops almost instantly
//   Closer to 1 → very long glide (never stops)
export const FRICTION = 0.1   // used as Math.pow(FRICTION, delta)

// ─────────────────────────────────────────────────────────────────────────────
// WAYPOINT CONFIGURATION — add more entries here as needed
// Each waypoint: { position: [x, y, z], target: [x, y, z] }
// ─────────────────────────────────────────────────────────────────────────────
export const WAYPOINTS = [
  {
    position: [0, 100, 0],
    target: [0, 0, 0],
    fov: 80,
    dof: { focusDistance: 2.8, focalLength: 40, bokehScale: 10 },
  },
  {
    position: [0, 70, 1],
    target: [0, 0, 0],
    fov: 60,
    dof: { focusDistance: 6, focalLength: 23, bokehScale: 8 },
  },
  {
    position: [0, 50, 1],
    target: [0, 0, 0],
    fov: 60,
    dof: { focusDistance: 5, focalLength: 30, bokehScale: 7 },
  },
  {
    position: [0, 10, 2],
    target: [0, -5, 0],
    fov: 60,
    dof: { focusDistance: 5, focalLength: 100, bokehScale: 8 },
  },
  {
    position: [3, 6, 3],
    target: [0, 1, 0],
    fov: 60,
    dof: { focusDistance: 2.5, focalLength: 50, bokehScale: 8 },
  },
  {
    position: [1, 5, 3],
    target: [0, 0, 0],
    fov: 60,
    dof: { focusDistance: 0.1, focalLength: 60, bokehScale: 8 },
  },
  {
    position: [-8, 3, 3],
    target: [0, 0, 0],
    fov: 98,
    dof: { focusDistance: 5.0, focalLength: 55, bokehScale: 8 },
  },

]

export const scrollProgress = { current: -1.0 }

// Shared mutable state updated every frame with interpolated per-waypoint camera values.
// Read by PostProcessing in Experience.jsx to drive DoF uniforms per-frame.
export const waypointCameraState = {
  fov: 60,
  focusDistance: 4.5,
  focalLength: 34.7,
  bokehScale: 1.7,
  perWaypointEnabled: false,
  hoveredObject: null,
}

const _pos = new THREE.Vector3()
const _target = new THREE.Vector3()

import { useExploded } from './ExplodedContext'
import { useControls } from 'leva'

// ────────────────────────────────────────────────────────────────────────────────
// NORTH EXPLODED VIEW — Per-section camera waypoints
// Camera is positioned to the RIGHT so the left 45% viewport is free for the UI panel.
// Tune these values in Leva or adjust directly here.
// ────────────────────────────────────────────────────────────────────────────────
export const NORTH_SECTION_WAYPOINTS = {
  // Events — TourbillonNorthOutter / G3 / G4 area (left side of exploded layout)
  events: {
    position: [-2.5, 5, 6.8],
    target: [-5, 5, 2],
    fov: 60,
    dof: { focusDistance: 0.1, focalLength: 48, bokehScale: 6 },
  },
  // THEadventures — TourbillonNorthInnerG2 area
  adventures: {
    position: [-1.5, 5.1, 7.5],
    target: [-3, 5, 2],
    fov: 60,
    dof: { focusDistance: 0.5, focalLength: 100, bokehScale: 6 },
  },
  // Book a Room — TourbillonNorthOutter area
  bookroom: {
    position: [0, 4.8, 7.2],
    target: [0, 5, 2],
    fov: 60,
    dof: { focusDistance: 1, focalLength: 100, bokehScale: 5 },
  },
  // THEsuites — TourbillonNorthInner area (right side of exploded layout)
  suites: {
    position: [2, 6.5, 6],
    target: [3.2, 5, 4.8],
    fov: 60,
    dof: { focusDistance: 10, focalLength: 10, bokehScale: 6 },
  },
}

// ────────────────────────────────────────────────────────────────────────────────
// SOUTH EXPLODED VIEW — Per-section camera waypoints
// Camera is positioned to frame objects to the LEFT, leaving the right 45% for UI.
// ────────────────────────────────────────────────────────────────────────────────
export const SOUTH_SECTION_WAYPOINTS = {
  // Events — TourbillonSouthInnerG3 / G4 area (~ x: -3.2)
  events: {
    position: [-4.5, 5, 6.8],
    target: [-1.4, 5, 2],
    fov: 60,
    dof: { focusDistance: 0.1, focalLength: 48, bokehScale: 6 },
  },
  // THEadventures — TourbillonSouthInnerG2 area (~ x: -2.3)
  adventures: {
    position: [-3.5, 5.1, 7.5],
    target: [-0.5, 5, 2],
    fov: 60,
    dof: { focusDistance: 0.5, focalLength: 100, bokehScale: 6 },
  },
  // Book a Room — TourbillonSouthOutter area (~ x: 0)
  bookroom: {
    position: [-2.0, 4.8, 7.2],
    target: [2.0, 5, 2],
    fov: 60,
    dof: { focusDistance: 1, focalLength: 100, bokehScale: 5 },
  },
  // THEsuites — TourbillonSouthInner area (~ x: 3.4)
  suites: {
    position: [0.5, 6.5, 6],
    target: [5.4, 5, 4.8],
    fov: 60,
    dof: { focusDistance: 10, focalLength: 10, bokehScale: 6 },
  },
}

// ────────────────────────────────────────────────────────────────────────────────
// WEST EXPLODED VIEW — Per-section camera waypoints
// ────────────────────────────────────────────────────────────────────────────────
export const WEST_SECTION_WAYPOINTS = {
  catering: {
    position: [2.5, 6, 6.8],
    target: [-3, 5, 4],
    fov: 60,
    dof: { focusDistance: 1, focalLength: 80, bokehScale: 5 },
  },
}

const lerp3 = (a, b, t) => new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), t)

const CameraRig = () => {
  const { camera, scene, performance } = useThree()
  const { isExploded, activeSection } = useExploded()

  const explodedCam = useControls('Exploded View Camera', {
    posX: { value: 0, min: -100, max: 100, step: 0.5, label: 'Position X' },
    posY: { value: 5, min: -100, max: 100, step: 0.5, label: 'Position Y' },
    posZ: { value: 10, min: -100, max: 100, step: 0.5, label: 'Position Z' },
    targetX: { value: 0, min: -50, max: 50, step: 0.5, label: 'Target X' },
    targetY: { value: 5, min: -50, max: 50, step: 0.5, label: 'Target Y' },
    targetZ: { value: 0, min: -50, max: 50, step: 0.5, label: 'Target Z' },
    fov: { value: 60, min: 10, max: 120, step: 1, label: 'Default FOV' },
    focusDistance: { value: 5.0, min: 0.1, max: 100, step: 0.1, label: 'Default Focus Distance' },
    focalLength: { value: 50, min: 1, max: 150, step: 1, label: 'Default Focal Length' },
    bokehScale: { value: 2.0, min: 0, max: 20, step: 0.1, label: 'Default Bokeh Scale' },
    parallaxIntensity: { value: 0.6, min: 0, max: 5, step: 0.05, label: 'Mouse Parallax' },
  })

  // Per-waypoint DoF & FOV toggle
  const { perWaypointDof } = useControls('Waypoint Camera', {
    perWaypointDof: { value: true, label: 'Per-Waypoint DoF & FOV' },
  })
  const perWaypointDofRef = useRef(false)
  useEffect(() => {
    perWaypointDofRef.current = perWaypointDof
    waypointCameraState.perWaypointEnabled = perWaypointDof
  }, [perWaypointDof])

  // progress: -1.0 (vault door closed) → 0.0 (vault door open, waypoint 0) → maxIdx
  const progress = useRef(-1.0)
  const velocity = useRef(0)
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const parallaxOffset = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    // Set camera to first waypoint immediately
    const wp = WAYPOINTS[0]
    camera.position.set(...wp.position)
    camera.lookAt(...wp.target)
    currentLookAt.current.set(...wp.target)
  }, [camera])

  useEffect(() => {
    let lastTouchY = 0

    const onWheel = (e) => {
      const raw = e.deltaY || e.detail || e.wheelDelta
      velocity.current += raw * SCROLL_SENSITIVITY
    }

    const onTouchStart = (e) => {
      if (e.touches.length > 0) {
        lastTouchY = e.touches[0].clientY
      }
    }

    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        const touchY = e.touches[0].clientY
        // Swipe up should move the camera forward (positive delta), swipe down backward (negative delta)
        const deltaY = lastTouchY - touchY
        lastTouchY = touchY

        // Multiplier to match wheel speed feel on touch devices
        velocity.current += deltaY * SCROLL_SENSITIVITY * 12.0
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  useFrame((state, delta) => {
    const maxIdx = WAYPOINTS.length - 1

    // Apply friction — frame-rate independent
    const friction = Math.pow(FRICTION, delta)
    velocity.current *= friction

    // Clamp tiny velocities to zero (prevents micro-drift)
    if (Math.abs(velocity.current) < 0.0001) velocity.current = 0

    // (Removed performance regression on movement)

    if (USE_AUTO_INTRO && triggerAutoIntro.current) {
      if (progress.current < 4.0) {
        // Automatic intro mode: progress moves automatically to waypoint 4 ([3, 6, 3])
        progress.current = THREE.MathUtils.clamp(
          progress.current + delta * AUTO_INTRO_SPEED,
          -1.0,
          4.0
        )
        velocity.current = 0 // Reset manual velocity during auto intro
      } else {
        // Finished automatic intro, allow manual scrolling again
        triggerAutoIntro.current = false
      }
    } else if (triggerAutoBack.current) {
      if (progress.current > -1.0) {
        // Automatic back mode: progress moves automatically to waypoint 0 ([0, 100, 0])
        progress.current = THREE.MathUtils.clamp(
          progress.current - delta * (AUTO_INTRO_SPEED * 1.5),
          -1.0,
          maxIdx
        )
        velocity.current = 0
      } else {
        triggerAutoBack.current = false
      }
    } else {
      // Integrate velocity into progress (manual scroll mode)
      progress.current = THREE.MathUtils.clamp(
        progress.current + velocity.current,
        -1.0,
        maxIdx
      )
    }

    // Sync global scroll progress
    scrollProgress.current = progress.current

    if (velocity.current !== 0) {
      console.log(`[CameraRig] progress: ${progress.current.toFixed(4)}, velocity: ${velocity.current.toFixed(6)}, cameraY: ${camera.position.y.toFixed(2)}`)
    }

    // Clamp velocity at extremes so it doesn't keep building at boundaries
    if (progress.current <= -1.0 || progress.current >= maxIdx) {
      velocity.current = 0
    }

    // Update scroll tooltip opacity
    const scrollTooltipEl = document.getElementById('scroll-tooltip')
    if (scrollTooltipEl) {
      if (progress.current > 2.5 || (USE_AUTO_INTRO && triggerAutoIntro.current) || triggerAutoBack.current) {
        scrollTooltipEl.style.opacity = '0'
        scrollTooltipEl.style.pointerEvents = 'none'
      } else {
        scrollTooltipEl.style.opacity = '1'
        if (USE_AUTO_INTRO) scrollTooltipEl.style.pointerEvents = 'auto'
      }
    }

    // Update Back to Entrance button opacity
    const backBtnEl = document.getElementById('back-to-entrance-btn')
    if (backBtnEl) {
      if (progress.current >= 3.9 && !isExploded && !triggerAutoBack.current) {
        backBtnEl.style.opacity = '1'
        backBtnEl.style.pointerEvents = 'auto'
      } else {
        backBtnEl.style.opacity = '0'
        backBtnEl.style.pointerEvents = 'none'
      }
    }

    // Interpolate camera position and target
    let targetPos, targetLookAt
    let targetFov, targetFocusDist, targetFocalLen, targetBokeh

    const DEFAULT_DOF = { focusDistance: 4.5, focalLength: 34.7, bokehScale: 1.7 }

    if (progress.current <= 0) {
      const wp = WAYPOINTS[0]
      targetPos = new THREE.Vector3(...wp.position)
      targetLookAt = new THREE.Vector3(...wp.target)
      const d = wp.dof || DEFAULT_DOF
      targetFov = wp.fov ?? 60
      targetFocusDist = d.focusDistance
      targetFocalLen = d.focalLength
      targetBokeh = d.bokehScale
    } else {
      // Determine which two waypoints we're interpolating between
      const lower = Math.floor(progress.current)
      const upper = Math.min(lower + 1, maxIdx)
      const t = progress.current - lower   // local blend factor 0→1

      // Ease t with smoothstep for extra softness at endpoints
      const et = t * t * (3 - 2 * t)

      const wpA = WAYPOINTS[lower]
      const wpB = WAYPOINTS[upper]
      const dA = wpA.dof || DEFAULT_DOF
      const dB = wpB.dof || DEFAULT_DOF

      targetPos = lerp3(wpA.position, wpB.position, et)
      targetLookAt = lerp3(wpA.target, wpB.target, et)
      targetFov = THREE.MathUtils.lerp(wpA.fov ?? 60, wpB.fov ?? 60, et)
      targetFocusDist = THREE.MathUtils.lerp(dA.focusDistance, dB.focusDistance, et)
      targetFocalLen = THREE.MathUtils.lerp(dA.focalLength, dB.focalLength, et)
      targetBokeh = THREE.MathUtils.lerp(dA.bokehScale, dB.bokehScale, et)
    }

    if (isExploded) {
      targetPos = new THREE.Vector3(explodedCam.posX, explodedCam.posY, explodedCam.posZ)
      targetLookAt = new THREE.Vector3(explodedCam.targetX, explodedCam.targetY, explodedCam.targetZ)
      targetFov = explodedCam.fov
      targetFocusDist = explodedCam.focusDistance
      targetFocalLen = explodedCam.focalLength
      targetBokeh = explodedCam.bokehScale

      // Per-section waypoints — override generic exploded camera
      if (activeSection) {
        // Move to specific section focus point
        const targetWp = isExploded === 'east' ? EAST_SECTION_WAYPOINTS[activeSection] :
          isExploded === 'north' ? NORTH_SECTION_WAYPOINTS[activeSection] :
            isExploded === 'south' ? SOUTH_SECTION_WAYPOINTS[activeSection] :
              isExploded === 'west' ? WEST_SECTION_WAYPOINTS[activeSection] :
                null
        if (targetWp) {
          targetPos = new THREE.Vector3(...targetWp.position)
          targetLookAt = new THREE.Vector3(...targetWp.target)
          targetFov = targetWp.fov ?? explodedCam.fov
          const sd = targetWp.dof
          targetFocusDist = sd?.focusDistance ?? explodedCam.focusDistance
          targetFocalLen = sd?.focalLength ?? explodedCam.focalLength
          targetBokeh = sd?.bokehScale ?? explodedCam.bokehScale
        }
      }

      // Apply mouse parallax in Exploded View
      if (explodedCam.parallaxIntensity > 0) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

        const targetParallax = new THREE.Vector3()
          .addScaledVector(right, state.mouse.x * explodedCam.parallaxIntensity)
          .addScaledVector(up, state.mouse.y * explodedCam.parallaxIntensity)

        parallaxOffset.current.lerp(targetParallax, 1 - Math.pow(0.02, delta))
        targetPos.add(parallaxOffset.current)
      } else {
        parallaxOffset.current.set(0, 0, 0)
      }
    } else {
      parallaxOffset.current.set(0, 0, 0)
    }

    const CATCH_UP = 1 - Math.pow(0.02, delta)   // ~98 % catch-up per second

    // Smoothly lerp waypoint camera state values
    waypointCameraState.fov = THREE.MathUtils.lerp(waypointCameraState.fov, targetFov, CATCH_UP)
    waypointCameraState.focusDistance = THREE.MathUtils.lerp(waypointCameraState.focusDistance, targetFocusDist, CATCH_UP)
    waypointCameraState.focalLength = THREE.MathUtils.lerp(waypointCameraState.focalLength, targetFocalLen, CATCH_UP)
    waypointCameraState.bokehScale = THREE.MathUtils.lerp(waypointCameraState.bokehScale, targetBokeh, CATCH_UP)

    // Smoothly lerp camera toward desired position
    _pos.copy(targetPos)
    camera.position.lerp(_pos, CATCH_UP)

    // Apply FOV (smoothly lerped)
    if (perWaypointDofRef.current || isExploded) {
      camera.fov = waypointCameraState.fov
      camera.updateProjectionMatrix()
    }

    // Look at target smoothly
    currentLookAt.current.lerp(targetLookAt, CATCH_UP)
    camera.lookAt(currentLookAt.current)
  })

  return null
}

export default CameraRig
