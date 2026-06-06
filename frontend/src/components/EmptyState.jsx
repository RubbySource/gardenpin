// iOS-style empty state: emoji + title + subtitle + optional action.
// Vizuál ladí s .gp-empty/.empty, ale na bílé kartě bez dashed borderu
// (mockup parity). CSS: .ios-empty-state-* v ios-redesign.css.
//
// Props:
//   emoji        — string (povinné, 1–2 grafémy, např. "🌻")
//   title        — string
//   subtitle     — string | ReactNode (volitelné)
//   actionLabel  — string (volitelné — pokud nastaveno, vykreslí se tlačítko)
//   onAction     — () => void
//   actionGhost  — boolean (sekundární vzhled — text místo plné sage)
//   children     — vlastní akce/obsah pod subtitle (přebíjí action button)
import React from 'react';

export default function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionGhost = false,
  children,
}) {
  return (
    <div className="ios-empty-state">
      {emoji && <div className="ios-empty-state-emoji" aria-hidden="true">{emoji}</div>}
      {title && <div className="ios-empty-state-title">{title}</div>}
      {subtitle && <div className="ios-empty-state-subtitle">{subtitle}</div>}
      {children}
      {!children && actionLabel && onAction && (
        <button
          type="button"
          className={`ios-empty-state-action${actionGhost ? ' ghost' : ''}`}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
