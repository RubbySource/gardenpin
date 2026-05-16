// All tasks page with month grouping + filters
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import Icon from '../components/Icon.jsx';
import { daysFromToday, taskIcon, taskLabel, dueBadge } from '../utils.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import PullIndicator from '../components/PullIndicator.jsx';

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

function monthKey(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  if (key === 'unknown') return 'Bez termínu';
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
  const [filter, setFilter] = useState('thisMonth'); // thisMonth | all | done
  const [openPin, setOpenPin] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [query, setQuery] = useState('');

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

  const { pull, refreshing, threshold } = usePullToRefresh(load);

  const searchMatch = (t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.title || '').toLowerCase().includes(q) ||
      (t.pin_name || '').toLowerCase().includes(q) ||
      (t.plant_name || '').toLowerCase().includes(q) ||
      (t.garden_name || '').toLowerCase().includes(q) ||
      (t.action || '').toLowerCase().includes(q)
    );
  };

  const completeTask = async (t) => {
    if (completingIds.has(t.id)) return;
    setCompletingIds((s) => new Set(s).add(t.id));
    try {
      await new Promise((r) => setTimeout(r, 280));
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

  const visibleTasks = useMemo(() => {
    let list;
    if (filter === 'all') list = tasks;
    else if (filter === 'thisMonth') {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      list = tasks.filter((t) => {
        if (!t.next_due) return false;
        const d = new Date(t.next_due);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    } else list = [];
    return list.filter(searchMatch);
  }, [tasks, filter, query]);

  const taskGroups = useMemo(() => {
    if (filter === 'done') return [];
    return groupByMonth(visibleTasks, (t) => t.next_due).sort(
      ([a], [b]) => a.localeCompare(b),
    );
  }, [visibleTasks, filter]);

  const historyGroups = useMemo(() => {
    if (filter !== 'done') return [];
    return groupByMonth(history.filter(searchMatch), (h) => h.done_at).sort(
      ([a], [b]) => b.localeCompare(a),
    );
  }, [history, filter, query]);

  if (loading) return <div className="empty">🌱 Načítám...</div>;

  return (
    <>
      <PullIndicator pull={pull} refreshing={refreshing} threshold={threshold} />
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

      <div className="sticky-search">
        <div className="sticky-search-inner">
          <Icon name="search" size={18} className="sticky-search-icon" />
          <input
            type="search"
            className="sticky-search-input"
            placeholder="Hledat úkol, rostlinu, zahradu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="sticky-search-clear"
              onClick={() => setQuery('')}
              aria-label="Vymazat"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="filter-pills">
        <button
          className={`filter-pill ${filter === 'thisMonth' ? 'active' : ''}`}
          onClick={() => setFilter('thisMonth')}
        >
          Tento měsíc
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

      {filter !== 'done' && taskGroups.length === 0 && (
        <div className="card empty">
          <div className="icon">🌼</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {filter === 'thisMonth' ? 'Žádné úkoly tento měsíc' : 'Žádné úkoly'}
          </div>
          <div className="small muted">Přidejte je v detailu místa v zahradě.</div>
        </div>
      )}

      {filter !== 'done' &&
        taskGroups.map(([key, items]) => (
          <div key={key} className="task-month-group">
            <div className="task-month-header">
              <span className="task-month-name">{monthLabel(key)}</span>
              <span className="task-month-count">{items.length}</span>
            </div>
            <div className="task-month-body">
              {items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  completing={completingIds.has(t.id)}
                  onComplete={() => completeTask(t)}
                  onOpen={() => setOpenPin(t.pin_id)}
                />
              ))}
            </div>
          </div>
        ))}

      {filter === 'done' && historyGroups.length === 0 && (
        <div className="card empty">
          <div className="icon">📭</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Zatím žádná historie péče</div>
          <div className="small muted">
            Až dokončíte první úkol, objeví se tady.
          </div>
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

function TaskRow({ task, completing, onComplete, onOpen }) {
  const badge = dueBadge(task.next_due);
  const cls = badge ? badge.cls : '';
  return (
    <div className={`task-row ${cls} ${completing ? 'completing' : ''}`}>
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
