// Home / dashboard: hero banner + today + week tasks
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';
import { toast } from '../App.jsx';

export default function HomePage({ onTaskComplete }) {
  const [today, setToday] = useState([]);
  const [week, setWeek] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = async () => {
    try {
      const [t, w, s] = await Promise.all([api.todayTasks(), api.weekTasks(), api.stats()]);
      setToday(t);
      setWeek((w.tasks || []).filter((x) => !t.some((y) => y.id === x.id)));
      setStats(s);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  const dayName = new Date().toLocaleDateString('cs-CZ', { weekday: 'long' });
  const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const dateStr = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });

  if (loading) return <div className="empty">🌱 Načítám...</div>;

  const urgentCount = stats ? stats.dueToday + stats.overdue : 0;

  return (
    <>
      {/* Hero banner */}
      <div className="home-hero">
        <div className="greeting">{dayNameCap} · {dateStr}</div>
        <div className="hero-title">
          {stats && stats.overdue > 0
            ? `${stats.overdue} úkol${stats.overdue > 1 ? 'y' : ''} po termínu`
            : stats && stats.dueToday > 0
            ? `Dnes máte ${stats.dueToday} úkol${stats.dueToday > 1 ? 'ů' : ''}`
            : stats && stats.gardens > 0
            ? 'Zahrada vypadá skvěle 🌿'
            : 'Vítejte v GardenPin 🌱'}
        </div>
        {stats && (
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="val">{stats.gardens}</div>
              <div className="lbl">Zahrady</div>
            </div>
            <div className="hero-stat">
              <div className="val">{stats.pins}</div>
              <div className="lbl">Rostliny</div>
            </div>
            <div className="hero-stat">
              <div className={`val ${stats.overdue > 0 ? 'danger' : urgentCount > 0 ? 'warning' : ''}`}>
                {urgentCount}
              </div>
              <div className="lbl">{stats.overdue > 0 ? 'Po termínu' : 'Dnes'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Weather */}
      <WeatherWidget />

      {/* Quick actions */}
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={() => nav('/zahrady')}>
          <span className="qa-icon">🗺️</span>
          <span className="qa-label">Moje zahrady</span>
        </button>
        <button className="quick-action-btn" onClick={() => nav('/ukoly')}>
          <span className="qa-icon">📋</span>
          <span className="qa-label">Všechny úkoly</span>
        </button>
      </div>

      {/* Today's tasks */}
      {today.length > 0 && (
        <>
          <div className="section-header">
            <div className="title">📅 Dnes</div>
            <span className={`count-badge${stats?.overdue > 0 ? ' danger' : ''}`}>{today.length}</span>
          </div>
          {today.map((t) => (
            <TaskItem key={t.id} task={t} onComplete={completeTask} showGarden />
          ))}
        </>
      )}

      {/* This week */}
      {week.length > 0 && (
        <>
          <div className="section-header">
            <div className="title">📆 Tento týden</div>
            <span className="count-badge">{week.length}</span>
          </div>
          {week.map((t) => (
            <TaskItem key={t.id} task={t} onComplete={completeTask} showGarden />
          ))}
        </>
      )}

      {/* All clear */}
      {today.length === 0 && week.length === 0 && stats && stats.tasks > 0 && (
        <div className="card empty" style={{ marginTop: 8 }}>
          <div className="icon">🎉</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Vše je hotovo!</div>
          <div className="small muted">Na tento týden nemáte žádné naplánované úkoly.</div>
        </div>
      )}

      {/* No gardens yet */}
      {stats && stats.gardens === 0 && (
        <div className="card empty" style={{ marginTop: 8 }}>
          <div className="icon">🌻</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Začněte svou první zahradu</div>
          <div className="small muted" style={{ marginBottom: 14 }}>
            Přidejte fotografii zahrady, přidejte rostliny a sledujte péči o ně.
          </div>
          <Link to="/zahrady">
            <button className="btn">+ Vytvořit zahradu</button>
          </Link>
        </div>
      )}
    </>
  );
}
