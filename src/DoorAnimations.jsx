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
// DOOR ACTIVATION CONFIGURATION (HEIGHT-BASED)
// triggerY     : camera Y below which the door OPENS, above which it CLOSES
// soundTriggerY: camera Y at which DoorsOpened.mp3 fires — tweak this
//                independently from the animation trigger to nail the sync.
//                On the way DOWN  (camera.y crosses below soundTriggerY) → plays opening sound
//                On the way UP    (camera.y crosses above soundTriggerY) → plays closing sound
// actions      : GLB animation actions to play
// color        : visual helper color
// ─────────────────────────────────────────────────────────────────────────────
export const DOOR_CONFIG = [
  {
    label: 'Door 1',
    triggerY: 85.0,
    soundTriggerY: 85.0,   // ← tweak to shift when the sound fires
    actions: ['Door1_Left', 'Door1_Right'],
    color: '#00ffcc',
  },
  {
    label: 'Door 2',
    triggerY: 73.0,
    soundTriggerY: 73.0,   // ← tweak to shift when the sound fires
    actions: ['Door2_Left', 'Door2_Right'],
    color: '#ff00ff',
  },
  {
    label: 'Door 3',
    triggerY: 60.0,
    soundTriggerY: 60.0,   // ← tweak to shift when the sound fires
    actions: ['Door3_Left', 'Door3_Right'],
    color: '#ffff00',
  },
  {
    label: 'Door 4',
    triggerY: 55.0,
    soundTriggerY: 55.0,   // ← tweak to shift when the sound fires
    actions: ['Door4_Left', 'Door4_Right'],
    color: '#0066ff',
  },
  {
    label: 'Dome',
    triggerY: 30.0,
    // No sound for Dome
    actions: ['TourbillonDome'],
    color: '#0066ff',
  },
]

const _camPos = new THREE.Vector3()

const DoorAnimations = () => {
  const { camera } = useThree()
  // useAdvancedGLTF retrieves the cached instance loaded in SceneModels
  const gltf = useAdvancedGLTF('/Doors_camera.glb')

  const { actions } = useAnimations(gltf.animations, gltf.scene)

  // Track the open/close state of each door (for animation)
  // { 'Door 1': false, 'Door 2': false, ... }
  const doorStates = useRef({})

  // Track sound-trigger state independently from animation state
  // true = camera is currently BELOW soundTriggerY
  const soundStates = useRef({})

  // Track HTML Audio objects for each door
  const doorAudios = useRef({})

  useEffect(() => {
    DOOR_CONFIG.forEach((door) => {
      if (door.label !== 'Dome' && door.soundTriggerY != null) {
        const audio = new Audio('/DoorsOpened.mp3')
        doorAudios.current[door.label] = audio
      }
    })
  }, [])

  // Helper to play an action forwards (open) or backwards (close)
  const playActionDirection = (name, open) => {
    const action = actions[name]
    if (!action) return

    action.paused = false
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)

    if (open) {
      action.timeScale = 1
      // If fully closed/finished, reset to start to ensure it plays
      if (action.time === action.getClip().duration || !action.isRunning()) {
        if (action.time === action.getClip().duration) {
          action.reset()
        }
        action.play()
      }
    } else {
      action.timeScale = -1
      // If fully open/finished, set time to duration to play backwards
      if (!action.isRunning()) {
        if (action.time === 0) {
          action.time = action.getClip().duration
        }
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

  useFrame(() => {
    if (!actions) return
    camera.getWorldPosition(_camPos)
    const cameraY = _camPos.y

    DOOR_CONFIG.forEach((door) => {
      // ── Animation trigger (unchanged) ────────────────────────────────────
      const isTriggered = cameraY <= door.triggerY
      const wasOpen = doorStates.current[door.label] || false

      if (isTriggered && !wasOpen) {
        door.actions.forEach((name) => playActionDirection(name, true))
        doorStates.current[door.label] = true
        console.log(`[DoorAnimations] Camera Y (${cameraY.toFixed(2)}) passed below triggerY (${door.triggerY}). Opening ${door.label}.`)
      } else if (!isTriggered && wasOpen) {
        door.actions.forEach((name) => playActionDirection(name, false))
        doorStates.current[door.label] = false
        console.log(`[DoorAnimations] Camera Y (${cameraY.toFixed(2)}) went above triggerY (${door.triggerY}). Closing ${door.label}.`)
      }

      // ── Sound trigger (independent, uses soundTriggerY) ───────────────
      if (door.soundTriggerY == null || door.label === 'Dome') return

      const isBelowSound = cameraY <= door.soundTriggerY
      const wasBelowSound = soundStates.current[door.label] || false

      if (isBelowSound && !wasBelowSound) {
        // Camera crossed DOWN through soundTriggerY → opening sound
        soundStates.current[door.label] = true
        console.log(`[DoorAnimations] 🔊 Sound ↓ at Y=${cameraY.toFixed(2)} (soundTriggerY=${door.soundTriggerY}) — ${door.label}`)
        playDoorSound(door)
      } else if (!isBelowSound && wasBelowSound) {
        // Camera crossed UP through soundTriggerY → closing sound (Back to Entrance)
        soundStates.current[door.label] = false
        console.log(`[DoorAnimations] 🔊 Sound ↑ at Y=${cameraY.toFixed(2)} (soundTriggerY=${door.soundTriggerY}) — ${door.label}`)
        playDoorSound(door)
      }
    })
  })

  return (
    <>
      {SHOW_HELPERS &&
        DOOR_CONFIG.map((door) => {
          return (
            <group key={door.label} position={[0, door.triggerY, 0]}>
              {/* Outer boundary ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[8.8, 9.0, 64]} />
                <meshBasicMaterial color={door.color} side={THREE.DoubleSide} transparent opacity={0.4} />
              </mesh>
              {/* Inner subtle disk */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0, 8.8, 64]} />
                <meshBasicMaterial color={door.color} side={THREE.DoubleSide} transparent opacity={0.04} />
              </mesh>
            </group>
          )
        })}
    </>
  )
}

export default DoorAnimations
