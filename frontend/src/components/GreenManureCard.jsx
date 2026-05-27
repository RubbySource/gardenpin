// Zelené hnojení po sklizni — karta v záložce Statistiky detailu zahrady (vedle RotationCard
// / WinterPrepCard). Sezónně podmíněná (srpen–říjen): najde uvolněné zeleninové záhony
// (jednoleté plodiny sklizeny, žádný trvalý obyvatel) a jedním klikem do nich naplánuje
// výsev zeleného hnojení — mráz-citlivá hořčice/svazenka pro brzký výsev, ozimé žito/jetel
// pro pozdní. Čistě nad existujícími daty — viz data/greenManure.js. Skryje se, není-li v
// sezóně žádný uvolněný záhon.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { formatDayMonth, monthNameShort } from '../utils.js';
import { greenManureForGarden, GREEN_MANURE_SEASON } from '../data/greenManure.js';

export default function GreenManureCard({ garden, pins, beds }) {
  const { t } = useTranslation();
  const monthNow = new Date().getMonth() + 1;
  const inSeason = GREEN_MANURE_SEASON.includes(monthNow);

  const conditions = useMemo(
    () => ({
      soil_type: garden.soil_type,
      exposure: garden.exposure,
      altitude_m: garden.altitude_m,
      climate_zone: garden.climate_zone,
    }),
    [garden.soil_type, garden.exposure, garden.altitude_m, garden.climate_zone],
  );

  const dedupMarker = t('greenManure.dedupMarker');
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
    return greenManureForGarden({
      pins,
      beds,
      lookup: findPlantByName,
      conditions,
      existingByPin,
      dedupMarker,
    });
  }, [inSeason, existingByPin, pins, beds, conditions, dedupMarker]);

  if (!inSeason || items.length === 0) return null;

  const mixLabel = (key) => (key === 'overwinter' ? t('greenManure.mixOverwinter') : t('greenManure.mixFrostKill'));
  const mixDesc = (key) => (key === 'overwinter' ? t('greenManure.descOverwinter') : t('greenManure.descFrostKill'));

  const createAll = async () => {
    setCreating(true);
    try {
      const calls = items.map((it) =>
        api.createTask({
          pin_id: it.pinId,
          title: `${it.emoji} ${t('greenManure.taskTitle', { bed: it.bedName })}`,
          task_type: 'presazeni',
          frequency_days: null,
          specific_date: it.suggested,
          notes: it.mixKey === 'overwinter' ? t('greenManure.notesOverwinter') : t('greenManure.notesFrostKill'),
        }),
      );
      await Promise.all(calls);
      toast(t('greenManure.planned', { count: calls.length }));
      loadExisting(); // naplánované odpadnou z dedupu → karta se zmenší/skryje
    } catch (e) {
      toast(t('greenManure.planFailed', { msg: e.message }));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="green-manure-card" role="note">
      <div className="green-manure-head">
        <span className="green-manure-title">🌱 {t('greenManure.title')}</span>
        <span className="green-manure-sub">{t('greenManure.summary', { count: items.length })}</span>
      </div>
      <div className="green-manure-list">
        {items.map((it) => (
          <div key={it.bedId} className="green-manure-row">
            <span className="green-manure-swatch" style={{ background: it.bedColor || '#8b6f47' }} />
            <span className="green-manure-main">
              <span className="green-manure-bed">{it.bedName}</span>
              <span className="green-manure-meta">
                {mixLabel(it.mixKey)} · {mixDesc(it.mixKey)} · {formatDayMonth(it.suggested)}
              </span>
            </span>
            <span className="green-manure-when">{monthNameShort(it.month - 1)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="green-manure-btn" onClick={createAll} disabled={creating}>
        {creating ? t('greenManure.planning') : t('greenManure.planAll', { count: items.length })}
      </button>
    </div>
  );
}
