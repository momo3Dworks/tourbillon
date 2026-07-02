import React, { useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, AdaptiveDpr } from '@react-three/drei'
import Navbar from './components/Navbar'
import Loader from './components/Loader'
import Experience from './Experience'
import CameraRig, { WAYPOINTS } from './CameraRig'
import { Leva } from 'leva'

import { useExploded } from './ExplodedContext'
import ExplodedUI from './components/ExplodedUI'
import { setIsMobile as setGlobalIsMobile } from './store/audioStore'

import './index.css'

// ── ExplodedViewButton ────────────────────────────────────────────────────────
// Rendered outside the Canvas so position:fixed is relative to the real viewport
const ExplodedViewButton = () => {
  const { isExploded, setExploded } = useExploded()
  if (!isExploded) return null
  return (
    <button
      onClick={() => setExploded(false)}
      style={{
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 32px',
        background: 'rgba(5, 15, 20, 0.85)',
        border: '1px solid #00ffff',
        color: '#00ffff',
        cursor: 'pointer',
        zIndex: 1000,
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.45)',
        fontFamily: 'sans-serif',
        fontSize: '13px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        backdropFilter: 'blur(6px)',
        transition: 'box-shadow 0.3s ease',
        pointerEvents: 'auto',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 35px rgba(0,255,255,0.75)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,255,0.45)' }}
    >
      ← Back to Tourbillon
    </button>
  )
}


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
  const { isMobile, dpr } = useMemo(() => {
    if (typeof window === 'undefined') return { isMobile: false, dpr: 1 }
    const mobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    return {
      isMobile: mobile,
      dpr: mobile ? Math.min(window.devicePixelRatio, 0.75) : Math.min(window.devicePixelRatio, 0.95)
    }
  }, [])

  useEffect(() => {
    setGlobalIsMobile(isMobile)
  }, [isMobile])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>

      {/* UI Components */}
      {/* Press H to toggle panel */}
      <Leva hidden={levaHidden} collapsed={false} />
      <Loader onStart={() => setHasStarted(true)} />
      <Navbar />
      {/* DOM-level exploded view return button — position:fixed relative to real viewport */}
      <ExplodedViewButton />
      {/* Exploded View overlay: title, tooltip, science panel */}
      <ExplodedUI />

      {/* R3F WebGL Canvas */}
      <Canvas
        shadows
        dpr={dpr}
        performance={{ min: 0.75, max: 0.95, debounce: 200 }}
        frameloop={(ready && hasStarted) ? 'always' : 'never'}
      >
        {/* Camera starts at waypoint 0 position. FOV 80 for mobile, 60 for desktop */}
        <PerspectiveCamera makeDefault position={WAYPOINTS[0].position} fov={isMobile ? 110 : 60} near={0.1} far={1000} />
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
