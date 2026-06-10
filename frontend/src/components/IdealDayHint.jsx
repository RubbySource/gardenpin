// Hint „ideální den v okně" na řádku úkolu — „🌤️ Nejlepší den: čtvrtek" + akce přesunout
// termín na suchý/mírný den dle 7denní předpovědi (api.snoozeTask → specific_date).
// Zobrazí se jen u nadcházejících sezónních úkonů s počasovou preferencí (řez/postřik = suchý
// den, přesazení = mírný den), kde je v okně ±3 dnů výrazně lepší den (viz idealDay.js).
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { bestDayInWindow } from '../idealDay.js';
import { formatDate, formatWeekday } from '../utils.js';

export default function IdealDayHint({ task, forecast, pheno, history, onShifted, compact = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const state = bestDayInWindow(task, forecast, pheno, history);
  if (!state) return null;

  const day = formatWeekday(state.date);
  const tip =
    state.pref === 'mild'
      ? t('idealDay.tooltipMild')
      : state.pref === 'postrain'
        ? t('idealDay.tooltipPostrain')
        : t('idealDay.tooltipDry');

  const apply = async (e) => {
    e?.stopPropagation();
    if (busy || !state.date) return;
    setBusy(true);
    try {
      await api.snoozeTask(task.id, { until: state.date });
      toast(t('idealDay.moved', { date: formatDate(state.date) }));
      onShifted?.();
    } catch (err) {
      toast(t('idealDay.moveFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ideal-day-alert${compact ? ' compact' : ''}`} role="note">
      <span className="ideal-day-badge" title={tip}>
        🌤️ {t('idealDay.badge', { day })}
      </span>
      <button type="button" className="ideal-day-btn" onClick={apply} disabled={busy}>
        {busy ? t('idealDay.moving') : t('idealDay.move', { day })}
      </button>
    </div>
  );
}
