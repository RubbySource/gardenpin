// Modal component for forms and detail views
import React, { useEffect } from 'react';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <span>{title}</span>
          <button className="close-btn" onClick={onClose} aria-label="Zavřít">
            ×
          </button>
        </h2>
        {children}
      </div>
    </div>
  );
}
