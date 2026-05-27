// Úprava pH půdy (vápnění) — karta v záložce Statistiky detailu zahrady (vedle
// GreenManureCard / WinterPrepCard / RotationCard). Sezónně podmíněná (říjen–listopad):
// najde záhony s košťálovinami (Brassica) a jedním klikem do nich naplánuje podzimní
// vápnění — zvýší pH a brání nádorovitosti (klubkořenu). Čistě nad existujícími daty —
// viz data/soilPh.js. Skryje se, není-li v sezóně žádný záhon s košťálovinami.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { formatDayMonth, monthNameShort } from '../utils.js';
import { soilLimingForGarden, SOIL_PH_SEASON } from '../data/soilPh.js';

export default function SoilPhCard({ garden, pins, beds }) {
  const { t } = useTranslation();
  const monthNow = new Date().getMonth() + 1;
  const inSeason = SOIL_PH_SEASON.includes(monthNow);

  const conditions = useMemo(
    () => ({
      soil_type: garden.soil_type,
      exposure: garden.exposure,
      altitude_m: garden.altitude_m,
      climate_zone: garden.climate_zone,
    }),
    [garden.soil_type, garden.exposure, garden.altitude_m, garden.climate_zone],
  );

  const dedupMarker = t('soilPh.limeDedup');
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
    return soilLimingForGarden({
      pins,
      beds,
      lookup: findPlantByName,
      conditions,
      existingByPin,
      dedupMarker,
    });
  }, [inSeason, existingByPin, pins, beds, conditions, dedupMarker]);

  if (!inSeason || items.length === 0) return null;

  const createAll = async () => {
    setCreating(true);
    try {
      const calls = items.map((it) =>
        api.createTask({
          pin_id: it.pinId,
          title: `${it.emoji} ${t('soilPh.limeTaskTitle', { bed: it.bedName })}`,
          task_type: 'hnojeni',
          frequency_days: null,
          specific_date: it.suggested,
          notes: t('soilPh.limeNotes'),
        }),
      );
      await Promise.all(calls);
      toast(t('soilPh.plannedCount', { count: calls.length }));
      loadExisting(); // naplánované odpadnou z dedupu → karta se zmenší/skryje
    } catch (e) {
      toast(t('soilPh.planFailed', { msg: e.message }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="soil-ph-card" role="note">
      <div className="soil-ph-head">
        <span className="soil-ph-title">🧪 {t('soilPh.limeTitle')}</span>
        <span className="soil-ph-sub">{t('soilPh.limeSummary', { count: items.length })}</span>
      </div>
      <div className="soil-ph-list">
        {items.map((it) => (
          <div key={it.bedId} className="soil-ph-row">
            <span className="soil-ph-swatch" style={{ background: it.bedColor || '#9aa0a6' }} />
            <span className="soil-ph-main">
              <span className="soil-ph-bed">{it.bedName}</span>
              <span className="soil-ph-meta">{t('soilPh.limeDesc')} · {formatDayMonth(it.suggested)}</span>
            </span>
            <span className="soil-ph-when">{monthNameShort(it.month - 1)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="soil-ph-btn" onClick={createAll} disabled={creating}>
        {creating ? t('soilPh.planning') : t('soilPh.limePlanAll', { count: items.length })}
      </button>
    </div>
  );
}
