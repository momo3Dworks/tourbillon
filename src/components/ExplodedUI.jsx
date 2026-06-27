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
        animation: 'tooltipFadeIn 0.15s ease forwards',
      }}
    >
      {tooltip.text}
    </div>
  )
}

// ─── Left-Side Info Panel ────────────────────────────────────────────────────
const InfoModal = () => {
  const { activeModal, setActiveModal, setActiveSection, isExploded } = useExploded()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (activeModal) {
      // tiny delay so CSS transition fires
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [activeModal])

  const handleClose = (e) => {
    e && e.stopPropagation()
    setActiveModal(null)
    setActiveSection(null)
  }

  if (!activeModal) return null

  let titleTop = ''
  let titleBottom = ''
  let sectionTag = ''
  if (activeModal === 'science') {
    titleTop = 'The Science'
    titleBottom = '/ Information'
    sectionTag = 'Knowledge'
  } else if (activeModal === 'suites') {
    titleTop = 'Book a Room'
    titleBottom = ''
    sectionTag = 'Accommodation'
  } else if (activeModal === 'adventures') {
    titleTop = 'THEsuites'
    titleBottom = ''
    sectionTag = 'Experiences'
  } else if (activeModal === 'events') {
    titleTop = 'Events'
    titleBottom = '/ General Info'
    sectionTag = 'Community'
  }

  const isRight = isExploded === 'south'

  return (
    // Side panel container — no backdrop, panel slides in
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: isRight ? 'auto' : 0,
        right: isRight ? 0 : 'auto',
        bottom: 0,
        width: '45vw',
        zIndex: 3000,
        pointerEvents: visible ? 'auto' : 'none',
        // subtle dark vignette on the panel side only
        background: isRight
          ? 'linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 100%)'
          : 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 100%)',
      }}
    >
      {/* Slide-in panel */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: isRight ? 'auto' : '0',
          right: isRight ? '0' : 'auto',
          transform: visible
            ? `translateY(-50%) translateX(0)`
            : `translateY(-50%) translateX(${isRight ? '100%' : '-100%'})`,
          transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
          width: '100%',
          maxWidth: '560px',
          minHeight: '380px',
          background: 'linear-gradient(135deg, rgba(4,9,20,0.97) 0%, rgba(6,16,32,0.97) 60%, rgba(0,24,40,0.97) 100%)',
          border: '1px solid rgba(0,255,255,0.28)',
          borderLeft: isRight ? '1px solid rgba(0,255,255,0.28)' : 'none',
          borderRight: isRight ? 'none' : '1px solid rgba(0,255,255,0.28)',
          borderRadius: isRight ? '16px 0 0 16px' : '0 16px 16px 0',
          boxShadow: '4px 0 60px rgba(0,255,255,0.12), inset 0 0 40px rgba(0,255,255,0.03)',
          display: 'flex',
          flexDirection: 'column',
          padding: '52px 48px 44px 52px',
          overflow: 'hidden',
        }}
      >
        {/* Accent top line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: isRight
            ? 'linear-gradient(-90deg, rgba(0,255,255,0.7) 0%, rgba(0,255,255,0.15) 60%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(0,255,255,0.7) 0%, rgba(0,255,255,0.15) 60%, transparent 100%)',
        }} />

        {/* Decorative corner — top right */}
        <div style={{
          position: 'absolute', top: '18px', right: '18px',
          width: '36px', height: '36px',
          borderTop: '1px solid rgba(0,255,255,0.55)',
          borderRight: '1px solid rgba(0,255,255,0.55)',
          borderRadius: '0 4px 0 0',
        }} />
        {/* Decorative corner — bottom right */}
        <div style={{
          position: 'absolute', bottom: '18px', right: '18px',
          width: '36px', height: '36px',
          borderBottom: '1px solid rgba(0,255,255,0.55)',
          borderRight: '1px solid rgba(0,255,255,0.55)',
          borderRadius: '0 0 4px 0',
        }} />

        {/* Close X */}
        <button
          id="section-panel-close-x"
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'transparent',
            border: '1px solid rgba(0,255,255,0.35)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: 'rgba(0,255,255,0.75)',
            cursor: 'pointer',
            fontSize: '14px',
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
            e.currentTarget.style.borderColor = 'rgba(0,255,255,0.35)'
            e.currentTarget.style.color = 'rgba(0,255,255,0.75)'
          }}
        >
          ✕
        </button>

        {/* Section tag */}
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '10px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: 'rgba(0,255,255,0.55)',
          margin: '0 0 20px 0',
        }}>
          — {sectionTag}
        </p>

        {/* Title */}
        <h2 style={{
          fontFamily: "'Inter', 'Outfit', sans-serif",
          fontSize: 'clamp(26px, 3.5vw, 44px)',
          fontWeight: 300,
          letterSpacing: '8px',
          textTransform: 'uppercase',
          color: '#ffffff',
          margin: '0 0 8px 0',
          textShadow: '0 0 40px rgba(0,255,255,0.35)',
          lineHeight: 1.1,
        }}>
          {titleTop}
        </h2>
        {titleBottom && (
          <span style={{
            display: 'block',
            fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(12px, 1.4vw, 15px)',
            color: 'rgba(0,255,255,0.65)',
            letterSpacing: '5px',
            textTransform: 'uppercase',
            marginBottom: '28px',
          }}>
            {titleBottom}
          </span>
        )}

        {/* Separator */}
        <div style={{
          width: '80px',
          height: '1px',
          background: 'linear-gradient(90deg, rgba(0,255,255,0.7), transparent)',
          margin: titleBottom ? '0 0 28px 0' : '12px 0 28px 0',
        }} />

        {/* Placeholder body */}
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.8px',
          lineHeight: '1.9',
          margin: '0 0 auto 0',
          maxWidth: '380px',
        }}>
          Content coming soon.
        </p>

        {/* Bottom CTA row */}
        <div style={{
          display: 'flex',
          gap: '14px',
          marginTop: '40px',
          flexShrink: 0,
        }}>
          <button
            id="section-panel-close-btn"
            onClick={handleClose}
            style={{
              padding: '10px 32px',
              background: 'transparent',
              border: '1px solid rgba(0,255,255,0.45)',
              borderRadius: '4px',
              color: 'rgba(0,255,255,0.85)',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              fontSize: '10px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,255,255,0.1)'
              e.currentTarget.style.borderColor = '#00ffff'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,255,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(0,255,255,0.45)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ExplodedUI — root overlay ────────────────────────────────────────────────
const ExplodedUI = () => {
  const { isExploded, hoverTitle } = useExploded()
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
            fontWeight: '900',
            color: 'rgba(255,255,255,0.92)',
            margin: 0,
            textShadow: '0 0 40px rgba(0,255,255,0.3), 0 2px 24px rgba(0,0,0,0.8)',
            userSelect: 'none',
          }}
        >
          {isExploded === 'east' ? 'THEapothecary' : (isExploded === 'north' ? 'THEhotel' : 'THEstore')}
        </h1>
      </div>

      {/* ── Tooltip ───────────────────────────────────────── */}
      <Tooltip />

      {/* ── Scroll Tooltip ────────────────────────────────── */}
      <div
        id="scroll-tooltip"
        style={{
          position: 'fixed',
          whiteSpace: 'nowrap',
          backgroundColor: 'rgba(2, 70, 13, 0.4)',
          padding: '8px 20px',
          borderRadius: '5px',
          borderLeft: '2px solid rgb(0, 255, 255)',
          bottom: '10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgb(0, 255, 255)',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 300,
          letterSpacing: '2px',
          fontSize: '1rem',
          width: 'auto',
          textShadow: 'rgba(0, 255, 255, 0.6) 0px 0px 10px',
          pointerEvents: 'none',
          opacity: 1, // Will be controlled by CameraRig
          transition: 'opacity 0.3s',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(10px)',
        }}
      >
        Scroll down to meet THETourbillon
      </div>

      {/* ── Hover Title Tooltip ───────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          whiteSpace: 'nowrap',
          backgroundColor: 'rgba(2, 70, 13, 0.4)',
          padding: '8px 20px',
          borderRadius: '5px',
          borderLeft: '2px solid rgb(0, 255, 255)',
          bottom: '10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgb(0, 255, 255)',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 300,
          letterSpacing: '2px',
          fontSize: '1rem',
          width: 'auto',
          backdropFilter: 'blur(10px)',
          textShadow: 'rgba(0, 255, 255, 0.6) 0px 0px 10px',
          pointerEvents: 'none',
          opacity: hoverTitle && !isExploded ? 1 : 0,
          transition: 'opacity 0.3s',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {hoverTitle}
      </div>

      {/* ── Left-side section panel ───────────────────────── */}
      <InfoModal />

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
