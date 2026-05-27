// Karta „🌳 Řez podle stáří rostliny" v detailu pinu (Úkony tab). Nenásilně nabídne
// věkově citlivý řez dřeviny — výchovný (mladá) / omlazovací (stará) — plus guard
// „1. rok po výsadbě, neřež" (viz data/ageTasks.js). Jeden klik = api.createTask na
// sezónní okno posunuté dle klim. zóny (dateForMonth). Skryje se, není-li co nabídnout.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { ageTasksForPin } from '../data/ageTasks.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function AgeTaskCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => ageTasksForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested || 'guard'}`;
  const visible = hints.filter((h) => h.kind === 'guard' || !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const age = visible.find((h) => h.kind !== 'guard')?.age ?? visible[0].age;

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t(`ageTasks.${h.kind}Title`)}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('ageTasks.notes', { age: h.age }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('ageTasks.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('ageTasks.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="age-task-card" role="note">
      <div className="age-task-head">
        <span className="age-task-title">🌳 {t('ageTasks.title')}</span>
        {age >= 1 && (
          <span className="age-task-sub">{t('ageTasks.ageSummary', { count: age })}</span>
        )}
      </div>
      <div className="age-task-list">
        {visible.map((h) => {
          const key = keyOf(h);
          if (h.kind === 'guard') {
            return (
              <div key={key} className="age-task-row is-guard">
                <span className="age-task-badge is-guard" aria-hidden="true">🌱</span>
                <div className="age-task-main">
                  <div className="age-task-action">{t('ageTasks.guardTitle')}</div>
                  <div className="age-task-meta">{t('ageTasks.guardMeta')}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={key} className="age-task-row">
              <span className="age-task-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="age-task-main">
                <div className="age-task-action">{h.emoji} {t(`ageTasks.${h.kind}Title`)}</div>
                <div className="age-task-meta">{t(`ageTasks.${h.kind}Meta`, { age: h.age })}</div>
              </div>
              <button
                type="button"
                className="age-task-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('ageTasks.planning') : t('ageTasks.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
