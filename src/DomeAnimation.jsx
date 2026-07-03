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
// DOME ACTIVATION CONFIGURATION (HEIGHT-BASED)
// triggerY     : camera Y below which the dome OPENS, above which it CLOSES
// soundTriggerY: camera Y at which DomeOpened.mp3 fires — tweak independently
//                from the animation trigger to nail the sync.
//                On the way DOWN (camera.y crosses below soundTriggerY) → opening sound
//                On the way UP   (camera.y crosses above soundTriggerY) → closing sound
// actions      : GLB animation actions to play
// color        : visual helper color
// ─────────────────────────────────────────────────────────────────────────────
export const DOME_CONFIG = [
  {
    label: 'Dome',
    triggerY: 20.0,
    soundTriggerY: 30.0,   // ← tweak to shift when DomeOpened.mp3 fires
    actions: ['TourbillonDome'],
    color: '#0066ff',
  },
]

const _camPos = new THREE.Vector3()

const DomeAnimations = () => {
  const { camera } = useThree()
  // useAdvancedGLTF retrieves the cached instance loaded in SceneModels
  const gltf = useAdvancedGLTF('/TourbillonDome.glb')

  const { actions } = useAnimations(gltf.animations, gltf.scene)

  // Track the open/close state of the dome (for animation)
  const domeStates = useRef({})

  // Track sound-trigger state independently from animation state
  // true = camera is currently BELOW soundTriggerY
  const soundStates = useRef({})

  // HTML Audio object for the dome
  const domeAudio = useRef(null)

  useEffect(() => {
    domeAudio.current = new Audio('/DomeOpened.mp3')
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

  const playDomeSound = () => {
    const audio = domeAudio.current
    if (!audio) return
    const { isPlayingAll, volumeDoors } = audioStore.getState()
    if (!isPlayingAll) return
    audio.currentTime = 0
    audio.volume = volumeDoors
    audio.play().catch(e => console.log('DomeOpened audio play failed:', e))
  }

  useFrame(() => {
    if (!actions) return
    camera.getWorldPosition(_camPos)
    const cameraY = _camPos.y

    DOME_CONFIG.forEach((dome) => {
      // ── Animation trigger ─────────────────────────────────────────────────
      const isTriggered = cameraY <= dome.triggerY
      const wasOpen = domeStates.current[dome.label] || false

      if (isTriggered && !wasOpen) {
        dome.actions.forEach((name) => playActionDirection(name, true))
        domeStates.current[dome.label] = true
        console.log(`[DomeAnimation] Camera Y (${cameraY.toFixed(2)}) passed below triggerY (${dome.triggerY}). Opening ${dome.label}.`)
      } else if (!isTriggered && wasOpen) {
        dome.actions.forEach((name) => playActionDirection(name, false))
        domeStates.current[dome.label] = false
        console.log(`[DomeAnimation] Camera Y (${cameraY.toFixed(2)}) went above triggerY (${dome.triggerY}). Closing ${dome.label}.`)
      }

      // ── Sound trigger (independent, uses soundTriggerY) ───────────────────
      if (dome.soundTriggerY == null) return

      const isBelowSound = cameraY <= dome.soundTriggerY
      const wasBelowSound = soundStates.current[dome.label] || false

      if (isBelowSound && !wasBelowSound) {
        // Camera crossed DOWN → opening sound
        soundStates.current[dome.label] = true
        console.log(`[DomeAnimation] 🔊 Sound ↓ at Y=${cameraY.toFixed(2)} (soundTriggerY=${dome.soundTriggerY}) — ${dome.label}`)
        playDomeSound()
      } else if (!isBelowSound && wasBelowSound) {
        // Camera crossed UP → closing sound (Back to Entrance)
        soundStates.current[dome.label] = false
        console.log(`[DomeAnimation] 🔊 Sound ↑ at Y=${cameraY.toFixed(2)} (soundTriggerY=${dome.soundTriggerY}) — ${dome.label}`)
        playDomeSound()
      }
    })
  })

  return (
    <>
      {SHOW_HELPERS &&
        DOME_CONFIG.map((dome) => {
          return (
            <group key={dome.label} position={[0, dome.triggerY, 0]}>
              {/* Outer boundary ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[8.8, 9.0, 64]} />
                <meshBasicMaterial color={dome.color} side={THREE.DoubleSide} transparent opacity={0.4} />
              </mesh>
              {/* Inner subtle disk */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0, 8.8, 64]} />
                <meshBasicMaterial color={dome.color} side={THREE.DoubleSide} transparent opacity={0.04} />
              </mesh>
            </group>
          )
        })}
    </>
  )
}

export default DomeAnimations
