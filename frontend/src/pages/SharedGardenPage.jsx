// Veřejná read-only stránka sdílené zahrady — bez autentizace
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { taskIcon, taskLabel } from '../utils.js';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function groupByMonth(tasks) {
  const groups = {};
  for (const t of tasks) {
    if (!t.next_due) continue;
    const d = new Date(t.next_due);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, items: [] };
    groups[key].items.push(t);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export default function SharedGardenPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getSharedGarden(token)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="shared-app">
        <main className="main shared-page">
          <div className="empty">🌱 Načítám…</div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="shared-app">
        <main className="main shared-page">
          <div className="shared-header">
            <h1>🌿 GardenPin</h1>
          </div>
          <div className="card empty">
            <div className="icon">🔒</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Sdílení není dostupné</div>
            <div className="small muted">{error || 'Odkaz byl zrušen nebo neexistuje.'}</div>
          </div>
        </main>
      </div>
    );
  }

  const { garden, pins, beds = [], upcoming_tasks } = data;
  const taskGroups = groupByMonth(upcoming_tasks || []);

  return (
    <div className="shared-app">
      <main className="main shared-page">
        <div className="shared-header">
          <h1>🗺️ {garden.name}</h1>
          <div className="small muted">
            Sdílená zahrada · {pins.length} {pins.length === 1 ? 'rostlina' : pins.length < 5 ? 'rostliny' : 'rostlin'}
            {garden.shared_at && ` · od ${formatDate(garden.shared_at)}`}
          </div>
        </div>

        {garden.image_path && (
          <div className="card" style={{ padding: 8 }}>
            <div
              className="map-container"
              style={{
                aspectRatio:
                  garden.image_width && garden.image_height
                    ? `${garden.image_width} / ${garden.image_height}`
                    : undefined,
                cursor: 'default',
              }}
            >
              <img
                src={garden.image_path}
                alt={garden.name}
                className="map-image"
                draggable={false}
                style={{ transform: `rotate(${garden.rotation || 0}deg)` }}
              />
              {beds.map((b) => (
                <div
                  key={b.id}
                  className="bed-rect"
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    width: `${b.width}%`,
                    height: `${b.height}%`,
                    background: (b.color || '#8b6f47') + '33',
                    border: `2px solid ${b.color || '#8b6f47'}`,
                    cursor: 'default',
                  }}
                  title={b.name}
                >
                  <span className="bed-label">
                    {b.name}
                    {b.width_m && b.height_m ? (
                      <span className="bed-size"> · {b.width_m}×{b.height_m} m</span>
                    ) : null}
                  </span>
                </div>
              ))}
              {pins.map((p) => (
                <div
                  key={p.id}
                  className="pin"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    cursor: 'default',
                    userSelect: 'none',
                  }}
                  title={p.name}
                >
                  <div className="pin-body" style={{ background: p.color || '#4a7c3a' }} />
                  <div className="pin-label">{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className="section-title">📍 Rostliny ({pins.length})</h3>
        {pins.length === 0 ? (
          <div className="card empty small">V této zahradě zatím nejsou žádné rostliny.</div>
        ) : (
          pins.map((p) => (
            <div key={p.id} className="garden-card" style={{ cursor: 'default' }}>
              {p.photo_path ? (
                <img src={p.photo_path} alt="" className="plant-avatar" />
              ) : (
                <div
                  className="plant-avatar plant-avatar-placeholder"
                  style={{ background: (p.color || '#4a7c3a') + '22', color: p.color || '#4a7c3a' }}
                >
                  🌿
                </div>
              )}
              <div className="details">
                <div className="name">{p.name}</div>
                {p.plant_name && <div className="meta">🌿 {p.plant_name}</div>}
                {p.planting_date && (
                  <div className="meta">📅 Vysazeno {formatDate(p.planting_date)}</div>
                )}
                {p.notes && <div className="meta small muted">{p.notes}</div>}
              </div>
            </div>
          ))
        )}

        <h3 className="section-title">📅 Nadcházející úkony</h3>
        {taskGroups.length === 0 ? (
          <div className="card empty small">Žádné naplánované úkony v nejbližších 3 měsících.</div>
        ) : (
          taskGroups.map((g) => (
            <div key={g.label} className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, textTransform: 'capitalize' }}>
                {g.label}
              </div>
              <ul className="month-tasks" style={{ margin: 0, listStyle: 'none', padding: 0 }}>
                {g.items.map((t) => (
                  <li key={t.id} className="month-task" style={{ cursor: 'default' }}>
                    <span className="month-task-day">
                      {new Date(t.next_due).getDate()}.
                    </span>
                    <span className="month-task-icon">{taskIcon(t.task_type)}</span>
                    <span className="month-task-info">
                      <span className="month-task-title">{t.title || taskLabel(t.task_type)}</span>
                      <span className="month-task-meta small muted">
                        {t.pin_name}
                        {t.plant_name ? ` · ${t.plant_name}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        <div className="shared-footer">
          <div className="small muted">
            Tato stránka je jen pro čtení.
          </div>
          <Link to="/" className="btn ghost small" style={{ marginTop: 10 }}>
            🌿 GardenPin
          </Link>
        </div>
      </main>
    </div>
  );
}
