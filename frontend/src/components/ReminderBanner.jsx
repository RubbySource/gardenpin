import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ReminderBanner({ overdue, dueToday }) {
  const today = new Date().toISOString().slice(0, 10);
  const dismissKey = `reminderDismissed_${today}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(dismissKey) === '1');

  const total = (overdue || 0) + (dueToday || 0);
  if (total === 0 || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const plural = (n) => (n === 1 ? 'úkol' : n < 5 ? 'úkoly' : 'úkolů');

  const text =
    overdue > 0
      ? `${overdue} ${plural(overdue)} po termínu${dueToday > 0 ? ` · ${dueToday} ${plural(dueToday)} dnes` : ''}`
      : `${dueToday} ${plural(dueToday)} na dnes`;

  return (
    <div className={`reminder-banner${overdue > 0 ? ' overdue' : ''}`}>
      <span>
        {overdue > 0 ? '⚠️' : '🌞'} {text} —{' '}
        <Link to="/ukoly" className="reminder-link">Zobrazit úkoly</Link>
      </span>
      <button className="reminder-close" onClick={dismiss} aria-label="Zavřít">✕</button>
    </div>
  );
}
