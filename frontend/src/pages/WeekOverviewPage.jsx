// Souhrnný přehled úkolů přes všechny zahrady — co dělat tento týden + příští
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import SnoozeButton from '../components/SnoozeButton.jsx';
import { daysFromToday, taskIcon, taskLabel, formatDate } from '../utils.js';
import { hapticNotification } from '../native/haptics.js';

const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

// Skupiny pro souhrnný přehled — řazené podle naléhavosti
function bucketFor(diff) {
  if (diff === null) return null;
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'thisWeek';
  if (diff <= 14) return 'nextWeek';
  return null;
}

const BUCKET_ORDER = ['overdue', 'today', 'thisWeek', 'nextWeek'];
const BUCKET_META = {
  overdue: { title: 'Po termínu', icon: '⚠️', cls: 'danger' },
  today: { title: 'Dnes', icon: '🌞', cls: 'today' },
  thisWeek: { title: 'Tento týden', icon: '📅', cls: 'week' },
  nextWeek: { title: 'Příští týden', icon: '🗓️', cls: 'next' },
};

export default function WeekOverviewPage({ onTaskComplete }) {
  const [tasks, setTasks] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gardenFilter, setGardenFilter] = useState('all');
  const [openPin, setOpenPin] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const nav = useNavigate();

  const load = async () => {
    try {
      const [o, g] = await Promise.all([api.overviewTasks(14), api.listGardens()]);
      setTasks(o.tasks || []);
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

  const completeTask = async (t) => {
    if (completingIds.has(t.id)) return;
    setCompletingIds((s) => new Set(s).add(t.id));
    try {
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

  const filtered = useMemo(() => {
    if (gardenFilter === 'all') return tasks;
    return tasks.filter((t) => String(t.garden_id) === String(gardenFilter));
  }, [tasks, gardenFilter]);

  const buckets = useMemo(() => {
    const out = { overdue: [], today: [], thisWeek: [], nextWeek: [] };
    for (const t of filtered) {
      const diff = daysFromToday(t.next_due);
      const b = bucketFor(diff);
      if (b) out[b].push(t);
    }
    // řazení v rámci bucketu podle next_due (nejnaléhavější první)
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => (a.next_due || '').localeCompare(b.next_due || ''));
    }
    return out;
  }, [filtered]);

  const counts = {
    overdue: buckets.overdue.length,
    today: buckets.today.length,
    thisWeek: buckets.thisWeek.length,
    nextWeek: buckets.nextWeek.length,
  };
  const totalCount = counts.overdue + counts.today + counts.thisWeek + counts.nextWeek;
  const urgent = counts.overdue + counts.today;

  // Statistiky zahrad — kolik úkolů má každá zahrada v zobrazeném okně
  const perGarden = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const key = t.garden_id;
      if (!map.has(key)) {
        map.set(key, {
          id: t.garden_id,
          name: t.garden_name,
          image: t.garden_image,
          total: 0,
          urgent: 0,
        });
      }
      const g = map.get(key);
      g.total += 1;
      const diff = daysFromToday(t.next_due);
      if (diff !== null && diff <= 0) g.urgent += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.urgent - a.urgent || b.total - a.total);
  }, [filtered]);

  if (loading) return <div className="empty">🌱 Načítám…</div>;

  return (
    <>
      <div className="overview-hero">
        <div className="overview-hero-row">
          <div>
            <div className="overview-hero-eyebrow">📋 Souhrnný přehled</div>
            <div className="overview-hero-title">
              {urgent > 0
                ? `${urgent} ${urgent === 1 ? 'úkol' : urgent < 5 ? 'úkoly' : 'úkolů'} čeká`
                : totalCount > 0
                ? `${totalCount} ${totalCount === 1 ? 'úkol' : totalCount < 5 ? 'úkoly' : 'úkolů'} ve výhledu`
                : 'Vše pod kontrolou 🌿'}
            </div>
            <div className="overview-hero-sub">
              {gardens.length > 0 && `${gardens.length} ${gardens.length === 1 ? 'zahrada' : gardens.length < 5 ? 'zahrady' : 'zahrad'} · `}
              Tento + příští týden
            </div>
          </div>
          {urgent > 0 && (
            <div className="overview-hero-urgent">
              <div className="val">{urgent}</div>
              <div className="lbl">naléhavé</div>
            </div>
          )}
        </div>
        <div className="overview-hero-stats">
          <div className="overview-hero-stat">
            <div className={`val ${counts.overdue > 0 ? 'danger' : ''}`}>{counts.overdue}</div>
            <div className="lbl">Po termínu</div>
          </div>
          <div className="overview-hero-stat">
            <div className={`val ${counts.today > 0 ? 'warning' : ''}`}>{counts.today}</div>
            <div className="lbl">Dnes</div>
          </div>
          <div className="overview-hero-stat">
            <div className="val">{counts.thisWeek}</div>
            <div className="lbl">Tento týden</div>
          </div>
          <div className="overview-hero-stat">
            <div className="val">{counts.nextWeek}</div>
            <div className="lbl">Příští týden</div>
          </div>
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

      {totalCount === 0 ? (
        <div className="gp-empty" style={{ padding: '32px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🌼</span>
          <div className="gp-empty-title">Žádné úkoly ve výhledu</div>
          <div className="gp-empty-text">
            V nadcházejících 14 dnech nemáte žádné naplánované úkony.
          </div>
        </div>
      ) : (
        <div className="overview-sections">
          {BUCKET_ORDER.map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            const meta = BUCKET_META[key];
            return (
              <section key={key} className={`overview-section overview-section-${meta.cls}`}>
                <div className="overview-section-header">
                  <span className="overview-section-icon">{meta.icon}</span>
                  <span className="overview-section-title">{meta.title}</span>
                  <span className="overview-section-count">{items.length}</span>
                </div>
                <div className="overview-section-body">
                  {items.map((t) => (
                    <OverviewTaskRow
                      key={t.id}
                      task={t}
                      completing={completingIds.has(t.id)}
                      onComplete={() => completeTask(t)}
                      onOpen={() => setOpenPin(t.pin_id)}
                      onOpenGarden={() => nav(`/zahrada/${t.garden_id}`)}
                      onSnoozed={load}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {perGarden.length > 1 && (
        <div className="overview-per-garden">
          <div className="section-header">
            <div className="title">🗺️ Podle zahrady</div>
          </div>
          <div className="overview-garden-list">
            {perGarden.map((g) => (
              <button
                key={g.id}
                className="overview-garden-card"
                onClick={() => nav(`/zahrada/${g.id}`)}
              >
                <div className="overview-garden-img">
                  {g.image ? <img src={g.image} alt={g.name} /> : <span>🌱</span>}
                </div>
                <div className="overview-garden-info">
                  <div className="overview-garden-name">{g.name}</div>
                  <div className="overview-garden-meta small muted">
                    {g.total} {g.total === 1 ? 'úkol' : g.total < 5 ? 'úkoly' : 'úkolů'}
                    {g.urgent > 0 && (
                      <span className="overview-garden-urgent"> · {g.urgent} naléhavých</span>
                    )}
                  </div>
                </div>
                <span className="overview-garden-arrow">›</span>
              </button>
            ))}
          </div>
        </div>
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

function OverviewTaskRow({ task, completing, onComplete, onOpen, onOpenGarden, onSnoozed }) {
  const diff = daysFromToday(task.next_due);
  const dueLabel = useMemo(() => {
    if (diff === null) return '';
    if (diff < 0) return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'den' : Math.abs(diff) < 5 ? 'dny' : 'dní'} po termínu`;
    if (diff === 0) return 'Dnes';
    if (diff === 1) return 'Zítra';
    const d = new Date(task.next_due);
    if (!isNaN(d) && diff <= 14) {
      return `${DAY_NAMES[d.getDay()]} · ${formatDate(task.next_due)}`;
    }
    return formatDate(task.next_due);
  }, [diff, task.next_due]);

  const stateClass =
    diff !== null && diff < 0 ? 'overdue' : diff === 0 ? 'today' : '';

  return (
    <div className={`overview-task ${stateClass} ${completing ? 'completing' : ''}`}>
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
      <div className="overview-task-body" onClick={onOpen}>
        <div className="overview-task-title">
          <span className="overview-task-icon">{taskIcon(task.task_type)}</span>
          <span className="overview-task-name">{task.title}</span>
        </div>
        <div className="overview-task-meta">
          🌿 {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
        </div>
        <div className="overview-task-tags">
          <span className={`overview-chip due-${stateClass || 'week'}`}>{dueLabel}</span>
          <button
            type="button"
            className="overview-chip overview-chip-garden"
            onClick={(e) => {
              e.stopPropagation();
              onOpenGarden();
            }}
          >
            🗺️ {task.garden_name}
          </button>
          <span className="overview-chip overview-chip-type">{taskLabel(task.task_type)}</span>
        </div>
      </div>
      {(task.next_due || task.specific_date) && (
        <SnoozeButton task={task} onSnoozed={onSnoozed} compact />
      )}
    </div>
  );
}
