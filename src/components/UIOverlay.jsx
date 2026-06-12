import React, { useState } from 'react'

const UIOverlay = ({ emissiveIntensity = 3.0, setEmissiveIntensity }) => {
  const [isVisible, setIsVisible] = useState(true)

  return (
    <div style={{
      position: 'absolute',
      bottom: '40px',
      right: '40px',
      zIndex: 100000,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Example of JourneyModeSelector style button */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.8) 0%, rgba(0, 0, 0, 0.1) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '15px 15px',
        backdropFilter: 'blur(20px) saturate(120%)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
        fontFamily: 'var(--font-primary)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '4px', height: '4px', background: 'var(--color-cyan)', borderRadius: '50%', boxShadow: '0 0 8px var(--color-cyan)' }} />
          <h3 style={{ margin: 0, fontSize: '11px', color: '#fff', letterSpacing: '4px', fontWeight: '300', textTransform: 'uppercase' }}>
            Interactive Demo
          </h3>
        </div>

        <button
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderLeft: '3px solid rgba(255, 255, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.8)',
            padding: '12px 15px',
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '2px',
            transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            textTransform: 'uppercase'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; 
            e.currentTarget.style.borderLeftColor = '#fff'; 
            e.currentTarget.style.color = '#fff'; 
            e.currentTarget.style.paddingLeft = '22px'; 
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.background = 'transparent'; 
            e.currentTarget.style.borderLeftColor = 'rgba(255, 255, 255, 0.3)'; 
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; 
            e.currentTarget.style.paddingLeft = '15px'; 
          }}
        >
          EXPLORE SCENE
        </button>

        <button
          style={{
            background: 'rgba(0, 255, 255, 0.05)',
            border: '1px solid #00ffff',
            color: '#00ffff',
            padding: '12px 15px',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '6px',
            cursor: 'pointer',
            fontSize: '10px',
            borderRadius: '10rem',
            textTransform: 'uppercase',
            transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
            textAlign: 'center'
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

        {/* Emissive Intensity Control */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.5)',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>
              LIGHT EMISSION
            </span>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: 'var(--color-cyan)',
              textShadow: `0 0 8px rgba(0, 255, 255, ${Math.min(emissiveIntensity / 5, 1)})`,
              fontWeight: 'bold'
            }}>
              {emissiveIntensity.toFixed(1)}
            </span>
          </div>
          
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={emissiveIntensity}
            onChange={(e) => setEmissiveIntensity(parseFloat(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: 'var(--color-cyan)',
              background: 'rgba(255, 255, 255, 0.1)',
              height: '4px',
              borderRadius: '2px',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxShadow: `0 0 10px rgba(0, 255, 255, ${Math.min(emissiveIntensity / 10, 0.4)})`
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default UIOverlay
