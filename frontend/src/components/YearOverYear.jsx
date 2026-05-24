// Meziroční srovnání splněných úkonů — letos vs. minulý rok
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const MONTH_SHORT = ['L', 'Ú', 'B', 'D', 'K', 'Č', 'Č', 'S', 'Z', 'Ř', 'L', 'P'];
const MONTH_FULL = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

function pluralUkony(n) {
  if (n === 1) return 'úkon';
  if (n >= 2 && n <= 4) return 'úkony';
  return 'úkonů';
}

export default function YearOverYear({ gardenId = null, title }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .yoyStats({ gardenId })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gardenId]);

  const max = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.thisMonthly, ...data.lastMonthly, 1);
  }, [data]);

  if (loading) return null;
  if (error) return null;
  if (!data) return null;

  // Pokud ani jeden rok nemá data, nezobrazuj kartu
  if (data.thisTotal === 0 && data.lastTotal === 0) return null;

  const currentMonth = new Date().getMonth();
  const pct = data.percentChange;
  const trendCls =
    pct === null ? '' : pct > 0 ? 'yoy-trend-up' : pct < 0 ? 'yoy-trend-down' : 'yoy-trend-flat';
  const trendIcon = pct === null ? '—' : pct > 0 ? '↑' : pct < 0 ? '↓' : '→';

  return (
    <div className="yoy-card card">
      <div className="yoy-header">
        <div className="yoy-title">
          📈 {title || 'Meziroční srovnání'}
        </div>
        <div className="small muted">Splněné úkony</div>
      </div>

      {/* Tři velká čísla — letos do dnešního dne, loni do stejného data, % změna */}
      <div className="yoy-totals">
        <div className="yoy-total">
          <div className="yoy-total-val accent">{data.thisToDate}</div>
          <div className="yoy-total-lbl">Letos do dnes</div>
          <div className="yoy-total-sub small muted">{data.thisYear}</div>
        </div>
        <div className="yoy-total">
          <div className="yoy-total-val">{data.lastToDateSame}</div>
          <div className="yoy-total-lbl">Loni do stejného data</div>
          <div className="yoy-total-sub small muted">{data.lastYear}</div>
        </div>
        <div className="yoy-total">
          <div className={`yoy-total-val ${trendCls}`}>
            {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}
          </div>
          <div className="yoy-total-lbl">
            <span className={trendCls}>{trendIcon}</span> Změna
          </div>
          <div className="yoy-total-sub small muted">
            {pct === null ? 'Bez loňských dat' : 'vs. stejné období'}
          </div>
        </div>
      </div>

      {/* Bar chart — dva sloupce vedle sebe pro každý měsíc */}
      <div className="yoy-chart">
        <div className="yoy-legend">
          <span className="yoy-legend-item">
            <span className="yoy-swatch this" /> {data.thisYear}
          </span>
          <span className="yoy-legend-item">
            <span className="yoy-swatch last" /> {data.lastYear}
          </span>
        </div>
        <div className="yoy-chart-bars">
          {data.thisMonthly.map((thisC, idx) => {
            const lastC = data.lastMonthly[idx];
            const hThis = max > 0 ? Math.max((thisC / max) * 100, thisC > 0 ? 6 : 0) : 0;
            const hLast = max > 0 ? Math.max((lastC / max) * 100, lastC > 0 ? 6 : 0) : 0;
            const isCurrent = idx === currentMonth;
            return (
              <div
                key={idx}
                className={`yoy-bar-wrap${isCurrent ? ' current' : ''}`}
                title={`${MONTH_FULL[idx]}: letos ${thisC} ${pluralUkony(thisC)}, loni ${lastC} ${pluralUkony(lastC)}`}
              >
                <div className="yoy-bar-track">
                  <div
                    className="yoy-bar this"
                    style={{ height: `${hThis}%` }}
                    aria-label={`${data.thisYear}: ${thisC}`}
                  />
                  <div
                    className="yoy-bar last"
                    style={{ height: `${hLast}%` }}
                    aria-label={`${data.lastYear}: ${lastC}`}
                  />
                </div>
                <div className="yoy-bar-label">{MONTH_SHORT[idx]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {data.missing.length > 0 && (
        <div className="yoy-missing">
          <div className="yoy-missing-title">
            ⏰ Co jste dělali loni a letos ještě ne
          </div>
          <ul className="yoy-missing-list">
            {data.missing.map((m) => {
              const d = new Date(m.last_done_at);
              const when = d.toLocaleDateString('cs-CZ', {
                day: 'numeric',
                month: 'short',
              });
              return (
                <li key={`${m.pin_id}-${m.action}`} className="yoy-missing-item">
                  <div className="yoy-missing-action">{m.action}</div>
                  <div className="yoy-missing-meta small muted">
                    {gardenId ? null : (
                      <>
                        🗺️ <Link to={`/zahrada/${m.garden_id}`}>{m.garden_name}</Link>
                        {' · '}
                      </>
                    )}
                    🌿 {m.plant_name || m.pin_name} · loni {when}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
