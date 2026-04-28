// Home / dashboard — GardenPin design: welcome banner, stats, upcoming tasks
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { daysFromToday, taskIcon, dueBadge } from '../utils.js';

const MONTH_TIPS = [
  'Plánujte výsadbu na další sezónu',
  'Připravte sazenice na jaro',
  'Začíná předpěstování — papriky a rajčata',
  'Vysazujte mrazuvzdorné druhy',
  'Hlavní výsadbová sezóna',
  'Sledujte zálivku a škůdce',
  'Sklízejte a hnojte',
  'Začátek sklizňových prací',
  'Sklizeň ovoce a zeleniny',
  'Připravte zahradu na zimu',
  'Mulčování a ochrana',
  'Plánujte sezónu ve své kuchyni',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Dobrou noc';
  if (h < 11) return 'Dobré ráno';
  if (h < 18) return 'Dobré odpoledne';
  return 'Dobrý večer';
}

export default function HomePage({ onTaskComplete }) {
  const [today, setToday] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    try {
      const [t, w, s] = await Promise.all([api.todayTasks(), api.weekTasks(), api.stats()]);
      setToday(t);
      // Top 3 nadcházející (kromě "dnes a po termínu")
      const future = (w.tasks || []).filter((x) => !t.some((y) => y.id === x.id)).slice(0, 3);
      setUpcoming(future);
      setStats(s);
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
      toast('✅ Úkol označen jako hotový');
      load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading) return <div className="empty">Načítám...</div>;

  const monthIdx = new Date().getMonth();
  const monthTip = MONTH_TIPS[monthIdx];

  return (
    <>
      <div className="gp-welcome">
        <div className="gp-welcome-greet">{getGreeting()}, zahradníku</div>
        <div className="gp-welcome-title">
          {today.length === 0
            ? 'Vše je vyřízené 🌿'
            : `Máte ${today.length} ${
                today.length === 1 ? 'úkol dnes' : today.length < 5 ? 'úkoly dnes' : 'úkolů dnes'
              }`}
        </div>
        <div className="gp-welcome-text">{monthTip}</div>
      </div>

      {stats && (
        <div className="stats-grid">
          <button
            type="button"
            className="stat-card stat-card-clickable stat-plants"
            onClick={() => nav('/zahrady')}
          >
            <div className="stat-icon">🌱</div>
            <div className="value">{stats.pins}</div>
            <div className="label">Rostlin celkem</div>
          </button>
          <button
            type="button"
            className="stat-card stat-card-clickable stat-week"
            onClick={() => nav('/ukoly')}
          >
            <div className="stat-icon">📅</div>
            <div className="value">{stats.tasksThisWeek ?? 0}</div>
            <div className="label">Úkolů tento týden</div>
          </button>
          <button
            type="button"
            className={`stat-card stat-card-clickable stat-overdue${stats.overdue > 0 ? ' has-overdue' : ''}`}
            onClick={() => nav('/ukoly')}
          >
            <div className="stat-icon">⚠️</div>
            <div className="value">{stats.overdue}</div>
            <div className="label">Po termínu</div>
          </button>
          <button
            type="button"
            className="stat-card stat-card-clickable stat-gardens"
            onClick={() => nav('/zahrady')}
          >
            <div className="stat-icon">🗺️</div>
            <div className="value">{stats.gardens}</div>
            <div className="label">Zahrad</div>
          </button>
        </div>
      )}

      <div className="gp-section">
        <div className="gp-section-title">🌞 Dnes a po termínu</div>
        {today.length > 0 && <span className="gp-section-count">{today.length}</span>}
      </div>
      {today.length === 0 ? (
        <div className="gp-empty" style={{ padding: '24px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🌼</span>
          <div className="gp-empty-title">Vše je vyřízené</div>
          <div className="gp-empty-text">Užijte si den v zahradě.</div>
        </div>
      ) : (
        today.map((t) => <HomeTaskCard key={t.id} task={t} onComplete={completeTask} />)
      )}

      <div className="gp-section">
        <div className="gp-section-title">📅 Nadcházející</div>
        <Link to="/ukoly" className="gp-section-link">
          Vše →
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <div className="gp-empty" style={{ padding: '20px 16px' }}>
          <div className="gp-empty-text" style={{ marginBottom: 0 }}>
            Žádné další úkoly v tomto týdnu
          </div>
        </div>
      ) : (
        upcoming.map((t) => <HomeTaskCard key={t.id} task={t} onComplete={completeTask} />)
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        <Link
          to="/zahrady"
          className="btn secondary"
          style={{
            padding: '14px 12px',
            borderRadius: 14,
            background: 'var(--sand)',
            color: 'var(--primary)',
            fontWeight: 700,
            border: '1px solid var(--sand-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          🗺️ Zahrady
        </Link>
        <Link
          to="/ukoly"
          className="btn secondary"
          style={{
            padding: '14px 12px',
            borderRadius: 14,
            background: 'var(--sand)',
            color: 'var(--primary)',
            fontWeight: 700,
            border: '1px solid var(--sand-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          📋 Úkoly
        </Link>
      </div>
    </>
  );
}

// Lightweight úkolová karta používaná na home — používá .gp-task styl
function HomeTaskCard({ task, onComplete }) {
  const badge = dueBadge(task.next_due);
  const days = daysFromToday(task.next_due);
  const stateClass =
    days !== null && days < 0
      ? 'is-overdue'
      : days === 0
      ? 'is-today'
      : '';
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
      <div className="gp-task-body">
        <div className="gp-task-title">
          {!/^[^\w\s]/u.test(cleanTitle) && <span>{fallbackEmoji}</span>}
          <span>{cleanTitle}</span>
        </div>
        <div className="gp-task-meta">
          🌿 {task.pin_name}
          {task.plant_name ? ` · ${task.plant_name}` : ''}
          {task.garden_name ? ` · 🗺️ ${task.garden_name}` : ''}
        </div>
        {badge && (
          <div className="gp-task-chips">
            <span className={`gp-chip ${badge.cls}`}>{badge.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
