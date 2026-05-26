// 🔥 Streak — počet dní v řadě s aspoň 1 splněným úkolem
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';

export default function StreakWidget({ refreshKey = 0 }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .streak()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data) return null;

  const { current_streak, longest_streak, is_weekly_gardener } = data;
  const cls = is_weekly_gardener
    ? 'streak-card weekly'
    : current_streak === 0
      ? 'streak-card cold'
      : 'streak-card';
  const icon = is_weekly_gardener ? '🏆' : current_streak === 0 ? '🌱' : '🔥';

  return (
    <div className={cls} role="status">
      <div className="streak-icon">{icon}</div>
      <div className="streak-body">
        <div className="streak-value">
          {current_streak === 0 ? t('streak.none') : t('streak.daysInRow', { count: current_streak })}
        </div>
        <div className="streak-label">
          {current_streak === 0
            ? t('streak.startHint')
            : t('streak.longest', { count: longest_streak })}
        </div>
        {is_weekly_gardener && (
          <span className="streak-badge">{t('streak.weeklyGardener')}</span>
        )}
      </div>
    </div>
  );
}
