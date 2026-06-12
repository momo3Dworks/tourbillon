import React, { useState } from 'react'

const Navbar = (props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [language, setLanguage] = useState('en')

  const waypoints = [
    { name: 'ENTRANCE', index: 0 },
    { name: 'THE ARTIFACT', index: 1 },
    { name: 'ARISE', index: 2 },
  ]
  const targetScroll = 0

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
        >
          {/* Replaced svg logo for a simple placeholder that resembles the intended filter */}
          <img 
            src="/Tourbillon_Logo.svg" 
            alt="Tourbillon Logo"
            style={{
              width: '40px',
              height: '40px',
              filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.4))'
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
              TOURBILLON
            </span>
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
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
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
              style={{
                background: 'none',
                border: 'none',
                color: targetScroll === wp.index ? 'var(--color-cyan)' : '#fff',
                fontFamily: 'var(--font-primary)',
                fontSize: '12px',
                letterSpacing: '2px',
                cursor: 'pointer',
                position: 'relative',
                padding: '10px 0',
                transition: 'color 0.3s ease',
                opacity: targetScroll === wp.index ? 1 : 0.6
              }}
              onMouseEnter={(e) => { e.target.style.opacity = 1; e.target.style.color = 'var(--color-cyan)' }}
              onMouseLeave={(e) => {
                if (targetScroll !== wp.index) {
                  e.target.style.opacity = 0.6;
                  e.target.style.color = '#fff'
                }
              }}
            >
              {wp.name}
              {targetScroll === wp.index && (
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
                onClick={() => setIsMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: targetScroll === wp.index ? 'var(--color-cyan)' : '#fff',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '24px',
                  letterSpacing: '8px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  opacity: targetScroll === wp.index ? 1 : 0.5,
                  transition: 'all 0.3s ease'
                }}
              >
                {wp.name}
              </button>
            ))}

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
                onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
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
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 1000px) {
          .nav-links {
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
