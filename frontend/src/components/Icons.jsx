// Inline SVG icon set (SF Symbols / lucide-inspired) — no npm dep
import React from 'react';

const SVG = ({ children, size = 22, className = '', strokeWidth = 1.8, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide ${className}`}
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <SVG {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </SVG>
);

export const IconMap = (p) => (
  <SVG {...p}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </SVG>
);

export const IconCheckCircle = (p) => (
  <SVG {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </SVG>
);

export const IconCalendar = (p) => (
  <SVG {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </SVG>
);

export const IconSettings = (p) => (
  <SVG {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </SVG>
);

export const IconSearch = (p) => (
  <SVG {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </SVG>
);

export const IconPlus = (p) => (
  <SVG {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </SVG>
);

export const IconChevronRight = (p) => (
  <SVG {...p}>
    <path d="m9 6 6 6-6 6" />
  </SVG>
);

export const IconTrash = (p) => (
  <SVG {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </SVG>
);

export const IconBell = (p) => (
  <SVG {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </SVG>
);

export const IconX = (p) => (
  <SVG {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </SVG>
);

export const IconLeaf = (p) => (
  <SVG {...p}>
    <path d="M11 20A7 7 0 0 1 4 13c0-6.6 5-12 17-12 0 11.4-5.4 17-12 17a7 7 0 0 1-4-1" />
    <path d="M4 20 16.5 7.5" />
  </SVG>
);

export const IconCamera = (p) => (
  <SVG {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <circle cx="12" cy="13" r="3.5" />
  </SVG>
);

export const IconRefresh = (p) => (
  <SVG {...p}>
    <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
    <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M3 21v-5h5" />
  </SVG>
);

export const IconAlert = (p) => (
  <SVG {...p}>
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.86a2 2 0 0 1 3.4 0l8.4 14.16A2 2 0 0 1 20.4 21H3.6a2 2 0 0 1-1.7-2.98l8.4-14.16Z" />
  </SVG>
);
