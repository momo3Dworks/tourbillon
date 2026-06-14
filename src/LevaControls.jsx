import { useControls, folder } from 'leva'

/**
 * Central Leva configuration — returns all tunable scene parameters.
 * Must be called inside an R3F <Canvas> child so it has access to the fiber context.
 */
const useLevaControls = () => {
  // ── Bloom ──────────────────────────────────────────────────────
  const bloomControls = useControls('Bloom', {
    enabled: { value: true, label: 'Enabled' },
    strength: { value: 0.03, min: 0, max: 3, step: 0.01, label: 'Strength' },
    radius: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'Radius' },
    threshold: { value: 0.75, min: 0, max: 1.5, step: 0.01, label: 'Threshold' },
  })

  // ── Depth of Field ─────────────────────────────────────────────
  const dofControls = useControls('Depth of Field', {
    enabled: { value: true, label: 'Enabled' },
    focusDistance: { value: 4.5, min: 0.1, max: 200, step: 0.1, label: 'Focus Distance' },
    focalLength: { value: 34.7, min: 0.1, max: 100, step: 0.1, label: 'Focal Length' },
    bokehScale: { value: 1.7, min: 0, max: 15, step: 0.1, label: 'Bokeh Scale' },
  })

  // ── Color Grading ──────────────────────────────────────────────
  const colorControls = useControls('Color Grading', {
    brightness: { value: 0.0, min: -1, max: 1, step: 0.01, label: 'Brightness' },
    contrast: { value: 0.03, min: -1, max: 1, step: 0.01, label: 'Contrast' },
    exposure: { value: 1.0, min: 0, max: 4, step: 0.01, label: 'Exposure' },
    toneMapping: { options: { None: 'none', ACES: 'aces', Linear: 'linear' }, label: 'Tone Mapping' },
  })

  // ── Vignette ───────────────────────────────────────────────────
  const vignetteControls = useControls('Vignette', {
    enabled: { value: true, label: 'Enabled' },
    offset: { value: 1.0, min: 0, max: 3, step: 0.01, label: 'Offset' },
    darkness: { value: 1.0, min: 0, max: 2, step: 0.01, label: 'Darkness' },
  })

  // ── Chromatic Aberration ───────────────────────────────────────
  const caControls = useControls('Chromatic Aberration', {
    enabled: { value: true, label: 'Enabled' },
    amount: { value: 0.01, min: 0, max: 0.05, step: 0.001, label: 'Max Amount' },
    falloff: { value: 2.3, min: 0.5, max: 5.0, step: 0.1, label: 'Falloff Power' },
  })

  // ── Directional Light ──────────────────────────────────────────
  const dirLightControls = useControls('Directional Light', {
    enabled: { value: true, label: 'Enabled' },
    intensity: { value: 10, min: 0, max: 10, step: 0.1, label: 'Intensity' },
    color: { value: '#ffeedd', label: 'Color' },
    position: folder({
      x: { value: 4, min: -100, max: 100, step: 0.5, label: 'X' },
      y: { value: 5, min: -100, max: 200, step: 0.5, label: 'Y' },
      z: { value: 9.5, min: -100, max: 100, step: 0.5, label: 'Z' },
    }),
  })

  // ── Ambient Light ──────────────────────────────────────────────
  const ambientControls = useControls('Ambient Light', {
    enabled: { value: true, label: 'Enabled' },
    intensity: { value: 0.4, min: 0, max: 5, step: 0.05, label: 'Intensity' },
    color: { value: '#c8d4f0', label: 'Color' },
  })

  // ── Shadows ────────────────────────────────────────────────────
  const shadowControls = useControls('Shadows', {
    enabled: { value: true, label: 'Enabled' },
    mapSize: { value: 2048, options: [512, 1024, 2048, 4096], label: 'Map Size' },
    bias: { value: -0.0005, min: -0.01, max: 0.01, step: 0.0001, label: 'Bias' },
  })

  // ── Emissive ───────────────────────────────────────────────────
  const emissiveControls = useControls('Emissive', {
    intensity: { value: 10.0, min: 0, max: 30, step: 0.1, label: 'Intensity' },
  })

  // ── Glass Transmission ─────────────────────────────────────────
  const transmissionControls = useControls('Glass (TourbillonGlass)', {
    enabled: { value: true, label: 'Enabled' },
    transmission: { value: 1.0, min: 0, max: 1, step: 0.01, label: 'Transmission' },
    ior: { value: 1.5, min: 1.0, max: 2.5, step: 0.01, label: 'IOR' },
    thickness: { value: 0.8, min: 0, max: 5, step: 0.05, label: 'Thickness' },
    dispersion: { value: 0.01, min: 0, max: 0.05, step: 0.001, label: 'Dispersion (CA)' },
    roughness: { value: 0.0, min: 0, max: 1, step: 0.01, label: 'Roughness' },
    color: { value: '#ffe4c1', label: 'Tint' },
  })

  // ── Environment ────────────────────────────────────────────────
  const envControls = useControls('Environment', {
    envIntensity: { value: 0.6, min: 0, max: 5, step: 0.1, label: 'IBL Intensity' },
  })

  return {
    bloom: bloomControls,
    dof: dofControls,
    color: colorControls,
    vignette: vignetteControls,
    ca: caControls,
    dirLight: {
      enabled: dirLightControls.enabled,
      intensity: dirLightControls.intensity,
      color: dirLightControls.color,
      position: [dirLightControls.x, dirLightControls.y, dirLightControls.z],
    },
    ambient: ambientControls,
    shadow: shadowControls,
    emissive: emissiveControls,
    env: envControls,
    transmission: transmissionControls,
  }
}

export default useLevaControls
