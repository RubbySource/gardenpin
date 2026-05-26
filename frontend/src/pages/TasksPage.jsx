// All tasks page — iOS segmented control (Dnes / Týden / Vše) + Hotovo historie.
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import Icon from '../components/Icon.jsx';
import TaskRow from '../components/TaskRow.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { daysFromToday } from '../utils.js';
import { hapticNotification } from '../native/haptics.js';

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

const CZ_WEEKDAYS = [
  'Neděle',
  'Pondělí',
  'Úterý',
  'Středa',
  'Čtvrtek',
  'Pátek',
  'Sobota',
];

const SEGMENTS = [
  { key: 'today', label: 'Dnes' },
  { key: 'week', label: 'Týden' },
  { key: 'all', label: 'Vše' },
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

// Relativní „den" bucket pro filtry Dnes / Týden (Po termínu, Dnes, Zítra, název dne).
function dayBucket(dateStr) {
  const diff = daysFromToday(dateStr);
  if (diff === null) return { key: 'none', label: 'Bez termínu', order: 9999 };
  if (diff < 0) return { key: 'overdue', label: 'Po termínu', order: -1 };
  if (diff === 0) return { key: 'd0', label: 'Dnes', order: 0 };
  if (diff === 1) return { key: 'd1', label: 'Zítra', order: 1 };
  const d = new Date(dateStr);
  return { key: `d${diff}`, label: CZ_WEEKDAYS[d.getDay()], order: diff };
}

function byDueAsc(a, b) {
  return new Date(a.next_due || 0) - new Date(b.next_due || 0);
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

// Sjednocený výstup: [{ key, label, items }] — renderuje se stejným markupem
// nezávisle na tom, jestli grupujeme podle dne (Dnes/Týden) nebo měsíce (Vše).
function buildActiveSections(tasks, filter) {
  if (filter === 'all') {
    return groupByMonth(tasks, (t) => t.next_due)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, label: monthLabel(key), items: [...items].sort(byDueAsc) }));
  }
  const map = new Map();
  tasks.forEach((t) => {
    const b = dayBucket(t.next_due);
    if (!map.has(b.key)) map.set(b.key, { key: b.key, label: b.label, order: b.order, items: [] });
    map.get(b.key).items.push(t);
  });
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ ...s, items: [...s.items].sort(byDueAsc) }));
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
  const [filter, setFilter] = useState('today'); // today | week | all | done
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
      hapticNotification('success');
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
    if (filter === 'today') {
      base = base.filter((t) => {
        const d = daysFromToday(t.next_due);
        return d !== null && d <= 0;
      });
    } else if (filter === 'week') {
      base = base.filter((t) => {
        const d = daysFromToday(t.next_due);
        return d !== null && d <= 7;
      });
    } else if (filter === 'done') {
      base = [];
    }
    return base.filter((t) => matchesQuery(t, query));
  }, [gardenFilteredTasks, filter, query]);

  const taskSections = useMemo(() => {
    if (filter === 'done') return [];
    return buildActiveSections(visibleTasks, filter);
  }, [visibleTasks, filter]);

  const historyGroups = useMemo(() => {
    if (filter !== 'done') return [];
    const filtered = gardenFilteredHistory.filter((h) => matchesQuery(h, query));
    return groupByMonth(filtered, (h) => h.done_at)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({ key, label: monthLabel(key), items }));
  }, [gardenFilteredHistory, filter, query]);

  const activeIdx = SEGMENTS.findIndex((s) => s.key === filter);

  const emptyText = () => {
    if (query) return { title: 'Žádné výsledky', sub: 'Zkuste jiný výraz.', icon: '🔍' };
    if (filter === 'today')
      return { title: 'Na dnešek máš hotovo', sub: 'Žádný úkol po termínu ani na dnes 🌿', icon: '🌿' };
    if (filter === 'week')
      return { title: 'Tento týden klid', sub: 'Žádné úkoly v příštích 7 dnech.', icon: '🌤️' };
    return { title: 'Žádné úkoly', sub: 'Přidejte je v detailu místa v zahradě.', icon: '🌼' };
  };

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

      {/* iOS segmented control: Dnes / Týden / Vše + Hotovo toggle */}
      <div className="tasks-filter-bar">
        <div className="ios-segmented" role="tablist" aria-label="Filtr úkolů">
          {activeIdx >= 0 && (
            <span
              className="ios-seg-thumb"
              style={{ transform: `translateX(${activeIdx * 100}%)` }}
              aria-hidden="true"
            />
          )}
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={filter === s.key}
              className={`ios-seg-btn ${filter === s.key ? 'active' : ''}`}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`tasks-done-toggle ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter((f) => (f === 'done' ? 'all' : 'done'))}
          aria-pressed={filter === 'done'}
          title="Dokončené úkoly"
        >
          <Icon name="check" size={16} stroke={2.5} />
          {gardenFilteredHistory.length > 0 && (
            <span className="tasks-done-count">{gardenFilteredHistory.length}</span>
          )}
        </button>
      </div>

      {filter !== 'done' &&
        taskSections.map((section) => (
          <div key={section.key} className="task-month-group">
            <div className="task-month-header">
              <span className="task-month-name">{section.label}</span>
              <span className="task-month-count">{section.items.length}</span>
            </div>
            <div className="task-month-body">
              {section.items.map((t) => (
                <TaskRow
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

      {filter !== 'done' && taskSections.length === 0 && (
        <div className="card empty">
          <div className="icon">{emptyText().icon}</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{emptyText().title}</div>
          <div className="small muted">{emptyText().sub}</div>
        </div>
      )}

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
        historyGroups.map((section) => (
          <div key={section.key} className="task-month-group">
            <div className="task-month-header">
              <span className="task-month-name">{section.label}</span>
              <span className="task-month-count">{section.items.length}</span>
            </div>
            <div className="task-month-body">
              {section.items.map((h) => (
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
