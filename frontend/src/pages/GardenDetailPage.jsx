// Garden detail: interactive map with pins + pin detail modal — GardenPin design
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import PinDetail from './PinDetail.jsx';
import { toast } from '../App.jsx';
import PlantAutocomplete, { PlantInfoCard, buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';
import { findPlantByName } from '../plantDatabase.js';

export default function GardenDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [garden, setGarden] = useState(null);
  const [pins, setPins] = useState([]);
  const [taskCounts, setTaskCounts] = useState({}); // { pinId: count }
  const [loading, setLoading] = useState(true);
  const [addingPinAt, setAddingPinAt] = useState(null);
  const [editingPinId, setEditingPinId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [upscaling, setUpscaling] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [draggingPin, setDraggingPin] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const mapRef = useRef();

  const load = async () => {
    try {
      const gardens = await api.listGardens();
      const g = gardens.find((x) => x.id === parseInt(id));
      if (!g) {
        toast('Zahrada nenalezena');
        nav('/zahrady');
        return;
      }
      setGarden(g);
      setRotation(g.rotation || 0);
      const ps = await api.listPins(id);
      setPins(ps);
      // Spočítej úkoly per pin (paralelní jeden fetch /api/tasks)
      try {
        const allTasks = await api.listTasks();
        const counts = {};
        for (const t of allTasks) counts[t.pin_id] = (counts[t.pin_id] || 0) + 1;
        setTaskCounts(counts);
      } catch {}
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleUpscale = async () => {
    if (!confirm('Upscale 4× – zpracuje obrázek serverstranně (bicubic). Pokračovat?')) return;
    setUpscaling(true);
    try {
      const res = await fetch(`/api/gardens/${garden.id}/upscale`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Chyba');
      const updated = await res.json();
      setGarden(updated);
      toast('✅ Upscale hotov');
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setUpscaling(false);
    }
  };

  const handleRotationChange = async (newRot) => {
    setRotation(newRot);
    try {
      const fd = new FormData();
      fd.append('rotation', newRot);
      await api.updateGarden(garden.id, fd);
    } catch {}
  };

  // P4: Drag & drop
  const handlePinPointerDown = (pin) => {
    setDraggingPin(pin);
    setDragPos({ x: pin.x, y: pin.y });
  };

  const handlePinMouseDown = (e, pin) => {
    e.preventDefault();
    e.stopPropagation();
    handlePinPointerDown(pin);
  };

  const handlePinTouchStart = (e, pin) => {
    e.stopPropagation();
    handlePinPointerDown(pin);
  };

  const updateDragPosFromPoint = useCallback((clientX, clientY) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setDragPos({ x, y });
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!draggingPin) return;
      updateDragPosFromPoint(e.clientX, e.clientY);
    },
    [draggingPin, updateDragPosFromPoint],
  );

  const finishDrag = useCallback(async () => {
    if (!draggingPin || !dragPos) {
      setDraggingPin(null);
      setDragPos(null);
      return;
    }
    const pin = draggingPin;
    const pos = dragPos;
    setDraggingPin(null);
    setDragPos(null);
    const dx = Math.abs(pos.x - pin.x);
    const dy = Math.abs(pos.y - pin.y);
    if (dx < 0.5 && dy < 0.5) {
      setEditingPinId(pin.id);
      return;
    }
    try {
      const fd = new FormData();
      fd.append('x', pos.x.toFixed(4));
      fd.append('y', pos.y.toFixed(4));
      await api.updatePin(pin.id, fd);
      setPins((prev) => prev.map((p) => (p.id === pin.id ? { ...p, x: pos.x, y: pos.y } : p)));
      toast('📍 Přesunuto');
    } catch (e) {
      toast('Chyba: ' + e.message);
      load();
    }
  }, [draggingPin, dragPos]);

  // Touch drag: nativní listener s passive:false, aby preventDefault zablokoval scroll na iOS/Androidu
  useEffect(() => {
    if (!draggingPin) return;
    const el = mapRef.current;
    if (!el) return;
    const onTouchMove = (e) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      updateDragPosFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => {
      finishDrag();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [draggingPin, updateDragPosFromPoint, finishDrag]);

  const handleMapClick = (e) => {
    if (draggingPin) return;
    if (!garden || !garden.image_path) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setAddingPinAt({ x, y });
  };

  const handleUploadMap = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMap(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((res) => (img.onload = res));
      fd.append('width', img.naturalWidth);
      fd.append('height', img.naturalHeight);
      URL.revokeObjectURL(img.src);
      const updated = await api.updateGarden(garden.id, fd);
      setGarden(updated);
      toast('✅ Mapa nahrána');
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setUploadingMap(false);
    }
  };

  const handleShare = async () => {
    try {
      const { shareUrl } = await api.shareGarden(garden.id);
      const fullUrl = window.location.origin + shareUrl;
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast('🔗 Odkaz zkopírován!');
      } catch {
        toast('🔗 ' + fullUrl);
      }
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Opravdu smazat tuto zahradu se všemi piny a úkoly?')) return;
    try {
      await api.deleteGarden(id);
      toast('Zahrada smazána');
      nav('/zahrady');
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  if (loading) return <div className="empty">Načítám...</div>;
  if (!garden) return <div className="empty">Zahrada nenalezena</div>;

  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="heading">
          <button
            className="btn ghost small"
            onClick={() => nav('/zahrady')}
            style={{ padding: '4px 8px', minHeight: 'auto', marginBottom: 6 }}
          >
            ← Zahrady
          </button>
          <h1 style={{ fontSize: '1.5rem' }}>{garden.name}</h1>
          <div className="subtitle">
            {pins.length} {pins.length === 1 ? 'rostlina' : pins.length < 5 ? 'rostliny' : 'rostlin'}
            {' · '}
            Vytvořeno {new Date(garden.created_at + 'Z').toLocaleDateString('cs-CZ')}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost small" onClick={handleShare} title="Sdílet zahradu veřejným odkazem">
            🔗 Sdílet
          </button>
          <a
            className="btn ghost small"
            href={`/api/ical/${garden.id}`}
            title="Stáhnout .ics s ročně se opakujícími úkoly"
          >
            📅 Exportovat do kalendáře
          </a>
          <button
            className="btn ghost small"
            onClick={() => setShowEdit(true)}
            title="Upravit zahradu"
          >
            ✏️ Upravit
          </button>
          {garden.image_path && (
            <button
              className="btn-cta"
              style={{ padding: '10px 14px', minHeight: 44 }}
              onClick={() => {
                if (mapRef.current) mapRef.current.scrollIntoView({ behavior: 'smooth' });
                toast('💡 Klikněte na mapu pro přidání rostliny');
              }}
            >
              + Rostlina
            </button>
          )}
        </div>
      </div>

      <WeatherWidget />

      {!garden.image_path ? (
        <div className="gp-empty">
          <span className="gp-empty-icon">🖼️</span>
          <div className="gp-empty-title">Nahrajte fotku zahrady</div>
          <div className="gp-empty-text">
            Letecký pohled, screenshot z Map.cz, ručně nakreslený plánek — cokoliv, co vám pomůže
            orientovat se v zahradě.
          </div>
          <label className="btn-cta">
            📷 Nahrát fotku
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadMap}
            />
          </label>
        </div>
      ) : (
        <>
          {/* Toolbar nad mapou — sbalitelný */}
          <div className="gp-toolbar">
            <button
              type="button"
              onClick={() => setShowToolbar((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--charcoal)',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              <span>🛠️ Nástroje mapy</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 500 }}>
                {showToolbar ? 'Skrýt ▴' : `Rotace ${rotation}° · ${showGrid ? 'mřížka' : 'bez mřížky'} ▾`}
              </span>
            </button>
            {showToolbar && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--sand-dark)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>🔄 {rotation}°</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={rotation}
                    onChange={(e) => handleRotationChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn ghost small"
                    onClick={() => handleRotationChange((rotation - 90 + 360) % 360)}
                    title="-90°"
                  >
                    ↺
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => handleRotationChange((rotation + 90) % 360)}
                    title="+90°"
                  >
                    ↻
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => handleRotationChange(0)}
                    title="Reset"
                  >
                    ⊙
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className="btn ghost small"
                    onClick={() => setShowGrid((v) => !v)}
                    style={
                      showGrid
                        ? { background: 'rgba(45,90,39,0.12)', border: '1px solid var(--primary)' }
                        : {}
                    }
                  >
                    ⊞ Mřížka
                  </button>
                  {showGrid && (
                    <input
                      type="range"
                      min="20"
                      max="150"
                      step="5"
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      style={{ width: 70 }}
                      title={`${gridSize}px`}
                    />
                  )}
                </div>
                <button
                  className="btn ghost small"
                  onClick={handleUpscale}
                  disabled={upscaling}
                  title="Zvětšit rozlišení 4× (bicubic)"
                >
                  {upscaling ? '⏳' : '🔍'} Upscale 4×
                </button>
              </div>
            )}
          </div>

          <div className="gp-map-frame">
            <div className="map-hint">
              💡 Klikněte na mapu pro přidání rostliny · přetáhněte pin pro přesun
            </div>
            <div
              className="map-container"
              ref={mapRef}
              onClick={handleMapClick}
              onMouseMove={handleMouseMove}
              onMouseUp={finishDrag}
              onMouseLeave={finishDrag}
              style={{
                aspectRatio: garden.image_width && garden.image_height
                  ? `${garden.image_width} / ${garden.image_height}`
                  : undefined,
                cursor: draggingPin ? 'grabbing' : 'crosshair',
                touchAction: draggingPin ? 'none' : 'auto',
              }}
            >
              <img
                src={garden.image_path}
                alt={garden.name}
                className="map-image"
                draggable={false}
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              {showGrid && (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                >
                  <defs>
                    <pattern
                      id="grid"
                      width={gridSize}
                      height={gridSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke="rgba(74,124,58,0.35)"
                        strokeWidth="0.8"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}
              {pins.map((p) => {
                const isDragging = draggingPin?.id === p.id;
                const pos = isDragging && dragPos ? dragPos : { x: p.x, y: p.y };
                return (
                  <div
                    key={p.id}
                    className="pin"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      zIndex: isDragging ? 50 : 10,
                      userSelect: 'none',
                      touchAction: 'none',
                    }}
                    onMouseDown={(e) => handlePinMouseDown(e, p)}
                    onTouchStart={(e) => handlePinTouchStart(e, p)}
                    onClick={(e) => e.stopPropagation()}
                    title={p.name}
                  >
                    <div className="pin-body" style={{ background: p.color || '#4a7c3a' }} />
                    <div className="pin-label">{p.name}</div>
                  </div>
                );
              })}
              {addingPinAt && (
                <div
                  className="pin new"
                  style={{ left: `${addingPinAt.x}%`, top: `${addingPinAt.y}%` }}
                >
                  <div className="pin-body" />
                </div>
              )}
            </div>
          </div>

          <div className="gp-section">
            <div className="gp-section-title">📍 Rostliny v zahradě</div>
            <span className="gp-section-count">{pins.length}</span>
          </div>
          {pins.length === 0 ? (
            <div className="gp-empty" style={{ padding: '24px 16px' }}>
              <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🌱</span>
              <div className="gp-empty-title">Zatím žádná rostlina</div>
              <div className="gp-empty-text">
                Klikněte na mapu výše a přidejte první rostlinu.
              </div>
            </div>
          ) : (
            pins.map((p) => (
              <PinRow
                key={p.id}
                pin={p}
                taskCount={taskCounts[p.id] || 0}
                onClick={() => setEditingPinId(p.id)}
              />
            ))
          )}
        </>
      )}

      {addingPinAt && (
        <NewPinModal
          gardenId={garden.id}
          x={addingPinAt.x}
          y={addingPinAt.y}
          onClose={() => setAddingPinAt(null)}
          onCreated={() => {
            setAddingPinAt(null);
            load();
          }}
        />
      )}

      {editingPinId && (
        <PinDetail
          pinId={editingPinId}
          onClose={() => {
            setEditingPinId(null);
            load();
          }}
        />
      )}

      {showEdit && (
        <EditGardenModal
          garden={garden}
          onClose={() => setShowEdit(false)}
          onSaved={(g) => {
            setGarden(g);
            setShowEdit(false);
            toast('✅ Uloženo');
          }}
          onDelete={handleDelete}
          onMapUpload={handleUploadMap}
          uploading={uploadingMap}
        />
      )}
    </>
  );
}

// Karta pinu v listu pod mapou — GardenPin styl: thumb, jméno, kategorie, počet úkolů
function PinRow({ pin, taskCount, onClick }) {
  // Najdi rostlinu v databázi pro kategorii badge
  const plant = useMemo(
    () => (pin.plant_name ? findPlantByName(pin.plant_name) : null),
    [pin.plant_name],
  );
  const cat = plant?.category;
  const color = pin.color || '#4a7c3a';

  return (
    <div className="gp-pin-row" onClick={onClick}>
      {pin.photo_path ? (
        <img src={pin.photo_path} alt="" className="gp-pin-thumb" />
      ) : (
        <div
          className="gp-pin-thumb"
          style={{ background: (cat?.color || color) + '22', color: cat?.color || color }}
        >
          {cat?.icon || '🌱'}
        </div>
      )}
      <div className="gp-pin-info">
        <div className="gp-pin-name">{pin.name}</div>
        <div className="gp-pin-meta">
          {pin.plant_name && <span>🌿 {pin.plant_name}</span>}
          {pin.planting_date && (
            <span>📅 {new Date(pin.planting_date).toLocaleDateString('cs-CZ')}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {cat && (
            <span
              className="gp-chip"
              style={{ background: cat.color + '22', color: cat.color, borderColor: 'transparent' }}
            >
              {cat.icon} {cat.label}
            </span>
          )}
          {taskCount > 0 && (
            <span className="gp-chip week">
              ✓ {taskCount} {taskCount === 1 ? 'úkol' : taskCount < 5 ? 'úkoly' : 'úkolů'}
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: '1.4rem', color: 'var(--text-dim)' }}>›</span>
    </div>
  );
}

function NewPinModal({ gardenId, x, y, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [plantName, setPlantName] = useState('');
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedCare, setSelectedCare] = useState(() => new Set());
  const [plantingDate, setPlantingDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState('#4a7c3a');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Zadejte název místa');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('garden_id', gardenId);
      fd.append('name', name);
      fd.append('x', x);
      fd.append('y', y);
      fd.append('plant_name', plantName);
      fd.append('planting_date', plantingDate);
      fd.append('notes', notes);
      fd.append('color', color);
      if (file) fd.append('photo', file);
      const pin = await api.createPin(fd);

      const promises = [];
      let dbCount = 0;
      let seasonalCount = 0;
      if (selectedPlant && pin?.id) {
        if (selectedPlant.tasks?.length) {
          dbCount = selectedPlant.tasks.length;
          selectedPlant.tasks.forEach((t) => {
            promises.push(
              fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  pin_id: pin.id,
                  title: t.title,
                  task_type: t.task_type,
                  frequency_days: t.frequency_days ?? null,
                  specific_date: t.specific_date ?? null,
                  notes: t.notes ?? null,
                }),
              }),
            );
          });
        }
        const seasonal = buildSeasonalTaskPayloads(selectedPlant, selectedCare, pin.id);
        seasonalCount = seasonal.length;
        seasonal.forEach((payload) => {
          promises.push(
            fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }),
          );
        });
      }
      if (promises.length) {
        await Promise.all(promises);
        const parts = [];
        if (dbCount) parts.push(`${dbCount} pravidelných`);
        if (seasonalCount) parts.push(`${seasonalCount} sezónních`);
        toast(`✅ Místo přidáno + ${parts.join(' + ')} úkolů`);
      } else {
        toast('✅ Místo přidáno');
      }
      onCreated();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nová rostlina v zahradě" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Název místa *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Záhon u plotu"
            autoFocus
          />
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
              onSelectionChange={setSelectedCare}
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
            placeholder="Poznámky o péči, osivo, zdroj..."
          />
        </div>
        <div className="field">
          <label>Barva pinu</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="field">
          <label>Fotka rostliny (volitelné)</label>
          <div className="file-input-wrap" onClick={() => fileRef.current?.click()}>
            {file ? (
              <div className="small">📎 {file.name}</div>
            ) : (
              <>
                <div style={{ fontSize: '1.6rem' }}>📷</div>
                <div className="small muted">Klikněte pro nahrání</div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </div>
        </div>
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn-cta" disabled={saving}>
            {saving ? 'Ukládám...' : 'Vytvořit místo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditGardenModal({ garden, onClose, onSaved, onDelete, onMapUpload, uploading }) {
  const [name, setName] = useState(garden.name);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      const g = await api.updateGarden(garden.id, fd);
      onSaved(g);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Upravit zahradu" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Název</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Nahrát novou mapu</label>
          <label className="btn secondary block">
            {uploading ? 'Nahrávám...' : '📷 Vybrat novou fotku zahrady'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onMapUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <div className="row mt-3">
          <button type="button" className="btn danger" onClick={onDelete}>
            🗑️ Smazat zahradu
          </button>
          <button type="submit" className="btn-cta" disabled={saving}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
