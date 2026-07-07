import React, { useEffect, useRef, useState } from 'react'
import { scrollProgress, triggerAutoBack } from '../CameraRig'

const LAST_WAYPOINT = 4.0   // final waypoint index
const EXIT_DELAY_MS = 2000  // 2s after arriving at last waypoint

const IntroOverlay = () => {
  const introRef = useRef(null)
  const tourbillonRef = useRef(null)

  // Track whether we've started the exit timer for the TOURBILLON block
  const exitTimerFired = useRef(false)
  const exitStartTime = useRef(null)
  const atLastWaypoint = useRef(false)
  const isReturningRef = useRef(false)
  
  const [isReturning, setIsReturning] = useState(false)

  useEffect(() => {
    let raf

    const tick = () => {
      const sp = scrollProgress.current

      if (triggerAutoBack.current && !isReturningRef.current) {
        isReturningRef.current = true
        setIsReturning(true)
      } else if (!triggerAutoBack.current && isReturningRef.current) {
        isReturningRef.current = false
        setIsReturning(false)
      }

      // ── "Hotel Herrera Productions / PRESENTS" ────────────────────────
      // Visible from waypoint 0 → ~2.8, centered in the descent
      let introOpacity = 0
      if (sp >= 0 && sp <= 3.0) {
        if (sp < 0.5) introOpacity = sp / 0.5
        else if (sp > 2.2) introOpacity = 1.0 - ((sp - 2.2) / 0.8)
        else introOpacity = 1.0
      }

      if (introRef.current) {
        const el = introRef.current
        const clamped = Math.max(0, Math.min(1, introOpacity))
        el.style.opacity = clamped
        // Subtle scale pulse as camera descends
        el.style.transform = `scale(${1 + sp * 0.025})`
        // Also drive the backdrop opacity proportionally
        el.style.setProperty('--bg-opacity', clamped * 0.4)
      }

      // ── TOURBILLON title block ─────────────────────────────────────────
      // Appears from ~2.8, held until 2s after we hit waypoint 4
      const now = performance.now()

      if (!atLastWaypoint.current && sp >= LAST_WAYPOINT - 0.05) {
        atLastWaypoint.current = true
        exitStartTime.current = now + EXIT_DELAY_MS
      }

      // Before triggering exit: fade in normally
      let tourbOpacity = 0
      let tourbY = 0 // translateY in px
      const exitStart = exitStartTime.current

      if (atLastWaypoint.current && exitStart !== null) {
        const elapsed = now - exitStart
        if (elapsed >= 0) {
          // Animate out over 900ms
          const t = Math.min(elapsed / 900, 1)
          const eased = t * t * (3 - 2 * t) // smoothstep
          tourbOpacity = 1.0 - eased
          tourbY = -eased * 50 // slides up 50px
        } else {
          tourbOpacity = 1.0
        }
      } else if (sp >= 2.8) {
        const t = Math.min((sp - 2.8) / 0.4, 1)
        tourbOpacity = t
      }

      if (tourbillonRef.current) {
        const el = tourbillonRef.current
        const clamped = Math.max(0, Math.min(1, tourbOpacity))
        el.style.opacity = clamped
        el.style.transform = `translateY(${tourbY}px)`
        el.style.setProperty('--bg-opacity', clamped * 0.4)
      }

      raf = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  // Shared backdrop style: horizontal gradient, transparent on both ends
  const backdropStyle = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.4) 20%, rgba(0,0,0,0.4) 80%, transparent 100%)',
    zIndex: 0,
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        pointerEvents: 'none',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Hotel Herrera Productions / PRESENTS ── */}
      <div
        ref={introRef}
        style={{
          position: 'absolute',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          padding: '28px 0',
          overflow: 'hidden',
        }}
      >
        {/* Gradient backdrop */}
        <div style={backdropStyle} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: isReturning ? '2.5rem' : '1.9rem',
            fontWeight: 300,
            letterSpacing: '5px',
            color: '#eeeeee',
            fontFamily: 'Outfit, sans-serif',
            textShadow: '0 2px 20px rgba(0,0,0,0.9)',
            marginBottom: isReturning ? '0px' : '14px',
            textTransform: 'uppercase',
          }}>
            {isReturning ? 'Come' : 'Hotel Herrera'}
          </div>
          <div style={{
            fontSize: isReturning ? '2.5rem' : '1rem',
            fontWeight: 200,
            letterSpacing: isReturning ? '5px' : '14px',
            marginLeft: isReturning ? '5px' : '14px',
            color: '#aaaaaa',
            fontFamily: 'Outfit, sans-serif',
            textShadow: '0 2px 20px rgba(0,0,0,0.9)',
            textTransform: 'uppercase',
          }}>
            {isReturning ? 'back soon' : 'PRESENTS'}
          </div>
        </div>
      </div>

      {/* ── TOURBILLON + Line + Subtitle ── */}
      <div
        ref={tourbillonRef}
        style={{
          position: 'absolute',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: 0,
          padding: '36px 0',
          overflow: 'hidden',
          willChange: 'transform, opacity',
        }}
      >
        {/* Gradient backdrop */}
        <div style={backdropStyle} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Main title */}
          <div className='MainTitleIntro'>
            Tourbillon
          </div>

          {/* Separator line */}
          <div
            style={{
              width: '100%',
              height: '1px',
              background: 'rgba(255,255,255,0.65)',
              marginTop: '12px',
              marginBottom: '14px',
              boxShadow: '0 0 8px rgba(0,255,255,0.4)',
            }}
          />

          {/* Subtitle — letter-spacing fills the width of the line */}
          <div className='MainTitleSubtitle'>
            Hotel Herrera Panamá Digital Embassy
          </div>
        </div>
      </div>
    </div>
  )
}

export default IntroOverlay
