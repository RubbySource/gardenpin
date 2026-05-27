// Karta „📋 Letos jsi ještě neplánoval" v detailu pinu (Úkony tab). Nenásilně nabídne
// hlavní sezónní úkony, které uživatel LONI reálně splnil, ale letos je nemá nikde
// (viz careGap.js). Jeden klik = api.createTask na loňský den (posun zóny už zapečený
// v reálném loňském splnění). Sdílí care-history cache (useCareHistory).
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { useCareHistory } from '../careHistory.js';
import { careGapsForPin } from '../careGap.js';
import { monthNameShort, formatDate, formatDayMonth } from '../utils.js';

export default function CareGapCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const history = useCareHistory();
  const [planned, setPlanned] = useState({}); // action → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const gaps = useMemo(
    () => careGapsForPin(pin.id, pin.tasks, history, pin.garden_conditions),
    [pin.id, pin.tasks, history, pin.garden_conditions],
  );
  const visible = gaps.filter((g) => !planned[g.action]);
  if (visible.length === 0) return null;

  const plan = async (gap) => {
    if (busy[gap.action]) return;
    setBusy((s) => ({ ...s, [gap.action]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: gap.action,              // už nese emoji (= loňský titulek)
        task_type: gap.taskType,
        frequency_days: null,
        specific_date: gap.suggested,
        notes: t('careGap.notes', { date: formatDayMonth(gap.suggested) }),
      });
      setPlanned((s) => ({ ...s, [gap.action]: true }));
      toast(t('careGap.planned', { date: formatDate(gap.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('careGap.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [gap.action]: false }));
    }
  };

  return (
    <div className="care-gap-card" role="note">
      <div className="care-gap-head">
        <span className="care-gap-title">📋 {t('careGap.title')}</span>
        <span className="care-gap-sub">{t('careGap.summary', { count: visible.length })}</span>
      </div>
      <div className="care-gap-list">
        {visible.map((gap) => (
          <div key={gap.action} className="care-gap-row">
            <span className="care-gap-month" aria-hidden="true">
              {monthNameShort(gap.month - 1)}
            </span>
            <div className="care-gap-main">
              <div className="care-gap-action">{gap.action}</div>
              <div className="care-gap-meta">{t('careGap.lastYear', { date: formatDayMonth(gap.suggested) })}</div>
            </div>
            <button
              type="button"
              className="care-gap-btn"
              onClick={() => plan(gap)}
              disabled={busy[gap.action]}
            >
              {busy[gap.action] ? t('careGap.planning') : t('careGap.plan')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
