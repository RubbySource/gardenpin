// Karta „✂️ Čas obnovit jahodník" v detailu pinu (Úkony tab). Nenásilně připomene po hlavní
// červnové/červencové sklizni SESTŘIHNOUT staré listy nízko nad srdíčkem + ODEBRAT přebytečné
// odnože (stolony), aby trs vyhnal čerstvé zdravé listy a nasadil květní pupeny pro PŘÍŠTÍ
// sezónu (viz data/strawberryRenewal.js). Měsíc posunutý dle klim. zóny (dateForMonth —
// v chladnějších zónách později, ať obnova odpovídá pozdější sklizni). Jeden klik =
// api.createTask na termín obnovy. Skryje se mimo gate / mimo sezónu / je-li už naplánováno.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { findPlantByName } from '../plantDatabase.js';
import { strawberryRenewalForPin } from '../data/strawberryRenewal.js';
import { monthNameShort, formatDate } from '../utils.js';

export default function StrawberryRenewalCard({ pin, onPlanned }) {
  const { t } = useTranslation();
  const plant = useMemo(() => findPlantByName(pin.plant_name), [pin.plant_name]);
  const [planned, setPlanned] = useState({}); // key → true (skryj po naplánování)
  const [busy, setBusy] = useState({});

  const hints = useMemo(
    () => strawberryRenewalForPin(pin, plant, pin.garden_conditions),
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
        title: `${h.emoji} ${t('strawberryRenewal.taskTitle', { plant: plant_name })}`,
        task_type: h.taskType,
        frequency_days: null,
        specific_date: h.suggested,
        notes: t('strawberryRenewal.notes'),
      });
      setPlanned((s) => ({ ...s, [key]: true }));
      toast(t('strawberryRenewal.planned', { date: formatDate(h.suggested) }));
      onPlanned?.();
    } catch (e) {
      toast(t('strawberryRenewal.planFailed', { msg: e.message }));
    } finally {
      setBusy((s) => ({ ...s, [key]: false }));
    }
  };

  return (
    <div className="strawberry-renewal-card" role="note">
      <div className="strawberry-renewal-head">
        <span className="strawberry-renewal-title">✂️ {t('strawberryRenewal.title')}</span>
        <span className="strawberry-renewal-sub">{t('strawberryRenewal.subtitle')}</span>
      </div>
      <div className="strawberry-renewal-list">
        {visible.map((h) => {
          const key = keyOf(h);
          return (
            <div key={key} className="strawberry-renewal-row">
              <span className="strawberry-renewal-badge" aria-hidden="true">
                {monthNameShort(h.month - 1)}
              </span>
              <div className="strawberry-renewal-main">
                <div className="strawberry-renewal-action">
                  {h.emoji} {t('strawberryRenewal.action', { plant: plant_name })}
                </div>
                <div className="strawberry-renewal-meta">{t('strawberryRenewal.instr')}</div>
              </div>
              <button
                type="button"
                className="strawberry-renewal-btn"
                onClick={() => plan(h)}
                disabled={busy[key]}
              >
                {busy[key] ? t('strawberryRenewal.planning') : t('strawberryRenewal.plan')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
