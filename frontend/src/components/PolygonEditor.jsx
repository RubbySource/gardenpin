// PolygonEditor — SVG overlay nad mapou zahrady pro ruční ohraničení.
// Controlled component: body, selection a undo si drží rodič (lifted state),
// aby šel button bar vykreslit MIMO mapu (v normálním document flow).
//
// Tap na bod = výběr (highlight ring). Drag bodu = přesun.
// Klik na midpoint = přidání nového bodu mezi sousedy.
// Smazání / undo / reset / add ovládá rodičův toolbar přes lifted state.
// Min 3 body jsou tvrdě vynucené — pro hlášku používá rodič toast.
import React, { useEffect, useRef, useState } from 'react';

export const DEFAULT_POLYGON_POINTS = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];

// Shoelace v % souřadnicích — vrací plochu jako podíl celého obdélníku (0–1).
export function polygonAreaFraction(points) {
  if (!points || points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += (a.x * b.y - b.x * a.y);
  }
  return Math.abs(s) / 2 / (100 * 100);
}

export default function PolygonEditor({
  containerRef,
  points,
  onPointsChange,
  selectedIdx = null,
  onSelectedIdxChange,
  onSnapshot,
}) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const draggedRef = useRef(false);
  // Ref na nejnovější body — vyhneme se re-registraci listenerů při každém pohybu
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onChangeRef = useRef(onPointsChange);
  onChangeRef.current = onPointsChange;

  const toPercent = (clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  // Globální pointer handlery — drag funguje i mimo bod
  useEffect(() => {
    if (draggingIdx === null) return;
    const move = (e) => {
      draggedRef.current = true;
      const pos = toPercent(e.clientX, e.clientY);
      onChangeRef.current(pointsRef.current.map((p, i) => (i === draggingIdx ? pos : p)));
    };
    const up = () => setDraggingIdx(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [draggingIdx]);

  const handlePointDown = (e, idx) => {
    e.stopPropagation();
    e.preventDefault();
    // Snapshot PŘED první změnou — undo vrátí pozici z doby před dragem.
    onSnapshot?.();
    draggedRef.current = false;
    onSelectedIdxChange?.(idx);
    setDraggingIdx(idx);
  };

  const handleMidClick = (e, i) => {
    e.stopPropagation();
    e.preventDefault();
    onSnapshot?.();
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...points];
    next.splice(i + 1, 0, mid);
    onPointsChange(next);
    onSelectedIdxChange?.(i + 1);
  };

  const pathD = points.length === 0
    ? ''
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'visible',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <mask id="polygon-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <path d={pathD} fill="black" />
        </mask>
      </defs>
      {/* Ztmavení mimo polygon */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="rgba(0,0,0,0.5)"
        mask="url(#polygon-mask)"
      />
      {/* Obrys polygonu (dashed zelená) */}
      <path
        d={pathD}
        fill="rgba(74,124,58,0.05)"
        stroke="#4a7c3a"
        strokeWidth="0.4"
        strokeDasharray="1.4 0.9"
        vectorEffect="non-scaling-stroke"
      />
      {/* Midpoint handles (klik = přidat bod) — větší hit area + plus glyph */}
      {points.map((p, i) => {
        const b = points[(i + 1) % points.length];
        const mid = { x: (p.x + b.x) / 2, y: (p.y + b.y) / 2 };
        return (
          <g key={`mid-${i}`}>
            {/* Neviditelná velká hit oblast (~24px @ typical 320px wide map) */}
            <circle
              cx={mid.x}
              cy={mid.y}
              r="3.5"
              fill="transparent"
              style={{ cursor: 'copy', pointerEvents: 'auto' }}
              onPointerDown={(e) => handleMidClick(e, i)}
            >
              <title>Přidat bod</title>
            </circle>
            {/* Vizuální tečka */}
            <circle
              cx={mid.x}
              cy={mid.y}
              r="1.4"
              fill="rgba(255,255,255,0.92)"
              stroke="#7BA889"
              strokeWidth="0.35"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
            {/* Plus glyph — naznačuje akci */}
            <path
              d={`M ${mid.x - 0.7} ${mid.y} L ${mid.x + 0.7} ${mid.y} M ${mid.x} ${mid.y - 0.7} L ${mid.x} ${mid.y + 0.7}`}
              stroke="#4a7c3a"
              strokeWidth="0.32"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
      {/* Hlavní body — vybraný má outer ring */}
      {points.map((p, i) => {
        const isSelected = i === selectedIdx;
        const isDragging = i === draggingIdx;
        return (
          <g key={`pt-${i}`}>
            {/* Outer ring pro vybraný bod */}
            {isSelected && (
              <circle
                cx={p.x}
                cy={p.y}
                r="3.2"
                fill="none"
                stroke="#4a7c3a"
                strokeWidth="0.4"
                strokeOpacity="0.55"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Neviditelná velká hit oblast (~32px @ typical map width) */}
            <circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill="transparent"
              style={{
                cursor: 'grab',
                pointerEvents: 'auto',
                touchAction: 'none',
              }}
              onPointerDown={(e) => handlePointDown(e, i)}
            >
              <title>Táhni pro přesun · klepni pro výběr</title>
            </circle>
            {/* Vizuální tečka */}
            <circle
              cx={p.x}
              cy={p.y}
              r={isSelected ? 2.1 : 1.8}
              fill={isDragging || isSelected ? '#2d5a27' : '#fff'}
              stroke="#4a7c3a"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Point-in-polygon pomocí ray-casting; body i polygon v procentech.
export function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
