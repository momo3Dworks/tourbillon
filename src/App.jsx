import React, { useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, AdaptiveDpr } from '@react-three/drei'
import Navbar from './components/Navbar'
import Loader from './components/Loader'
import Experience from './Experience'
import CameraRig, { WAYPOINTS } from './CameraRig'
import { Leva } from 'leva'

import './index.css'

function App() {
  const [ready, setReady] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  // Press H to toggle Leva panel visibility
  const [levaHidden, setLevaHidden] = useState(true)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'h' || e.key === 'H') {
        setLevaHidden(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Max DPR configured separately for Desktop vs Mobile
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // Mobile capped at 0.75 for performance, desktop up to 0.95 for quality/perf balance
    return isMobile ? Math.min(window.devicePixelRatio, 0.75) : Math.min(window.devicePixelRatio, 0.95);
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>

      {/* UI Components */}
      {/* Press H to toggle panel */}
      <Leva hidden={levaHidden} collapsed={false} />
      <Loader onStart={() => setHasStarted(true)} />
      <Navbar />

      {/* R3F WebGL Canvas */}
      <Canvas
        shadows
        dpr={dpr}
        performance={{ min: 0.65, max: 0.95, debounce: 200 }}
        frameloop={(ready && hasStarted) ? 'always' : 'never'}
      >
        {/* Camera starts at waypoint 0 position */}
        <PerspectiveCamera makeDefault position={WAYPOINTS[0].position} fov={60} near={0.1} far={1000} />
        <color attach="background" args={['#050510']} />

        {/* Scroll-driven smooth camera rig */}
        <CameraRig />

        {/* Adaptive DPR: Dynamically degrades pixel ratio on heavy load */}
        <AdaptiveDpr pixelated />

        {ready && (
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        )}
      </Canvas>
    </div>
  )
}

export default App
