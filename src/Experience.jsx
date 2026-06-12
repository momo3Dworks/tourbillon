import React from 'react'
import { Environment } from '@react-three/drei'
import SceneModels from './SceneModels'
import DoorAnimations from './DoorAnimations'

const Experience = ({ emissiveIntensity }) => {
  return (
    <>
      {/* HDRI Environment via IBL - only lighting source supported by WebGPU TSL pipeline */}
      <Environment
        files="/citrus_orchard_road_puresky_1k.hdr"
        background={false}
        environmentIntensity={1.5}
      />

      <SceneModels emissiveIntensity={emissiveIntensity} />

      {/* Proximity-based door animation triggers */}
      <DoorAnimations />
    </>
  )
}

export default Experience
