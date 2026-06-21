import React, { createContext, useContext, useState, useRef } from 'react';

const ExplodedContext = createContext(null);

export const ExplodedProvider = ({ children }) => {
  const [isExploded, setExploded] = useState(false);
  const [sciencePanelOpen, setSciencePanelOpen] = useState(false);
  // tooltip: null | { text: string }
  const [tooltip, setTooltip] = useState(null);

  // Legacy single progress kept for backward compat (not used for staggered groups)
  const transitionProgress = useRef(0.0);

  // ── Per-group progress refs — each group gets its own shader uniform value ──
  // Sweep order (explode): tunnelFloor → crystals/lights/cameras → tourbillonDome → tourbillonSystem
  // Reverse order  (collapse): tourbillonSystem → tourbillonDome → crystals/lights/cameras → tunnelFloor
  const progressTunnelFloor = useRef(0.0);  // group 1
  const progressCrystals    = useRef(0.0);  // group 2 (crystals, tunnel lights, doors camera, vault, top gears)
  const progressDome        = useRef(0.0);  // group 3 (TourbillonDome.glb non-exploded meshes)
  const progressSystem      = useRef(0.0);  // group 4 (TourbillonMainSystem.glb non-exploded meshes)

  return (
    <ExplodedContext.Provider value={{
      isExploded,
      setExploded,
      sciencePanelOpen,
      setSciencePanelOpen,
      tooltip,
      setTooltip,
      transitionProgress,       // legacy — kept for compat
      progressTunnelFloor,
      progressCrystals,
      progressDome,
      progressSystem,
    }}>
      {children}
    </ExplodedContext.Provider>
  );
};

export const useExploded = () => useContext(ExplodedContext);
