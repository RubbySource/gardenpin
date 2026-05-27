// Návazný sezónní úkon — nenásilný iOS snackbar po splnění hlavního úkonu.
// Nabídne logické pokračování („🌱 Přihnojit po řezu za ~3 týdny") jedním tapnutím →
// api.createTask. Auto-dismiss + „×". Respektuje prefers-reduced-motion (CSS).
// Návrh (suggestion) už je vyřešený přes resolveFollowUp (taskChains.js) vč. dedup.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { formatDate } from '../utils.js';

const AUTO_DISMISS_MS = 9000; // déle než toast (3 s) — vyžaduje akci uživatele

export default function FollowUpPrompt({ suggestion, onClose, onCreated }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  // Auto-dismiss (zruší se při unmountu / když uživatel klikne).
  useEffect(() => {
    const id = setTimeout(() => onClose?.(), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [suggestion, onClose]);

  if (!suggestion) return null;

  const action = t(suggestion.labelKey);
  const weeks = Math.round(suggestion.offsetDays / 7);
  const when =
    suggestion.offsetDays >= 14
      ? t('followUp.inWeeks', { count: weeks })
      : t('followUp.inDays', { count: suggestion.offsetDays });

  const plan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.createTask({
        pin_id: suggestion.pinId,
        title: `${suggestion.emoji} ${action}`,
        task_type: suggestion.toType,
        frequency_days: null,
        specific_date: suggestion.targetDate,
        notes: suggestion.fromTitle ? t('followUp.notes', { from: suggestion.fromTitle }) : null,
      });
      toast(t('followUp.planned', { date: formatDate(suggestion.targetDate) }));
      onCreated?.();
      onClose?.();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
      setBusy(false);
    }
  };

  return (
    <div className="follow-up" role="status">
      <span className="follow-up-emoji" aria-hidden="true">{suggestion.emoji}</span>
      <div className="follow-up-body">
        <span className="follow-up-lead">{t('followUp.lead')}</span>
        <span className="follow-up-action">{action} · {when}</span>
      </div>
      <button type="button" className="follow-up-plan" onClick={plan} disabled={busy}>
        {busy ? t('followUp.planning') : t('followUp.plan')}
      </button>
      <button
        type="button"
        className="follow-up-close"
        onClick={() => onClose?.()}
        aria-label={t('followUp.dismiss')}
      >
        ×
      </button>
    </div>
  );
}
