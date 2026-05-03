// All tasks page with smart time buckets + swipe-to-complete
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import { daysFromToday, taskIcon, taskLabel, dueBadge } from '../utils.js';
import { useSwipeToComplete } from '../hooks/useSwipeToComplete.js';

const MONTH_NAMES = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
];

// Smart time buckets — Dnes / Tento týden / Příští týden / Později / Bez termínu
const BUCKETS = [
  { key: 'overdue', label: '⚠️ Po termínu', tone: 'danger' },
  { key: 'today', label: '🌞 Dnes', tone: 'warning' },
  { key: 'thisWeek', label: '📆 Tento týden', tone: '' },
  { key: 'nextWeek', label: '🗓️ Příští týden', tone: '' },
  { key: 'later', label: '🌱 Později', tone: '' },
  { key: 'undated', label: '🕓 Bez termínu', tone: 'muted' },
];

function bucketForTask(task) {
  const days = daysFromToday(task.next_due);
  if (days === null) return 'undated';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  // Tento týden = do neděle
  const now = new Date();
  const dow = now.getDay() === 0 ? 7 : now.getDay(); // Pondělí=1 ... Neděle=7
  const daysToSunday = 7 - dow; // 0..6
  if (days <= daysToSunday) return 'thisWeek';
  if (days <= daysToSunday + 7) return 'nextWeek';
  return 'later';
}

function groupTasksByBucket(tasks) {
  const groups = {};
  BUCKETS.forEach((b) => (groups[b.key] = []));
  tasks.forEach((t) => {
    const k = bucketForTask(t);
    groups[k].push(t);
  });
  // Seřaď v každém bucketu podle data
  Object.keys(groups).forEach((k) => {
    groups[k].sort((a, b) => {
      if (!a.next_due) return 1;
      if (!b.next_due) return -1;
      return new Date(a.next_due) - new Date(b.next_due);
    });
  });
  return groups;
}

function monthKey(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  if (key === 'unknown') return 'Bez data';
  const [y, m] = key.split('-');
  const monthIdx = parseInt(m, 10) - 1;
  const now = new Date();
  const isCurrent =
    parseInt(y, 10) === now.getFullYear() && monthIdx === now.getMonth();
  const yearLabel = parseInt(y, 10) === now.getFullYear() ? '' : ` ${y}`;
  return (isCurrent ? 'Tento měsíc · ' : '') + MONTH_NAMES[monthIdx] + yearLabel;
}

function groupByMonth(items, getDate) {
  const groups = new Map();
  items.forEach((it) => {
    const key = monthKey(getDate(it));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  return Array.from(groups.entries());
}

export default function TasksPage({ onTaskComplete }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming'); // upcoming | all | done
  const [openPin, setOpenPin] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());

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
    if (completingIds.has(t.id)) return;
    setCompletingIds((s) => new Set(s).add(t.id));
    try {
      await api.completeTask(t.id);
      toast('✅ Hotovo');
      await load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setCompletingIds((s) => {
        const next = new Set(s);
        next.delete(t.id);
        return next;
      });
    }
  };

  const overdueCount = tasks.filter((t) => daysFromToday(t.next_due) < 0).length;
  const todayCount = tasks.filter((t) => daysFromToday(t.next_due) === 0).length;
  const urgentCount = overdueCount + todayCount;

  // 'upcoming' = vše s termínem do +14 dní + bez termínu
  // 'all' = všechny aktivní úkoly
  const visibleTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'upcoming') {
      return tasks.filter((t) => {
        const d = daysFromToday(t.next_due);
        if (d === null) return true; // bez termínu
        return d <= 14;
      });
    }
    return [];
  }, [tasks, filter]);

  const buckets = useMemo(() => groupTasksByBucket(visibleTasks), [visibleTasks]);

  const historyGroups = useMemo(() => {
    if (filter !== 'done') return [];
    return groupByMonth(history, (h) => h.done_at).sort(
      ([a], [b]) => b.localeCompare(a),
    );
  }, [history, filter]);

  if (loading) return <div className="empty">🌱 Načítám...</div>;

  return (
    <>
      <div className="tasks-hero">
        <div className="tasks-hero-row">
          <div>
            <div className="tasks-hero-eyebrow">📋 Úkoly</div>
            <div className="tasks-hero-title">
              {urgentCount > 0
                ? `${urgentCount} ${urgentCount === 1 ? 'úkol' : urgentCount < 5 ? 'úkoly' : 'úkolů'} čeká`
                : tasks.length > 0
                ? 'Vše pod kontrolou 🌿'
                : 'Žádné úkoly'}
            </div>
          </div>
          {urgentCount > 0 && (
            <div className="tasks-hero-urgent">
              <div className="val">{urgentCount}</div>
              <div className="lbl">naléhavé</div>
            </div>
          )}
        </div>
        <div className="tasks-hero-stats">
          <div className="tasks-hero-stat">
            <div className="val">{tasks.length}</div>
            <div className="lbl">Naplánováno</div>
          </div>
          <div className="tasks-hero-stat">
            <div className={`val ${overdueCount > 0 ? 'danger' : ''}`}>{overdueCount}</div>
            <div className="lbl">Po termínu</div>
          </div>
          <div className="tasks-hero-stat">
            <div className="val">{history.length}</div>
            <div className="lbl">Hotovo</div>
          </div>
        </div>
      </div>

      <div className="filter-pills">
        <button
          className={`filter-pill ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          Nadcházející
        </button>
        <button
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Vše {tasks.length > 0 && <span className="pill-count">{tasks.length}</span>}
        </button>
        <button
          className={`filter-pill ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Dokončené {history.length > 0 && <span className="pill-count">{history.length}</span>}
        </button>
      </div>

      {/* Smart bucket view for upcoming/all */}
      {filter !== 'done' && (
        <>
          {visibleTasks.length === 0 && (
            <div className="tasks-empty-illustration">
              <div className="emoji-art">
                <span>🌻</span>
                <span>🌱</span>
                <span>🌷</span>
              </div>
              <div className="title">
                {filter === 'upcoming'
                  ? 'Žádné úkoly v nejbližších dnech'
                  : 'Žádné úkoly'}
              </div>
              <div className="text">
                {filter === 'upcoming'
                  ? 'Užijte si den v zahradě 🌿'
                  : 'Přidejte je v detailu místa v zahradě.'}
              </div>
            </div>
          )}
          {BUCKETS.map((bucket) => {
            const items = buckets[bucket.key] || [];
            if (items.length === 0) return null;
            return (
              <div key={bucket.key} className={`task-bucket task-bucket-${bucket.tone}`}>
                <div className="task-bucket-header">
                  <span className="task-bucket-name">{bucket.label}</span>
                  <span className="task-bucket-count">{items.length}</span>
                </div>
                <div className="task-bucket-body">
                  {items.map((t) => (
                    <SwipeTaskRow
                      key={t.id}
                      task={t}
                      completing={completingIds.has(t.id)}
                      onComplete={() => completeTask(t)}
                      onOpen={() => setOpenPin(t.pin_id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {filter === 'done' && historyGroups.length === 0 && (
        <div className="tasks-empty-illustration">
          <div className="emoji-art">
            <span>📭</span>
            <span>🌿</span>
          </div>
          <div className="title">Zatím žádná historie péče</div>
          <div className="text">Až dokončíte první úkol, objeví se tady.</div>
        </div>
      )}

      {filter === 'done' &&
        historyGroups.map(([key, items]) => (
          <div key={key} className="task-month-group">
            <div className="task-month-header">
              <span className="task-month-name">{monthLabel(key)}</span>
              <span className="task-month-count">{items.length}</span>
            </div>
            <div className="task-month-body">
              {items.map((h) => (
                <DoneRow key={h.id} item={h} onOpen={() => setOpenPin(h.pin_id)} />
              ))}
            </div>
          </div>
        ))}

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

function SwipeTaskRow({ task, completing, onComplete, onOpen }) {
  const badge = dueBadge(task.next_due);
  const cls = badge ? badge.cls : '';
  const { handlers, itemStyle, triggered } = useSwipeToComplete(() => onComplete?.());

  return (
    <div className="task-row-swipe-wrap">
      <div className={`task-row-swipe-bg ${triggered ? 'triggered' : ''}`} aria-hidden="true">
        <span className="swipe-icon">{triggered ? '✅' : '✓'}</span>
        <span className="swipe-label">{triggered ? 'Pustit' : 'Posuňte →'}</span>
      </div>
      <div
        className={`task-row ${cls} ${completing ? 'completing' : ''}`}
        style={itemStyle}
        {...handlers}
      >
        <button
          className={`task-checkbox ${completing ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          aria-label="Označit jako hotové"
          title="Označit jako hotové"
        >
          {completing ? '✓' : ''}
        </button>
        <div className="task-row-info" onClick={onOpen} style={{ cursor: 'pointer' }}>
          <div className="task-row-title">
            <span className="task-row-icon">{taskIcon(task.task_type)}</span>
            <span className="task-row-name">{task.title}</span>
          </div>
          <div className="task-row-meta">
            {task.pin_name}
            {task.plant_name ? ` · ${task.plant_name}` : ''}
            {task.garden_name ? ` · 🗺️ ${task.garden_name}` : ''}
          </div>
          <div className="task-row-tags">
            {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
            {task.frequency_days ? (
              <span className="badge">Každých {task.frequency_days} dní</span>
            ) : null}
            {task.specific_date ? <span className="badge">Jednorázově</span> : null}
            <span className="badge type">{taskLabel(task.task_type)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoneRow({ item, onOpen }) {
  const date = new Date(item.done_at + 'Z').toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="task-row done" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="task-checkbox checked done-static" aria-hidden="true">
        ✓
      </div>
      <div className="task-row-info">
        <div className="task-row-title">
          <span className="task-row-name">{item.action}</span>
        </div>
        <div className="task-row-meta">
          {item.pin_name}
          {item.plant_name ? ` · ${item.plant_name}` : ''}
          {item.garden_name ? ` · 🗺️ ${item.garden_name}` : ''}
        </div>
        {item.notes && <div className="small muted task-row-notes">{item.notes}</div>}
        <div className="task-row-tags">
          <span className="badge done-badge">📅 {date}</span>
        </div>
      </div>
    </div>
  );
}
