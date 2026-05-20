// SF Symbols-inspired SVG icons. Tenké linky, 24x24 viewBox, stroke=currentColor.
import React from 'react';

const PATHS = {
  search:
    'M11 4a7 7 0 1 0 4.95 11.95L20 20M14 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
  trash:
    'M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
  leaf:
    'M20 4c-7 0-13 3-13 11a5 5 0 0 0 5 5c8 0 11-9 11-16-3 0-7 3-8 7',
  camera:
    'M3 8h3l2-3h8l2 3h3v11H3zM12 11a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  calendar:
    'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 3v4M16 3v4M4 11h16',
  check: 'M5 12l4 4 10-10',
  pin: 'M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chevron: 'M9 6l6 6-6 6',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2 18.4 5.6M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  sparkle:
    'M12 3v6m0 6v6M3 12h6m6 0h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3',
  close: 'M6 6l12 12M6 18 18 6',
};

export default function Icon({ name, size = 20, strokeWidth = 1.7, className = '', style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={`sf-icon sf-icon-${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
