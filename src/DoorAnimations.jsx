import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import { useAdvancedGLTF } from './SceneModels'
import * as THREE from 'three'
import { audioStore } from './store/audioStore'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURABLE DEBUGGING PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────
export const SHOW_HELPERS = false // Set to true to show neon trigger planes/rings in the scene

// ─────────────────────────────────────────────────────────────────────────────
// DOOR GATE STATE — mutable singleton read by CameraRig to clamp progress
//
// doorGates[label] = {
//   active: bool,       — true while this door is holding the camera
//   maxProgressY: num,  — the world-Y at which camera must be clamped
// }
// ─────────────────────────────────────────────────────────────────────────────
export const doorGates = {}

// ─────────────────────────────────────────────────────────────────────────────
// DOOR ACTIVATION CONFIGURATION (HEIGHT-BASED)
// triggerY        : camera Y at which the door animation starts playing.
//                   Also the Y where the camera is held (gated) waiting for the door.
// holdOffset      : extra Y units above triggerY where camera is frozen.
//                   e.g. holdOffset=2 → camera stops at triggerY+2, door opens, camera released.
// releaseAfter    : seconds to wait after triggering before releasing the gate.
//                   Set to roughly the animation clip duration (or slightly less).
// soundTriggerY   : camera Y at which DoorsOpened.mp3 fires
// soundFalloffRange: Y-units over which volume fades from max → 0 while the clip plays
// ─────────────────────────────────────────────────────────────────────────────
export const DOOR_CONFIG = [
  {
    label: 'Door 1',
    triggerY: 90.0,
    holdOffset: 1.5,     // camera waits at Y=91.5 while door opens
    releaseAfter: 1.5,   // release gate after 1.5s (adjust to match clip length)
    soundTriggerY: 90.0,
    soundFalloffRange: 18.0,
    actions: ['Door1_Left', 'Door1_Right'],
    color: '#00ffcc',
  },
  {
    label: 'Door 2',
    triggerY: 80.0,
    holdOffset: 1.5,
    releaseAfter: 1.5,
    soundTriggerY: 80.0,
    soundFalloffRange: 18.0,
    actions: ['Door2_Left', 'Door2_Right'],
    color: '#ff00ff',
  },
  {
    label: 'Door 3',
    triggerY: 70.0,
    holdOffset: 1.5,
    releaseAfter: 1.5,
    soundTriggerY: 70.0,
    soundFalloffRange: 18.0,
    actions: ['Door3_Left', 'Door3_Right'],
    color: '#ffff00',
  },
  {
    label: 'Door 4',
    triggerY: 60.0,
    holdOffset: 1.5,
    releaseAfter: 1.5,
    soundTriggerY: 60.0,
    soundFalloffRange: 18.0,
    actions: ['Door4_Left', 'Door4_Right'],
    color: '#0066ff',
  },
  {
    label: 'Dome',
    triggerY: 30.0,
    holdOffset: 0,       // Dome has no gate (DomeAnimation handles it)
    releaseAfter: 0,
    actions: ['TourbillonDome'],
    color: '#0066ff',
  },
]

const _camPos = new THREE.Vector3()

const DoorAnimations = () => {
  const { camera } = useThree()
  const gltf = useAdvancedGLTF('/Doors_camera.glb')
  const { actions } = useAnimations(gltf.animations, gltf.scene)

  // Track the open/close state of each door (for animation)
  const doorStates = useRef({})

  // Track sound-trigger state independently from animation state
  const soundStates = useRef({})

  // Track HTML Audio objects for each door
  const doorAudios = useRef({})

  // Gate timers: track how long since each gate was activated
  const gateTimers = useRef({})

  // Guard: don't start evaluating frames until actions are ready
  const readyRef = useRef(false)

  useEffect(() => {
    if (!actions) return
    const hasActions = DOOR_CONFIG.some((door) =>
      door.actions.some((name) => !!actions[name])
    )
    if (!hasActions) return

    // Initialize HTML Audio objects and gate states
    DOOR_CONFIG.forEach((door) => {
      if (door.label !== 'Dome' && door.soundTriggerY != null && !doorAudios.current[door.label]) {
        doorAudios.current[door.label] = new Audio('/DoorsOpened.mp3')
      }
      // Initialize gate as inactive
      doorGates[door.label] = { active: false, maxProgressY: door.triggerY + (door.holdOffset ?? 0) }
      gateTimers.current[door.label] = 0
    })

    // Pre-initialize door states from current camera position
    const startY = camera.position.y
    DOOR_CONFIG.forEach((door) => {
      const isAlreadyBelow = startY <= door.triggerY
      doorStates.current[door.label] = isAlreadyBelow

      if (door.soundTriggerY != null) {
        soundStates.current[door.label] = startY <= door.soundTriggerY
      }

      // Snap actions to OPEN state if camera starts below triggerY
      if (isAlreadyBelow) {
        door.actions.forEach((name) => {
          const action = actions[name]
          if (!action) return
          action.clampWhenFinished = true
          action.setLoop(THREE.LoopOnce, 1)
          action.time = action.getClip().duration
          action.paused = true
          action.play()
        })
      }
    })
    readyRef.current = true
  }, [actions])

  // Helper to play an action forwards (open) or backwards (close)
  const playActionDirection = (name, open) => {
    const action = actions[name]
    if (!action) return

    action.paused = false
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)

    if (open) {
      action.timeScale = 1
      if (action.time === action.getClip().duration || !action.isRunning()) {
        if (action.time === action.getClip().duration) action.reset()
        action.play()
      }
    } else {
      action.timeScale = -1
      if (!action.isRunning()) {
        if (action.time === 0) action.time = action.getClip().duration
        action.play()
      }
    }
  }

  const playDoorSound = (door) => {
    if (door.label === 'Dome') return
    const audio = doorAudios.current[door.label]
    if (!audio) return
    const { isPlayingAll, volumeDoors } = audioStore.getState()
    if (!isPlayingAll) return
    audio.currentTime = 0
    audio.volume = volumeDoors
    audio.play().catch(e => console.log('Audio play failed:', e))
  }

  const updateDoorSoundProximity = (door, cameraY) => {
    if (door.label === 'Dome' || door.soundTriggerY == null) return
    const audio = doorAudios.current[door.label]
    if (!audio || audio.paused) return
    const { isPlayingAll, volumeDoors } = audioStore.getState()
    if (!isPlayingAll) { audio.volume = 0; return }
    const dist = Math.abs(cameraY - door.soundTriggerY)
    const falloff = door.soundFalloffRange ?? 18.0
    const proximity = THREE.MathUtils.clamp(1.0 - dist / falloff, 0, 1)
    audio.volume = volumeDoors * proximity
  }

  useFrame((_, delta) => {
    if (!actions || !readyRef.current) return
    camera.getWorldPosition(_camPos)
    const cameraY = _camPos.y

    DOOR_CONFIG.forEach((door) => {
      const holdY = door.triggerY + (door.holdOffset ?? 0)

      // ── Gate: camera enters hold zone ────────────────────────────────
      const isInHoldZone = cameraY <= holdY && cameraY > door.triggerY - 2
      const gate = doorGates[door.label]
      const wasOpen = doorStates.current[door.label] || false

      if (door.holdOffset > 0) {
        if (isInHoldZone && !wasOpen && !gate.active) {
          // ACTIVATE gate: freeze camera here and start door animation
          gate.active = true
          gate.maxProgressY = holdY
          gateTimers.current[door.label] = 0

          door.actions.forEach((name) => playActionDirection(name, true))
          doorStates.current[door.label] = true
          playDoorSound(door)
          if (door.soundTriggerY != null) soundStates.current[door.label] = true

          console.log(`[DoorAnimations] ⛩ Gate ACTIVATED — ${door.label}, holding at Y≤${holdY.toFixed(1)}`)
        }

        // Tick gate timer and release when door animation is done
        if (gate.active) {
          gateTimers.current[door.label] += delta
          if (gateTimers.current[door.label] >= (door.releaseAfter ?? 1.5)) {
            gate.active = false
            console.log(`[DoorAnimations] ✅ Gate RELEASED — ${door.label}`)
          }
        }

        // When going back UP: close door and clear gate
        if (cameraY > holdY && wasOpen) {
          door.actions.forEach((name) => playActionDirection(name, false))
          doorStates.current[door.label] = false
          gate.active = false
          gateTimers.current[door.label] = 0
          console.log(`[DoorAnimations] Camera went above holdY (${holdY}). Closing ${door.label}.`)
        }
      } else {
        // No gate (Dome): original trigger logic
        const isTriggered = cameraY <= door.triggerY
        if (isTriggered && !wasOpen) {
          door.actions.forEach((name) => playActionDirection(name, true))
          doorStates.current[door.label] = true
        } else if (!isTriggered && wasOpen) {
          door.actions.forEach((name) => playActionDirection(name, false))
          doorStates.current[door.label] = false
        }
      }

      // ── Sound trigger (independent, uses soundTriggerY) ───────────────
      if (door.soundTriggerY == null || door.label === 'Dome') return

      const isBelowSound = cameraY <= door.soundTriggerY
      const wasBelowSound = soundStates.current[door.label] || false

      if (!isBelowSound && wasBelowSound) {
        // Camera crossed UP through soundTriggerY → closing sound
        soundStates.current[door.label] = false
        playDoorSound(door)
      }

      updateDoorSoundProximity(door, cameraY)
    })
  })

  return (
    <>
      {SHOW_HELPERS &&
        DOOR_CONFIG.map((door) => {
          const holdY = door.triggerY + (door.holdOffset ?? 0)
          return (
            <group key={door.label}>
              {/* Trigger plane */}
              <group position={[0, door.triggerY, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[8.8, 9.0, 64]} />
                  <meshBasicMaterial color={door.color} side={THREE.DoubleSide} transparent opacity={0.4} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0, 8.8, 64]} />
                  <meshBasicMaterial color={door.color} side={THREE.DoubleSide} transparent opacity={0.04} />
                </mesh>
              </group>
              {/* Hold plane (where camera actually stops) */}
              {door.holdOffset > 0 && (
                <group position={[0, holdY, 0]}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[8.8, 9.0, 64]} />
                    <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
                  </mesh>
                </group>
              )}
            </group>
          )
        })}
    </>
  )
}

export default DoorAnimations
