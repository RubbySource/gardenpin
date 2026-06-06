// Souhrnný přehled úkolů přes všechny zahrady — co dělat tento týden + příští.
// iOS redesign [iOS-4]: large title, stats strip, grouped buckety s hairline separátory,
// per-garden iOS list, garden picker (≥4 zahrad) přes <Sheet>.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localeCode } from '../i18n.js';
import { api } from '../api.js';
import { toast, followUpForTask } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import Sheet from '../components/Sheet.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import SnoozeButton from '../components/SnoozeButton.jsx';
import { daysFromToday, dueBadge, taskLabel, taskIconName, formatDate } from '../utils.js';
import { hapticNotification } from '../native/haptics.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
// Ikona + cls v module scope; title se dopočítá přes t() při renderu.
const BUCKET_META = {
  overdue: { titleKey: 'overview.bucketOverdue', icon: '⚠️', cls: 'overdue' },
  today: { titleKey: 'overview.bucketToday', icon: '🌞', cls: 'today' },
  thisWeek: { titleKey: 'overview.bucketThisWeek', icon: '📅', cls: 'week' },
  nextWeek: { titleKey: 'overview.bucketNextWeek', icon: '🗓️', cls: 'next' },
};

export default function WeekOverviewPage({ onTaskComplete }) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gardenFilter, setGardenFilter] = useState('all');
  const [gardenPickerOpen, setGardenPickerOpen] = useState(false);
  const [openPin, setOpenPin] = useState(null);
  const [completingIds, setCompletingIds] = useState(new Set());
  const nav = useNavigate();

  const load = async () => {
    try {
      const [o, g] = await Promise.all([api.overviewTasks(14), api.listGardens()]);
      setTasks(o.tasks || []);
      setGardens(g);
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completeTask = async (task) => {
    if (completingIds.has(task.id)) return;
    setCompletingIds((s) => new Set(s).add(task.id));
    try {
      await api.completeTask(task.id);
      hapticNotification('success');
      toast(t('overview.completed'));
      await load();
      onTaskComplete?.();
      followUpForTask(task);
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setCompletingIds((s) => {
        const next = new Set(s);
        next.delete(task.id);
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

  if (loading) return <div className="empty">🌱 {t('common.loadingShort')}</div>;

  return (
    <>
      {/* iOS large title + dynamický subtitle */}
      <header className="overview-header">
        <h1 className="ios-large-title">{t('overview.title')}</h1>
        <p className="overview-subtitle">
          {urgent > 0
            ? t('overview.waitingCount', { count: urgent })
            : totalCount > 0
              ? t('overview.upcomingCount', { count: totalCount })
              : t('overview.allUnderControl')}
          {gardens.length > 0 && ` · ${t('overview.gardenCount', { count: gardens.length })}`}
        </p>
      </header>

      {/* Stats strip — 4 surface karty (mapuje na buckety) */}
      <div className="overview-stats-strip">
        <div className="overview-stat">
          <div className={`overview-stat-val ${counts.overdue > 0 ? 'red' : ''}`}>{counts.overdue}</div>
          <div className="overview-stat-lbl">{t('overview.statOverdue')}</div>
        </div>
        <div className="overview-stat">
          <div className={`overview-stat-val ${counts.today > 0 ? 'orange' : ''}`}>{counts.today}</div>
          <div className="overview-stat-lbl">{t('overview.statToday')}</div>
        </div>
        <div className="overview-stat">
          <div className="overview-stat-val">{counts.thisWeek}</div>
          <div className="overview-stat-lbl">{t('overview.statThisWeek')}</div>
        </div>
        <div className="overview-stat">
          <div className="overview-stat-val">{counts.nextWeek}</div>
          <div className="overview-stat-lbl">{t('overview.statNextWeek')}</div>
        </div>
      </div>

      {/* Garden filter: pills pro ≤3 zahrady, iOS picker pro ≥4 (parita s TasksPage) */}
      {gardens.length > 1 && gardens.length <= 3 && (
        <div className="filter-pills overview-filter">
          <button
            className={`filter-pill ${gardenFilter === 'all' ? 'active' : ''}`}
            onClick={() => setGardenFilter('all')}
          >
            {t('overview.allGardens')}
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

      {gardens.length >= 4 && (
        <button
          type="button"
          className="tasks-garden-picker-btn overview-garden-picker-btn"
          onClick={() => setGardenPickerOpen(true)}
          aria-label={t('overview.gardenPickerTitle')}
        >
          <Icon name="map" size={16} className="tasks-garden-picker-icon" />
          <span className="tasks-garden-picker-label">
            {gardenFilter === 'all'
              ? t('overview.allGardens')
              : gardens.find((g) => String(g.id) === String(gardenFilter))?.name || t('overview.allGardens')}
          </span>
          <Icon name="chevronDown" size={16} className="tasks-garden-picker-chevron" />
        </button>
      )}

      {totalCount === 0 ? (
        <EmptyState
          emoji="🌼"
          title={t('overview.emptyTitle')}
          subtitle={t('overview.emptyText')}
        />
      ) : (
        BUCKET_ORDER.map((key) => {
          const items = buckets[key];
          if (items.length === 0) return null;
          const meta = BUCKET_META[key];
          return (
            <section key={key} className={`overview-bucket overview-bucket-${meta.cls}`}>
              <header className="overview-bucket-head">
                <span className="overview-bucket-emoji" aria-hidden="true">{meta.icon}</span>
                <span className="overview-bucket-title">{t(meta.titleKey)}</span>
                <span className="overview-bucket-count">{items.length}</span>
              </header>
              <div className="ios-group-list">
                {items.map((task, idx) => (
                  <React.Fragment key={task.id}>
                    {idx > 0 && <div className="ios-list-sep" />}
                    <OverviewTaskRow
                      task={task}
                      completing={completingIds.has(task.id)}
                      onComplete={() => completeTask(task)}
                      onOpen={() => setOpenPin(task.pin_id)}
                      onOpenGarden={() => nav(`/zahrada/${task.garden_id}`)}
                      onSnoozed={load}
                    />
                  </React.Fragment>
                ))}
              </div>
            </section>
          );
        })
      )}

      {perGarden.length > 1 && (
        <section className="ios-list-section overview-per-garden">
          <div className="ios-list-section-label">{t('overview.byGarden')}</div>
          <div className="ios-group-list">
            {perGarden.map((g, idx) => (
              <React.Fragment key={g.id}>
                {idx > 0 && <div className="ios-list-sep" />}
                <button
                  type="button"
                  className="ios-list-row overview-garden-row"
                  onClick={() => nav(`/zahrada/${g.id}`)}
                >
                  <span className="overview-garden-avatar" aria-hidden="true">
                    {g.image ? <img src={g.image} alt="" /> : <span>🌱</span>}
                  </span>
                  <span className="ios-list-row-label">
                    {g.name}
                    <span className="ios-list-row-sub">
                      {t('overview.taskCount', { count: g.total })}
                      {g.urgent > 0 && (
                        <>
                          {' · '}
                          <span className="overview-garden-urgent">
                            {t('overview.urgentCount', { count: g.urgent })}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="ios-list-row-chevron">›</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {gardenPickerOpen && (
        <Sheet
          title={t('overview.gardenPickerTitle')}
          onClose={() => setGardenPickerOpen(false)}
        >
          <div className="ios-group-list tasks-garden-picker-list">
            <button
              type="button"
              className="ios-list-row"
              onClick={() => {
                setGardenFilter('all');
                setGardenPickerOpen(false);
              }}
            >
              <span className="ios-list-row-icon" style={{ background: 'var(--ios-accent)' }} aria-hidden="true">
                <Icon name="map" size={16} />
              </span>
              <span className="ios-list-row-label">{t('overview.allGardens')}</span>
              {gardenFilter === 'all' && (
                <Icon name="check" size={18} className="tasks-garden-picker-check" stroke={2.5} />
              )}
            </button>
            {gardens.map((g) => (
              <React.Fragment key={g.id}>
                <div className="ios-list-sep" />
                <button
                  type="button"
                  className="ios-list-row"
                  onClick={() => {
                    setGardenFilter(g.id);
                    setGardenPickerOpen(false);
                  }}
                >
                  <span
                    className="ios-list-row-icon"
                    style={{ background: '#7BA889' }}
                    aria-hidden="true"
                  >
                    🌿
                  </span>
                  <span className="ios-list-row-label">{g.name}</span>
                  {String(gardenFilter) === String(g.id) && (
                    <Icon name="check" size={18} className="tasks-garden-picker-check" stroke={2.5} />
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>
        </Sheet>
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
  const { t } = useTranslation();
  const diff = daysFromToday(task.next_due);
  const dueLabel = useMemo(() => {
    if (diff === null) return '';
    if (diff < 0) return t('common.daysOverdue', { count: Math.abs(diff) });
    if (diff === 0) return t('common.today');
    if (diff === 1) return t('common.tomorrow');
    const d = new Date(task.next_due);
    if (!isNaN(d) && diff <= 14) {
      return `${cap(d.toLocaleDateString(localeCode(), { weekday: 'long' }))} · ${formatDate(task.next_due)}`;
    }
    return formatDate(task.next_due);
  }, [diff, task.next_due, t]);

  const badge = dueBadge(task.next_due);
  const stateClass =
    diff !== null && diff < 0 ? 'overdue' : diff === 0 ? 'today' : '';
  const iconName = taskIconName(task.task_type);
  const canSnooze = task.next_due || task.specific_date;

  return (
    <div className={`overview-task ${stateClass} ${completing ? 'completing' : ''}`}>
      <button
        className={`task-checkbox ${completing ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        aria-label={t('overview.markDone')}
        title={t('overview.markDone')}
      >
        {completing ? <Icon name="check" size={14} stroke={2.5} /> : ''}
      </button>
      <div className="overview-task-body" onClick={onOpen}>
        <div className="overview-task-title">
          <span className="overview-task-icon-svg" aria-hidden="true">
            <Icon name={iconName} size={16} />
          </span>
          <span className="overview-task-name">{task.title}</span>
        </div>
        <div className="overview-task-meta">
          {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
        </div>
        <div className="overview-task-tags">
          <span className={`badge ${badge ? badge.cls : 'week'}`}>{dueLabel}</span>
          <button
            type="button"
            className="badge badge-garden"
            onClick={(e) => {
              e.stopPropagation();
              onOpenGarden();
            }}
          >
            🗺️ {task.garden_name}
          </button>
          <span className="badge type">{taskLabel(task.task_type)}</span>
        </div>
      </div>
      {canSnooze && (
        <div className="overview-task-trailing" onClick={(e) => e.stopPropagation()}>
          <SnoozeButton task={task} onSnoozed={onSnoozed} compact />
        </div>
      )}
    </div>
  );
}
