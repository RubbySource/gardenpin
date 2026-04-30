// All tasks page — GardenPin design: měsíce + chip pro datum
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import { daysFromToday, taskIcon, dueBadge } from '../utils.js';

const MONTH_NAMES_CZ = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

export default function TasksPage({ onTaskComplete }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [openPin, setOpenPin] = useState(null);

  const load = async () => {
    try {
      const [t, h] = await Promise.all([api.listTasks(), api.listHistory()]);
      setTasks(t);
      setHistory(h);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const completeTask = async (t) => {
    try {
      await api.completeTask(t.id);
      toast('✅ Hotovo');
      load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  // Seskupit úkoly po měsíci, plus extra "Po termínu" sekce
  const grouped = useMemo(() => {
    const overdue = [];
    const byMonth = new Map(); // 'YYYY-MM' → { label, year, month, items }
    for (const t of tasks) {
      const days = daysFromToday(t.next_due);
      if (days !== null && days < 0) {
        overdue.push(t);
        continue;
      }
      if (!t.next_due) continue;
      const d = new Date(t.next_due);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, {
          key,
          label: `${MONTH_NAMES_CZ[d.getMonth()]} ${d.getFullYear()}`,
          items: [],
        });
      }
      byMonth.get(key).items.push(t);
    }
    return { overdue, months: Array.from(byMonth.values()) };
  }, [tasks]);

  if (loading) return <div className="empty">Načítám...</div>;

  return (
    <>
      <div className="page-header">
        <div className="heading">
          <div className="eyebrow">📋 Plánovač</div>
          <h1>Sezónní úkoly</h1>
          <div className="subtitle">
            {tasks.length === 0
              ? 'Vše hotovo'
              : `${tasks.length} ${tasks.length === 1 ? 'úkol' : tasks.length < 5 ? 'úkoly' : 'úkolů'} celkem`}
          </div>
        </div>
      </div>

      <div className="gp-tabs">
        <button
          className={tab === 'upcoming' ? 'active' : ''}
          onClick={() => setTab('upcoming')}
        >
          Nadcházející ({tasks.length})
        </button>
        <button
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          Historie ({history.length})
        </button>
      </div>

      {tab === 'upcoming' && (
        <>
          {tasks.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty-icon">🌼</span>
              <div className="gp-empty-title">Žádné úkoly</div>
              <div className="gp-empty-text">
                Přidejte úkoly v detailu rostliny v zahradě nebo vyberte rostlinu z databáze
                a nechte si automaticky naplánovat sezónní péči.
              </div>
            </div>
          ) : (
            <>
              {grouped.overdue.length > 0 && (
                <div className="gp-month-group">
                  <div className="section-header">
                    <div className="title" style={{ color: 'var(--danger)' }}>
                      ⚠️ Po termínu
                    </div>
                    <span className="count-badge danger">{grouped.overdue.length}</span>
                  </div>
                  {grouped.overdue.map((t) => (
                    <GpTaskCard
                      key={t.id}
                      task={t}
                      onComplete={completeTask}
                      onClick={() => setOpenPin(t.pin_id)}
                    />
                  ))}
                </div>
              )}
              {grouped.months.map((g) => (
                <div key={g.key} className="gp-month-group">
                  <div className="section-header">
                    <div className="title">{g.label}</div>
                    <span className="count-badge">{g.items.length}</span>
                  </div>
                  {g.items.map((t) => (
                    <GpTaskCard
                      key={t.id}
                      task={t}
                      onComplete={completeTask}
                      onClick={() => setOpenPin(t.pin_id)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {history.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty-icon">📖</span>
              <div className="gp-empty-title">Zatím žádná historie</div>
              <div className="gp-empty-text">
                Po dokončení úkolů se zde objeví záznam o péči.
              </div>
            </div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className="gp-task is-done"
                onClick={() => setOpenPin(h.pin_id)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                >
                  ✓
                </div>
                <div className="gp-task-body">
                  <div className="gp-task-title">{h.action}</div>
                  <div className="gp-task-meta">
                    {h.pin_name}
                    {h.plant_name ? ` · ${h.plant_name}` : ''}
                    {' · 🗺️ '}
                    {h.garden_name}
                  </div>
                  {h.notes && (
                    <div className="gp-task-meta" style={{ marginTop: 4 }}>
                      {h.notes}
                    </div>
                  )}
                  <div className="gp-task-chips">
                    <span className="gp-chip muted">
                      {new Date(h.done_at + 'Z').toLocaleString('cs-CZ', {
                        day: 'numeric',
                        month: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {openPin && (
        <PinDetail
          pinId={openPin}
          onClose={() => {
            setOpenPin(null);
            load();
          }}
        />
      )}
    </>
  );
}

// GardenPin task karta — emoji + název + zahrada + chip s datem
function GpTaskCard({ task, onComplete, onClick }) {
  const badge = dueBadge(task.next_due);
  const days = daysFromToday(task.next_due);
  const stateClass =
    days !== null && days < 0
      ? 'is-overdue'
      : days === 0
      ? 'is-today'
      : '';

  // Title typically already has emoji prefix from buildSeasonalTaskPayloads, but if not — fallback
  const cleanTitle = task.title;
  const fallbackEmoji = taskIcon(task.task_type);

  return (
    <div className={`gp-task ${stateClass}`}>
      <button
        className="gp-task-check"
        onClick={(e) => {
          e.stopPropagation();
          onComplete?.(task);
        }}
        aria-label="Označit jako hotové"
        title="Označit jako hotové"
      >
        ✓
      </button>
      <div
        className="gp-task-body"
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className="gp-task-title">
          {!/^[^\w\s]/u.test(cleanTitle) && <span>{fallbackEmoji}</span>}
          <span>{cleanTitle}</span>
        </div>
        <div className="gp-task-meta">
          🌿 {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
          {task.garden_name ? ` · 🗺️ ${task.garden_name}` : ''}
        </div>
        <div className="gp-task-chips">
          {badge && <span className={`gp-chip ${badge.cls}`}>{badge.text}</span>}
          {task.frequency_days ? (
            <span className="gp-chip">🔁 {task.frequency_days} dní</span>
          ) : null}
          {task.specific_date && !task.frequency_days ? (
            <span className="gp-chip">📌 Jednorázově</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
