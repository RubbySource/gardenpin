// Tlačítko pro odložení úkolu — popover s rychlými volbami (+1d, +3d, +1t, +2t, vlastní datum).
// Volá api.snoozeTask a po úspěchu pozve onSnoozed (typicky reload listu).
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';

const QUICK_OPTIONS = [
  { days: 1, label: '+1 den' },
  { days: 3, label: '+3 dny' },
  { days: 7, label: '+1 týden' },
  { days: 14, label: '+2 týdny' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SnoozeButton({ task, onSnoozed, compact = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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

  return (
    <div ref={wrapRef} className="snooze-wrap">
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
        ⏰
      </button>
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
