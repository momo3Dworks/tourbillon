import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAlquimiaStore from '../store/useAlquimiaStore'
import gsap from 'gsap'
import translations from '../locales/translations.json'

const Navbar = (props) => {
  const navigate = useNavigate()
  const navigateToWaypoint = useAlquimiaStore((state) => state.navigateToWaypoint)
  const targetScroll = useAlquimiaStore((state) => state.targetScroll)
  const isArtifactActive = useAlquimiaStore((state) => state.isArtifactActive)
  const isModalOpen = useAlquimiaStore((state) => state.isModalOpen)
  const setIsModalOpen = useAlquimiaStore((state) => state.setIsModalOpen)
  const isTimeAnomalyActive = useAlquimiaStore((state) => state.isTimeAnomalyActive)
  const setIsTimeAnomalyActive = useAlquimiaStore((state) => state.setIsTimeAnomalyActive)
  const isExploded = useAlquimiaStore((state) => state.isExploded)
  const isPlaying = useAlquimiaStore((state) => state.isPlaying)
  const setIsPlaying = useAlquimiaStore((state) => state.setIsPlaying)
  const language = useAlquimiaStore((state) => state.language)
  const setLanguage = useAlquimiaStore((state) => state.setLanguage)
  const journeyMode = useAlquimiaStore((state) => state.journeyMode)
  const setJourneyMode = useAlquimiaStore((state) => state.setJourneyMode)
  const setPendingInspect = useAlquimiaStore((state) => state.setPendingInspect)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNootropicsOpen, setIsNootropicsOpen] = useState(false)
  const nootropicsRef = useRef(null)
  const mobileNootropicsRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isOutsideDesktop = nootropicsRef.current && !nootropicsRef.current.contains(e.target)
      const isOutsideMobile = mobileNootropicsRef.current && !mobileNootropicsRef.current.contains(e.target)
      
      if (isOutsideDesktop && isOutsideMobile) {
        setIsNootropicsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const t = translations[language]

  const waypoints = [
    { name: t.nav.entrance, index: 0 },
    { name: t.nav.artifact, index: 1 },
    { name: t.nav.arise, index: 2 },
    { name: t.nav.awakening, index: 3 },
    { name: t.nav.deconstructed, index: 4 }
  ]

  const handleNavClick = (index) => {
    // Entrance y THEArtifact siempre funcionan
    if (index <= 1) {
      navigateToWaypoint(index)
      setIsMenuOpen(false)
      return
    }

    // Arise, THExperience y Deconstructed requieren activación
    if (!isArtifactActive) {
      setIsModalOpen(true)
      return
    }

    navigateToWaypoint(index)
    setIsMenuOpen(false)
  }

  const renderNootropicsItems = (isMobile = false) => {
    const handleInspect = (part) => {
      setPendingInspect(part);
      setIsNootropicsOpen(false);
      if (isMobile) setIsMenuOpen(false);
    };

    return (
      <>
        {/* The Cosmos → circleOuter */}
        <button className="ntrop-item" onClick={() => handleInspect('circleOuter')}>
          <div className="ntrop-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>
          </div>
          <div className="ntrop-text">
            <span className="ntrop-title">The Cosmos</span>
            <span className="ntrop-sub">The universal force</span>
          </div>
        </button>

        {/* THEVision → triangle */}
        <button className="ntrop-item" onClick={() => handleInspect('triangle')}>
          <div className="ntrop-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="1.5"><path d="M12 3L22 20H2L12 3z" /></svg>
          </div>
          <div className="ntrop-text">
            <span className="ntrop-title">THEVision</span>
            <span className="ntrop-sub"> The upward motion of intention, f ire, and ambition</span>
          </div>
        </button>

        {/* The Veil → circleInner */}
        <button className="ntrop-item" onClick={() => handleInspect('circleInner')}>
          <div className="ntrop-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="1.5"><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" fill="#00ffff" opacity="0.4" /></svg>
          </div>
          <div className="ntrop-text">
            <span className="ntrop-title">The Veil</span>
            <span className="ntrop-sub">THE VEIL + THE VESSEL</span>
          </div>
        </button>

        {/* Flask + DNA */}
        <button className="ntrop-item" onClick={() => handleInspect('flask')}>
          <div className="ntrop-icon">
            <svg width="16" height="16" viewBox="0 0 24 28" fill="none" stroke="#00ffff" strokeWidth="1.5"><path d="M9 2v8L3 22a3 3 0 0 0 2.7 4H18.3A3 3 0 0 0 21 22L15 10V2" /><line x1="9" y1="2" x2="15" y2="2" /></svg>
          </div>
          <div className="ntrop-text">
            <span className="ntrop-title">Nootropic Code</span>
            <span className="ntrop-sub">It is the physical space where elements are combined and refined.</span>
          </div>
        </button>

        {/* The Structure → square */}
        <button className="ntrop-item" onClick={() => handleInspect('square')}>
          <div className="ntrop-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="1" /><rect x="8" y="8" width="8" height="8" opacity="0.4" fill="#00ffff" /></svg>
          </div>
          <div className="ntrop-text">
            <span className="ntrop-title">The Structure</span>
            <span className="ntrop-sub">Matter. Discipline. Embodiment.</span>
          </div>
        </button>
      </>
    );
  };

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 5vw',
        boxSizing: 'border-box',
        zIndex: 26745350,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
        backdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.5)',
        transition: 'all 0.4s ease',
        ...props.style
      }}>
        {/* Logo Area */}
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '15px' }}
          onClick={() => handleNavClick(0)}
        >
          <img
            src="/assets/AlquimaLogo.svg"
            alt="Alquimia Logo"
            style={{
              height: '40px',
              width: 'auto',
              filter: 'invert(1) drop-shadow(0 0 10px rgba(0, 255, 255, 0.4))'
            }}
          />
          <div className="nav-logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '18px',
              fontWeight: '300',
              letterSpacing: '4px',
              color: 'var(--color-cyan)',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
            }}>
              ALQUIMIA
            </span>
            {journeyMode && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.6)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginTop: '2px'
              }}>
                {journeyMode === 'mad' ? 'MAD Adventure selected' : 'Standard Scroll selected'}
              </span>
            )}
          </div>
        </div>

        {/* Desktop Links */}
        <div className="nav-links" style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'center'
        }}>
          {/* Audio & Language Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginRight: '10px' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isPlaying ? 'var(--color-cyan)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                opacity: 0.7,
                padding: '5px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.transform = 'scale(1)' }}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => navigate(`/${language === 'en' ? 'es' : 'en'}`)}
              style={{
                background: 'none',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                color: 'var(--color-cyan)',
                fontFamily: 'monospace',
                fontSize: '10px',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                letterSpacing: '1px'
              }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.1)'; e.target.style.border = '1px solid var(--color-cyan)' }}
              onMouseLeave={(e) => { e.target.style.background = 'none'; e.target.style.border = '1px solid rgba(0, 255, 255, 0.3)' }}
            >
              {language === 'en' ? 'EN' : 'ES'}
            </button>
          </div>

          {waypoints.map((wp) => (
            <button
              key={wp.index}
              onClick={() => handleNavClick(wp.index)}
              style={{
                background: 'none',
                border: 'none',
                color: Math.floor(targetScroll) === wp.index ? 'var(--color-cyan)' : '#fff',
                fontFamily: 'var(--font-primary)',
                fontSize: '12px',
                letterSpacing: '2px',
                cursor: 'pointer',
                position: 'relative',
                padding: '10px 0',
                transition: 'color 0.3s ease',
                opacity: Math.floor(targetScroll) === wp.index ? 1 : 0.6
              }}
              onMouseEnter={(e) => { e.target.style.opacity = 1; e.target.style.color = 'var(--color-cyan)' }}
              onMouseLeave={(e) => {
                if (Math.floor(targetScroll) !== wp.index) {
                  e.target.style.opacity = 0.6;
                  e.target.style.color = '#fff'
                }
              }}
            >
              {wp.name}
              {Math.floor(targetScroll) === wp.index && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: '1px',
                  background: 'var(--color-cyan)',
                  boxShadow: '0 0 10px var(--color-cyan)'
                }} />
              )}
            </button>
          ))}
        </div>

        {/* ─── ALQUIMIA NOOTROPICS DROPDOWN ─── */}
        <div ref={nootropicsRef} className="desktop-nootropics" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <button
            onClick={() => setIsNootropicsOpen(!isNootropicsOpen)}
            style={{
              background: isNootropicsOpen ? 'rgba(0,255,255,0.15)' : 'transparent',
              border: '1px solid rgba(0,255,255,0.35)',
              color: isNootropicsOpen ? '#00ffff' : 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '2px',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00ffff'; e.currentTarget.style.color = '#00ffff' }}
            onMouseLeave={(e) => { if (!isNootropicsOpen) { e.currentTarget.style.borderColor = 'rgba(0,255,255,0.35)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' } }}
          >
            {/* Alchemical flask icon */}
            <svg width="12" height="14" viewBox="0 0 24 28" fill="currentColor" style={{ opacity: 0.9 }}>
              <path d="M9 2v8L3 22a3 3 0 0 0 2.7 4.3h12.6A3 3 0 0 0 21 22L15 10V2H9zm0 2h6v7.5l5.7 11.2A1 1 0 0 1 19.7 24H4.3a1 1 0 0 1-.9-1.3L9 11.5V4z" />
            </svg>
            ALQUIMIA PAGES
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ transform: isNootropicsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>

          {/* Dropdown panel */}
          {isNootropicsOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, rgba(10,15,20,0.97) 0%, rgba(0,5,10,0.95) 100%)',
              border: '1px solid rgba(0,255,255,0.2)',
              borderRadius: '12px',
              padding: '16px 12px',
              backdropFilter: 'blur(20px) saturate(120%)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              minWidth: '220px',
              zIndex: 99999999,
              animation: 'dropdownFade 0.2s ease-out'
            }}>
              <style>{`
                @keyframes dropdownFade {
                  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
                  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                .ntrop-item { display: flex; align-items: center; gap: 14px; width: 100%; background: transparent; border: none; padding: 10px 12px; border-radius: 6px; cursor: pointer; transition: all 0.25s cubic-bezier(0.23,1,0.32,1); text-align: left; border-left: 2px solid transparent; }
                .ntrop-item:hover { background: rgba(0,255,255,0.06); border-left-color: rgba(0,255,255,0.6); padding-left: 18px; }
                .ntrop-icon { flex-shrink: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(0,255,255,0.25); background: rgba(0,255,255,0.04); }
                .ntrop-text { display: flex; flex-direction: column; }
                .ntrop-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 2px; color: rgba(255,255,255,0.9); text-transform: uppercase; }
                .ntrop-sub { font-family: var(--font-primary); font-size: 9px; color: rgba(0,255,255,0.5); letter-spacing: 1px; margin-top: 2px; }
              `}</style>

              {renderNootropicsItems(false)}
            </div>
          )}
        </div>

        {/* Temporal Anomaly Simulation (Static in Navbar) */}
        {props.showForceAnomaly && (
          <button
            onClick={() => setIsTimeAnomalyActive(!isTimeAnomalyActive)}
            disabled={isExploded}
            style={{
              background: isTimeAnomalyActive ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 255, 0.1)',
              border: '1px solid rgba(0, 255, 255, 0.4)',
              color: '#00ffff',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: isExploded ? 'default' : 'pointer',
              opacity: isExploded ? 0.3 : 1,
              transition: 'all 0.3s ease',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginLeft: '20px'
            }}
            onMouseEnter={(e) => { if (!isTimeAnomalyActive && !isExploded) e.target.style.background = 'rgba(0, 255, 255, 0.3)' }}
            onMouseLeave={(e) => { if (!isTimeAnomalyActive && !isExploded) e.target.style.background = 'rgba(0, 255, 255, 0.1)' }}
          >
            {isTimeAnomalyActive ? 'ANOMALY ACTIVE' : 'SIMULATE ANOMALY'}
          </button>
        )}

        {/* Burger Button (Mobile) */}
        <div
          className="burger-menu"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: '6px',
            cursor: 'pointer',
            zIndex: 10000001
          }}
        >
          <div style={{ width: '25px', height: '2px', background: 'var(--color-cyan)', transition: '0.3s', transform: isMenuOpen ? 'rotate(45deg) translate(5px, 6px)' : 'none' }} />
          <div style={{ width: '25px', height: '2px', background: 'var(--color-cyan)', transition: '0.3s', opacity: isMenuOpen ? 0 : 1 }} />
          <div style={{ width: '25px', height: '2px', background: 'var(--color-cyan)', transition: '0.3s', transform: isMenuOpen ? 'rotate(-45deg) translate(5px, -6px)' : 'none' }} />
        </div>

        {/* Mobile Overlay */}
        {isMenuOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.95)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            zIndex: 10000000
          }}>
            {waypoints.map((wp) => (
              <button
                key={wp.index}
                onClick={() => handleNavClick(wp.index)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: Math.floor(targetScroll) === wp.index ? 'var(--color-cyan)' : '#fff',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '24px',
                  letterSpacing: '8px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  opacity: Math.floor(targetScroll) === wp.index ? 1 : 0.5,
                  transition: 'all 0.3s ease'
                }}
              >
                {wp.name}
              </button>
            ))}
            {/* ALQUIMIA NOOTROPICS DROPDOWN (MOBILE) */}
            <div ref={mobileNootropicsRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 40px', marginTop: '10px' }}>
              <button
                onClick={() => setIsNootropicsOpen(!isNootropicsOpen)}
                style={{
                  background: isNootropicsOpen ? 'rgba(0,255,255,0.15)' : 'transparent',
                  border: '1px solid rgba(0,255,255,0.35)',
                  color: isNootropicsOpen ? '#00ffff' : 'rgba(255,255,255,0.85)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '3px',
                  padding: '12px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%'
                }}
              >
                <svg width="14" height="16" viewBox="0 0 24 28" fill="currentColor">
                  <path d="M9 2v8L3 22a3 3 0 0 0 2.7 4.3h12.6A3 3 0 0 0 21 22L15 10V2H9zm0 2h6v7.5l5.7 11.2A1 1 0 0 1 19.7 24H4.3a1 1 0 0 1-.9-1.3L9 11.5V4z" />
                </svg>
                ALQUIMIA PAGES
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transform: isNootropicsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                  <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {isNootropicsOpen && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  marginTop: '10px',
                  background: 'rgba(0,5,10,0.6)',
                  border: '1px solid rgba(0,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                  animation: 'dropdownFade 0.2s ease-out'
                }}>
                  {renderNootropicsItems(true)}
                </div>
              )}
            </div>

            {/* Navigation Mode Selector for Mobile */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px', gap: '15px' }}>
              <span style={{ color: 'var(--color-cyan)', fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', opacity: 0.8 }}>Navigation Mode</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setJourneyMode('mad')}
                  style={{
                    background: journeyMode === 'mad' ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                    border: '1px solid ' + (journeyMode === 'mad' ? 'var(--color-cyan)' : 'rgba(255, 255, 255, 0.3)'),
                    color: journeyMode === 'mad' ? 'var(--color-cyan)' : '#fff',
                    padding: '8px 16px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'all 0.3s'
                  }}
                >
                  MAD
                </button>
                <button
                  onClick={() => setJourneyMode('scroll')}
                  style={{
                    background: journeyMode === 'scroll' ? 'rgba(0, 255, 255, 0.2)' : 'transparent',
                    border: '1px solid ' + (journeyMode === 'scroll' ? 'var(--color-cyan)' : 'rgba(255, 255, 255, 0.3)'),
                    color: journeyMode === 'scroll' ? 'var(--color-cyan)' : '#fff',
                    padding: '8px 16px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'all 0.3s'
                  }}
                >
                  STANDARD
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '30px', marginTop: '20px', alignItems: 'center' }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isPlaying ? 'var(--color-cyan)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8,
                  padding: '10px'
                }}
              >
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => navigate(`/${language === 'en' ? 'es' : 'en'}`)}
                style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                  color: 'var(--color-cyan)',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  letterSpacing: '2px'
                }}
              >
                {language === 'en' ? 'EN' : 'ES'}
              </button>
            </div>

            {props.showForceAnomaly && (
              <button
                onClick={() => { setIsTimeAnomalyActive(!isTimeAnomalyActive); setIsMenuOpen(false); }}
                disabled={isExploded}
                style={{
                  background: isTimeAnomalyActive ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                  color: '#00ffff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: isExploded ? 'default' : 'pointer',
                  opacity: isExploded ? 0.3 : 1,
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginTop: '10px'
                }}
              >
                {isTimeAnomalyActive ? 'ANOMALY ACTIVE' : 'SIMULATE ANOMALY'}
              </button>
            )}

          </div>
        )}
      </nav>

      {/* Modal - Fuera del nav para evitar recortes y conflictos de z-index */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(15px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999999, // Superior a la NavBar
          padding: '20px',
          boxSizing: 'border-box',
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'rgba(20,20,20,0.95)',
            border: '1px solid var(--color-cyan)',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 0 100px rgba(0, 255, 255, 0.3)',
            borderRadius: '8px',
            position: 'relative'
          }}>
            <h2 style={{
              color: 'var(--color-cyan)',
              fontFamily: 'var(--font-primary)',
              fontSize: '28px',
              letterSpacing: '4px',
              marginBottom: '20px',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
            }}>
              RESTRICTED ACCESS
            </h2>
            <p style={{
              color: '#fff',
              fontFamily: 'var(--font-primary)',
              fontSize: '18px',
              lineHeight: '1.6',
              marginBottom: '40px',
              opacity: 0.9
            }}>
              You need to approach the Artifact and activate it to continue the experience.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexDirection: window.innerWidth < 480 ? 'column' : 'row' }}>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  navigateToWaypoint(1) // Ir al WP 2 (TheArtifact)
                  setIsMenuOpen(false)
                }}
                style={{
                  background: 'var(--color-cyan)',
                  border: 'none',
                  color: '#000',
                  padding: '15px 30px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)'
                }}
                onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.6)' }}
                onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.4)' }}
              >
                Approach the Artifact
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '15px 30px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for responsiveness */}
      <style>{`
        @media (max-width: 1000px) {
          .nav-links {
            display: none !important;
          }
          .desktop-nootropics {
            display: none !important;
          }
          .burger-menu {
            display: flex !important;
          }
        }
        @media (min-width: 480px) {
          nav span {
            display: block !important;
          }
        }
      `}</style>
    </>
  )
}

export default Navbar
