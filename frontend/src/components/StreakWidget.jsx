// 🔥 Streak — počet dní v řadě s aspoň 1 splněným úkolem
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function dayLabel(n) {
  if (n === 0) return 'Začněte dnes splněním úkolu';
  if (n === 1) return '1 den v řadě';
  if (n < 5) return `${n} dny v řadě`;
  return `${n} dní v řadě`;
}

export default function StreakWidget({ refreshKey = 0 }) {
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
          {current_streak === 0 ? 'Žádný streak' : dayLabel(current_streak)}
        </div>
        <div className="streak-label">
          {current_streak === 0
            ? 'Splňte aspoň jeden úkol denně'
            : `Nejdelší: ${longest_streak} ${longest_streak === 1 ? 'den' : longest_streak < 5 ? 'dny' : 'dní'}`}
        </div>
        {is_weekly_gardener && (
          <span className="streak-badge">🏅 Zahradník týdne</span>
        )}
      </div>
    </div>
  );
}
