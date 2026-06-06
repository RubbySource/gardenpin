// iOS-style bottom sheet — backdrop, rounded top, grabber, scroll, spring.
// Generalized replacement for ad-hoc <Modal>. See docs/design-system.md
// (sekce "Bottom sheet (modal)") a CSS .ios-sheet-* v ios-redesign.css.
//
// Props:
//   title       — string (povinné, čte se screen readerem)
//   subtitle    — string (volitelné, malý meta řádek pod titulkem)
//   onClose     — () => void
//   children    — obsah těla (scrolluje uvnitř)
//   footer      — JSX akce dole (např. primární CTA), nepovinné
//   ariaLabel   — alternativní popisek pro a11y když nechceš viditelný title
//
// Behavior: Esc zavírá, klik mimo zavírá, body scroll je při otevření zamčen.
import React, { useEffect, useRef } from 'react';

export default function Sheet({ title, subtitle, onClose, children, footer, ariaLabel }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="ios-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
    >
      <div
        className="ios-sheet"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ios-sheet-grabber" aria-hidden="true" />
        {(title || subtitle) && (
          <div className="ios-sheet-head">
            {title && <div className="ios-sheet-title">{title}</div>}
            {subtitle && <div className="ios-sheet-subtitle">{subtitle}</div>}
            <button
              type="button"
              className="ios-sheet-close"
              onClick={onClose}
              aria-label="Zavřít"
            >×</button>
          </div>
        )}
        <div className="ios-sheet-body">{children}</div>
        {footer && <div className="ios-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
