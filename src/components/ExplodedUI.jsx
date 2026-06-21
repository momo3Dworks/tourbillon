import React, { useEffect, useRef, useState } from 'react'
import { useExploded } from '../ExplodedContext'

// ─── Tooltip ────────────────────────────────────────────────────────────────
const Tooltip = () => {
  const { tooltip } = useExploded()
  const ref = useRef(null)
  const pos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY }
      if (ref.current) {
        ref.current.style.left = `${e.clientX + 18}px`
        ref.current.style.top = `${e.clientY - 10}px`
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  if (!tooltip) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: `${pos.current.x + 18}px`,
        top: `${pos.current.y - 10}px`,
        pointerEvents: 'none',
        zIndex: 2000,
        background: 'rgba(5, 10, 18, 0.88)',
        border: '1px solid rgba(0,255,255,0.45)',
        borderRadius: '6px',
        padding: '7px 14px',
        color: '#00ffff',
        fontFamily: "'Inter', 'Outfit', sans-serif",
        fontSize: '12px',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 18px rgba(0,255,255,0.25)',
        whiteSpace: 'nowrap',
        // animate in
        animation: 'tooltipFadeIn 0.15s ease forwards',
      }}
    >
      {tooltip.text}
    </div>
  )
}

// ─── Science / Information Panel ─────────────────────────────────────────────
const SciencePanel = () => {
  const { sciencePanelOpen, setSciencePanelOpen } = useExploded()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sciencePanelOpen) {
      // tiny delay so CSS transition fires
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [sciencePanelOpen])

  if (!sciencePanelOpen) return null

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation()
          setSciencePanelOpen(false)
        }
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '60vw',
          height: '60vh',
          background: 'linear-gradient(145deg, rgba(5,10,22,0.97) 0%, rgba(8,20,36,0.97) 100%)',
          border: '1px solid rgba(0,255,255,0.35)',
          borderRadius: '16px',
          boxShadow: '0 0 60px rgba(0,255,255,0.18), inset 0 0 40px rgba(0,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 48px 40px',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(20px)',
          transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
          overflow: 'hidden',
        }}
      >
        {/* Decorative corner lines */}
        <div style={{
          position: 'absolute', top: '16px', left: '16px',
          width: '40px', height: '40px',
          borderTop: '1px solid rgba(0,255,255,0.6)',
          borderLeft: '1px solid rgba(0,255,255,0.6)',
          borderRadius: '2px 0 0 0',
        }} />
        <div style={{
          position: 'absolute', top: '16px', right: '16px',
          width: '40px', height: '40px',
          borderTop: '1px solid rgba(0,255,255,0.6)',
          borderRight: '1px solid rgba(0,255,255,0.6)',
          borderRadius: '0 2px 0 0',
        }} />
        <div style={{
          position: 'absolute', bottom: '16px', left: '16px',
          width: '40px', height: '40px',
          borderBottom: '1px solid rgba(0,255,255,0.6)',
          borderLeft: '1px solid rgba(0,255,255,0.6)',
          borderRadius: '0 0 0 2px',
        }} />
        <div style={{
          position: 'absolute', bottom: '16px', right: '16px',
          width: '40px', height: '40px',
          borderBottom: '1px solid rgba(0,255,255,0.6)',
          borderRight: '1px solid rgba(0,255,255,0.6)',
          borderRadius: '0 0 2px 0',
        }} />

        {/* Close X — top right */}
        <button
          id="science-panel-close-x"
          onClick={(e) => {
            e.stopPropagation()
            setSciencePanelOpen(false)
          }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: '1px solid rgba(0,255,255,0.4)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            color: 'rgba(0,255,255,0.8)',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 1,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0,255,255,0.12)'
            e.currentTarget.style.borderColor = '#00ffff'
            e.currentTarget.style.color = '#00ffff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(0,255,255,0.4)'
            e.currentTarget.style.color = 'rgba(0,255,255,0.8)'
          }}
        >
          ✕
        </button>

        {/* Content — scrollable */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          overflowY: 'auto',
          gap: '24px',
        }}>
          {/* Title */}
          <h2 style={{
            fontFamily: "'Inter', 'Outfit', sans-serif",
            fontSize: 'clamp(20px, 3vw, 32px)',
            fontWeight: 300,
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: '#ffffff',
            margin: 0,
            textAlign: 'center',
            textShadow: '0 0 30px rgba(0,255,255,0.4)',
          }}>
            The Science
            <span style={{
              display: 'block',
              fontSize: 'clamp(12px, 1.5vw, 16px)',
              color: 'rgba(0,255,255,0.7)',
              letterSpacing: '4px',
              marginTop: '8px',
            }}>
              / Information
            </span>
          </h2>

          {/* Separator */}
          <div style={{
            width: '60px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.6), transparent)',
          }} />

          {/* Placeholder body */}
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '1px',
            textAlign: 'center',
            maxWidth: '480px',
            lineHeight: '1.8',
            margin: 0,
          }}>
            Content coming soon.
          </p>
        </div>

        {/* Close button — bottom center */}
        <button
          id="science-panel-close-btn"
          onClick={(e) => {
            e.stopPropagation()
            setSciencePanelOpen(false)
          }}
          style={{
            marginTop: '32px',
            padding: '11px 36px',
            background: 'transparent',
            border: '1px solid rgba(0,255,255,0.5)',
            borderRadius: '4px',
            color: 'rgba(0,255,255,0.9)',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            fontSize: '11px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            transition: 'all 0.25s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0,255,255,0.1)'
            e.currentTarget.style.borderColor = '#00ffff'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,255,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(0,255,255,0.5)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── ExplodedUI — root overlay ────────────────────────────────────────────────
const ExplodedUI = () => {
  const { isExploded } = useExploded()
  const [titleVisible, setTitleVisible] = useState(false)

  useEffect(() => {
    if (isExploded) {
      // slight delay so the 3D transition starts first
      const t = setTimeout(() => setTitleVisible(true), 600)
      return () => clearTimeout(t)
    } else {
      setTitleVisible(false)
    }
  }, [isExploded])

  return (
    <>
      {/* ── "The Store" title ─────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: '3rem',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '36px',
          zIndex: 900,
          pointerEvents: 'none',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(-16px)',
          transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <h1
          id="exploded-view-title"
          style={{
            fontFamily: "'Inter', 'Outfit', sans-serif",
            fontWeight: 200,
            fontSize: 'clamp(22px, 3.5vw, 42px)',
            letterSpacing: '12px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.92)',
            margin: 0,
            textShadow: '0 0 40px rgba(0,255,255,0.3), 0 2px 24px rgba(0,0,0,0.8)',
            userSelect: 'none',
          }}
        >
          The Store
        </h1>
      </div>

      {/* ── Tooltip ───────────────────────────────────────── */}
      <Tooltip />

      {/* ── Science / Info panel ──────────────────────────── */}
      <SciencePanel />

      {/* ── Keyframe CSS ──────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400&family=Outfit:wght@200;300&display=swap');
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

export default ExplodedUI
