// PinDetail — iOS-style mobile sheet: hero, tabs (URL hash), FAB, scroll-aware sticky header
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { TASK_TYPES, dueBadge, formatDate, formatDateTime, taskLabel, taskIconName } from '../utils.js';
import PlantAutocomplete, { PlantInfoCard } from '../components/PlantAutocomplete.jsx';
import { findPlantByName } from '../plantDatabase.js';
import RecommendedTasks from '../components/RecommendedTasks.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import SnoozeButton from '../components/SnoozeButton.jsx';
import Icon from '../components/Icon.jsx';
import { hapticNotification } from '../native/haptics.js';
import { openPhotoPicker } from '../native/camera.js';

// Tab keys odrážejí URL hash; pořadí = pořadí v tab baru.
const PD_TABS = ['ukony', 'pece', 'fotky', 'info'];
const PD_DEFAULT_TAB = 'ukony';

function readTabFromHash() {
  if (typeof window === 'undefined') return PD_DEFAULT_TAB;
  const h = window.location.hash.replace(/^#/, '');
  return PD_TABS.includes(h) ? h : PD_DEFAULT_TAB;
}

// Emoji ikona dle kategorie rostliny v plantDatabase.
const CATEGORY_ICONS = {
  vegetables: '🥕',
  fruits: '🍓',
  herbs: '🌿',
  ornamental: '🌸',
  bulbs: '🌷',
  climbers: '🌱',
  shrubs: '🌳',
  trees: '🌳',
  grasses: '🌾',
  water: '💧',
  succulents: '🌵',
  annuals: '🌻',
};
function categoryIcon(plant) {
  if (plant?.category && CATEGORY_ICONS[plant.category]) return CATEGORY_ICONS[plant.category];
  return '📍';
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function PinDetail({ pinId, onClose }) {
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(readTabFromHash);
  const [editing, setEditing] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Sticky header se objeví, když uživatel posune scroll dolů (a zmizí při zpětném scrollu).
  const sheetRef = useRef(null);
  const lastScrollY = useRef(0);
  const [headerShown, setHeaderShown] = useState(false);

  // Drag-to-dismiss: tah za grip handle dolů zavře sheet (iOS gesto).
  const [drag, setDrag] = useState({ y: 0, dragging: false, released: false });
  const gripStartY = useRef(null);
  const dragY = useRef(0);
  const onGripStart = (e) => { gripStartY.current = e.touches[0].clientY; };
  const onGripMove = (e) => {
    if (gripStartY.current == null) return;
    const dy = Math.max(0, e.touches[0].clientY - gripStartY.current);
    dragY.current = dy;
    setDrag({ y: dy, dragging: true, released: false });
  };
  const onGripEnd = () => {
    if (gripStartY.current == null) return;
    gripStartY.current = null;
    if (dragY.current > 90) { onClose(); return; }
    dragY.current = 0;
    setDrag({ y: 0, dragging: false, released: true });
  };

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
  useEffect(() => { load(); }, [pinId]);

  // ESC zavírá. Body scroll lock po dobu otevření sheetu.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Sync stavu tabu s URL hash (← / → v prohlížeči zachová tab).
  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Scroll detector: zobraz sticky header při scroll-down, schovej při scroll-up nahoru.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 60) setHeaderShown(false);
      else if (y > lastScrollY.current + 4) setHeaderShown(true);
      else if (y < lastScrollY.current - 6) setHeaderShown(true);
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pin]);

  const changeTab = (t) => {
    setTab(t);
    try {
      window.history.replaceState(null, '', `#${t}`);
    } catch {}
  };

  const completeTask = async (t) => {
    try {
      await api.completeTask(t.id);
      hapticNotification('success');
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
      <div className="pd-backdrop" onClick={onClose}>
        <div className="pd-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="empty" style={{ padding: 40 }}>Načítám…</div>
        </div>
      </div>
    );
  }

  // Edit formulář otevíráme stále jako Modal (drží se původní UX).
  if (editing) {
    return (
      <EditPinForm
        pin={pin}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />
    );
  }

  const plant = findPlantByName(pin.plant_name);
  const icon = categoryIcon(plant);
  const since = daysSince(pin.planting_date);

  const sheetStyle = (drag.dragging || drag.released)
    ? { transform: `translateY(${drag.y}px)`, transition: drag.dragging ? 'none' : 'transform 0.32s var(--ios-spring)' }
    : undefined;

  return (
    <div className="pd-backdrop" onClick={onClose}>
      <div
        className="pd-sheet"
        ref={sheetRef}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Grip handle — tah dolů zavře sheet (iOS bottom-sheet gesto) */}
        <div
          className="pd-grip-zone"
          onTouchStart={onGripStart}
          onTouchMove={onGripMove}
          onTouchEnd={onGripEnd}
        >
          <div className="pd-grip" aria-hidden="true" />
        </div>

        {/* Sticky compact header — vrátí se při scrollu nahoru */}
        <div className={`pd-sticky-header ${headerShown ? 'shown' : ''}`}>
          <button className="pd-back-sticky" onClick={onClose} aria-label="Zpět">‹</button>
          <span className="pd-sticky-title">{pin.name}</span>
        </div>

        {/* Hero */}
        <div className="pd-hero">
          <button type="button" className="pd-back-floating" onClick={onClose}>
            ‹ Zpět
          </button>
          <div className="pd-hero-row">
            <div className="pd-hero-icon" aria-hidden="true">{icon}</div>
            <div className="pd-hero-text">
              <h1 className="pd-hero-name">{pin.name}</h1>
              {pin.plant_name && <div className="pd-hero-plant">{pin.plant_name}</div>}
              {plant?.nameLat && <div className="pd-hero-latin">{plant.nameLat}</div>}
              {pin.planting_date && (
                <div className="pd-hero-meta">
                  📅 Vysazeno {formatDate(pin.planting_date)}
                  {since != null && since >= 0 && <> · před {since} {sinceLabel(since)}</>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs (sticky) */}
        <div className="pd-tabs">
          <TabBtn id="ukony" active={tab} onSelect={changeTab}>
            ✅ Úkony{pin.tasks.length > 0 && <span className="pd-tab-count">{pin.tasks.length}</span>}
          </TabBtn>
          <TabBtn id="pece" active={tab} onSelect={changeTab}>🌿 Péče</TabBtn>
          <TabBtn id="fotky" active={tab} onSelect={changeTab}>📷 Fotky</TabBtn>
          <TabBtn id="info" active={tab} onSelect={changeTab}>ℹ️ Info</TabBtn>
        </div>

        <div className="pd-content">
          {tab === 'ukony' && (
            <UkonyTab
              pin={pin}
              onComplete={completeTask}
              onSnoozed={load}
              onEdit={setEditingTask}
              onDelete={deleteTask}
            />
          )}
          {tab === 'pece' && <PeceTab pin={pin} plant={plant} onEditPin={() => setEditing(true)} />}
          {tab === 'fotky' && <PhotoGallery pinId={pin.id} />}
          {tab === 'info' && (
            <InfoTab
              pin={pin}
              plant={plant}
              onReload={load}
              onDeletePin={deletePin}
            />
          )}
        </div>

        {/* FAB — palec ho vždy dosáhne */}
        {tab === 'ukony' && (
          <button
            type="button"
            className="pd-fab"
            onClick={() => setShowNewTask(true)}
            aria-label="Přidat úkon"
            title="Přidat úkon"
          >
            +
          </button>
        )}

        {showNewTask && (
          <NewTaskForm
            pinId={pin.id}
            onClose={() => setShowNewTask(false)}
            onCreated={() => { setShowNewTask(false); load(); }}
          />
        )}
        {editingTask && (
          <EditTaskForm
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSaved={() => { setEditingTask(null); load(); }}
          />
        )}
      </div>
    </div>
  );
}

function sinceLabel(n) {
  if (n === 1) return 'dnem';
  if (n < 5) return 'dny';
  return 'dny';
}

function TabBtn({ id, active, onSelect, children }) {
  return (
    <button
      type="button"
      className={`pd-tab-btn${active === id ? ' active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {children}
    </button>
  );
}

// ===================== Úkony tab — iOS grouped list + choroby & škůdci =====================
function UkonyTab({ pin, onComplete, onSnoozed, onEdit, onDelete }) {
  const hasTasks = pin.tasks.length > 0;
  return (
    <div>
      {hasTasks ? (
        <div className="pd-task-list">
          {pin.tasks.map((t) => {
            const badge = dueBadge(t.next_due);
            const cls = badge?.cls ? `is-${badge.cls}` : '';
            const canSnooze = t.next_due || t.specific_date;
            return (
              <div key={t.id} className={`pd-task-row ${cls}`}>
                <button
                  type="button"
                  className="pd-task-check"
                  onClick={() => onComplete(t)}
                  aria-label="Splnit úkon"
                  title="Splnit"
                >
                  <Icon name="check" size={15} stroke={2.5} />
                </button>
                <span className="pd-task-ic" aria-hidden="true">
                  <Icon name={taskIconName(t.task_type)} size={16} />
                </span>
                <div className="pd-task-main">
                  <div className="pd-task-name">{t.title}</div>
                  <div className="pd-task-sub">
                    {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
                    {t.frequency_days ? <span className="badge">Každých {t.frequency_days} dní</span> : null}
                    {t.specific_date && !t.frequency_days ? <span className="badge">Jednorázově</span> : null}
                    <span className="badge type">{taskLabel(t.task_type)}</span>
                  </div>
                </div>
                <div className="pd-task-trailing">
                  {canSnooze && <SnoozeButton task={t} onSnoozed={onSnoozed} compact />}
                  <button
                    type="button"
                    className="pd-task-mini"
                    onClick={() => onEdit(t)}
                    aria-label="Upravit úkon"
                    title="Upravit"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="pd-task-mini danger"
                    onClick={() => onDelete(t)}
                    aria-label="Smazat úkon"
                    title="Smazat"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pd-empty">
          <span className="pd-empty-icon">✅</span>
          <div className="pd-empty-text">Žádné úkony. Přidejte hnojení, stříhání nebo přesazení přes ＋.</div>
        </div>
      )}

      {/* Choroby & škůdci — hned pod hlavními úkony (vykreslí se jen má-li rostlina záznamy) */}
      {pin.plant_name && (
        <div className="pd-warnings-section">
          <PlantWarnings plantName={pin.plant_name} />
        </div>
      )}
    </div>
  );
}

// ===================== Péče tab — kompaktní řádky =====================
function CareRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="pd-care-row">
      <span className="pd-care-icon" aria-hidden="true">{icon}</span>
      <div className="pd-care-content">
        <div className="pd-care-label">{label}</div>
        <div className="pd-care-value">{value}</div>
      </div>
    </div>
  );
}

function PeceTab({ pin, plant, onEditPin }) {
  const nav = useNavigate();
  const companions = plant?.companions;
  const hasCompanions = companions && ((companions.good?.length > 0) || (companions.bad?.length > 0));
  const hasAny =
    pin.photo_path ||
    pin.planting_date ||
    pin.notes ||
    plant?.soil || plant?.sun || plant?.watering || plant?.fertilizing || plant?.pruning || plant?.planting || plant?.notes ||
    plant?.hardy || plant?.height || plant?.spread ||
    hasCompanions;
  const goToCatalog = (name) => nav(`/katalog?q=${encodeURIComponent(name)}`);
  return (
    <div>
      {pin.photo_path && (
        <img
          src={pin.photo_path}
          alt={pin.name}
          className="pin-photo-preview"
          style={{ borderRadius: 14, marginBottom: 14 }}
        />
      )}

      {!hasAny ? (
        <div className="pd-empty">
          <span className="pd-empty-icon">🌿</span>
          <div className="pd-empty-text">
            Žádné info o péči. Přiřaďte rostlinu z katalogu nebo upravte poznámky.
          </div>
        </div>
      ) : (
        <div className="pd-care-list">
          <CareRow icon="🪴" label="Půda" value={plant?.soil} />
          <CareRow icon="☀️" label="Slunce" value={plant?.sun} />
          <CareRow icon="💧" label="Zálivka" value={plant?.watering} />
          <CareRow icon="🌱" label="Hnojení" value={plant?.fertilizing} />
          <CareRow icon="✂️" label="Řez / pasínkování" value={plant?.pruning} />
          <CareRow icon="📅" label="Výsadba" value={plant?.planting} />
          <CareRow icon="❄️" label="Mrazuvzdornost" value={plant?.hardy} />
          <CareRow icon="📏" label="Výška" value={plant?.height} />
          <CareRow icon="↔️" label="Šíře / průměr" value={plant?.spread} />
          <CareRow icon="ℹ️" label="Pozn. ke druhu" value={plant?.notes} />
          <CareRow icon="📝" label="Vlastní poznámky" value={pin.notes} />
        </div>
      )}

      {hasCompanions && (
        <div className="companion-section">
          <div className="companion-title">🤝 Doprovodné rostliny</div>
          {companions.good?.length > 0 && (
            <div className="companion-row">
              <span className="companion-label">Dobře se snáší:</span>
              <div className="companion-pills">
                {companions.good.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="companion-pill good"
                    onClick={() => goToCatalog(name)}
                    title={`Hledat ${name} v katalogu`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {companions.bad?.length > 0 && (
            <div className="companion-row">
              <span className="companion-label">Nesadit vedle:</span>
              <div className="companion-pills">
                {companions.bad.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="companion-pill bad"
                    onClick={() => goToCatalog(name)}
                    title={`Hledat ${name} v katalogu`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button type="button" className="btn ghost block" onClick={onEditPin}>
        ✏️ Upravit místo
      </button>
    </div>
  );
}

// ===================== Info tab =====================
function InfoTab({ pin, plant, onReload, onDeletePin }) {
  const [showMore, setShowMore] = useState(false);
  const cond = pin.garden_conditions;
  const condParts = [];
  if (cond) {
    if (cond.soil_type) condParts.push(`🪴 ${cond.soil_type}`);
    if (cond.exposure) {
      const map = { N: '⬆️ sever', S: '⬇️ jih', E: '➡️ východ', W: '⬅️ západ', mixed: '🧭 smíšená' };
      condParts.push(map[cond.exposure] || cond.exposure);
    }
    if (cond.altitude_m) condParts.push(`⛰️ ${cond.altitude_m} m`);
    if (cond.climate_zone) condParts.push(`📍 ${cond.climate_zone}`);
  }

  return (
    <div>
      {/* Pěstební podmínky */}
      {condParts.length > 0 && (
        <div className="pd-section">
          <div className="pd-section-title">🌍 Pěstební podmínky</div>
          <div className="pd-care-list">
            <div className="pd-care-row">
              <div className="pd-care-content">
                <div className="pd-care-value">{condParts.join(' · ')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sezónní doporučení (RecommendedTasks slouží jako sezónní kalendář pro tuto rostlinu) */}
      {pin.plant_name && (
        <div className="pd-section">
          <RecommendedTasks
            plantName={pin.plant_name}
            pinId={pin.id}
            existingTasks={pin.tasks}
            gardenConditions={pin.garden_conditions}
            onTaskAdded={onReload}
          />
        </div>
      )}

      {/* Sklizeň */}
      <div className="pd-section">
        <div className="pd-section-title">🧺 Sklizeň</div>
        <HarvestTab pinId={pin.id} />
      </div>

      {/* Více — historie péče */}
      {!showMore ? (
        <button type="button" className="pd-more" onClick={() => setShowMore(true)}>
          ▾ Více · Historie péče ({pin.history.length})
        </button>
      ) : (
        <div className="pd-section">
          <div className="pd-section-title">📜 Historie péče</div>
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
          <button type="button" className="pd-more" onClick={() => setShowMore(false)}>
            ▴ Skrýt
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className="pd-danger-zone">
        <button type="button" className="pd-danger-btn" onClick={onDeletePin}>
          🗑️ Smazat toto místo
        </button>
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
          <div
            className="file-input-wrap mt-2"
            onClick={() =>
              openPhotoPicker({
                multiple: false,
                inputRef: fileRef,
                onFiles: (files) => {
                  setFile(files[0]);
                  setRemovePhoto(false);
                },
              })
            }
          >
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
      const t = TASK_TYPES.find((x) => x.id === taskType);
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
              <option key={t.id} value={t.id}>
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
              <option key={t.id} value={t.id}>
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

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
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
        onClick={() =>
          !uploading &&
          openPhotoPicker({ multiple: true, inputRef: fileRef, onFiles: uploadFiles })
        }
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
          onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div className="empty small">Načítám…</div>
      ) : photos.length === 0 ? (
        <div className="empty small">Zatím žádné fotky. Přidejte první fotku rostliny.</div>
      ) : (
        <div className="pd-photo-strip">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="pd-photo-cell"
              onClick={() => setLightbox(i)}
              aria-label="Zobrazit fotku"
            >
              <img src={p.url} alt={p.caption || 'Fotka rostliny'} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox != null && photos[lightbox] && (
        <div
          className="photo-lightbox pd-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="pd-lb-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Zavřít"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              className="pd-lb-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length); }}
              aria-label="Předchozí"
            >
              ‹
            </button>
          )}

          <div className="pd-lb-stage" onClick={(e) => e.stopPropagation()}>
            <PinchImage
              key={photos[lightbox].id}
              src={photos[lightbox].url}
              alt={photos[lightbox].caption || ''}
            />
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              className="pd-lb-nav next"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length); }}
              aria-label="Další"
            >
              ›
            </button>
          )}

          <div className="pd-lb-bar" onClick={(e) => e.stopPropagation()}>
            <div className="small muted">
              {photos[lightbox].uploaded_at ? formatDateTime(photos[lightbox].uploaded_at) : ''}
              {photos.length > 1 ? ` · ${lightbox + 1}/${photos.length}` : ''}
            </div>
            <button className="btn danger small" onClick={() => handleDelete(photos[lightbox])}>
              🗑️ Smazat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Obrázek v lightboxu s pinch-zoom (dva prsty), pan při přiblížení a double-tap zoom.
function PinchImage({ src, alt }) {
  const imgRef = useRef(null);
  const st = useRef({ scale: 1, x: 0, y: 0, startDist: 0, startScale: 1, panX: 0, panY: 0, lastTap: 0, mode: null });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0, animating: false });

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const s = st.current;
    const distOf = (touches) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const set = (scale, x, y, animating = false) => {
      const sc = Math.max(1, Math.min(4, scale));
      if (sc === 1) { x = 0; y = 0; }
      s.scale = sc; s.x = x; s.y = y;
      setView({ scale: sc, x, y, animating });
    };
    const onStart = (e) => {
      if (e.touches.length === 2) {
        s.mode = 'pinch';
        s.startDist = distOf(e.touches);
        s.startScale = s.scale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - s.lastTap < 280) {
          set(s.scale > 1 ? 1 : 2.5, 0, 0, true);
          s.lastTap = 0;
          s.mode = null;
          e.preventDefault();
          return;
        }
        s.lastTap = now;
        if (s.scale > 1) {
          s.mode = 'pan';
          s.panX = e.touches[0].clientX - s.x;
          s.panY = e.touches[0].clientY - s.y;
        } else {
          s.mode = null;
        }
      }
    };
    const onMove = (e) => {
      if (s.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const ratio = distOf(e.touches) / (s.startDist || 1);
        set(s.startScale * ratio, s.x, s.y);
      } else if (s.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        set(s.scale, e.touches[0].clientX - s.panX, e.touches[0].clientY - s.panY);
      }
    };
    const onEnd = (e) => { if (e.touches.length === 0) s.mode = null; };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const onDoubleClick = () => {
    const s = st.current;
    const sc = s.scale > 1 ? 1 : 2.5;
    s.scale = sc; s.x = 0; s.y = 0;
    setView({ scale: sc, x: 0, y: 0, animating: true });
  };

  return (
    <img
      ref={imgRef}
      className="pd-lb-img"
      src={src}
      alt={alt}
      draggable={false}
      onDoubleClick={onDoubleClick}
      style={{
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        transition: view.animating ? 'transform 0.22s var(--ios-ease)' : 'none',
      }}
    />
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
            <div className="dot" style={{ background: 'var(--warning)' }} />
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
