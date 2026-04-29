// All tasks page with filters
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
import { toast } from '../App.jsx';
import PinDetail from './PinDetail.jsx';
import { daysFromToday } from '../utils.js';

export default function TasksPage({ onTaskComplete }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [openPin, setOpenPin] = useState(null);

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
    try {
      await api.completeTask(t.id);
      toast('✅ Hotovo');
      load();
      onTaskComplete?.();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading) return <div className="empty">🌱 Načítám...</div>;

  const overdue = tasks.filter((t) => daysFromToday(t.next_due) < 0);
  const today = tasks.filter((t) => daysFromToday(t.next_due) === 0);
  const thisWeek = tasks.filter((t) => { const d = daysFromToday(t.next_due); return d > 0 && d <= 7; });
  const later = tasks.filter((t) => { const d = daysFromToday(t.next_due); return d > 7; });

  const urgentCount = overdue.length + today.length;

  return (
    <>
      <div className="section-header" style={{ marginTop: 4 }}>
        <div className="title">📋 Úkoly</div>
        {urgentCount > 0 && <span className="count-badge danger">{urgentCount} urgentních</span>}
      </div>

      <div className="tabs">
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>
          Naplánované {tasks.length > 0 && `(${tasks.length})`}
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Historie {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {tab === 'upcoming' && (
        <>
          {tasks.length === 0 && (
            <div className="card empty">
              <div className="icon">🌼</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Žádné úkoly</div>
              <div className="small muted">Přidejte je v detailu místa v zahradě.</div>
            </div>
          )}
          {overdue.length > 0 && (
            <>
              <div className="section-header">
                <div className="title" style={{ color: 'var(--danger)' }}>⚠️ Po termínu</div>
                <span className="count-badge danger">{overdue.length}</span>
              </div>
              {overdue.map((t) => (
                <TaskItem key={t.id} task={t} onComplete={completeTask} onClick={() => setOpenPin(t.pin_id)} showGarden />
              ))}
            </>
          )}
          {today.length > 0 && (
            <>
              <div className="section-header">
                <div className="title">🌞 Dnes</div>
                <span className="count-badge">{today.length}</span>
              </div>
              {today.map((t) => (
                <TaskItem key={t.id} task={t} onComplete={completeTask} onClick={() => setOpenPin(t.pin_id)} showGarden />
              ))}
            </>
          )}
          {thisWeek.length > 0 && (
            <>
              <div className="section-header">
                <div className="title">📅 Tento týden</div>
                <span className="count-badge">{thisWeek.length}</span>
              </div>
              {thisWeek.map((t) => (
                <TaskItem key={t.id} task={t} onComplete={completeTask} onClick={() => setOpenPin(t.pin_id)} showGarden />
              ))}
            </>
          )}
          {later.length > 0 && (
            <>
              <div className="section-header">
                <div className="title">🗓️ Plánované</div>
                <span className="count-badge">{later.length}</span>
              </div>
              {later.map((t) => (
                <TaskItem key={t.id} task={t} onComplete={completeTask} onClick={() => setOpenPin(t.pin_id)} showGarden />
              ))}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <div className="empty small">Zatím žádná historie péče</div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className="history-item"
                onClick={() => setOpenPin(h.pin_id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="dot" />
                <div className="info">
                  <div>
                    <strong>{h.action}</strong>
                    <span className="muted small"> · {h.pin_name}</span>
                    {h.plant_name && <span className="muted small"> · {h.plant_name}</span>}
                  </div>
                  {h.notes && <div className="small muted">{h.notes}</div>}
                  <div className="date">
                    🗺️ {h.garden_name} ·{' '}
                    {new Date(h.done_at + 'Z').toLocaleString('cs-CZ', {
                      day: 'numeric',
                      month: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
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
