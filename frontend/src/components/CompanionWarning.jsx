// Companion warning: zkontroluje, jestli má pin v blízkosti nekompatibilní/doporučené
// rostliny dle plantDatabase companions.good/bad. "Blízkost" = stejný záhon NEBO
// vzdálenost do NEIGHBOR_RADIUS_PCT % mapy. Cross-reference je accent + case insensitive
// (vstup z databáze ↔ user pin name).
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { findPlantByName } from '../plantDatabase.js';

const NEIGHBOR_RADIUS_PCT = 15;
const DIACRITICS_RE = /[̀-ͯ]/g;

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .trim();
}

function isNeighbor(self, other) {
  if (self.bed_id && other.bed_id && self.bed_id === other.bed_id) return true;
  const dx = (other.x ?? 0) - (self.x ?? 0);
  const dy = (other.y ?? 0) - (self.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy) <= NEIGHBOR_RADIUS_PCT;
}

// Externí helper: kolik UNIKÁTNÍCH "bad" sousedů má pin (pro ⚠️ badge na mapě).
export function countBadCompanions(pin, pins) {
  if (!pin?.plant_name || !Array.isArray(pins) || pins.length < 2) return 0;
  const plant = findPlantByName(pin.plant_name);
  const bad = plant?.companions?.bad;
  if (!bad || bad.length === 0) return 0;
  const badSet = new Set(bad.map(normalize));
  const seen = new Set();
  for (const p of pins) {
    if (p.id === pin.id || !p.plant_name) continue;
    if (!isNeighbor(pin, p)) continue;
    const key = normalize(p.plant_name);
    if (badSet.has(key)) seen.add(key);
  }
  return seen.size;
}

export default function CompanionWarning({ pin, pins }) {
  const { t } = useTranslation();

  const result = useMemo(() => {
    if (!pin?.plant_name || !Array.isArray(pins) || pins.length < 2) return null;
    const plant = findPlantByName(pin.plant_name);
    const companions = plant?.companions;
    if (!companions) return null;
    const goodList = companions.good || [];
    const badList = companions.bad || [];
    if (goodList.length === 0 && badList.length === 0) return null;

    const goodSet = new Set(goodList.map(normalize));
    const badSet = new Set(badList.map(normalize));

    const bad = [];
    const good = [];
    const seenBad = new Set();
    const seenGood = new Set();

    for (const p of pins) {
      if (p.id === pin.id || !p.plant_name) continue;
      if (!isNeighbor(pin, p)) continue;
      const key = normalize(p.plant_name);
      if (badSet.has(key) && !seenBad.has(key)) {
        seenBad.add(key);
        bad.push(p.plant_name);
      } else if (goodSet.has(key) && !seenGood.has(key)) {
        seenGood.add(key);
        good.push(p.plant_name);
      }
    }

    if (bad.length === 0 && good.length === 0) return null;
    return { bad, good };
  }, [pin, pins]);

  if (!result) return null;
  const { bad, good } = result;

  if (bad.length > 0) {
    return (
      <div className="companion-warn-box" role="alert">
        <div className="companion-warn-title">⚠️ {t('companionWarn.badTitle')}</div>
        <div className="companion-warn-body">
          {t('companionWarn.badBody', { neighbors: bad.join(', ') })}
        </div>
        {good.length > 0 && (
          <div className="companion-warn-good-line">
            ✅ {t('companionWarn.goodSuffix', { neighbors: good.join(', ') })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="companion-warn-box good" role="status">
      <div className="companion-warn-title">✅ {t('companionWarn.goodTitle')}</div>
      <div className="companion-warn-body">
        {t('companionWarn.goodBody', { neighbors: good.join(', ') })}
      </div>
    </div>
  );
}
