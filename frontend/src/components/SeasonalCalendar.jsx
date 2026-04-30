// Seasonal calendar — 12 months grid with planned tasks per month, filterable by garden
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { taskIcon, taskLabel } from '../utils.js';
import PinDetail from '../pages/PinDetail.jsx';

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];
const MONTH_EMOJI = ['❄️', '❄️', '🌱', '🌷', '🌸', '☀️', '☀️', '🌻', '🍂', '🍁', '🍂', '🎄'];

export default function SeasonalCalendar() {
  const [tasks, setTasks] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [gardenFilter, setGardenFilter] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [openPin, setOpenPin] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, g] = await Promise.all([api.listTasks(), api.listGardens()]);
        setTasks(t);
        setGardens(g);
      } catch (e) {
        toast('Chyba: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tasksByMonth = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => []);
    const filtered = gardenFilter === 'all'
      ? tasks
      : tasks.filter((t) => String(t.garden_id) === String(gardenFilter));
    for (const t of filtered) {
      if (!t.next_due) continue;
      const d = new Date(t.next_due);
      if (isNaN(d)) continue;
      if (d.getFullYear() !== year) continue;
      buckets[d.getMonth()].push(t);
    }
    for (const b of buckets) {
      b.sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));
    }
    return buckets;
  }, [tasks, gardenFilter, year]);

  const totalCount = tasksByMonth.reduce((s, b) => s + b.length, 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  if (loading) return <div className="empty">🌱 Načítám…</div>;

  return (
    <>
      <div className="section-header" style={{ marginTop: 4 }}>
        <div className="title">📅 Sezónní kalendář</div>
        {totalCount > 0 && <span className="count-badge">{totalCount}</span>}
      </div>

      <div className="calendar-controls">
        <div className="calendar-year-switch">
          <button
            className="btn ghost small"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Předchozí rok"
          >
            ‹
          </button>
          <div className="calendar-year-label">{year}</div>
          <button
            className="btn ghost small"
            onClick={() => setYear((y) => y + 1)}
            aria-label="Další rok"
          >
            ›
          </button>
        </div>

        <select
          className="calendar-garden-select"
          value={gardenFilter}
          onChange={(e) => setGardenFilter(e.target.value)}
        >
          <option value="all">🗺️ Všechny zahrady</option>
          {gardens.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {totalCount === 0 && (
        <div className="card empty">
          <div className="icon">🌼</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Žádné naplánované úkoly</div>
          <div className="small muted">
            {gardenFilter === 'all'
              ? `V roce ${year} nejsou naplánované žádné úkoly.`
              : 'Zkuste vybrat jinou zahradu nebo rok.'}
          </div>
        </div>
      )}

      <div className="months-grid">
        {MONTH_NAMES.map((name, idx) => {
          const monthTasks = tasksByMonth[idx];
          const isCurrent = idx === currentMonth && year === currentYear;
          return (
            <div
              key={idx}
              className={`month-card${isCurrent ? ' current' : ''}${monthTasks.length === 0 ? ' empty-month' : ''}`}
            >
              <div className="month-header">
                <span className="month-emoji">{MONTH_EMOJI[idx]}</span>
                <span className="month-name">{name}</span>
                {monthTasks.length > 0 && (
                  <span className="month-count">{monthTasks.length}</span>
                )}
              </div>

              {monthTasks.length === 0 ? (
                <div className="month-empty small muted">—</div>
              ) : (
                <ul className="month-tasks">
                  {monthTasks.map((t) => {
                    const day = new Date(t.next_due).getDate();
                    return (
                      <li
                        key={t.id}
                        className="month-task"
                        onClick={() => setOpenPin(t.pin_id)}
                      >
                        <span className="month-task-day">{day}.</span>
                        <span className="month-task-icon">{taskIcon(t.task_type)}</span>
                        <span className="month-task-info">
                          <span className="month-task-title">{t.title || taskLabel(t.task_type)}</span>
                          <span className="month-task-meta small muted">
                            {t.pin_name}
                            {gardenFilter === 'all' && t.garden_name ? ` · ${t.garden_name}` : ''}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {openPin && (
        <PinDetail
          pinId={openPin}
          onClose={async () => {
            setOpenPin(null);
            try {
              const t = await api.listTasks();
              setTasks(t);
            } catch {
              // ignore
            }
          }}
        />
      )}
    </>
  );
}
