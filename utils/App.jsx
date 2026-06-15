import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three'
import Experience from './Experience'
import Navbar from './components/Navbar'
import { Perf } from 'r3f-webgpu-perf'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import useAlquimiaStore from './store/useAlquimiaStore'
import translations from './locales/translations.json'

const SHOW_FORCE_TIME_EVENT = false // Toggle para mostrar el botón de anomalía en el Navbar

const AudioManager = () => {
  const isPlayingGlobal = useAlquimiaStore((state) => state.isPlaying)
  const volume = useAlquimiaStore((state) => state.volume)
  const targetScroll = useAlquimiaStore((state) => state.targetScroll)
  const isTabActive = useAlquimiaStore((state) => state.isTabActive)
  const audiosRef = React.useRef({})

  useEffect(() => {
    // Inicializar todos los audios de los Waypoints
    const audioFiles = {
      wp1: '/assets/AlquimiaC4.mp3',
      wp2: '/assets/AlquimiaE4_G4.mp3',
      wp3: '/assets/AlquimiaB4.mp3',
      wp4: '/assets/AlquimiaD5_E5.mp3',
      wp5: '/assets/AlquimiaG5.mp3',
      clockwork: '/assets/clockwork.mp3'
    }

    Object.entries(audioFiles).forEach(([key, url]) => {
      const audio = new Audio(url)
      audio.loop = true
      audiosRef.current[key] = audio
    })

    return () => {
      Object.values(audiosRef.current).forEach(a => {
        a.pause()
        a.src = ""
      })
    }
  }, [])

  // Actualizar volumen de todas las capas
  useEffect(() => {
    Object.values(audiosRef.current).forEach(a => {
      a.volume = volume
    })
  }, [volume])

  // Lógica de activación por Waypoint con Fades suaves (GSAP)
  useEffect(() => {
    if (!isPlayingGlobal || !isTabActive) {
      Object.values(audiosRef.current).forEach(a => {
        if (!isTabActive) {
          // Si el usuario cambia de pestaña, pausar inmediatamente porque 
          // GSAP (requestAnimationFrame) se congela en pestañas inactivas.
          gsap.killTweensOf(a)
          a.pause()
        } else {
          // Si es pausa normal (isPlayingGlobal = false), hacer un fade out suave
          gsap.to(a, {
            volume: 0,
            duration: 1.5,
            ease: 'power2.inOut',
            overwrite: true,
            onComplete: () => {
              if (!useAlquimiaStore.getState().isPlaying || !useAlquimiaStore.getState().isTabActive) a.pause()
            }
          })
        }
      })
      return
    }

    const isExploded = useAlquimiaStore.getState().isExploded

    // Definir volúmenes objetivo según la posición del scroll
    const targetVolumes = {
      wp1: volume,
      wp2: targetScroll >= 1.0 ? volume : 0,
      wp3: targetScroll >= 2.0 ? volume : 0,
      wp4: targetScroll >= 3.0 ? volume : 0,
      wp5: (targetScroll >= 3.9 || isExploded) ? volume : 0
    }

    // Capa Clockwork dinámica (WP1 a WP4: 0.1 a 0.8)
    const rawClockwork = 0.003 + (targetScroll / 3.0) * 0.02
    const clockworkTarget = Math.max(0.001, Math.min(0.15, rawClockwork))
    const clockworkVolume = clockworkTarget * (volume / 0.1) // Escalar relativo al master (normalizado a 0.1)

    Object.entries(targetVolumes).forEach(([key, target]) => {
      const audio = audiosRef.current[key]
      if (!audio) return

      if (target > 0) {
        // Encender con Fade In
        if (audio.paused) {
          audio.volume = 0
          audio.play().catch(() => { })
        }
        gsap.to(audio, {
          volume: target,
          duration: 2.5,
          ease: 'power1.inOut',
          overwrite: true
        })
      } else {
        // Apagar con Fade Out
        gsap.to(audio, {
          volume: 0,
          duration: 2.0,
          ease: 'power1.inOut',
          overwrite: true,
          onComplete: () => {
            if (audio.volume === 0) audio.pause()
          }
        })
      }
    })

    // Manejar Clockwork por separado por su lógica de volumen continua
    if (audiosRef.current.clockwork) {
      if (isExploded) {
        // Detener mecanismos en modo Deconstructed
        gsap.to(audiosRef.current.clockwork, {
          volume: 0,
          duration: 1.5,
          ease: 'power2.inOut',
          onComplete: () => {
            if (isExploded) audiosRef.current.clockwork.pause()
          }
        })
      } else {
        // Reanudar mecanismos
        if (audiosRef.current.clockwork.paused && isPlayingGlobal) {
          audiosRef.current.clockwork.play().catch(() => { })
        }
        gsap.to(audiosRef.current.clockwork, {
          volume: clockworkVolume,
          duration: 2.0,
          ease: 'none',
          overwrite: true
        })
      }
    }
  }, [isPlayingGlobal, isTabActive, targetScroll, volume])

  // Lógica de SFX (Disparos únicos)
  const sfxTrigger = useAlquimiaStore((state) => state.sfxTrigger)
  useEffect(() => {
    if (sfxTrigger) {
      const sfx = new Audio(`/assets/${sfxTrigger.name}.mp3`)
      sfx.volume = Math.min(volume * 1, 0.8) // Los SFX suelen ser un poco más altos que el ambiente
      sfx.play().catch(() => { })
    }
  }, [sfxTrigger])

  return null
}

const LogoPiece = ({ src, index, isHovered, progress }) => {
  const ref = React.useRef()
  const threshold = index * 20
  const isActive = progress >= threshold
  const [hasActivated, setHasActivated] = React.useState(false)

  React.useEffect(() => {
    if (isActive && !hasActivated) {
      setHasActivated(true)
      // Efecto de 'ignición' cuando la pieza se activa por progreso
      gsap.fromTo(ref.current,
        { scale: 0.8, opacity: 0, filter: 'invert(1) brightness(0.1)' },
        {
          scale: 1,
          opacity: 0.9,
          filter: 'invert(1) sepia(1) saturate(5) hue-rotate(140deg) brightness(1.2)',
          duration: 1,
          ease: 'back.out(2)',
          onComplete: () => {
            gsap.to(ref.current, { filter: 'invert(1) sepia(1) saturate(5) hue-rotate(140deg) brightness(1)', duration: 0.5 })
          }
        }
      )
    }
  }, [isActive, hasActivated])

  const handleClick = (e) => {
    e.stopPropagation()

    // Super Explosión al click: Se aleja mucho más con fuerza extra
    const angle = (index / 5) * Math.PI * 2
    const superForce = 450 + Math.random() * 200

    gsap.to(ref.current, {
      x: Math.cos(angle) * superForce,
      y: Math.sin(angle) * superForce,
      rotation: '+=720',
      scale: 1.5,
      duration: 0.8,
      ease: 'power4.out',
      overwrite: 'auto'
    })
  }

  React.useEffect(() => {
    if (isHovered) {
      const angle = (index / 5) * Math.PI * 2
      const randomForce = 140 + Math.random() * 100
      gsap.to(ref.current, {
        x: Math.cos(angle) * randomForce,
        y: Math.sin(angle) * randomForce,
        rotation: 360 * (Math.random() > 0.5 ? 1 : -1) + (Math.random() * 180),
        scale: 0.8 + Math.random() * 0.4,
        duration: 1.5,
        ease: 'power4.out',
        overwrite: 'auto' // Evita que se quede "trabado" al entrar/salir rápido
      })
    } else {
      gsap.to(ref.current, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.7,
        ease: 'power3.out',
        overwrite: 'auto' // Evita que se quede "trabado" al entrar/salir rápido
      })
    }
  }, [isHovered, index])

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        opacity: isActive ? 0.9 : 0.3 // Las piezas inactivas son visibles pero tenues
      }}
    >
      <img
        src={`/assets/loader_svgs/${src}`}
        style={{
          width: '100%',
          height: '100%',
          filter: isActive
            ? 'invert(1) sepia(1) saturate(5) hue-rotate(140deg) brightness(1)'
            : 'invert(1) brightness(0.2)',
          transition: 'filter 0.3s ease'
        }}
        alt=""
      />
    </div>
  )
}

const OverlayLoader = ({ onStart }) => {
  const { progress } = useProgress()
  const [visible, setVisible] = React.useState(true)
  const [isHovered, setIsHovered] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)
  const setIsPlaying = useAlquimiaStore((state) => state.setIsPlaying)
  const language = useAlquimiaStore((state) => state.language)
  const overlayRef = React.useRef()

  const t = translations[language]

  const pieces = [
    'Logo_CircleOuter.png',
    'Logo_Triangle.png',
    'Logo_InnerCircle.png',
    'Logo_Square.png',
    'Logo_FlaskDNA.png'
  ]

  useEffect(() => {
    if (progress === 100) {
      // Pequeño delay para que la última pieza haga su pop antes de mostrar el botón
      const timer = setTimeout(() => setIsReady(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [progress])

  const handleStart = () => {
    setIsPlaying(true)
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.inOut',
      onComplete: () => {
        setVisible(false)
        onStart()
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
        overflow: 'hidden'
      }}
    >
      {/* Logo dinámico */}
      <div
        style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          cursor: isReady ? 'crosshair' : 'default',
          transition: 'transform 0.8s cubic-bezier(0.23, 1, 0.32, 1)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {pieces.map((src, i) => (
            <LogoPiece
              key={src}
              src={src}
              index={i}
              isHovered={isHovered}
              progress={progress}
            />
          ))}
        </div>

        {/* Círculo de interacción reactivo */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: isHovered ? '1px solid rgba(0, 255, 255, 0.4)' : '1px solid rgba(0, 255, 255, 0.1)',
          borderRadius: '50%',
          transform: isHovered ? 'scale(1.5)' : 'scale(1)',
          transition: 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* Info de carga / Botón de inicio */}
      <div style={{
        marginTop: '80px',
        textAlign: 'center',
        fontFamily: "'Outfit', sans-serif",
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
              color: '#00ffff',
              fontWeight: '400',
              textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
              marginBottom: '5px'
            }}>
              {t.loader.loaded}
            </div>
            <button
              onClick={handleStart}
              style={{
                background: 'rgba(0, 255, 255, 0.05)',
                border: '1px solid #00ffff',
                color: '#00ffff',
                padding: '15px 40px',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                borderRadius: '10rem',
                textTransform: 'uppercase',
                transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                pointerEvents: 'auto'
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
              {t.loader.start}
            </button>
            <div style={{
              letterSpacing: '4px',
              fontSize: '10px',
              textTransform: 'uppercase',
              opacity: 0.6,
              fontWeight: '300',
              marginTop: '10px'
            }}>
              {t.loader.transmuting}
            </div>
          </div>
        ) : (
          <div style={{ letterSpacing: '6px', fontSize: '12px', textTransform: 'uppercase', opacity: 0.8, fontWeight: '300' }}>
            {isHovered ? t.loader.transcendence : t.loader.transmuting}
          </div>
        )}
      </div>

      {!isHovered && (
        <div style={{
          position: 'absolute',
          bottom: '10%',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '11px',
          letterSpacing: '3px',
          fontFamily: "'Outfit', sans-serif",
          textTransform: 'uppercase'
        }}>
          {t.loader.hover}
        </div>
      )}
    </div>
  )
}

const CookieConsent = ({ onAccept }) => {
  const [visible, setVisible] = React.useState(false)
  const language = useAlquimiaStore((state) => state.language)
  const t = translations[language]

  useEffect(() => {
    const consent = localStorage.getItem('alquimia-consent')
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    } else {
      onAccept()
    }
  }, [onAccept])

  const handleAccept = () => {
    localStorage.setItem('alquimia-consent', 'true')
    gsap.to('.cookie-box', {
      y: 100,
      opacity: 0,
      duration: 1,
      ease: 'power4.in',
      onComplete: () => {
        setVisible(false)
        onAccept()
      }
    })
  }

  if (!visible) return null

  return (
    <div className="cookie-box" style={{
      position: 'fixed',
      bottom: '40px',
      right: '40px',
      width: '320px',
      background: 'rgba(0, 10, 20, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 255, 255, 0.2)',
      borderRadius: '15px',
      padding: '25px',
      zIndex: 100000000,
      fontFamily: "'Outfit', sans-serif",
      boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(0, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', background: '#00ffff', borderRadius: '50%', boxShadow: '0 0 10px #00ffff' }} />
        <span style={{ fontSize: '10px', letterSpacing: '4px', color: '#00ffff', fontWeight: '500' }}>
          {t.cookies.title}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', letterSpacing: '0.5px' }}>
        {t.cookies.text}
      </p>

      <button
        onClick={handleAccept}
        style={{
          background: 'transparent',
          border: '1px solid rgba(0, 255, 255, 0.5)',
          color: '#00ffff',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          letterSpacing: '3px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          textTransform: 'uppercase'
        }}
        onMouseEnter={(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.1)'; e.target.style.borderColor = '#00ffff' }}
        onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(0, 255, 255, 0.5)' }}
      >
        {t.cookies.accept}
      </button>
    </div>
  )
}

const JourneyModeSelector = () => {
  const language = useAlquimiaStore((state) => state.language)
  const t = translations[language]?.journeyMode || translations['en'].journeyMode
  const journeyMode = useAlquimiaStore((state) => state.journeyMode)
  const setJourneyMode = useAlquimiaStore((state) => state.setJourneyMode)
  const targetScroll = useAlquimiaStore((state) => state.targetScroll)
  const hasLeftStart = React.useRef(false)
  const [isBlinking, setIsBlinking] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => setIsBlinking(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    if (targetScroll > 0.5) {
      hasLeftStart.current = true
    } else if (targetScroll < 0.1 && hasLeftStart.current) {
      if (journeyMode !== null) {
        setJourneyMode(null)
      }
      hasLeftStart.current = false
    }
  }, [targetScroll, journeyMode, setJourneyMode])

  // Solo mostrar en la entrada (WP 1) y si no se ha elegido modo
  if (journeyMode !== null || targetScroll > 0.5) return null;

  return (
    <div className='journeyMode' style={{
      position: 'absolute',
      bottom: '40px',
      right: '40px',
      width: 'auto',
      zIndex: 1000000000,
      background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.8) 0%, rgba(0, 0, 0, 0.1) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '15px 15px',
      backdropFilter: 'blur(20px) saturate(120%)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
      fontFamily: 'var(--font-primary)',
      color: '#fff',
      animation: `fadeIn 1s ease-out${isBlinking ? ', pulseBorder 2s infinite ease-in-out' : ''}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }}>
      <style>{`
        @keyframes pulseBorder {
          0% { border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8); }
          50% { border-color: rgba(0, 255, 255, 0.6); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 255, 255, 0.4); }
          100% { border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '4px', height: '4px', background: 'var(--color-cyan)', borderRadius: '50%', boxShadow: '0 0 8px var(--color-cyan)' }} />
        <h3 style={{ margin: 0, fontSize: '11px', color: '#fff', letterSpacing: '4px', fontWeight: '300', textTransform: 'uppercase' }}>
          {t.title}
        </h3>
      </div>

      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '300' }}>
        {t.subtitle}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px' }}>
        <button className='setJournetMode'
          onClick={() => setJourneyMode('mad')}
          style={{
            background: 'rgba(9, 109, 6, 0.33)',
            border: '1px solid rgba(0, 255, 255, 0.15)',
            borderLeft: '3px solid var(--color-cyan)',
            color: 'var(--color-cyan)',
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 255, 255, 0.15)'; e.currentTarget.style.paddingLeft = '22px'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 255, 255, 0.05)'; e.currentTarget.style.paddingLeft = '15px'; }}
        >
          {t.mad}
          <span className='ToDisplayNone' style={{ display: 'block', fontSize: '8px', color: 'rgba(0,255,255,0.5)', marginTop: '4px', letterSpacing: '1px' }}>{t.madSub}</span>
        </button>

        <button className='setJournetMode'
          onClick={() => setJourneyMode('scroll')}
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderLeftColor = '#fff'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.paddingLeft = '22px'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; e.currentTarget.style.paddingLeft = '15px'; }}
        >
          {t.scroll}
          <span className='ToDisplayNone' style={{ display: 'block', fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', letterSpacing: '1px' }}>{t.scrollSub}</span>
        </button>
      </div>
    </div>
  )
}

function MainApp() {
  const [ready, setReady] = React.useState(false)
  const [hasStarted, setHasStarted] = React.useState(false)
  const [hasConsent, setHasConsent] = React.useState(false)
  const isTabActive = useAlquimiaStore((state) => state.isTabActive)
  const isRestoring = useAlquimiaStore((state) => state.isRestoring)

  // Optimización de Pixel Ratio (DPR) para Móviles vs Desktop
  const dpr = React.useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? Math.min(window.devicePixelRatio, 0.75) : Math.min(window.devicePixelRatio, 1);
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <AudioManager isTabActive={isTabActive} />
      <CookieConsent onAccept={() => setHasConsent(true)} />

      <OverlayLoader onStart={() => setHasStarted(true)} />

      {hasStarted && hasConsent && <JourneyModeSelector />}

      <Navbar
        showForceAnomaly={SHOW_FORCE_TIME_EVENT}
        style={{
          zIndex: 100000000,
          opacity: (hasStarted && hasConsent) ? 1 : 0,
          transition: 'opacity 1s ease',
          pointerEvents: (hasStarted && hasConsent) ? 'auto' : 'none'
        }}
      />

      <Canvas
        dpr={dpr}
        frameloop={(ready && isTabActive && !isRestoring) ? 'always' : 'never'}
        gl={(props) => {
          const renderer = new WebGPURenderer({
            ...props,
            antialias: true,
            sampleCount: 4, // MSAA 4x para WebGPU
            forceWebGL: false
          })
          renderer.setPixelRatio(dpr)
          renderer.init().then(() => setReady(true))
          return renderer
        }}
      >
        <Perf position="top-left" />
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />

        {ready && (
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        )}
      </Canvas>
      <ReRenderingLoader />
    </div>
  )
}

const ReRenderingLoader = () => {
  const isRestoring = useAlquimiaStore((state) => state.isRestoring)
  if (!isRestoring) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: '#000000',
      zIndex: 9999999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#00ffff',
      fontFamily: 'monospace',
      letterSpacing: '2px',
      pointerEvents: 'none',
      opacity: 1,
      animation: 'fadeInOut 1.5s ease-in-out forwards'
    }}>
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        .spinner {
          margin-top: 20px;
          width: 40px;
          height: 40px;
          border: 2px solid rgba(0,255,255,0.1);
          border-left-color: #00ffff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <h2>RE-RENDERING ALQUIMIA</h2>
      <div className="spinner"></div>
    </div>
  )
}

const LanguageWrapper = () => {
  const { lang } = useParams()
  const setLanguage = useAlquimiaStore((state) => state.setLanguage)

  useEffect(() => {
    if (lang === 'en' || lang === 'es') {
      setLanguage(lang)
    }
  }, [lang, setLanguage])

  return <AlquimiaApp language={lang} />
}

const AppWrapper = () => {
  const { lang } = useParams()
  const setLanguage = useAlquimiaStore((state) => state.setLanguage)

  useEffect(() => {
    if (lang === 'en' || lang === 'es') {
      setLanguage(lang)
    }
  }, [lang, setLanguage])

  // Evitar parpadeos de metadatos o lenguaje incorrecto
  const displayLang = (lang === 'en' || lang === 'es') ? lang : 'en';
  const meta = translations[displayLang]?.meta || translations['en'].meta;

  if (lang !== 'en' && lang !== 'es') {
    return <Navigate to="/en" replace />
  }

  return (
    <>
      <Helmet>
        <html lang={displayLang} />
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="alternate" hrefLang="en" href={`${window.location.origin}/en`} />
        <link rel="alternate" hrefLang="es" href={`${window.location.origin}/es`} />
        <link rel="alternate" hrefLang="x-default" href={`${window.location.origin}/en`} />
      </Helmet>
      <MainApp />
    </>
  )
}

function App() {
  const setIsTabActive = useAlquimiaStore((state) => state.setIsTabActive)
  const setIsRestoring = useAlquimiaStore((state) => state.setIsRestoring)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsTabActive(false)
      } else {
        setIsTabActive(true)
        setIsRestoring(true)
        setTimeout(() => {
          setIsRestoring(false)
        }, 1500)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [setIsTabActive, setIsRestoring])

  return (
    <Routes class="glitch">
      <Route path="/:lang/*" element={<AppWrapper />} />
      <Route path="*" element={<Navigate to="/en" replace />} />
    </Routes>
  )
}

export default App
