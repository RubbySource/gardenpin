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
  const [harvest, setHarvest] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.seasonStats(year).catch(() => null),
      api.harvestStats(year).catch(() => null),
    ])
      .then(([s, h]) => {
        setData(s);
        setHarvest(h);
      })
      .finally(() => setLoading(false));
  }, [year]);

  const currentMonth = new Date().getMonth();
  const max = useMemo(() => {
    if (!data?.monthlyDone) return 0;
    return Math.max(...data.monthlyDone, 1);
  }, [data]);

  if (loading && !data && !harvest) return null;
  if (!data && !harvest) return null;

  const hasAnyActivity = data && data.doneThisYear > 0;

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

      <HarvestSection harvest={harvest} year={year} />
    </div>
  );
}

function HarvestSection({ harvest, year }) {
  if (!harvest || harvest.entries === 0) return null;

  const prevByUnit = new Map((harvest.totalsByUnitPrev || []).map((r) => [r.unit, r.total]));

  return (
    <div className="season-harvest" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--sand-dark, #d8c9a7)' }}>
      <div className="season-stats-title" style={{ marginBottom: 10 }}>🧺 Sklizeň {year}</div>

      <div className="season-stat-row">
        {harvest.totalsByUnit.map((row) => {
          const prev = prevByUnit.get(row.unit);
          let trendText = null;
          let trendCls = '';
          if (prev && prev > 0) {
            const diff = row.total - prev;
            const pct = Math.round((diff / prev) * 100);
            trendText = `${pct >= 0 ? '+' : ''}${pct}% vs ${year - 1}`;
            trendCls = pct >= 0 ? 'trend-up' : 'trend-down';
          } else if (prev === 0 || prev === undefined) {
            trendText = `Nový rok`;
          }
          return (
            <div key={row.unit} className="season-stat-card">
              <div className="season-stat-value">{row.total} {row.unit}</div>
              <div className="season-stat-label">
                {row.entries} {row.entries === 1 ? 'záznam' : (row.entries < 5 ? 'záznamy' : 'záznamů')}
              </div>
              {trendText && (
                <div className={`small muted ${trendCls}`} style={{ marginTop: 4 }}>
                  {trendText}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {harvest.topPlants && harvest.topPlants.length > 0 && (
        <div className="season-top" style={{ marginTop: 12 }}>
          {harvest.topPlants.slice(0, 3).map((p) => (
            <div key={`${p.pin_id}-${p.unit}`} className="season-top-item">
              <div className="season-top-icon">🥇</div>
              <div className="season-top-body">
                <div className="season-top-label">{p.plant_name || p.pin_name}</div>
                <div className="season-top-value">{p.total} {p.unit}</div>
                <div className="season-top-meta small muted">{p.garden_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
