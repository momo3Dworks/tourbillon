import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAdvancedGLTF } from './SceneModels'
import * as THREE from 'three'
import gsap from 'gsap'
import { ElectricVertexShader, ElectricFragmentShader } from './shaders/electricShader'

const _camPos = new THREE.Vector3()

const TourbillonAnimations = () => {
  const { camera } = useThree()
  // Retrieve the cached gltf of TourbillonMainSystem loaded in SceneModels
  const gltf = useAdvancedGLTF('/TourbillonMainSystem.glb')

  const pivotRef = useRef(null)
  const triggered = useRef(false)
  const tourbillonRef = useRef(null)
  const hoverUniform = useRef({ value: 0 }); const DEBUG_RAYCAST = true;

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
        // Debug: log all mesh names encountered during traversal
          if (child.isMesh) {
            console.log('[Mesh]', child.name);
          }
          // Handle TourbillonEast mesh for electric effect
          if (child.name === 'TourbillonEast') {
            tourbillonRef.current = child;
            // Ensure geometry is ready for raycasting
            child.geometry.computeBoundingSphere();
            // Create an invisible sphere collider slightly larger than the mesh bounds
            const sphereGeom = new THREE.SphereGeometry(child.geometry.boundingSphere.radius * 1.2, 16, 16);
            const colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
            const collider = new THREE.Mesh(sphereGeom, colliderMat);
            collider.name = 'TourbillonEastCollider';
            // Align collider with the mesh
            collider.position.copy(child.position);
            collider.quaternion.copy(child.quaternion);
            child.add(collider);
            // Store reference for raycasting
            tourbillonRef.current.collider = collider;
            // Create shader material if not already assigned
            const shaderMat = new THREE.ShaderMaterial({
              vertexShader: ElectricVertexShader,
              fragmentShader: ElectricFragmentShader,
              uniforms: {
                uTime: { value: 0 },
                uHover: { value: 0 },
              },
              transparent: true,
              side: THREE.DoubleSide,
            });
            child.material = shaderMat;
          }
      })
    }
  }, [gltf])

  useFrame((state, delta) => {
    // Existing CenterPivot animation logic
    if (pivotRef.current) {
      camera.getWorldPosition(_camPos)
      const cameraY = _camPos.y
      const isTriggered = cameraY <= 20.0
      if (isTriggered && !triggered.current) {
        triggered.current = true
        gsap.killTweensOf(pivotRef.current.position)
        gsap.to(pivotRef.current.position, {
          y: pivotRef.current.userData.initialY + 2.0,
          duration: 1.5,
          delay: 1.25,
          ease: 'bounce.out',
          onStart: () => {
            console.log('[TourbillonAnimations] Dome open. Elevating CenterPivot.')
          }
        })
      } else if (!isTriggered && triggered.current) {
        triggered.current = false
        gsap.killTweensOf(pivotRef.current.position)
        gsap.to(pivotRef.current.position, {
          y: pivotRef.current.userData.initialY,
          duration: 1.0,
          ease: 'power2.inOut',
          onStart: () => {
            console.log('[TourbillonAnimations] Lowering CenterPivot.')
          }
        })
      }
    }

      if (tourbillonRef.current) {
        // Update time uniform
        tourbillonRef.current.material.uniforms.uTime.value += delta;
        // Raycast using the collider if present, otherwise the mesh itself
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(state.mouse, state.camera);
        const target = tourbillonRef.current.collider || tourbillonRef.current;
        const intersects = raycaster.intersectObject(target, true);
        const hover = intersects.length > 0 ? 1 : 0;
        tourbillonRef.current.material.uniforms.uHover.value = hover;
        if (DEBUG_RAYCAST) {
          console.log('[Raycast] hover:', hover, 'objects:', intersects.map(i => i.object.name));
        }
        // Keep mesh visible; shader controls intensity
        tourbillonRef.current.visible = true;
      }
  })

  return null
}

export default TourbillonAnimations
