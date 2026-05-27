// Fenologický hint na řádku úkolu — „🌡️ Ideální okno: teď" / „Letos asi o ~N dní později
// (dříve)" + akce posunout termín na fenologicky přesnější datum (api.snoozeTask → specific_date).
// Zobrazí se jen u nadcházejících sezónních úkonů, kde letošní teplotní anomálie posune
// ideální okno o ≥ MIN_SHIFT dní (viz phenology.js). Veškerá logika je klientská.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { phenologyState } from '../phenology.js';
import { formatDate } from '../utils.js';

export default function PhenologyHint({ task, pheno, onShifted, compact = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const state = phenologyState(task, pheno);
  if (!state) return null;

  const apply = async (e) => {
    e?.stopPropagation();
    if (busy || !state.suggested) return;
    setBusy(true);
    try {
      await api.snoozeTask(task.id, { until: state.suggested });
      toast(t('phenology.shifted', { date: formatDate(state.suggested) }));
      onShifted?.();
    } catch (err) {
      toast(t('phenology.shiftFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const label =
    state.mode === 'now'
      ? t('phenology.idealNow')
      : state.mode === 'later'
        ? t('phenology.laterBy', { count: state.days })
        : t('phenology.earlierBy', { count: state.days });
  const btnLabel = state.mode === 'now' ? t('phenology.scheduleNow') : t('phenology.shiftDate');
  const signedAnomaly = `${state.anomaly > 0 ? '+' : ''}${state.anomaly}`;

  return (
    <div className={`phenology-alert${compact ? ' compact' : ''}`} role="note">
      <span className="phenology-badge" title={t('phenology.tooltip', { temp: signedAnomaly })}>
        🌡️ {label}
      </span>
      <button type="button" className="phenology-btn" onClick={apply} disabled={busy}>
        {busy ? t('phenology.shifting') : btnLabel}
      </button>
    </div>
  );
}
