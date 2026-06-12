import { useControls, folder } from 'leva'

/**
 * Central Leva configuration — returns all tunable scene parameters.
 * Must be called inside an R3F <Canvas> child so it has access to the fiber context.
 */
const useLevaControls = () => {
  // ── Bloom ──────────────────────────────────────────────────────
  const bloomControls = useControls('Bloom', {
    enabled: { value: true, label: 'Enabled' },
    strength: { value: 0.8, min: 0, max: 3, step: 0.01, label: 'Strength' },
    radius: { value: 0.4, min: 0, max: 1, step: 0.01, label: 'Radius' },
    threshold: { value: 0.5, min: 0, max: 1.5, step: 0.01, label: 'Threshold' },
  })

  // ── Depth of Field ─────────────────────────────────────────────
  const dofControls = useControls('Depth of Field', {
    enabled: { value: false, label: 'Enabled' },
    focusDistance: { value: 50, min: 0.1, max: 200, step: 0.1, label: 'Focus Distance' },
    focalLength: { value: 30, min: 0.1, max: 100, step: 0.1, label: 'Focal Length' },
    bokehScale: { value: 3, min: 0, max: 15, step: 0.1, label: 'Bokeh Scale' },
  })

  // ── Directional Light ──────────────────────────────────────────
  const dirLightControls = useControls('Directional Light', {
    enabled: { value: true, label: 'Enabled' },
    intensity: { value: 1.5, min: 0, max: 10, step: 0.1, label: 'Intensity' },
    color: { value: '#ffeedd', label: 'Color' },
    position: folder({
      x: { value: 20, min: -100, max: 100, step: 1, label: 'X' },
      y: { value: 80, min: -100, max: 200, step: 1, label: 'Y' },
      z: { value: 30, min: -100, max: 100, step: 1, label: 'Z' },
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
    mapSize: { value: 1024, options: [512, 1024, 2048, 4096], label: 'Map Size' },
    bias: { value: -0.0005, min: -0.01, max: 0.01, step: 0.0001, label: 'Bias' },
  })

  // ── Emissive ───────────────────────────────────────────────────
  const emissiveControls = useControls('Emissive', {
    intensity: { value: 10.0, min: 0, max: 30, step: 0.1, label: 'Intensity' },
  })

  // ── Environment ────────────────────────────────────────────────
  const envControls = useControls('Environment', {
    envIntensity: { value: 1.5, min: 0, max: 5, step: 0.1, label: 'IBL Intensity' },
  })

  return {
    bloom: bloomControls,
    dof: dofControls,
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
  }
}

export default useLevaControls
