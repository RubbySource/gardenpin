// Pin detail modal: info, tasks, history editing
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { TASK_TYPES, dueBadge, formatDate, formatDateTime, taskIcon, taskLabel } from '../utils.js';
import PlantAutocomplete, { PlantInfoCard } from '../components/PlantAutocomplete.jsx';
import { findPlantByName } from '../plantDatabase.js';

export default function PinDetail({ pinId, onClose }) {
  const [pin, setPin] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const load = async () => {
    try {
      const [p, ph] = await Promise.all([
        api.getPin(pinId),
        api.listPinPhotos(pinId).catch(() => []),
      ]);
      setPin(p);
      setPhotos(ph);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [pinId]);

  const refreshPhotos = async () => {
    try {
      const [p, ph] = await Promise.all([api.getPin(pinId), api.listPinPhotos(pinId)]);
      setPin(p);
      setPhotos(ph);
    } catch {}
  };

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

  return (
    <Modal title={`📍 ${pin.name}`} onClose={onClose}>
      <div className="tabs">
        <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
          ℹ️ Info
        </button>
        <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
          📷 Fotky{photos.length > 0 ? ` (${photos.length})` : ''}
        </button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
          ✅ Úkoly ({pin.tasks.length})
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          📜 Historie
        </button>
      </div>

      {tab === 'info' && (
        <div>
          {pin.photo_path && (
            <img src={pin.photo_path} alt="" className="pin-photo-preview mb-2" />
          )}
          <div className="field">
            <label>Rostlina</label>
            <div>{pin.plant_name || <span className="muted">—</span>}</div>
          </div>
          <div className="field">
            <label>Datum výsadby</label>
            <div>
              {pin.planting_date ? (
                <>
                  {formatDate(pin.planting_date)}
                  {(() => {
                    const d = new Date(pin.planting_date);
                    const days = Math.floor((new Date() - d) / 86400000);
                    return days >= 0 ? (
                      <span className="muted small"> (před {days} dny)</span>
                    ) : null;
                  })()}
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
          <div className="field">
            <label>Poznámky</label>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {pin.notes || <span className="muted">—</span>}
            </div>
          </div>
          <div className="row mt-3">
            <button className="btn danger" onClick={deletePin}>
              🗑️ Smazat
            </button>
            <button className="btn" onClick={() => setEditing(true)}>
              ✏️ Upravit
            </button>
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <PhotoGallery
          pinId={pin.id}
          coverPath={pin.photo_path}
          photos={photos}
          onRefresh={refreshPhotos}
          onOpen={(photo) => setLightboxPhoto(photo)}
        />
      )}

      {tab === 'tasks' && (
        <div>
          <button className="btn block mb-2" onClick={() => setShowNewTask(true)}>
            + Přidat úkol
          </button>
          {pin.tasks.length === 0 ? (
            <div className="empty small">Žádné úkoly. Přidejte zálivku, hnojení apod.</div>
          ) : (
            pin.tasks.map((t) => {
              const badge = dueBadge(t.next_due);
              return (
                <div key={t.id} className={`task-item ${badge?.cls || ''}`}>
                  <button
                    className="task-complete-btn"
                    onClick={() => completeTask(t)}
                    aria-label="Hotovo"
                  >
                    ✓
                  </button>
                  <div className="info">
                    <div className="title">
                      {taskIcon(t.task_type)} {t.title}
                    </div>
                    <div className="meta">
                      {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
                      {t.frequency_days ? (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          Každých {t.frequency_days} dní
                        </span>
                      ) : null}
                      {t.last_done && (
                        <span className="muted small" style={{ marginLeft: 6 }}>
                          · Naposledy: {formatDate(t.last_done)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn ghost small"
                      onClick={() => setEditingTask(t)}
                      aria-label="Upravit"
                      title="Upravit úkol"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn ghost small"
                      onClick={() => deleteTask(t)}
                      aria-label="Smazat"
                      title="Smazat úkol"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
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

      {tab === 'history' && (
        <div>
          {pin.history.length === 0 ? (
            <div className="empty small">Zatím žádná historie péče</div>
          ) : (
            pin.history.map((h) => (
              <div key={h.id} className="history-item">
                <div className="dot" />
                <div className="info">
                  <div>{h.action}</div>
                  {h.notes && <div className="small muted">{h.notes}</div>}
                  <div className="date">{formatDateTime(h.done_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          isCover={pin.photo_path === lightboxPhoto.path}
          onClose={() => setLightboxPhoto(null)}
          onDelete={async () => {
            if (!confirm('Smazat tuto fotku?')) return;
            try {
              await api.deletePinPhoto(lightboxPhoto.id);
              toast('🗑️ Fotka smazána');
              setLightboxPhoto(null);
              refreshPhotos();
            } catch (e) {
              toast('Chyba: ' + e.message);
            }
          }}
          onSetCover={async () => {
            try {
              await api.setPinPhotoAsCover(lightboxPhoto.id);
              toast('✅ Nastaveno jako titulní fotka');
              refreshPhotos();
            } catch (e) {
              toast('Chyba: ' + e.message);
            }
          }}
        />
      )}
    </Modal>
  );
}

function PhotoGallery({ pinId, coverPath, photos, onRefresh, onOpen }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        await api.addPinPhoto(pinId, file);
      }
      toast(`✅ ${files.length} ${files.length === 1 ? 'fotka přidána' : files.length < 5 ? 'fotky přidány' : 'fotek přidáno'}`);
      onRefresh();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="photo-gallery">
      <button
        type="button"
        className="btn block mb-2"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '⏳ Nahrávám…' : '📷 Přidat fotky'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleAdd}
      />

      {photos.length === 0 ? (
        <div className="gp-empty" style={{ padding: '24px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>📷</span>
          <div className="gp-empty-title">Žádné fotky</div>
          <div className="gp-empty-text">
            Přidejte první fotku této rostliny pro sledování růstu.
          </div>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              className={`photo-grid-item${coverPath === photo.path ? ' is-cover' : ''}`}
              onClick={() => onOpen(photo)}
              title={photo.caption || formatDateTime(photo.created_at)}
            >
              <img src={photo.path} alt={photo.caption || ''} loading="lazy" />
              {coverPath === photo.path && (
                <span className="photo-cover-badge">⭐ Titulní</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoLightbox({ photo, isCover, onClose, onDelete, onSetCover }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="photo-lightbox-backdrop" onClick={onClose}>
      <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="photo-lightbox-close" onClick={onClose} aria-label="Zavřít">
          ×
        </button>
        <img src={photo.path} alt={photo.caption || ''} className="photo-lightbox-img" />
        {photo.caption && <div className="photo-lightbox-caption">{photo.caption}</div>}
        <div className="photo-lightbox-meta">
          📅 {formatDateTime(photo.created_at)}
        </div>
        <div className="photo-lightbox-actions">
          {!isCover && (
            <button className="btn ghost" onClick={onSetCover}>
              ⭐ Nastavit jako titulní
            </button>
          )}
          <button className="btn danger" onClick={onDelete}>
            🗑️ Smazat
          </button>
        </div>
      </div>
    </div>
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
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field">
          <label>Barva pinu</label>
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
              <div className="small muted">
                {pin.photo_path ? 'Nahrát jinou fotku' : 'Klikněte pro nahrání fotky'}
              </div>
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
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám...' : 'Uložit'}
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
    // Auto-fill title from type
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
          <div className="tabs">
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
            <div className="row">
              <label className="small muted">Každých</label>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={{ width: 80 }}
              />
              <label className="small muted">dní</label>
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
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám...' : 'Přidat úkol'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===================== P5: Editace úkolu =====================
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Kdy</label>
          <div className="tabs">
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
            <div className="row">
              <label className="small muted">Každých</label>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={{ width: 80 }}
              />
              <label className="small muted">dní</label>
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
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám...' : 'Uložit změny'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
