// Přehled osevního postupu pro zahradu (záložka Statistiky v detailu zahrady).
// Pro každý záhon se zeleninou/letničkami ukáže, jaké botanické čeledi v něm nedávno
// rostly, upozorní na opakování téže čeledi (rotace neprobíhá) a navrhne vhodnou rotaci
// pro příští výsadbu. Čistě klientské nad existujícími piny/záhony (viz data/cropRotation.js).
// Skryje se, není-li co ukázat.
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gardenRotationOverview, ROTATION_FAMILIES } from '../data/cropRotation.js';

export default function RotationCard({ beds, pins }) {
  const { t } = useTranslation();
  const overview = useMemo(
    () => gardenRotationOverview({ beds, pins }),
    [beds, pins],
  );
  if (overview.length === 0) return null;

  const famLabel = (key) => t(ROTATION_FAMILIES[key]?.labelKey || key);
  const famEmoji = (key) => ROTATION_FAMILIES[key]?.emoji || '🌱';

  return (
    <div className="rotation-card" role="note">
      <div className="rotation-head">
        <span className="rotation-title">🔄 {t('cropRotation.cardTitle')}</span>
        <span className="rotation-sub">{t('cropRotation.cardSub', { count: overview.length })}</span>
      </div>
      <div className="rotation-beds">
        {overview.map(({ bed, families, warnings, suggestions }) => {
          const warnSet = new Set(warnings.map((w) => w.family));
          return (
            <div key={bed.id} className="rotation-bed">
              <div className="rotation-bed-name">
                <span className="rotation-bed-swatch" style={{ background: bed.color || '#8b6f47' }} />
                {bed.name}
              </div>
              <div className="rotation-fam-chips">
                {families.map((f) => (
                  <span
                    key={f.family}
                    className={`rotation-chip${warnSet.has(f.family) ? ' is-warn' : ''}`}
                    title={f.plantNames.join(', ')}
                  >
                    {famEmoji(f.family)} {famLabel(f.family)}
                    <span className="rotation-chip-year">{f.latestYear}</span>
                  </span>
                ))}
              </div>
              {warnings.length > 0 && (
                <div className="rotation-warn">
                  ⚠️ {t('cropRotation.warnRepeat', { family: famLabel(warnings[0].family) })}
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="rotation-suggest">
                  <span className="rotation-suggest-lead">{t('cropRotation.suggestLead')}</span>
                  {suggestions.map((s) => (
                    <span key={s} className="rotation-suggest-chip">
                      {famEmoji(s)} {famLabel(s)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
