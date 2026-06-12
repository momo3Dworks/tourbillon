import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURABLE DEBUGGING PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────
export const SHOW_HELPERS = false // Set to true to show neon trigger planes/rings in the scene

// ─────────────────────────────────────────────────────────────────────────────
// DOOR ACTIVATION CONFIGURATION (HEIGHT-BASED)
// triggerY  : camera height (Y) below which the door opens, and above which it closes
// actions   : GLB animation actions to play
// color     : visual helper color
// ─────────────────────────────────────────────────────────────────────────────
export const DOOR_CONFIG = [
  {
    label: 'Door 1',
    triggerY: 85.0, // Open when camera.y <= 78
    actions: ['Door1_Left', 'Door1_Right'],
    color: '#00ffcc', // Neon Cyan
  },
  {
    label: 'Door 2',
    triggerY: 73.0, // Open when camera.y <= 62
    actions: ['Door2_Left', 'Door2_Right'],
    color: '#ff00ff', // Neon Purple
  },
  {
    label: 'Door 3',
    triggerY: 60.0, // Open when camera.y <= 46
    actions: ['Door3_Left', 'Door3_Right'],
    color: '#ffff00', // Neon Yellow
  },
  {
    label: 'Door 4',
    triggerY: 55.0, // Open when camera.y <= 30
    actions: ['Door4_Left', 'Door4_Right'],
    color: '#0066ff', // Neon Blue
  },
]

const _camPos = new THREE.Vector3()

const DoorAnimations = () => {
  const { camera } = useThree()
  // useGLTF retrieves the cached instance loaded in SceneModels
  const gltf = useGLTF('/src/assets/Doors_camera.glb')
  const { actions } = useAnimations(gltf.animations, gltf.scene)

  // Track the open/close state of each door
  // { 'Door 1': false, 'Door 2': false, ... }
  const doorStates = useRef({})

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

  useFrame(() => {
    if (!actions) return
    camera.getWorldPosition(_camPos)
    const cameraY = _camPos.y

    DOOR_CONFIG.forEach((door) => {
      const isTriggered = cameraY <= door.triggerY
      const wasOpen = doorStates.current[door.label] || false

      // Height-based trigger state machine
      if (isTriggered && !wasOpen) {
        // Trigger opening
        door.actions.forEach((name) => playActionDirection(name, true))
        doorStates.current[door.label] = true
        console.log(`[DoorAnimations] Camera Y (${cameraY.toFixed(2)}) passed below triggerY (${door.triggerY}). Opening ${door.label}.`)
      } else if (!isTriggered && wasOpen) {
        // Trigger closing
        door.actions.forEach((name) => playActionDirection(name, false))
        doorStates.current[door.label] = false
        console.log(`[DoorAnimations] Camera Y (${cameraY.toFixed(2)}) went above triggerY (${door.triggerY}). Closing ${door.label}.`)
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
