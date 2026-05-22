// Sezónní statistiky — splněné úkony, graf aktivity po měsících, top zahrada a rostlina
import React, { useEffect, useMemo, useState } from 'react';
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

export default function SeasonStats() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .seasonStats(year)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [year]);

  const currentMonth = new Date().getMonth();
  const max = useMemo(() => {
    if (!data?.monthlyDone) return 0;
    return Math.max(...data.monthlyDone, 1);
  }, [data]);

  if (loading && !data) return null;
  if (!data) return null;

  const hasAnyActivity = data.doneThisYear > 0;

  return (
    <div className="season-stats card">
      <div className="season-stats-header">
        <div className="season-stats-title">📊 Sezóna {year}</div>
        <div className="season-year-switch">
          <button
            type="button"
            className="season-year-btn"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Předchozí rok"
          >
            ‹
          </button>
          <button
            type="button"
            className="season-year-btn"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Další rok"
            disabled={year >= new Date().getFullYear()}
          >
            ›
          </button>
        </div>
      </div>

      {!hasAnyActivity ? (
        <div className="season-empty">
          <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🌱</div>
          <div className="small muted">
            {year === new Date().getFullYear()
              ? 'Zatím žádné splněné úkony — pusťte se do toho!'
              : `V roce ${year} žádné záznamy.`}
          </div>
        </div>
      ) : (
        <>
          <div className="season-stat-row">
            <div className="season-stat-card">
              <div className="season-stat-value">{data.doneThisMonth}</div>
              <div className="season-stat-label">Tento měsíc</div>
            </div>
            <div className="season-stat-card">
              <div className="season-stat-value">{data.doneThisYear}</div>
              <div className="season-stat-label">Celkem v roce</div>
            </div>
          </div>

          <div className="season-chart">
            <div className="season-chart-bars">
              {data.monthlyDone.map((count, idx) => {
                const h = max > 0 ? Math.max((count / max) * 100, count > 0 ? 8 : 0) : 0;
                const isCurrent = idx === currentMonth && year === new Date().getFullYear();
                return (
                  <div
                    key={idx}
                    className={`season-bar-wrap${isCurrent ? ' current' : ''}`}
                    title={`${MONTH_FULL[idx]}: ${count} ${pluralUkony(count)}`}
                  >
                    <div className="season-bar-count">{count > 0 ? count : ''}</div>
                    <div className="season-bar-track">
                      <div
                        className={`season-bar${count > 0 ? '' : ' is-empty'}`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <div className="season-bar-label">{MONTH_SHORT[idx]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {(data.topGarden || data.topPlant) && (
            <div className="season-top">
              {data.topGarden && (
                <div className="season-top-item">
                  <div className="season-top-icon">🏆</div>
                  <div className="season-top-body">
                    <div className="season-top-label">Nejaktivnější zahrada</div>
                    <div className="season-top-value">{data.topGarden.name}</div>
                    <div className="season-top-meta small muted">
                      {data.topGarden.done_count} {pluralUkony(data.topGarden.done_count)}
                    </div>
                  </div>
                </div>
              )}
              {data.topPlant && (
                <div className="season-top-item">
                  <div className="season-top-icon">🌿</div>
                  <div className="season-top-body">
                    <div className="season-top-label">Nejpečovanější rostlina</div>
                    <div className="season-top-value">
                      {data.topPlant.plant_name || data.topPlant.pin_name}
                    </div>
                    <div className="season-top-meta small muted">
                      {data.topPlant.garden_name} · {data.topPlant.done_count}{' '}
                      {pluralUkony(data.topPlant.done_count)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
