import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

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
export const FRICTION = 0.08   // used as Math.pow(FRICTION, delta)

// ─────────────────────────────────────────────────────────────────────────────
// WAYPOINT CONFIGURATION — add more entries here as needed
// Each waypoint: { position: [x, y, z], target: [x, y, z] }
// ─────────────────────────────────────────────────────────────────────────────
export const WAYPOINTS = [
  {
    position: [0, 90, 0],
    target: [0, 0, 0],
  },
  {
    position: [0, 70, 1],
    target: [0, 0, 0],
  },
  {
    position: [0, 50, 1],
    target: [0, 0, 0],
  },
  {
    position: [0, 15, 2],
    target: [0, -5, 0],
  }, {
    position: [3, 5, 8],
    target: [0, -1, 0],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

const _pos = new THREE.Vector3()
const _target = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

const lerp3 = (a, b, t) => new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), t)

const CameraRig = () => {
  const { camera, performance } = useThree()

  // progress: 0.0 → WAYPOINTS.length - 1
  const progress = useRef(0)
  const velocity = useRef(0)

  useEffect(() => {
    // Set camera to first waypoint immediately
    const wp = WAYPOINTS[0]
    camera.position.set(...wp.position)
    camera.lookAt(...wp.target)
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

  useFrame((_, delta) => {
    const maxIdx = WAYPOINTS.length - 1

    // Apply friction — frame-rate independent
    const friction = Math.pow(FRICTION, delta)
    velocity.current *= friction

    // Clamp tiny velocities to zero (prevents micro-drift)
    if (Math.abs(velocity.current) < 0.0001) velocity.current = 0

    // Regress R3F performance dynamically on movement to trigger Adaptive DPR scaling
    if (velocity.current !== 0) {
      performance.regress()
    }

    // Integrate velocity into progress
    progress.current = THREE.MathUtils.clamp(
      progress.current + velocity.current,
      0,
      maxIdx
    )

    // Clamp velocity at extremes so it doesn't keep building at boundaries
    if (progress.current <= 0 || progress.current >= maxIdx) {
      velocity.current = 0
    }

    // Determine which two waypoints we're interpolating between
    const lower = Math.floor(progress.current)
    const upper = Math.min(lower + 1, maxIdx)
    const t = progress.current - lower   // local blend factor 0→1

    // Ease t with smoothstep for extra softness at endpoints
    const et = t * t * (3 - 2 * t)

    const wpA = WAYPOINTS[lower]
    const wpB = WAYPOINTS[upper]

    const targetPos = lerp3(wpA.position, wpB.position, et)
    const targetLookAt = lerp3(wpA.target, wpB.target, et)

    // Smoothly lerp camera toward desired position (spring-like catch-up)
    const CATCH_UP = 1 - Math.pow(0.02, delta)   // ~98 % catch-up per second
    _pos.copy(targetPos)
    camera.position.lerp(_pos, CATCH_UP)

    // Look at target
    _target.copy(targetLookAt)
    camera.lookAt(_target)
  })

  return null
}

export default CameraRig
