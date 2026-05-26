import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ReminderBanner({ overdue, dueToday }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const dismissKey = `reminderDismissed_${today}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(dismissKey) === '1');

  const total = (overdue || 0) + (dueToday || 0);
  if (total === 0 || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const text =
    overdue > 0
      ? t('reminder.overdue', { count: overdue }) +
        (dueToday > 0 ? ' · ' + t('reminder.alsoToday', { count: dueToday }) : '')
      : t('reminder.dueToday', { count: dueToday });

  return (
    <div className={`reminder-banner${overdue > 0 ? ' overdue' : ''}`}>
      <span>
        {overdue > 0 ? '⚠️' : '🌞'} {text} —{' '}
        <Link to="/ukoly" className="reminder-link">{t('reminder.viewTasks')}</Link>
      </span>
      <button className="reminder-close" onClick={dismiss} aria-label={t('common.close')}>✕</button>
    </div>
  );
}
