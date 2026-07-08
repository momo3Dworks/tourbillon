import React, { useEffect, useState, useRef } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'

const Loader = ({ onStart }) => {
  const { progress, item, loaded, total } = useProgress()
  const [visible, setVisible] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const overlayRef = useRef()

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setIsReady(true)
        gsap.to(overlayRef.current, {
          backgroundColor: 'transparent',
          opacity: 0,
          duration: 1.5,
          ease: 'power2.inOut',
          onComplete: () => {
            setVisible(false)
            if (onStart) onStart()
          }
        })
      }, 1500) // Slightly longer wait to ensure shaders are compiled before fading
      return () => clearTimeout(timer)
    }
  }, [progress, onStart])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: 1000000000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary)'
      }}
    >
      {/* Circular Progress */}
      <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src="/Tourbillon_Logo.svg" 
          alt="Tourbillon Logo"
          style={{
            position: 'absolute',
            width: '70px',
            height: '70px',
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.4))'
          }}
        />
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          border: '2px solid rgba(0, 255, 255, 0.1)',
          borderTopColor: 'var(--color-cyan)',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    </div>
  )
}

export default Loader
