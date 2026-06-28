import React, { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { audioStore, setPlayingAll } from '../store/audioStore'
import { triggerAutoIntro, triggerAutoBack } from '../CameraRig'

// Function to dynamically load YouTube Iframe API if not loaded
let ytAPIStatus = 'unloaded' // 'loading', 'loaded'
const loadYouTubeAPI = (callback) => {
  if (window.YT && window.YT.Player) {
    callback()
    return
  }
  if (ytAPIStatus === 'loaded') {
    callback()
    return
  }
  if (ytAPIStatus === 'loading') {
    setTimeout(() => loadYouTubeAPI(callback), 100)
    return
  }
  ytAPIStatus = 'loading'
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  const firstScriptTag = document.getElementsByTagName('script')[0]
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
  
  window.onYouTubeIframeAPIReady = () => {
    ytAPIStatus = 'loaded'
    callback()
  }
}

const SpatialAudioController = () => {
  const { camera } = useThree()
  
  const clickPlayerRef = useRef(null)
  const proximityPlayerRef = useRef(null)
  const proximityPlayer2Ref = useRef(null)
  
  const clickPlayerReadyRef = useRef(false)
  const proximityPlayerReadyRef = useRef(false)
  const proximityPlayer2ReadyRef = useRef(false)
  
  const vaultAudioRef = useRef(null)
  const gearsAudioRef = useRef(null)
  
  const prevAutoIntro = useRef(false)
  const hasTriggeredClickAudios = useRef(false)

  // 1. Initialise local Audio objects
  useEffect(() => {
    vaultAudioRef.current = new Audio('/VaultDoorOpen.mp3')
    vaultAudioRef.current.loop = false
    
    gearsAudioRef.current = new Audio('/GearsSounds.mp3')
    gearsAudioRef.current.loop = false
    
    return () => {
      if (vaultAudioRef.current) {
        vaultAudioRef.current.pause()
      }
      if (gearsAudioRef.current) {
        gearsAudioRef.current.pause()
      }
    }
  }, [])

  // 2. Initialise YouTube players
  useEffect(() => {
    loadYouTubeAPI(() => {
      new window.YT.Player('yt-player-click', {
        height: '0',
        width: '0',
        videoId: '-fZQbEHMxbI',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            const player = event.target
            clickPlayerRef.current = player
            clickPlayerReadyRef.current = true
            // Cue/mute player to prepare it (browser autoplay requires interaction first)
            player.mute()
            player.playVideo()
            setTimeout(() => {
              player.pauseVideo()
              player.unMute()
            }, 1000)
          }
        }
      })

      new window.YT.Player('yt-player-proximity', {
        height: '0',
        width: '0',
        videoId: 'lNYCujza8JU',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          loop: 1,
          playlist: 'lNYCujza8JU' // Loop helper for iframe
        },
        events: {
          onReady: (event) => {
            const player = event.target
            proximityPlayerRef.current = player
            proximityPlayerReadyRef.current = true
            // Cue/mute player
            player.mute()
            player.playVideo()
            setTimeout(() => {
              player.pauseVideo()
              player.unMute()
            }, 1000)
          }
        }
      })
        new window.YT.Player('yt-player-proximity2', {
          height: '0',
          width: '0',
          videoId: '9fsHGj9ZJFo',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
            loop: 1,
            playlist: '9fsHGj9ZJFo' // Loop helper for iframe
          },
          events: {
            onReady: (event) => {
              const player = event.target
              proximityPlayer2Ref.current = player
              proximityPlayer2ReadyRef.current = true
              // Cue/mute player
              player.mute()
              player.playVideo()
              setTimeout(() => {
                player.pauseVideo()
                player.unMute()
              }, 1000)
            }
          }
        })
    })

    return () => {
      try {
        if (clickPlayerRef.current?.destroy) clickPlayerRef.current.destroy()
        if (proximityPlayerRef.current?.destroy) proximityPlayerRef.current.destroy()
        if (proximityPlayer2Ref.current?.destroy) proximityPlayer2Ref.current.destroy()
      } catch (e) {
        console.error('Error destroying YouTube players:', e)
      }
    }
  }, [])

  // 3. Proximity calculations and triggers in frame loop
  useFrame((state, delta) => {
    const isIntroActive = triggerAutoIntro.current
    const isBackActive = triggerAutoBack.current

    // Trigger audios on "Meet the Tourbillon" button click
    if (isIntroActive && !prevAutoIntro.current && !hasTriggeredClickAudios.current) {
      hasTriggeredClickAudios.current = true

      if (vaultAudioRef.current) {
        vaultAudioRef.current.currentTime = 0
        vaultAudioRef.current.play().catch((e) => console.log('Vault Audio play blocked:', e))
      }

      if (clickPlayerReadyRef.current && clickPlayerRef.current) {
        if (typeof clickPlayerRef.current.seekTo === 'function') {
          clickPlayerRef.current.seekTo(0)
        }
        if (typeof clickPlayerRef.current.playVideo === 'function') {
          clickPlayerRef.current.playVideo()
        }
      }
      
      // Auto enable global audio playback
      setPlayingAll(true)
    }

    // Reset triggers on Back to Entrance
    if (isBackActive) {
      hasTriggeredClickAudios.current = false
      if (vaultAudioRef.current) {
        vaultAudioRef.current.pause()
      }
      if (clickPlayerReadyRef.current && clickPlayerRef.current) {
        if (typeof clickPlayerRef.current.pauseVideo === 'function') {
          clickPlayerRef.current.pauseVideo()
        }
      }
      if (proximityPlayerReadyRef.current && proximityPlayerRef.current) {
        if (typeof proximityPlayerRef.current.pauseVideo === 'function') {
          proximityPlayerRef.current.pauseVideo()
        }
      }
    }

    prevAutoIntro.current = isIntroActive

    // Get current global audio parameters
    const { 
      isPlayingAll, 
      volumeVaultDoor, 
      volumeTourbillonClick, 
      volumeTourbillonProximity,
      volumeTourbillonProximity2,
      volumeGearsRandom
    } = audioStore.getState()

    const camPos = camera.position
    
    // Proximity target positions
    const vaultPos = new THREE.Vector3(0, 3, 0)
    const systemPos = new THREE.Vector3(0, 0, 0)
    
    const distVault = camPos.distanceTo(vaultPos)
    const distSystem = camPos.distanceTo(systemPos)

    // A. Vault Door Open Audio volume (reproduce inmediatamente al clickear, sin atenuación por distancia inicial)
    const targetVolumeVault = volumeVaultDoor * (isPlayingAll ? 1 : 0)

    if (vaultAudioRef.current) {
      vaultAudioRef.current.volume = targetVolumeVault
      if (!isPlayingAll && !vaultAudioRef.current.paused) {
        vaultAudioRef.current.pause()
      } else if (isPlayingAll && vaultAudioRef.current.paused && !vaultAudioRef.current.ended && hasTriggeredClickAudios.current) {
        vaultAudioRef.current.play().catch(() => {})
      }
    }

    // B. First YouTube Video (-fZQbEHMxbI) volume attenuation
    // Escuchable desde el waypoint inicial (distancia ~100) con volumen 1
    const maxClickDist = 200.0
    const clickFactor = THREE.MathUtils.clamp(2.0 - distSystem / 100.0, 0, 1)
    const targetVolumeClick = volumeTourbillonClick * clickFactor * (isPlayingAll ? 1 : 0)

    if (clickPlayerReadyRef.current && clickPlayerRef.current) {
      if (typeof clickPlayerRef.current.setVolume === 'function') {
        clickPlayerRef.current.setVolume(targetVolumeClick * 100)
      }
      if (typeof clickPlayerRef.current.getPlayerState === 'function') {
        const stateVal = clickPlayerRef.current.getPlayerState()
        if (!isPlayingAll || distSystem >= maxClickDist) {
          if (stateVal === 1 && typeof clickPlayerRef.current.pauseVideo === 'function') {
            clickPlayerRef.current.pauseVideo()
          }
        } else if (isPlayingAll && hasTriggeredClickAudios.current) {
          if (stateVal !== 1 && typeof clickPlayerRef.current.playVideo === 'function') {
            clickPlayerRef.current.playVideo()
          }
        }
      }
    }

    // C. Second YouTube Video (lNYCujza8JU) - strictly proximity-based playback
    // Escuchable desde el waypoint inicial
    const proximityThreshold = 200.0
    const targetVolumeProximity = 0.5 * volumeTourbillonProximity * THREE.MathUtils.clamp(2.0 - distSystem / 100.0, 0, 1)

    if (proximityPlayerReadyRef.current && proximityPlayerRef.current) {
      if (typeof proximityPlayerRef.current.setVolume === 'function') {
        proximityPlayerRef.current.setVolume(targetVolumeProximity * 100)
      }
      if (typeof proximityPlayerRef.current.getPlayerState === 'function') {
        const stateVal = proximityPlayerRef.current.getPlayerState()
        if (isPlayingAll && distSystem < proximityThreshold) {
          if (stateVal !== 1 && typeof proximityPlayerRef.current.playVideo === 'function') {
            proximityPlayerRef.current.playVideo()
          }
        } else {
          if (stateVal === 1 && typeof proximityPlayerRef.current.pauseVideo === 'function') {
            proximityPlayerRef.current.pauseVideo()
          }
        }
      }
    }

    // D. Third YouTube Video (9fsHGj9ZJFo) - strictly proximity-based playback
    const targetVolumeProximity2 = 1.0 * volumeTourbillonProximity2 * THREE.MathUtils.clamp(2.0 - distSystem / 100.0, 0, 1)

    if (proximityPlayer2ReadyRef.current && proximityPlayer2Ref.current) {
      if (typeof proximityPlayer2Ref.current.setVolume === 'function') {
        proximityPlayer2Ref.current.setVolume(targetVolumeProximity2 * 100)
      }
      if (typeof proximityPlayer2Ref.current.getPlayerState === 'function') {
        const stateVal = proximityPlayer2Ref.current.getPlayerState()
        if (isPlayingAll && distSystem < proximityThreshold) {
          if (stateVal !== 1 && typeof proximityPlayer2Ref.current.playVideo === 'function') {
            proximityPlayer2Ref.current.playVideo()
          }
        } else {
          if (stateVal === 1 && typeof proximityPlayer2Ref.current.pauseVideo === 'function') {
            proximityPlayer2Ref.current.pauseVideo()
          }
        }
      }
    }

    // E. GearsSounds.mp3 - Random playback when close to system
    if (gearsAudioRef.current) {
      gearsAudioRef.current.volume = volumeGearsRandom * THREE.MathUtils.clamp(2.0 - distSystem / 100.0, 0, 1) * (isPlayingAll ? 1 : 0)
      
      if (!isPlayingAll && !gearsAudioRef.current.paused) {
        gearsAudioRef.current.pause()
      } else if (isPlayingAll && distSystem < proximityThreshold) {
        // Si está pausado/terminado, hay una probabilidad de iniciarlo
        if (gearsAudioRef.current.paused) {
          // 0.005 probabilidad por frame (~30% de chance por segundo a 60fps)
          if (Math.random() < 0.005) {
            gearsAudioRef.current.currentTime = 0
            gearsAudioRef.current.play().catch(() => {})
          }
        }
      }
    }
  })

  return (
    <Html style={{ display: 'none' }} pointerEvents="none">
      <div id="yt-player-click"></div>
      <div id="yt-player-proximity"></div>
      <div id="yt-player-proximity2"></div>
    </Html>
  )
}

export default SpatialAudioController
