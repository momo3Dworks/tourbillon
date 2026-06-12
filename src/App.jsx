import React, { useMemo, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, AdaptiveDpr } from '@react-three/drei'
import WebGPURenderer from 'three/src/renderers/webgpu/WebGPURenderer.js'
import Navbar from './components/Navbar'
import UIOverlay from './components/UIOverlay'
import Loader from './components/Loader'
import Experience from './Experience'
import CameraRig, { WAYPOINTS } from './CameraRig'
import { Perf } from 'r3f-webgpu-perf'

import './index.css'

function App() {
  const [ready, setReady] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [emissiveIntensity, setEmissiveIntensity] = useState(10.0)

  // Max DPR configured separately for Desktop vs Mobile
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // Mobile capped at 1.2 for performance, desktop up to 2.0 for high resolution
    return isMobile ? Math.min(window.devicePixelRatio, 0.75) : Math.min(window.devicePixelRatio, 0.95);
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>

      {/* UI Components */}
      <Loader onStart={() => setHasStarted(true)} />
      <Navbar />
      <UIOverlay emissiveIntensity={emissiveIntensity} setEmissiveIntensity={setEmissiveIntensity} />

      {/* WebGPU Canvas */}
      <Canvas
        dpr={dpr}
        performance={{ min: 0.65, max: 0.95, debounce: 200 }}
        frameloop={(ready && hasStarted) ? 'always' : 'never'}
        gl={(props) => {
          const renderer = new WebGPURenderer({
            ...props,
            antialias: true,
            alpha: true,
          })
          renderer.setPixelRatio(dpr)
          renderer.init().then(() => setReady(true))
          return renderer
        }}
      >
        {/* Perf */}
        <Perf position="top-left" />
        {/* Camera starts at waypoint 0 position */}
        <PerspectiveCamera makeDefault position={WAYPOINTS[0].position} fov={60} near={0.1} far={1000} />
        <color attach="background" args={['#050510']} />

        {/* Scroll-driven smooth camera rig */}
        <CameraRig />

        {/* Adaptive DPR: Dynamically degrades pixel ratio on regression/heavy load */}
        <AdaptiveDpr pixelated />

        {ready && (
          <Suspense fallback={null}>
            <Experience emissiveIntensity={emissiveIntensity} />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}

export default App

