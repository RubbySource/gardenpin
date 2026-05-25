// Tlačítko pro odložení úkolu — rychlé volby (+1d, +3d, +1t, +2t, vlastní datum).
// Dva režimy: popover (default, pro kompaktní kontexty) a iOS action-sheet (`sheet`)
// pro mobilní seznam úkolů, kde se popover ořezával o swipe-overflow.
// Volá api.snoozeTask a po úspěchu pozve onSnoozed (typicky reload listu).
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import Icon from './Icon.jsx';

const QUICK_OPTIONS = [
  { days: 1, label: '+1 den' },
  { days: 3, label: '+3 dny' },
  { days: 7, label: '+1 týden' },
  { days: 14, label: '+2 týdny' },
];

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SnoozeButton({ task, onSnoozed, compact = false, sheet = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const wrapRef = useRef(null);

  // Popover režim: zavři při kliku mimo. Sheet má vlastní overlay backdrop.
  useEffect(() => {
    if (!open || sheet) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, sheet]);

  // Sheet režim: zamkni scroll pozadí + Esc zavře.
  useEffect(() => {
    if (!open || !sheet) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  const doSnooze = async (payload) => {
    setBusy(true);
    try {
      await api.snoozeTask(task.id, payload);
      toast('⏰ Odloženo');
      setOpen(false);
      onSnoozed?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const minDate = addDaysISO(1);

  const trigger = (
    <button
      type="button"
      className={`snooze-btn${compact ? ' compact' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      title="Odložit úkol"
      aria-label="Odložit úkol"
    >
      {sheet ? <Icon name="clock" size={18} /> : '⏰'}
    </button>
  );

  if (sheet) {
    return (
      <div className="snooze-wrap" ref={wrapRef}>
        {trigger}
        {open && (
          <div
            className="snooze-sheet-overlay"
            onClick={() => setOpen(false)}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div
              className="snooze-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Odložit úkol"
            >
              <div className="snooze-sheet-grip" aria-hidden="true" />
              <div className="snooze-sheet-head">
                <div className="snooze-sheet-title">Odložit úkol</div>
                {task?.title && <div className="snooze-sheet-sub">{task.title}</div>}
              </div>
              <div className="snooze-sheet-list">
                {QUICK_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    className="snooze-sheet-item"
                    disabled={busy}
                    onClick={() => doSnooze({ days: opt.days })}
                  >
                    <Icon name="clock" size={18} className="snooze-sheet-item-ic" />
                    <span>{opt.label}</span>
                  </button>
                ))}
                <label className="snooze-sheet-item snooze-sheet-custom">
                  <Icon name="calendar" size={18} className="snooze-sheet-item-ic" />
                  <span>Vlastní datum</span>
                  <input
                    type="date"
                    value={customDate}
                    min={minDate}
                    disabled={busy}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomDate(v);
                      if (v) doSnooze({ until: v });
                    }}
                  />
                </label>
              </div>
              <button
                type="button"
                className="snooze-sheet-cancel"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Zrušit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="snooze-wrap">
      {trigger}
      {open && (
        <div className="snooze-popover" onClick={(e) => e.stopPropagation()}>
          <div className="snooze-popover-title">Odložit o…</div>
          <div className="snooze-quick-grid">
            {QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                className="snooze-quick-btn"
                disabled={busy}
                onClick={() => doSnooze({ days: opt.days })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="snooze-custom">
            <label className="snooze-custom-label">Vlastní datum:</label>
            <div className="snooze-custom-row">
              <input
                type="date"
                value={customDate}
                min={minDate}
                onChange={(e) => setCustomDate(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="btn small"
                disabled={busy || !customDate}
                onClick={() => doSnooze({ until: customDate })}
              >
                Odložit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
