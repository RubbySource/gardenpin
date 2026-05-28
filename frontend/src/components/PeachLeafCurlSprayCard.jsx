// Karta „🛡️ Čas chránit broskev před kadeřavostí" v detailu pinu (Úkony tab). Nenásilně
// připomene preventivní MĚĎNATÝ POSTŘIK (Bordeauxská jícha / Kuprikol) TĚSNĚ PŘED PUČENÍM
// u broskvoně/meruňky — zablokuje infekci houby Taphrina deformans (viz data/peachLeafCurlSpray.js).
// Měsíc posunutý dle klim. zóny (dateForMonth). Jeden klik = api.createTask na termín postřiku.
// Skryje se mimo gate stromy / mimo druhy broskev/meruňka / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { peachLeafCurlSprayForPin } from '../data/peachLeafCurlSpray.js';
import { monthNameShort, formatDate } from '../utils.js';

// type → i18n klíče (label typu + krátká instrukce)
const TYPE_KEY = {
  strong: { label: 'typeStrong', instr: 'instrStrong' },
  mild: { label: 'typeMild', instr: 'instrMild' },
};

export default function PeachLeafCurlSprayCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => peachLeafCurlSprayForPin(pin, plant, pin.garden_conditions),
    [pin, plant],
  );
  const keyOf = (h) => `${h.kind}-${h.suggested}`;
  const visible = hints.filter((h) => !planned[keyOf(h)]);
  if (visible.length === 0) return null;

  const plant_name = plant?.nameCz || pin.plant_name;

  const plan = async (h) => {
    const key = keyOf(h);
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    try {
      await api.createTask({
        pin_id: pin.id,
        title: `${h.emoji} ${t('peachLeafCurlSpray.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('peachLeafCurlSpray.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('peachLeafCurlSpray.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('peachLeafCurlSpray.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="peach-curl-spray-card" role="note">
      <div className="peach-curl-spray-head">
        <span className="peach-curl-spray-title">🛡️ {t('peachLeafCurlSpray.title')}</span>
        <span className="peach-curl-spray-sub">{t('peachLeafCurlSpray.subtitle')}</span>
      </div>
      <div className="peach-curl-spray-list">
        {visible.map((h) => {
          const key = keyOf(h);
          const tk = TYPE_KEY[h.type] || TYPE_KEY.strong;
          return (
            <div key={key} className="peach-curl-spray-row">
              <span className="peach-curl-spray-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="peach-curl-spray-main">
                <div className="peach-curl-spray-action">
                  {h.emoji} {t(`peachLeafCurlSpray.${tk.label}`)}
                </div>
                <div className="peach-curl-spray-meta">{t(`peachLeafCurlSpray.${tk.instr}`)}</div>
              </div>
              <button
                type="button"
                className="peach-curl-spray-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('peachLeafCurlSpray.planning') : t('peachLeafCurlSpray.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
