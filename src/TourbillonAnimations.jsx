import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAdvancedGLTF } from './SceneModels'
import * as THREE from 'three'
import gsap from 'gsap'

const _camPos = new THREE.Vector3()

const TourbillonAnimations = () => {
  const { camera } = useThree()
  // Retrieve the cached gltf of TourbillonMainSystem loaded in SceneModels
  const gltf = useAdvancedGLTF('/TourbillonMainSystem.glb')

  const pivotRef = useRef(null)
  const triggered = useRef(false)

  // Traverse the gltf to find the CenterPivot mesh and store its initial Y position
  useEffect(() => {
    if (gltf && gltf.scene) {
      gltf.scene.traverse((child) => {
        if (child.name === 'CenterPivot') {
          pivotRef.current = child
          if (child.userData.initialY === undefined) {
            child.userData.initialY = child.position.y
          }
        }
      })
    }
  }, [gltf])

  useFrame(() => {
    if (!pivotRef.current) return

    camera.getWorldPosition(_camPos)
    const cameraY = _camPos.y

    // Trigger height threshold Y = 20.0
    const isTriggered = cameraY <= 20.0

    if (isTriggered && !triggered.current) {
      triggered.current = true

      // Kill any active tweens on CenterPivot position.y
      gsap.killTweensOf(pivotRef.current.position)

      // Animate CenterPivot Y upwards with bounce after a 1.25s delay (matching DomeAnimation duration)
      gsap.to(pivotRef.current.position, {
        y: pivotRef.current.userData.initialY + 2.0, // Elevate by 3 units
        duration: 1.5,
        delay: 1.25, // Wait for dome opening animation to complete
        ease: 'bounce.out',
        onStart: () => {
          console.log('[TourbillonAnimations] Dome open. Elevating CenterPivot.')
        }
      })
    } else if (!isTriggered && triggered.current) {
      triggered.current = false

      // Kill any active tweens on CenterPivot position.y
      gsap.killTweensOf(pivotRef.current.position)

      // Instantly drop back or slide back down when scrolling back up
      gsap.to(pivotRef.current.position, {
        y: pivotRef.current.userData.initialY,
        duration: 1.0,
        ease: 'power2.inOut',
        onStart: () => {
          console.log('[TourbillonAnimations] Lowering CenterPivot.')
        }
      })
    }
  })

  return null
}

export default TourbillonAnimations
