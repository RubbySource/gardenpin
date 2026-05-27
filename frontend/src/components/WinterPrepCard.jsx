// Zazimování zahrady — karta v záložce Statistiky detailu zahrady (vedle RotationCard).
// Sezónně podmíněná (září–listopad): najde mrazově citlivé rostliny, které je třeba před
// prvním mrazem vyrýt (hlízy) nebo zazimovat (přikrýt/přesunout), a jedním klikem vytvoří
// úkol pro všechny najednou. Termín se zpřesní dle předpovědi mrazu (frost.js). Čistě nad
// existujícími daty — viz data/winterPrep.js. Skryje se, není-li v sezóně nic k zazimování.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { formatDayMonth, monthNameShort } from '../utils.js';
import { useFrostForecast, shortFrostDate } from '../frost.js';
import { winterPrepForGarden, WINTER_PREP_SEASON } from '../data/winterPrep.js';

export default function WinterPrepCard({ garden, pins }) {
  const { t } = useTranslation();
  const monthNow = new Date().getMonth() + 1;
  const inSeason = WINTER_PREP_SEASON.includes(monthNow);

  const conditions = useMemo(
    () => ({
      soil_type: garden.soil_type,
      exposure: garden.exposure,
      altitude_m: garden.altitude_m,
      climate_zone: garden.climate_zone,
    }),
    [garden.soil_type, garden.exposure, garden.altitude_m, garden.climate_zone],
  );

  const frost = useFrostForecast();
  const [existingByPin, setExistingByPin] = useState(null); // null dokud se nenačtou úkoly
  const [creating, setCreating] = useState(false);

  // Načti existující úkoly v zahradě (dedup). `alive` jako session guard — true při refetch.
  const loadExisting = (alive = { v: true }) => {
    api.listTasks()
      .then((all) => {
        if (!alive.v) return;
        const map = {};
        for (const tk of all) {
          if (tk.garden_id !== garden.id) continue;
          (map[tk.pin_id] ||= []).push(tk);
        }
        setExistingByPin(map);
      })
      .catch(() => { if (alive.v) setExistingByPin({}); });
  };
  // Jen v sezóně, jednou na mount/změnu zahrady.
  useEffect(() => {
    if (!inSeason) return undefined;
    const alive = { v: true };
    loadExisting(alive);
    return () => { alive.v = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garden.id, inSeason]);

  const items = useMemo(() => {
    if (!inSeason || existingByPin === null) return [];
    return winterPrepForGarden({
      pins,
      lookup: findPlantByName,
      existingByPin,
      frost,
      conditions,
    });
  }, [inSeason, existingByPin, pins, frost, conditions]);

  if (!inSeason || items.length === 0) return null;

  const actionLabel = (kind) => (kind === 'lift' ? t('winterPrep.actionLift') : t('winterPrep.actionProtect'));

  const createAll = async () => {
    setCreating(true);
    try {
      const calls = items.map((it) =>
        api.createTask({
          pin_id: it.pinId,
          title: `${it.emoji} ${actionLabel(it.kind)}`,
          task_type: it.taskType,
          frequency_days: null,
          specific_date: it.suggested,
          notes: it.kind === 'lift' ? t('winterPrep.notesLift') : t('winterPrep.notesProtect'),
        }),
      );
      await Promise.all(calls);
      toast(t('winterPrep.planned', { count: calls.length }));
      loadExisting(); // naplánované odpadnou z dedupu → karta se zmenší/skryje
    } catch (e) {
      toast(t('winterPrep.planFailed', { msg: e.message }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="winter-prep-card" role="note">
      <div className="winter-prep-head">
        <span className="winter-prep-title">🍂 {t('winterPrep.title')}</span>
        <span className="winter-prep-sub">{t('winterPrep.summary', { count: items.length })}</span>
      </div>
      <div className="winter-prep-list">
        {items.map((it) => (
          <div key={`${it.pinId}-${it.kind}`} className="winter-prep-row">
            <span className={`winter-prep-badge ${it.kind}`}>{it.emoji}</span>
            <span className="winter-prep-main">
              <span className="winter-prep-plant">{it.plantName}</span>
              <span className="winter-prep-meta">
                {actionLabel(it.kind)} · {formatDayMonth(it.suggested)}
                {it.frostDate && (
                  <span className="winter-prep-frost"> · ⚠️ {t('winterPrep.frostWarn', { date: shortFrostDate(it.frostDate) })}</span>
                )}
              </span>
            </span>
            <span className="winter-prep-when">{monthNameShort(it.month - 1)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="winter-prep-btn" onClick={createAll} disabled={creating}>
        {creating ? t('winterPrep.planning') : t('winterPrep.planAll', { count: items.length })}
      </button>
    </div>
  );
}
