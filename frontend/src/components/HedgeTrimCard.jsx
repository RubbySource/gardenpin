// Karta „✂️ Čas tvarovat plot" v detailu pinu (Úkony tab). Nenásilně připomene LETNÍ
// TVAROVACÍ ŘEZ formálního živého plotu (viz data/hedgeTrim.js) — první sestřih po hnízdění
// ptáků (7), druhý koncem léta (9), ať plot jde do zimy upravený. Ukáže NEJBLIŽŠÍ budoucí okno,
// měsíc posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín sestřihu.
// Skryje se mimo gate (jen stříhané plotové dřeviny) / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { hedgeTrimForPin } from '../data/hedgeTrim.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function HedgeTrimCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => hedgeTrimForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested}`;
  const visible = hints.filter((h) => !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const plant_name = plant?.nameCz || pin.plant_name;
  const metaKey = (h) => (h.window === 'summer1' ? 'hedgeTrim.metaSummer1' : 'hedgeTrim.metaSummer2');

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      const meta = t(metaKey(h));
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('hedgeTrim.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('hedgeTrim.notes', { meta }),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('hedgeTrim.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('hedgeTrim.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="hedge-trim-card" role="note">
      <div className="hedge-trim-head">
        <span className="hedge-trim-title">✂️ {t('hedgeTrim.title')}</span>
        <span className="hedge-trim-sub">{t('hedgeTrim.subtitle')}</span>
      </div>
      <div className="hedge-trim-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="hedge-trim-row">
              <span className="hedge-trim-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="hedge-trim-main">
                <div className="hedge-trim-action">{h.emoji} {t('hedgeTrim.action')}</div>
                <div className="hedge-trim-meta">{t(metaKey(h))}</div>
              </div>
              <button
                type="button"
                className="hedge-trim-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('hedgeTrim.planning') : t('hedgeTrim.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
