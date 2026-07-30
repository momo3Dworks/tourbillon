import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { translations } from './translations';

const ExplodedContext = createContext(null);

export const ExplodedProvider = ({ children }) => {
  const [isExploded, setExploded] = useState(false);
  const [language, setLanguage] = useState('en');
  const [activeModal, setActiveModal] = useState(null);
  const [externalLink, setExternalLink] = useState(null);
  // tooltip: null | { text: string }
  const [tooltip, setTooltip] = useState(null);

  // Active section for North and South exploded views — drives per-section camera waypoints
  // Values: null | 'events' | 'adventures' | 'bookroom' | 'suites'
  const [activeSection, setActiveSection] = useState(null);

  // Hover title for the main Tourbillons
  const [hoverTitle, setHoverTitle] = useState(null);


  // Legacy single progress kept for backward compat (not used for staggered groups)
  const transitionProgress = useRef(0.0);

  // ── Per-group progress refs — kept for backward compat with scroll-based intro sweep
  const progressTunnelFloor = useRef(0.0);  // group 1
  const progressCrystals    = useRef(0.0);  // group 2
  const progressDome        = useRef(0.0);  // group 3
  const progressSystem      = useRef(0.0);  // group 4

  // ── Unified progress for the Exploded View grid sweep ──────────────────────
  // All meshes that must dissolve during Exploded View share this single ref,
  // so they all sweep at exactly the same moment (treated as one object).
  const progressUnified     = useRef(0.0);

  // ── Translation Helper ─────────────────────────────────────────────────────
  const t = useCallback((keyPath) => {
    const keys = keyPath.split('.');
    let current = translations[language];
    for (let i = 0; i < keys.length; i++) {
      if (current[keys[i]] === undefined) return keyPath;
      current = current[keys[i]];
    }
    return current;
  }, [language]);

  return (
    <ExplodedContext.Provider value={{
      isExploded,
      setExploded,
      language,
      setLanguage,
      activeModal,
      setActiveModal,
      externalLink,
      setExternalLink,
      tooltip,
      setTooltip,
      activeSection,
      setActiveSection,
      hoverTitle,
      setHoverTitle,
      transitionProgress,       // legacy — kept for compat
      progressTunnelFloor,
      progressCrystals,
      progressDome,
      progressSystem,
      progressUnified,
      t,
    }}>
      {children}
    </ExplodedContext.Provider>
  );
};

export const useExploded = () => useContext(ExplodedContext);
