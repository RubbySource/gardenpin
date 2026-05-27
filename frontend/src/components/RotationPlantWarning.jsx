// Varování osevního postupu při ZAKLÁDÁNÍ VÝSADBY (v NewPinModal). Když vybraná rostlina
// padne do záhonu, kde v minulých letech rostla TÁŽ botanická čeleď, nenásilně varuje
// a navrhne vhodnější rotační čeleď. Skryje se, není-li konflikt (nebo pin mimo záhon /
// rostlina mimo rotaci). Viz data/cropRotation.js.
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { rotationCheckForPlanting, ROTATION_FAMILIES } from '../data/cropRotation.js';

export default function RotationPlantWarning({ plantName, x, y, beds, pins }) {
  const { t } = useTranslation();
  const check = useMemo(
    () => rotationCheckForPlanting({ plantName, x, y, beds, pins }),
    [plantName, x, y, beds, pins],
  );
  if (!check || check.conflictYear == null) return null;

  const famLabel = (key) => t(ROTATION_FAMILIES[key]?.labelKey || key);
  const famEmoji = (key) => ROTATION_FAMILIES[key]?.emoji || '🌱';
  const suggestions = check.suggestions || [];

  return (
    <div className="rotation-warn-box" role="alert">
      <div className="rotation-warn-title">⚠️ {t('cropRotation.plantWarnTitle')}</div>
      <div className="rotation-warn-body">
        {t('cropRotation.plantWarnBody', {
          family: famLabel(check.family),
          year: check.conflictYear,
        })}
      </div>
      {suggestions.length > 0 && (
        <div className="rotation-warn-suggest">
          <span className="rotation-suggest-lead">{t('cropRotation.plantSuggestLead')}</span>
          {suggestions.map((s) => (
            <span key={s} className="rotation-suggest-chip">
              {famEmoji(s)} {famLabel(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
