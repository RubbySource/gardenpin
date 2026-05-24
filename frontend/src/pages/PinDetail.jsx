// Pin detail modal: info, tasks, history editing
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { TASK_TYPES, dueBadge, formatDate, formatDateTime, taskIcon, taskLabel } from '../utils.js';
import PlantAutocomplete, { PlantInfoCard } from '../components/PlantAutocomplete.jsx';
import { findPlantByName } from '../plantDatabase.js';
import RecommendedTasks from '../components/RecommendedTasks.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import SnoozeButton from '../components/SnoozeButton.jsx';

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

  return (
    <Modal title={`📍 ${pin.name}`} onClose={onClose}>
      <div className="tabs">
        <button className={tab === 'info' ? 'active' : ''} onClick={() => setTab('info')}>
          ℹ️ Info
        </button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
          ✅ Úkoly ({pin.tasks.length})
        </button>
        <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
          📷 Fotky
        </button>
        <button className={tab === 'harvests' ? 'active' : ''} onClick={() => setTab('harvests')}>
          🧺 Sklizeň
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
          <RecommendedTasks
            plantName={pin.plant_name}
            pinId={pin.id}
            existingTasks={pin.tasks}
            gardenConditions={pin.garden_conditions}
            onTaskAdded={load}
          />
          <PlantWarnings plantName={pin.plant_name} />
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
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {(t.next_due || t.specific_date) && (
                      <SnoozeButton task={t} onSnoozed={load} compact />
                    )}
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

      {tab === 'photos' && <PhotoGallery pinId={pin.id} />}

      {tab === 'harvests' && <HarvestTab pinId={pin.id} />}

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

// ===================== Photo gallery — fotky rostlin =====================
// Klient-side resize pomocí canvas (max 1600px na delší straně, JPEG 0.85).
async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nelze přečíst soubor'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nelze načíst obrázek'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Resize selhal'));
            const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
            });
            resolve(out);
          },
          'image/jpeg',
          quality,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoGallery({ pinId }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.listPinPhotos(pinId);
      setPhotos(list);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pinId]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) {
        try {
          const resized = await resizeImage(f, 1600, 0.85);
          fd.append('photos', resized);
        } catch {
          // Pokud resize selže, pošli originál
          fd.append('photos', f);
        }
      }
      await api.uploadPinPhotos(pinId, fd);
      toast('✅ Fotky nahrány');
      load();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm('Smazat tuto fotku?')) return;
    try {
      await api.deletePinPhoto(pinId, photo.id);
      toast('Smazáno');
      setLightbox(null);
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  return (
    <div className="photo-gallery">
      <div
        className="file-input-wrap mb-2"
        onClick={() => !uploading && fileRef.current?.click()}
        style={{ cursor: uploading ? 'wait' : 'pointer' }}
      >
        <div className="small">
          {uploading ? '⏳ Nahrávám…' : '📷 Přidat fotky (lze vybrat více)'}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div className="empty small">Načítám…</div>
      ) : photos.length === 0 ? (
        <div className="empty small">Zatím žádné fotky. Přidejte první fotku rostliny.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className="photo-thumb"
              onClick={() => setLightbox(p)}
              aria-label="Zobrazit fotku"
            >
              <img src={p.url} alt={p.caption || 'Fotka rostliny'} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="photo-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption || ''} />
            <div className="photo-lightbox-bar">
              <div className="small muted">
                {lightbox.uploaded_at ? formatDateTime(lightbox.uploaded_at) : ''}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn danger small"
                  onClick={() => handleDelete(lightbox)}
                >
                  🗑️ Smazat
                </button>
                <button className="btn ghost small" onClick={() => setLightbox(null)}>
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Sklizeň (harvests) =====================
const HARVEST_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'ks', label: 'ks' },
  { value: 'l', label: 'l' },
  { value: 'svazek', label: 'svazek' },
];

function HarvestTab({ pinId }) {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('kg');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.listPinHarvests(pinId);
      setHarvests(list);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pinId]);

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(String(amount).replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) return toast('Zadejte množství');
    setSaving(true);
    try {
      await api.createHarvest({ pin_id: pinId, date, amount: amt, unit, note: note || null });
      toast('🧺 Sklizeň zaznamenána');
      setAmount('');
      setNote('');
      load();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h) => {
    if (!confirm(`Smazat záznam sklizně ze ${formatDate(h.date)}?`)) return;
    try {
      await api.deleteHarvest(h.id);
      toast('Smazáno');
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  // Součet po jednotkách, jen pro tuto rostlinu
  const totals = harvests.reduce((acc, h) => {
    acc[h.unit] = (acc[h.unit] || 0) + Number(h.amount);
    return acc;
  }, {});
  const totalsLine = Object.entries(totals)
    .map(([u, v]) => `${Math.round(v * 100) / 100} ${u}`)
    .join(' · ');

  return (
    <div>
      <form onSubmit={submit} className="harvest-form" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 130px', marginBottom: 8 }}>
            <label className="small muted">Datum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px', marginBottom: 8 }}>
            <label className="small muted">Množství</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field" style={{ flex: '0 1 110px', marginBottom: 8 }}>
            <label className="small muted">Jednotka</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {HARVEST_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label className="small muted">Poznámka (volitelné)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Např. první sklizeň sezóny"
          />
        </div>
        <button type="submit" className="btn block" disabled={saving}>
          {saving ? 'Ukládám…' : '🧺 Zaznamenat sklizeň'}
        </button>
      </form>

      {totalsLine && (
        <div className="small muted" style={{ marginBottom: 8 }}>
          Celkem: <strong>{totalsLine}</strong>
        </div>
      )}

      {loading ? (
        <div className="empty small">Načítám…</div>
      ) : harvests.length === 0 ? (
        <div className="empty small">Zatím žádné záznamy sklizně. Zaznamenejte první výnos!</div>
      ) : (
        harvests.map((h) => (
          <div key={h.id} className="history-item">
            <div className="dot" style={{ background: '#d97a1b' }} />
            <div className="info">
              <div>
                🧺 <strong>{h.amount} {h.unit}</strong>
              </div>
              {h.note && <div className="small muted">{h.note}</div>}
              <div className="date">{formatDate(h.date)}</div>
            </div>
            <button
              className="btn ghost small"
              onClick={() => remove(h)}
              aria-label="Smazat sklizeň"
              title="Smazat sklizeň"
            >
              🗑️
            </button>
          </div>
        ))
      )}
    </div>
  );
}
