import React from 'react';

/**
 * OrnamentCorner — uses the actual SVG files from /public/svg/
 * 
 * Positions:
 *  - 'top-left'     → ornament_top_left_corner.svg  (no rotation)
 *  - 'top-right'    → ornament_top_right_corner.svg (no rotation)
 *  - 'bottom-left'  → ornament_top_left_corner.svg  (rotated 180deg via CSS)
 *  - 'bottom-right' → ornament_top_right_corner.svg (rotated 180deg via CSS)
 */
const OrnamentCorner = ({ position = 'top-left', size = 40, opacity = 0.5, style = {} }) => {
  const isLeft = position.includes('left');
  const isBottom = position.includes('bottom');

  // Choose correct SVG source
  const src = isLeft
    ? '/svg/ornament_top_left_corner.svg'
    : '/svg/ornament_top_right_corner.svg';

  // Flip vertically for bottom positions
  const flip = isBottom ? 'scaleY(-1)' : 'none';

  // Absolute positioning
  const posStyle = {
    top: isBottom ? 'auto' : 0,
    bottom: isBottom ? 0 : 'auto',
    left: isLeft ? 0 : 'auto',
    right: isLeft ? 'auto' : 0,
  };

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        opacity,
        marginTop: "-0.4rem",
        marginRight: "-0.4rem",
        marginLeft: "-0.4rem",
        marginBottom: "-0.4rem",
        gap: "5px",
        transform: flip,
        pointerEvents: 'none',
        userSelect: 'none',
        ...posStyle,
        ...style,
      }}
    />
  );
};

/**
 * OrnamentCenterTop — centered ornament for top edge of containers
 * ornament_center_top.svg (empty currently, only use if file has content)
 */
const OrnamentCenterTop = ({ size = 60, opacity = 0.5, style = {} }) => (
  <img
    src="/svg/ornament_center_top.svg"
    alt=""
    aria-hidden="true"
    style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: size,
      height: 'auto',
      opacity,
      pointerEvents: 'none',
      userSelect: 'none',
      ...style,
    }}
  />
);

/**
 * OrnamentCenterBottom — centered ornament for bottom edge of containers
 * ornament_center_down.svg
 */
const OrnamentCenterBottom = ({ size = 90, opacity = 0.75, style = {} }) => (
  <img
    src="/svg/ornament_center_down.svg"
    alt=""
    aria-hidden="true"
    style={{
      position: 'absolute',
      bottom: '-1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      width: size,
      height: 'auto',
      opacity,
      pointerEvents: 'none',
      userSelect: 'none',
      ...style,
    }}
  />
);

export { OrnamentCorner, OrnamentCenterTop, OrnamentCenterBottom };

// Default export keeps backward compat for any leftover <CornerOrnament /> usage
export default OrnamentCorner;
