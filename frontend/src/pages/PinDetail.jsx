// Pin detail modal — Claude Design iOS premium (forest/sand, flat)
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { TASK_TYPES, dueBadge, formatDate, formatDateTime, taskIcon } from '../utils.js';
import PlantAutocomplete, { PlantInfoCard } from '../components/PlantAutocomplete.jsx';
import { findPlantByName } from '../plantDatabase.js';

export default function PinDetail({ pinId, onClose }) {
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const load = async () => {
    try {
      const p = await api.getPin(pinId);
      setPin(p);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [pinId]);

  const completeTask = async (t) => {
    try {
      await api.completeTask(t.id);
      toast('✅ Hotovo');
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const deleteTask = async (t) => {
    if (!confirm(`Smazat úkol "${t.title}"?`)) return;
    try {
      await api.deleteTask(t.id);
      toast('Smazáno');
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const deletePin = async () => {
    if (!confirm('Opravdu smazat toto místo se všemi úkoly?')) return;
    try {
      await api.deletePin(pin.id);
      toast('Místo smazáno');
      onClose();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading || !pin) {
    return (
      <Modal title="Detail místa" onClose={onClose}>
        <div className="empty">Načítám...</div>
      </Modal>
    );
  }

  if (editing) {
    return (
      <EditPinForm
        pin={pin}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load();
        }}
      />
    );
  }

  const knownPlant = findPlantByName(pin.plant_name);
  const plantedDays = pin.planting_date
    ? Math.floor((new Date() - new Date(pin.planting_date)) / 86400000)
    : null;

  return (
    <Modal title={null} onClose={onClose}>
      {/* Hero header: photo or forest gradient */}
      <div
        className={`pin-hero${pin.photo_path ? '' : ' placeholder'}`}
        style={pin.photo_path ? { backgroundImage: `url(${pin.photo_path})` } : undefined}
      >
        <div className="pin-hero-content">
          {pin.plant_name && <div className="pin-hero-eyebrow">{pin.plant_name}</div>}
          <h2 className="pin-hero-title">{pin.name}</h2>
          {pin.planting_date && (
            <div className="pin-hero-sub">
              <span>📅</span> Vysazeno {formatDate(pin.planting_date)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="gp-tabs">
        <button
          className={tab === 'info' ? 'active' : ''}
          onClick={() => setTab('info')}
          type="button"
        >
          Info
        </button>
        <button
          className={tab === 'tasks' ? 'active' : ''}
          onClick={() => setTab('tasks')}
          type="button"
        >
          Úkoly
          {pin.tasks.length > 0 && <span className="tab-count">{pin.tasks.length}</span>}
        </button>
        <button
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
          type="button"
        >
          Historie
          {pin.history.length > 0 && <span className="tab-count">{pin.history.length}</span>}
        </button>
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <div>
          {knownPlant && (
            <PlantInfoCard
              plant={knownPlant}
              pinId={pin.id}
              onTasksCreated={() => {
                toast('✅ Doporučené úkoly přidány');
                load();
              }}
            />
          )}

          <div className="info-rows">
            <div className="info-row">
              <span className="info-row-label">Rostlina</span>
              <span className="info-row-value">
                {pin.plant_name || <span className="muted-dash">—</span>}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Datum výsadby</span>
              <span className="info-row-value">
                {pin.planting_date ? (
                  <>
                    {formatDate(pin.planting_date)}
                    {plantedDays !== null && plantedDays >= 0 && (
                      <span className="info-row-value-meta">před {plantedDays} dny</span>
                    )}
                  </>
                ) : (
                  <span className="muted-dash">—</span>
                )}
              </span>
            </div>
            {pin.notes ? (
              <div className="info-row column">
                <span className="info-row-label">Poznámky</span>
                <span className="info-row-value">{pin.notes}</span>
              </div>
            ) : (
              <div className="info-row">
                <span className="info-row-label">Poznámky</span>
                <span className="info-row-value">
                  <span className="muted-dash">—</span>
                </span>
              </div>
            )}
          </div>

          <button className="btn block" onClick={() => setEditing(true)} type="button">
            ✏️ Upravit místo
          </button>
          <button className="btn-text-danger" onClick={deletePin} type="button">
            Smazat místo
          </button>
        </div>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div>
          {pin.tasks.length === 0 ? (
            <div className="gp-empty" style={{ marginBottom: 14 }}>
              <span className="gp-empty-icon">✅</span>
              <div className="gp-empty-title">Žádné úkoly</div>
              <div className="gp-empty-text">
                Přidejte zálivku, hnojení nebo jinou péči pro tuto rostlinu.
              </div>
            </div>
          ) : (
            <div>
              {pin.tasks.map((t) => {
                const badge = dueBadge(t.next_due);
                const isOverdue = badge?.cls === 'overdue';
                const isToday = badge?.cls === 'today';
                return (
                  <div
                    key={t.id}
                    className={`gp-task${isOverdue ? ' is-overdue' : ''}${isToday ? ' is-today' : ''}`}
                  >
                    <button
                      className="gp-task-check"
                      onClick={() => completeTask(t)}
                      aria-label="Hotovo"
                      type="button"
                    >
                      ✓
                    </button>
                    <div className="gp-task-body">
                      <div className="gp-task-title">
                        <span style={{ fontSize: '1.05rem' }}>{taskIcon(t.task_type)}</span>
                        {t.title}
                      </div>
                      <div className="gp-task-chips">
                        {badge && <span className={`gp-chip ${badge.cls}`}>{badge.text}</span>}
                        {t.frequency_days ? (
                          <span className="gp-chip muted">Každých {t.frequency_days} dní</span>
                        ) : null}
                      </div>
                      {t.last_done && (
                        <div className="gp-task-meta" style={{ marginTop: 4 }}>
                          Naposledy: {formatDate(t.last_done)}
                        </div>
                      )}
                    </div>
                    <div className="gp-task-actions">
                      <button
                        className="icon-btn"
                        onClick={() => setEditingTask(t)}
                        aria-label="Upravit"
                        title="Upravit úkol"
                        type="button"
                      >
                        ✏️
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => deleteTask(t)}
                        aria-label="Smazat"
                        title="Smazat úkol"
                        type="button"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="btn block mt-3"
            onClick={() => setShowNewTask(true)}
            type="button"
          >
            + Přidat úkol
          </button>

          {showNewTask && (
            <NewTaskForm
              pinId={pin.id}
              onClose={() => setShowNewTask(false)}
              onCreated={() => {
                setShowNewTask(false);
                load();
              }}
            />
          )}
          {editingTask && (
            <EditTaskForm
              task={editingTask}
              onClose={() => setEditingTask(null)}
              onSaved={() => {
                setEditingTask(null);
                load();
              }}
            />
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {pin.history.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty-icon">📜</span>
              <div className="gp-empty-title">Zatím žádná historie</div>
              <div className="gp-empty-text">
                Až splníte první úkol, objeví se zde záznam o péči.
              </div>
            </div>
          ) : (
            <div className="pin-history">
              {pin.history.map((h) => (
                <div key={h.id} className="pin-history-item">
                  <div className="pin-history-dot" />
                  <div className="pin-history-line" />
                  <div className="pin-history-action">{h.action}</div>
                  {h.notes && <div className="pin-history-notes">{h.notes}</div>}
                  <div className="pin-history-date">{formatDateTime(h.done_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditPinForm({ pin, onClose, onSaved }) {
  const [name, setName] = useState(pin.name);
  const [plantName, setPlantName] = useState(pin.plant_name || '');
  const [selectedPlant, setSelectedPlant] = useState(() => findPlantByName(pin.plant_name));
  const [plantingDate, setPlantingDate] = useState(pin.planting_date || '');
  const [notes, setNotes] = useState(pin.notes || '');
  const [color, setColor] = useState(pin.color || '#4a7c3a');
  const [file, setFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('plant_name', plantName);
      fd.append('planting_date', plantingDate);
      fd.append('notes', notes);
      fd.append('color', color);
      if (file) fd.append('photo', file);
      if (removePhoto) fd.append('remove_photo', 'true');
      await api.updatePin(pin.id, fd);
      toast('✅ Uloženo');
      onSaved();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Upravit místo" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Název místa *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Rostlina</label>
          <PlantAutocomplete
            value={plantName}
            onChange={(val, plant) => {
              setPlantName(val);
              if (!plant) setSelectedPlant(null);
            }}
            onSelect={(plant) => {
              setSelectedPlant(plant);
              setPlantName(plant.nameCz);
            }}
            placeholder="Začněte psát název rostliny…"
          />
          {selectedPlant && (
            <PlantInfoCard
              plant={selectedPlant}
              pinId={pin.id}
              onTasksCreated={() => toast('✅ Doporučené úkoly přidány')}
            />
          )}
        </div>
        <div className="field">
          <label>Datum výsadby</label>
          <input
            type="date"
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Poznámky</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Něco o rostlině, péči, zdroji semen…"
          />
        </div>
        <div className="field">
          <label>Barva pinu na mapě</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="field">
          <label>Fotka rostliny</label>
          {pin.photo_path && !removePhoto && !file && (
            <>
              <img src={pin.photo_path} alt="" className="pin-photo-preview mb-2" />
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setRemovePhoto(true)}
              >
                Odstranit fotku
              </button>
            </>
          )}
          <div className="file-input-wrap mt-2" onClick={() => fileRef.current?.click()}>
            {file ? (
              <div className="small">📎 {file.name}</div>
            ) : (
              <>
                <div style={{ fontSize: '1.5rem' }}>📷</div>
                <div className="small muted">
                  {pin.photo_path ? 'Nahrát jinou fotku' : 'Klikněte pro nahrání fotky'}
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFile(e.target.files?.[0]);
                setRemovePhoto(false);
              }}
            />
          </div>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewTaskForm({ pinId, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('zalivka');
  const [mode, setMode] = useState('frequency'); // 'frequency' | 'specific'
  const [frequency, setFrequency] = useState(3);
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!title) {
      const t = TASK_TYPES.find((x) => x.value === taskType);
      if (t) setTitle(t.label);
    }
  }, [taskType]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast('Zadejte název úkolu');
    setSaving(true);
    try {
      const data = {
        pin_id: pinId,
        title,
        task_type: taskType,
        notes,
      };
      if (mode === 'frequency') {
        data.frequency_days = parseInt(frequency, 10);
      } else {
        data.specific_date = specificDate;
      }
      await api.createTask(data);
      toast('✅ Úkol přidán');
      onCreated();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nový úkol" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Typ úkolu</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Název úkolu</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Např. Zálivka"
          />
        </div>
        <div className="field">
          <label>Kdy</label>
          <div className="segmented">
            <button
              type="button"
              className={mode === 'frequency' ? 'active' : ''}
              onClick={() => setMode('frequency')}
            >
              🔁 Opakovaně
            </button>
            <button
              type="button"
              className={mode === 'specific' ? 'active' : ''}
              onClick={() => setMode('specific')}
            >
              📅 Jednorázově
            </button>
          </div>
          {mode === 'frequency' ? (
            <div className="frequency-row">
              <span className="freq-label">Každých</span>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              />
              <span className="freq-label">dní</span>
            </div>
          ) : (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>
        <div className="field">
          <label>Poznámky</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám…' : 'Přidat úkol'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTaskForm({ task, onClose, onSaved }) {
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState(task.task_type);
  const [mode, setMode] = useState(task.specific_date ? 'specific' : 'frequency');
  const [frequency, setFrequency] = useState(task.frequency_days || 7);
  const [specificDate, setSpecificDate] = useState(
    task.specific_date || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(task.notes || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast('Zadejte název úkolu');
    setSaving(true);
    try {
      const data = {
        title,
        task_type: taskType,
        notes,
        frequency_days: mode === 'frequency' ? parseInt(frequency, 10) : null,
        specific_date: mode === 'specific' ? specificDate : null,
      };
      await api.updateTask(task.id, data);
      toast('✅ Úkol uložen');
      onSaved();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Upravit úkol" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Typ úkolu</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Název úkolu</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Kdy</label>
          <div className="segmented">
            <button
              type="button"
              className={mode === 'frequency' ? 'active' : ''}
              onClick={() => setMode('frequency')}
            >
              🔁 Opakovaně
            </button>
            <button
              type="button"
              className={mode === 'specific' ? 'active' : ''}
              onClick={() => setMode('specific')}
            >
              📅 Jednorázově
            </button>
          </div>
          {mode === 'frequency' ? (
            <div className="frequency-row">
              <span className="freq-label">Každých</span>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              />
              <span className="freq-label">dní</span>
            </div>
          ) : (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>
        <div className="field">
          <label>Poznámky</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
