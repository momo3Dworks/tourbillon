import { useSyncExternalStore } from 'react'

let state = {
  isPlayingAll: false,
  volumeVaultDoor: 1.0,
  volumeTourbillonClick: 0.7,
  volumeTourbillonProximity: 0.2,
  volumeTourbillonProximity2: 0.1,
  volumeDoors: 0.0,
  volumeGearsRandom: 0.3,
  volumeTourbillonNorthOpened: 0.8,
  volumeTourbillonEastOpened: 0.8,
  volumeTourbillonSouthOpened: 0.8,
  volumeTourbillonWestOpened: 0.8,
  activeNavIndex: 0,
  isMobile: false,
  mobileTooltipFontSize: 9,
  isTabVisible: true,
}

const listeners = new Set()

export const audioStore = {
  getState() {
    return state;
  },
  setState(nextState) {
    state = { ...state, ...nextState }
    listeners.forEach((listener) => listener())
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export const useAudioStore = (selector = (s) => s) => {
  return useSyncExternalStore(
    audioStore.subscribe,
    () => selector(audioStore.getState()),
    () => selector(audioStore.getState())
  )
}

export const setPlayingAll = (isPlaying) => audioStore.setState({ isPlayingAll: isPlaying })
export const setVolumeVaultDoor = (vol) => audioStore.setState({ volumeVaultDoor: vol })
export const setVolumeTourbillonClick = (vol) => audioStore.setState({ volumeTourbillonClick: vol })
export const setVolumeTourbillonProximity = (vol) => audioStore.setState({ volumeTourbillonProximity: vol })
export const setVolumeTourbillonProximity2 = (vol) => audioStore.setState({ volumeTourbillonProximity2: vol })
export const setVolumeDoors = (vol) => audioStore.setState({ volumeDoors: vol })
export const setVolumeGearsRandom = (vol) => audioStore.setState({ volumeGearsRandom: vol })
export const setVolumeTourbillonNorthOpened = (vol) => audioStore.setState({ volumeTourbillonNorthOpened: vol })
export const setVolumeTourbillonEastOpened = (vol) => audioStore.setState({ volumeTourbillonEastOpened: vol })
export const setVolumeTourbillonSouthOpened = (vol) => audioStore.setState({ volumeTourbillonSouthOpened: vol })
export const setVolumeTourbillonWestOpened = (vol) => audioStore.setState({ volumeTourbillonWestOpened: vol })
export const setActiveNavIndex = (idx) => audioStore.setState({ activeNavIndex: idx })
export const setIsMobile = (isMobile) => audioStore.setState({ isMobile })
export const setMobileTooltipFontSize = (size) => audioStore.setState({ mobileTooltipFontSize: size })
export const setIsTabVisible = (isVisible) => audioStore.setState({ isTabVisible: isVisible })
