// Home / dashboard: today + week tasks + stats
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
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

  return (
    <>
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

      <h2 className="section-title">🌞 Dnes a po termínu</h2>
      {today.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌼</div>
          <div>Vše je vyřízené. Užijte si den!</div>
        </div>
      ) : (
        today.map((t) => (
          <TaskItem key={t.id} task={t} onComplete={completeTask} showGarden />
        ))
      )}

      <h2 className="section-title">📅 Tento týden</h2>
      {week.length === 0 ? (
        <div className="card empty small">Žádné další úkoly v tomto týdnu</div>
      ) : (
        week.map((t) => <TaskItem key={t.id} task={t} onComplete={completeTask} showGarden />)
      )}

      <div className="mt-3 center">
        <Link to="/zahrady" className="btn secondary">
          🗺️ Spravovat zahrady
        </Link>{' '}
        <Link to="/ukoly" className="btn secondary">
          📋 Všechny úkoly
        </Link>
      </div>
    </>
  );
}
