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
      const timer = setTimeout(() => setIsReady(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [progress])

  const handleStart = () => {
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.inOut',
      onComplete: () => {
        setVisible(false)
        if (onStart) onStart()
      }
    })
  }

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
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
          <circle 
            cx="100" cy="100" r="90" 
            fill="none" stroke="rgba(0, 255, 255, 0.1)" strokeWidth="2" 
          />
          <circle 
            cx="100" cy="100" r="90" 
            fill="none" stroke="var(--color-cyan)" strokeWidth="2" 
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          bottom: '20px',
          color: 'var(--color-cyan)',
          fontSize: '16px',
          fontWeight: '300',
          letterSpacing: '4px',
          textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
        }}>
          {Math.round(progress)}%
        </div>
      </div>

      <div style={{
        marginTop: '60px',
        textAlign: 'center',
        color: '#00ffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {isReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <div style={{
              letterSpacing: '8px',
              fontSize: '14px',
              textTransform: 'uppercase',
              fontWeight: '400',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
            }}>
              ASSETS LOADED
            </div>
            <button
              onClick={handleStart}
              style={{
                background: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid #00ffff',
                color: '#00ffff',
                padding: '15px 40px',
                fontFamily: 'var(--font-primary)',
                letterSpacing: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '10rem',
                textTransform: 'uppercase',
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#00ffff'
                e.target.style.color = '#000'
                e.target.style.boxShadow = '0 0 40px rgba(0, 255, 255, 0.6)'
                e.target.style.letterSpacing = '10px'
                e.target.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(0, 255, 255, 0.05)'
                e.target.style.color = '#00ffff'
                e.target.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.1)'
                e.target.style.letterSpacing = '6px'
                e.target.style.transform = 'scale(1)'
              }}
            >
              START
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ letterSpacing: '6px', fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: '300' }}>
              TRANSMUTING SCENE
            </div>
            <div style={{ fontSize: '10px', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              Loading: {item ? item.split('/').pop() : 'Assets'} ({loaded}/{total})
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Loader
