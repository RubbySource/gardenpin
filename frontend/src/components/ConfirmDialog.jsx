// ConfirmDialog — iOS-style modal confirm. Náhrada za window.confirm() pro destruktivní akce.
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  icon = '⚠️',
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const cancelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-icon" aria-hidden="true">{icon}</div>
        <div className="confirm-dialog-title">{title}</div>
        {message && <div className="confirm-dialog-message">{message}</div>}
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog-btn cancel"
            onClick={onCancel}
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
