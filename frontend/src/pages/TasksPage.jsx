// All tasks page with month grouping + filters
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import Icon from '../components/Icon.jsx';
import { useSwipeActions } from '../hooks/useSwipeActions.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import SnoozeButton from '../components/SnoozeButton.jsx';
import { daysFromToday, taskIcon, taskLabel, dueBadge } from '../utils.js';

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

const TASK_TYPE_ICON = {
  zaliti: 'droplet',
  hnojeni: 'sparkles',
  rez: 'scissors',
  sklizen: 'leaf',
  vysadba: 'leaf',
  prihnojit: 'sparkles',
  default: 'leaf',
};

function taskIconName(type) {
  return TASK_TYPE_ICON[type] || TASK_TYPE_ICON.default;
}

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

function matchesQuery(t, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [t.title, t.pin_name, t.plant_name, t.garden_name, t.action]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(needle));
}

export default function TasksPage({ onTaskComplete }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('thisMonth'); // thisMonth | all | done
  const [gardenFilter, setGardenFilter] = useState('all');
  const [openPin, setOpenPin] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      const [t, h, g] = await Promise.all([
        api.listTasks(),
        api.listHistory(),
        api.listGardens(),
      ]);
      setTasks(t);
      setHistory(h);
      setGardens(g);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const ptr = usePullToRefresh(load);

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

  const deleteTask = async (t) => {
    if (deletingIds.has(t.id)) return;
    setDeletingIds((s) => new Set(s).add(t.id));
    try {
      await api.deleteTask(t.id);
      toast('🗑️ Smazáno');
      await load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setDeletingIds((s) => {
        const next = new Set(s);
        next.delete(t.id);
        return next;
      });
    }
  };

  // Filtr zahrady aplikujeme nejdřív, ať se z něj počítají i statistiky v hero.
  const gardenFilteredTasks = useMemo(() => {
    if (gardenFilter === 'all') return tasks;
    return tasks.filter((t) => String(t.garden_id) === String(gardenFilter));
  }, [tasks, gardenFilter]);

  const gardenFilteredHistory = useMemo(() => {
    if (gardenFilter === 'all') return history;
    return history.filter((h) => String(h.garden_id) === String(gardenFilter));
  }, [history, gardenFilter]);

  const overdueCount = gardenFilteredTasks.filter((t) => daysFromToday(t.next_due) < 0).length;
  const todayCount = gardenFilteredTasks.filter((t) => daysFromToday(t.next_due) === 0).length;
  const urgentCount = overdueCount + todayCount;

  const visibleTasks = useMemo(() => {
    let base = gardenFilteredTasks;
    if (filter === 'thisMonth') {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      base = gardenFilteredTasks.filter((t) => {
        if (!t.next_due) return false;
        const d = new Date(t.next_due);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    } else if (filter === 'done') {
      base = [];
    }
    return base.filter((t) => matchesQuery(t, query));
  }, [gardenFilteredTasks, filter, query]);

  const taskGroups = useMemo(() => {
    if (filter === 'done') return [];
    return groupByMonth(visibleTasks, (t) => t.next_due).sort(
      ([a], [b]) => a.localeCompare(b),
    );
  }, [visibleTasks, filter]);

  const historyGroups = useMemo(() => {
    if (filter !== 'done') return [];
    const filtered = gardenFilteredHistory.filter((h) => matchesQuery(h, query));
    return groupByMonth(filtered, (h) => h.done_at).sort(
      ([a], [b]) => b.localeCompare(a),
    );
  }, [gardenFilteredHistory, filter, query]);

  if (loading) return <div className="empty">🌱 Načítám...</div>;

  return (
    <div {...ptr.handlers} className="ptr-host">
      <div
        className={`ptr-indicator ${ptr.refreshing ? 'refreshing' : ''} ${ptr.triggered ? 'triggered' : ''}`}
        style={{ height: `${ptr.pull}px`, opacity: ptr.pull > 6 ? 1 : 0 }}
        aria-hidden="true"
      >
        <Icon
          name="refresh"
          size={22}
          className={`ptr-icon ${ptr.refreshing ? 'spin' : ''}`}
          style={{ transform: `rotate(${Math.min(ptr.pull * 4, 360)}deg)` }}
        />
        <span className="ptr-label">
          {ptr.refreshing ? 'Aktualizuji…' : ptr.triggered ? 'Pustit pro obnovu' : 'Stáhněte ↓'}
        </span>
      </div>

      <div className="tasks-hero">
        <div className="tasks-hero-row">
          <div>
            <div className="tasks-hero-eyebrow">📋 Úkoly</div>
            <div className="tasks-hero-title">
              {urgentCount > 0
                ? `${urgentCount} ${urgentCount === 1 ? 'úkol' : urgentCount < 5 ? 'úkoly' : 'úkolů'} čeká`
                : gardenFilteredTasks.length > 0
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
            <div className="val">{gardenFilteredTasks.length}</div>
            <div className="lbl">Naplánováno</div>
          </div>
          <div className="tasks-hero-stat">
            <div className={`val ${overdueCount > 0 ? 'danger' : ''}`}>{overdueCount}</div>
            <div className="lbl">Po termínu</div>
          </div>
          <div className="tasks-hero-stat">
            <div className="val">{gardenFilteredHistory.length}</div>
            <div className="lbl">Hotovo</div>
          </div>
        </div>
      </div>

      {/* Sticky search bar with blur backdrop */}
      <div className="ios-search-wrap">
        <div className="ios-search-bar">
          <Icon name="search" size={18} className="ios-search-icon" />
          <input
            type="search"
            inputMode="search"
            placeholder="Hledat úkol, rostlinu nebo zahradu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ios-search-input"
          />
          {query && (
            <button
              type="button"
              className="ios-search-clear"
              onClick={() => setQuery('')}
              aria-label="Vymazat hledání"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      {gardens.length > 1 && (
        <div className="filter-pills overview-filter">
          <button
            className={`filter-pill ${gardenFilter === 'all' ? 'active' : ''}`}
            onClick={() => setGardenFilter('all')}
          >
            🗺️ Všechny
          </button>
          {gardens.map((g) => (
            <button
              key={g.id}
              className={`filter-pill ${String(gardenFilter) === String(g.id) ? 'active' : ''}`}
              onClick={() => setGardenFilter(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

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
          Vše {gardenFilteredTasks.length > 0 && <span className="pill-count">{gardenFilteredTasks.length}</span>}
        </button>
        <button
          className={`filter-pill ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter('done')}
        >
          Dokončené {gardenFilteredHistory.length > 0 && <span className="pill-count">{gardenFilteredHistory.length}</span>}
        </button>
      </div>

      {filter !== 'done' && taskGroups.length === 0 && (
        <div className="card empty">
          <div className="icon">🌼</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {query
              ? 'Žádné výsledky'
              : filter === 'thisMonth'
              ? 'Žádné úkoly tento měsíc'
              : 'Žádné úkoly'}
          </div>
          <div className="small muted">
            {query ? 'Zkuste jiný výraz.' : 'Přidejte je v detailu místa v zahradě.'}
          </div>
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
                <SwipeableTaskRow
                  key={t.id}
                  task={t}
                  completing={completingIds.has(t.id)}
                  deleting={deletingIds.has(t.id)}
                  onComplete={() => completeTask(t)}
                  onDelete={() => deleteTask(t)}
                  onOpen={() => setOpenPin(t.pin_id)}
                  onSnoozed={load}
                />
              ))}
            </div>
          </div>
        ))}

      {filter === 'done' && historyGroups.length === 0 && (
        <div className="card empty">
          <div className="icon">📭</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {query ? 'Žádné výsledky' : 'Zatím žádná historie péče'}
          </div>
          <div className="small muted">
            {query ? 'Zkuste jiný výraz.' : 'Až dokončíte první úkol, objeví se tady.'}
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
    </div>
  );
}

function SwipeableTaskRow({ task, completing, deleting, onComplete, onDelete, onOpen, onSnoozed }) {
  const { handlers, itemStyle, triggeredLeft, triggeredRight, drag } = useSwipeActions({
    onSwipeRight: () => onComplete?.(),
    onSwipeLeft: () => onDelete?.(),
  });
  const badge = dueBadge(task.next_due);
  const cls = badge ? badge.cls : '';
  const iconName = taskIconName(task.task_type);
  const overlayDir = drag < 0 ? 'left' : drag > 0 ? 'right' : '';
  return (
    <div className="swipe-row-wrap">
      <div
        className={`swipe-action-bg swipe-action-complete ${triggeredRight ? 'triggered' : ''}`}
        style={{ opacity: drag > 0 ? 1 : 0 }}
        aria-hidden="true"
      >
        <Icon name="check" size={22} />
        <span>{triggeredRight ? 'Hotovo' : 'Posuňte →'}</span>
      </div>
      <div
        className={`swipe-action-bg swipe-action-delete ${triggeredLeft ? 'triggered' : ''}`}
        style={{ opacity: drag < 0 ? 1 : 0 }}
        aria-hidden="true"
      >
        <Icon name="trash" size={22} />
        <span>{triggeredLeft ? 'Smazat' : '← Smazat'}</span>
      </div>
      <div
        className={`task-row ios-task-row ${cls} ${completing ? 'completing' : ''} ${deleting ? 'deleting' : ''} swipe-${overlayDir}`}
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
          {completing ? <Icon name="check" size={14} stroke={2.5} /> : ''}
        </button>
        <div className="task-row-info" onClick={onOpen} style={{ cursor: 'pointer' }}>
          <div className="task-row-title">
            <span className="task-row-icon-svg" aria-hidden="true">
              <Icon name={iconName} size={16} />
            </span>
            <span className="task-row-name">{task.title}</span>
          </div>
          <div className="task-row-meta">
            {task.pin_name}
            {task.plant_name ? ` · ${task.plant_name}` : ''}
            {task.garden_name ? ` · ${task.garden_name}` : ''}
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
        <Icon name="chevronRight" size={16} className="task-row-chev" />
      </div>
      {(task.next_due || task.specific_date) && (
        <SnoozeButton task={task} onSnoozed={onSnoozed} />
      )}
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
    <div className="task-row ios-task-row done" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="task-checkbox checked done-static" aria-hidden="true">
        <Icon name="check" size={14} stroke={2.5} />
      </div>
      <div className="task-row-info">
        <div className="task-row-title">
          <span className="task-row-name">{item.action}</span>
        </div>
        <div className="task-row-meta">
          {item.pin_name}
          {item.plant_name ? ` · ${item.plant_name}` : ''}
          {item.garden_name ? ` · ${item.garden_name}` : ''}
        </div>
        {item.notes && <div className="small muted task-row-notes">{item.notes}</div>}
        <div className="task-row-tags">
          <span className="badge done-badge">
            <Icon name="calendar" size={11} stroke={2} /> {date}
          </span>
        </div>
      </div>
    </div>
  );
}
