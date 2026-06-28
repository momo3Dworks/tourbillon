import { useSyncExternalStore } from 'react'

let state = {
  isPlayingAll: false,
  volumeVaultDoor: 1.0,
  volumeTourbillonClick: 1.0,
  volumeTourbillonProximity: 0.5,
  volumeTourbillonProximity2: 0.3,
  volumeDoors: 0.0,
  volumeGearsRandom: 0.3,
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
