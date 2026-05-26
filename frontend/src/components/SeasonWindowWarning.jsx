// Badge „⏳ Okno zmeškáno" na řádku úkolu + chytré dořešení prošlého sezónního okna.
// Zobrazí se jen u jednorázových sezónních úkonů (specific_date) po termínu o víc dní,
// než je sezónní okno jejich typu (viz seasonWindow.js). Tři volby:
//   • Přesunout na příští rok → api.snoozeTask na příští sezónní výskyt
//   • Stihnout teď → ponechá úkol, jen zavře badge (session-paměť markCaughtUp)
//   • Zrušit → api.deleteTask (úkon už nemá smysl)
// Veškerá logika je klientská — žádné nové endpointy ani schéma.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { seasonWindowState, markCaughtUp } from '../seasonWindow.js';
import { formatDate } from '../utils.js';

export default function SeasonWindowWarning({ task, onResolved, compact = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const state = seasonWindowState(task);
  if (!state || hidden) return null;

  const moveNextYear = async (e) => {
    e?.stopPropagation();
    if (busy || !state.nextDate) return;
    setBusy(true);
    try {
      await api.snoozeTask(task.id, { until: state.nextDate });
      toast(t('seasonWindow.moved', { date: formatDate(state.nextDate) }));
      onResolved?.();
    } catch (err) {
      toast(t('seasonWindow.actionFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const doNow = (e) => {
    e?.stopPropagation();
    markCaughtUp(task.id);
    setHidden(true);
  };

  const cancelTask = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      toast(t('seasonWindow.cancelled'));
      onResolved?.();
    } catch (err) {
      toast(t('seasonWindow.actionFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`season-window-alert${compact ? ' compact' : ''}`} role="alert">
      <span className="season-window-badge" title={t('seasonWindow.tooltip')}>
        ⏳ {t('seasonWindow.badge')}
      </span>
      <button
        type="button"
        className="season-window-btn primary"
        onClick={moveNextYear}
        disabled={busy}
      >
        {busy ? t('seasonWindow.moving') : t('seasonWindow.moveNextYear')}
      </button>
      <button type="button" className="season-window-btn" onClick={doNow} disabled={busy}>
        {t('seasonWindow.doNow')}
      </button>
      <button type="button" className="season-window-btn danger" onClick={cancelTask} disabled={busy}>
        {t('seasonWindow.cancel')}
      </button>
    </div>
  );
}
