// Seasonal calendar — 12 months grid with planned tasks per month, filterable by garden
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { taskIcon, taskLabel } from '../utils.js';
import PinDetail from '../pages/PinDetail.jsx';
import seasonalData from '../data/seasonal.json';
import { getWarningsForMonth, monthRangeLabel } from '../pestDatabase.js';

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];
const MONTH_EMOJI = ['❄️', '❄️', '🌱', '🌷', '🌸', '☀️', '☀️', '🌻', '🍂', '🍁', '🍂', '🎄'];

// Najdi piny, kde plant_name obsahuje některý z tagů (case-insensitive)
function matchPinsByTags(pins, tags) {
  if (!tags || tags.length === 0) return [];
  const norm = (s) => (s || '').toLowerCase();
  return pins.filter((p) => {
    const name = norm(p.plant_name);
    if (!name) return false;
    return tags.some((tag) => name.includes(norm(tag)));
  });
}

export default function SeasonalCalendar() {
  const [tasks, setTasks] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [allPins, setAllPins] = useState([]);
  const [gardenFilter, setGardenFilter] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [openPin, setOpenPin] = useState(null);
  const [expandedSeasonal, setExpandedSeasonal] = useState({});
  const [expandedWarnings, setExpandedWarnings] = useState({});
  const [completing, setCompleting] = useState(null);
  const currentMonthRef = useRef(null);

  // Označit úkol jako hotový přímo z kalendáře — zastav propagaci, ať neotevře PinDetail
  const handleCompleteTask = async (e, taskId) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(taskId);
    try {
      await api.completeTask(taskId);
      toast('✅ Hotovo');
      const fresh = await api.listTasks();
      setTasks(fresh);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setCompleting(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, g] = await Promise.all([api.listTasks(), api.listGardens()]);
        setTasks(t);
        setGardens(g);
        // Načti všechny piny ze všech zahrad (pro plantTags filtr)
        const pinLists = await Promise.all(
          g.map((garden) => api.listPins(garden.id).catch(() => [])),
        );
        setAllPins(pinLists.flat());
      } catch (e) {
        toast('Chyba: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Scroll na aktuální měsíc po načtení (s malou prodlevou kvůli renderu)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (currentMonthRef.current) {
        currentMonthRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [loading]);

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
          const seasonal = seasonalData.months[idx];
          const seasonalTasks = seasonal?.tasks || [];
          const isExpanded = !!expandedSeasonal[idx] || isCurrent;
          // Preventivní varování — choroby/škůdci aktivní v tomto měsíci,
          // omezené na rostliny, které uživatel skutečně pěstuje.
          const monthWarnings = getWarningsForMonth(idx + 1)
            .map((w) => ({ ...w, pins: matchPinsByTags(allPins, w.plantTags) }))
            .filter((w) => w.pins.length > 0);
          const warningsExpanded = !!expandedWarnings[idx] || isCurrent;
          const isEmptyMonth =
            monthTasks.length === 0 && seasonalTasks.length === 0 && monthWarnings.length === 0;
          return (
            <div
              key={idx}
              ref={isCurrent ? currentMonthRef : null}
              className={`month-card${isCurrent ? ' current' : ''}${isEmptyMonth ? ' empty-month' : ''}`}
            >
              <div className="month-header">
                <span className="month-emoji">{MONTH_EMOJI[idx]}</span>
                <span className="month-name">{name}</span>
                {monthTasks.length > 0 && (
                  <span className="month-count">{monthTasks.length}</span>
                )}
                {isCurrent && <span className="badge" style={{ marginLeft: 'auto' }}>Tento měsíc</span>}
              </div>

              {/* Naplánované úkoly z DB */}
              {monthTasks.length > 0 && (
                <ul className="month-tasks">
                  {monthTasks.map((t) => {
                    const day = new Date(t.next_due).getDate();
                    const isCompleting = completing === t.id;
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
                        <button
                          type="button"
                          className="month-task-done"
                          onClick={(e) => handleCompleteTask(e, t.id)}
                          disabled={isCompleting}
                          title="Označit jako hotové"
                          aria-label="Označit úkol jako hotové"
                        >
                          {isCompleting ? '⏳' : '✓'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Sezónní typické úkoly pro ČR */}
              {seasonalTasks.length > 0 && (
                <div className="seasonal-section">
                  <button
                    type="button"
                    className="seasonal-toggle"
                    onClick={() =>
                      setExpandedSeasonal((prev) => ({ ...prev, [idx]: !isExpanded }))
                    }
                    aria-expanded={isExpanded}
                  >
                    <span className="small muted">
                      🌿 Typické úkoly ({seasonalTasks.length})
                    </span>
                    <span className="small muted">{isExpanded ? '▴' : '▾'}</span>
                  </button>
                  {isExpanded && (
                    <ul className="seasonal-tasks">
                      {seasonalTasks.map((st, i) => {
                        const matchedPins = matchPinsByTags(allPins, st.plantTags);
                        return (
                          <li key={i} className="seasonal-task">
                            <span className="seasonal-icon">{taskIcon(st.type)}</span>
                            <div className="seasonal-info">
                              <div className="seasonal-title">{st.title}</div>
                              {st.desc && (
                                <div className="seasonal-desc small muted">{st.desc}</div>
                              )}
                              {matchedPins.length > 0 && (
                                <div className="seasonal-pins">
                                  {matchedPins.slice(0, 6).map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="seasonal-pin-chip"
                                      onClick={() => setOpenPin(p.id)}
                                      title={`Otevřít ${p.name}`}
                                    >
                                      📍 {p.plant_name || p.name}
                                    </button>
                                  ))}
                                  {matchedPins.length > 6 && (
                                    <span className="small muted">
                                      +{matchedPins.length - 6}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Preventivní varování — choroby a škůdci */}
              {monthWarnings.length > 0 && (
                <div className="seasonal-section warning-section">
                  <button
                    type="button"
                    className="seasonal-toggle"
                    onClick={() =>
                      setExpandedWarnings((prev) => ({ ...prev, [idx]: !warningsExpanded }))
                    }
                    aria-expanded={warningsExpanded}
                  >
                    <span className="small warning-toggle-label">
                      ⚠️ Na co si dát pozor ({monthWarnings.length})
                    </span>
                    <span className="small muted">{warningsExpanded ? '▴' : '▾'}</span>
                  </button>
                  {warningsExpanded && (
                    <ul className="seasonal-tasks">
                      {monthWarnings.map((w) => (
                        <li key={w.id} className="seasonal-task warning-task">
                          <span className="seasonal-icon">{w.icon}</span>
                          <div className="seasonal-info">
                            <div className="seasonal-title">
                              {w.name}
                              <span className="pest-month-badge">
                                🗓️ {monthRangeLabel(w.months)}
                              </span>
                            </div>
                            <div className="seasonal-desc small muted">{w.prevention}</div>
                            <div className="seasonal-pins">
                              {w.pins.slice(0, 6).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="seasonal-pin-chip"
                                  onClick={() => setOpenPin(p.id)}
                                  title={`Otevřít ${p.name}`}
                                >
                                  📍 {p.plant_name || p.name}
                                </button>
                              ))}
                              {w.pins.length > 6 && (
                                <span className="small muted">+{w.pins.length - 6}</span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isEmptyMonth && (
                <div className="month-empty small muted">—</div>
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
