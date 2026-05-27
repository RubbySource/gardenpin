// Adaptivní hint na řádku úkolu — „📈 Loni: 18. srpna" / „Tvůj termín: ~18. srpna"
// + akce posunout termín na den, kdy úkon reálně probíhal v minulých letech
// (api.snoozeTask → specific_date). Zobrazí se jen u nadcházejících sezónních úkonů,
// kde se osobní historie liší o ≥ MIN_DIFF_DAYS (viz careHistory.js). Ustupuje fenologii.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { careHistoryState } from '../careHistory.js';
import { formatDate, formatDayMonth } from '../utils.js';

export default function CareHistoryHint({ task, history, pheno, onShifted, compact = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const state = careHistoryState(task, history, pheno);
  if (!state) return null;

  const apply = async (e) => {
    e?.stopPropagation();
    if (busy || !state.suggested) return;
    setBusy(true);
    try {
      await api.snoozeTask(task.id, { until: state.suggested });
      toast(t('careHistory.shifted', { date: formatDate(state.suggested) }));
      onShifted?.();
    } catch (err) {
      toast(t('careHistory.shiftFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const label =
    state.mode === 'avg'
      ? t('careHistory.yourTerm', { date: formatDayMonth(state.avgDate) })
      : t('careHistory.lastYear', { date: formatDayMonth(state.lastYearDate) });
  const tip =
    state.mode === 'avg'
      ? t('careHistory.tooltipAvg', { count: state.years, last: formatDayMonth(state.lastYearDate) })
      : t('careHistory.tooltipLast');

  return (
    <div className={`care-history-alert${compact ? ' compact' : ''}`} role="note">
      <span className="care-history-badge" title={tip}>
        📈 {label}
      </span>
      <button type="button" className="care-history-btn" onClick={apply} disabled={busy}>
        {busy ? t('careHistory.shifting') : t('careHistory.shiftBtn')}
      </button>
    </div>
  );
}
