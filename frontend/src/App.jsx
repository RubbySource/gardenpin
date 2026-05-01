// Main App component with routes and navigation
import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import GardensPage from './pages/GardensPage.jsx';
import GardenDetailPage from './pages/GardenDetailPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SeasonalCalendar from './components/SeasonalCalendar.jsx';
import Toast from './components/Toast.jsx';
import ReminderBanner from './components/ReminderBanner.jsx';
import { showNotification, daysFromToday, taskIcon } from './utils.js';
import { api } from './api.js';

// Simple context-free toast system
let toastHandler = null;
export function toast(message) {
  if (toastHandler) toastHandler(message);
}

export default function App() {
  const [toastMsg, setToastMsg] = useState(null);
  const [pendingStats, setPendingStats] = useState({ overdue: 0, dueToday: 0 });
  const location = useLocation();

  toastHandler = (m) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Load stats for reminder banner and nav badge
  useEffect(() => {
    const loadStats = () => api.stats().then((s) => setPendingStats(s)).catch(() => {});
    loadStats();
    const interval = setInterval(loadStats, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic notification check — fires for tasks due within user-configured advance days
  useEffect(() => {
    let lastNotified = JSON.parse(localStorage.getItem('lastNotified') || '{}');
    const check = async () => {
      try {
        const reminderDays = parseInt(localStorage.getItem('notifReminderDays') ?? '1', 10);
        const today = new Date().toISOString().slice(0, 10);
        const { tasks } = await api.weekTasks();
        for (const t of tasks) {
          const diff = daysFromToday(t.next_due);
          if (diff === null || diff < 0 || diff > reminderDays) continue;
          const key = `${t.id}_${today}`;
          if (!lastNotified[key]) {
            const when = diff === 0 ? 'Dnes' : diff === 1 ? 'Zítra' : `Za ${diff} dny`;
            showNotification(
              `${taskIcon(t.task_type)} ${t.title}`,
              `${when}: ${t.pin_name} · ${t.garden_name}`,
            );
            lastNotified[key] = true;
          }
        }
        // Keep only today's entries to avoid localStorage bloat
        const keep = {};
        Object.keys(lastNotified).forEach((k) => {
          if (k.endsWith('_' + today)) keep[k] = true;
        });
        lastNotified = keep;
        localStorage.setItem('lastNotified', JSON.stringify(keep));
      } catch {
        // ignore — app may be offline or server not running
      }
    };
    check();
    const interval = setInterval(check, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="leaf">📍</span>
          GardenPin
        </h1>
        <div className="small" style={{ opacity: 0.8, fontWeight: 500 }}>
          {new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
        </div>
      </header>

      <ReminderBanner overdue={pendingStats.overdue} dueToday={pendingStats.dueToday} />

      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage onTaskComplete={() => api.stats().then(setPendingStats).catch(() => {})} />} />
          <Route path="/zahrady" element={<GardensPage />} />
          <Route path="/zahrada/:id" element={<GardenDetailPage />} />
          <Route path="/ukoly" element={<TasksPage onTaskComplete={() => api.stats().then(setPendingStats).catch(() => {})} />} />
          <Route path="/kalendar" element={<SeasonalCalendar />} />
          <Route path="/nastaveni" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          <span className="icon">🏠</span>
          <span>Přehled</span>
        </NavLink>
        <NavLink to="/zahrady">
          <span className="icon">🗺️</span>
          <span>Zahrady</span>
        </NavLink>
        <NavLink to="/ukoly">
          <span className="nav-icon-wrap">
            <span className="icon">✅</span>
            {pendingStats.overdue + pendingStats.dueToday > 0 && (
              <span className="nav-badge">
                {pendingStats.overdue + pendingStats.dueToday > 99
                  ? '99+'
                  : pendingStats.overdue + pendingStats.dueToday}
              </span>
            )}
          </span>
          <span>Úkoly</span>
        </NavLink>
        <NavLink to="/kalendar">
          <span className="icon">📅</span>
          <span>Kalendář</span>
        </NavLink>
        <NavLink to="/nastaveni">
          <span className="icon">⚙️</span>
          <span>Nastavení</span>
        </NavLink>
      </nav>

      {toastMsg && <Toast message={toastMsg} />}
    </div>
  );
}
