// Mrazové varování na řádku úkolu + nabídka „Odložit za mráz".
// Zobrazí se jen u mrazově citlivých úkolů (přesazení/výsadba) naplánovaných na den
// s předpovězeným mrazem. Postpone posune termín na první den bez mrazu v předpovědi.
// Veškerá logika je klientská (frost.js nad /api/weather) — žádné nové endpointy.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { frostRiskForTask, firstFrostFreeDate, shortFrostDate } from '../frost.js';
import { formatDate } from '../utils.js';

export default function FrostWarning({ task, forecast, onPostponed, compact = false }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const risk = frostRiskForTask(task, forecast);
  if (!risk) return null;

  const target = firstFrostFreeDate(forecast, risk.date);

  const postpone = async (e) => {
    e?.stopPropagation();
    if (busy || !target) return;
    setBusy(true);
    try {
      await api.snoozeTask(task.id, { until: target });
      toast(t('frost.postponed', { date: formatDate(target) }));
      onPostponed?.();
    } catch (err) {
      toast(t('frost.postponeFailed', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`frost-alert${compact ? ' compact' : ''}`} role="alert">
      <span className="frost-alert-badge" title={t('frost.tooltip', { temp: Math.round(risk.min) })}>
        ⚠️ {t('frost.badge', { date: shortFrostDate(risk.date) })}
      </span>
      {target && (
        <button type="button" className="frost-alert-btn" onClick={postpone} disabled={busy}>
          {busy ? t('frost.postponing') : t('frost.postpone')}
        </button>
      )}
    </div>
  );
}
