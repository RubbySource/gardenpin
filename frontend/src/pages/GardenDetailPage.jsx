// Garden detail: interactive map with pins + pin detail modal
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import PinDetail from './PinDetail.jsx';
import { toast } from '../App.jsx';
import PlantAutocomplete, { PlantInfoCard, buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import WeatherWidget from '../components/WeatherWidget.jsx';

export default function GardenDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [garden, setGarden] = useState(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingPinAt, setAddingPinAt] = useState(null); // { x, y } in percentages
  const [editingPinId, setEditingPinId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  // P3: Map toolbar state
  const [rotation, setRotation] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [upscaling, setUpscaling] = useState(false);
  // P4: Drag & drop state
  const [draggingPin, setDraggingPin] = useState(null); // { pin, startX, startY }
  const [dragPos, setDragPos] = useState(null); // { x%, y% }
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
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // P3: Upscale 4×
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

  // P3: Uložit rotaci
  const handleRotationChange = async (newRot) => {
    setRotation(newRot);
    try {
      const fd = new FormData();
      fd.append('rotation', newRot);
      await api.updateGarden(garden.id, fd);
    } catch {}
  };

  // P4: Drag & drop
  const handlePinMouseDown = (e, pin) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingPin(pin);
    setDragPos({ x: pin.x, y: pin.y });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!draggingPin || !mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setDragPos({ x, y });
    },
    [draggingPin],
  );

  const handleMouseUp = useCallback(async () => {
    if (!draggingPin || !dragPos) {
      setDraggingPin(null);
      setDragPos(null);
      return;
    }
    const pin = draggingPin;
    const pos = dragPos;
    setDraggingPin(null);
    setDragPos(null);
    // Pokud se pin téměř nepohnul, otevřeme detail
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

  const handleMapClick = (e) => {
    if (draggingPin) return; // Ignorovat click při drag
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
      // Need dimensions for aspect ratio preservation
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
      <div className="row spread mb-2">
        <div>
          <div style={{ fontSize: '0.85rem' }}>
            <button className="btn ghost small" onClick={() => nav('/zahrady')}>
              ← Zpět
            </button>
          </div>
          <h2 className="section-title" style={{ margin: '4px 0 0' }}>
            🗺️ {garden.name}
          </h2>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost small" onClick={handleShare} title="Sdílet zahradu veřejným odkazem">
            🔗 Sdílet
          </button>
          <button className="btn ghost small" onClick={() => setShowEdit(true)}>
            ✏️ Upravit
          </button>
        </div>
      </div>

      <WeatherWidget />

      {!garden.image_path ? (
        <div className="card">
          <div className="empty">
            <div className="icon">🖼️</div>
            <div className="mb-2">Nahrajte fotku zahrady z leteckého pohledu</div>
            <label className="btn">
              📷 Nahrát fotku
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUploadMap}
              />
            </label>
          </div>
        </div>
      ) : (
        <>
          {/* P3: Toolbar nad mapou */}
          <div className="card" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Rotace */}
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
              {/* Mřížka */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className={`btn ghost small${showGrid ? ' active' : ''}`}
                  onClick={() => setShowGrid((v) => !v)}
                  style={showGrid ? { background: 'rgba(74,124,58,0.15)', border: '1px solid #4a7c3a' } : {}}
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
              {/* Upscale */}
              <button
                className="btn ghost small"
                onClick={handleUpscale}
                disabled={upscaling}
                title="Zvětšit rozlišení 4× (bicubic)"
              >
                {upscaling ? '⏳' : '🔍'} Upscale 4×
              </button>
            </div>
          </div>

          <div className="card">
            <div className="small muted mb-2">
              💡 Klikněte na mapu pro přidání místa. Přetáhněte pin pro přesun.
            </div>
            <div
              className="map-container"
              ref={mapRef}
              onClick={handleMapClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                aspectRatio: garden.image_width && garden.image_height
                  ? `${garden.image_width} / ${garden.image_height}`
                  : undefined,
                cursor: draggingPin ? 'grabbing' : 'crosshair',
              }}
            >
              <img
                src={garden.image_path}
                alt={garden.name}
                className="map-image"
                draggable={false}
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              {/* P3: SVG mřížka overlay */}
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
                    }}
                    onMouseDown={(e) => handlePinMouseDown(e, p)}
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

          <h3 className="section-title">
            📍 Místa v zahradě ({pins.length})
          </h3>
          {pins.length === 0 ? (
            <div className="card empty small">
              Zatím žádná místa. Klikněte na mapu výše pro přidání.
            </div>
          ) : (
            pins.map((p) => (
              <div
                key={p.id}
                className="garden-card"
                onClick={() => setEditingPinId(p.id)}
              >
                {p.photo_path ? (
                  <img src={p.photo_path} alt="" className="thumb" />
                ) : (
                  <div
                    className="thumb thumb-placeholder"
                    style={{ background: (p.color || '#4a7c3a') + '33', color: p.color || '#4a7c3a' }}
                  >
                    🌱
                  </div>
                )}
                <div className="details">
                  <div className="name">{p.name}</div>
                  {p.plant_name && <div className="meta">🌿 {p.plant_name}</div>}
                  {p.planting_date && (
                    <div className="meta">
                      📅 Vysazeno {new Date(p.planting_date).toLocaleDateString('cs-CZ')}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '1.4rem', color: 'var(--text-dim)' }}>›</span>
              </div>
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

      // Auto-vytvoř úkoly z databáze rostlin (pravidelné) + sezónní úkoly z vybraných chipů
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
    <Modal title="Nové místo v zahradě" onClose={onClose}>
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
          <button type="submit" className="btn" disabled={saving}>
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
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
