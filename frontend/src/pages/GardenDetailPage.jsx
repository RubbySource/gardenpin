// Garden detail: interactive map with pins + pin detail modal
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import PinDetail from './PinDetail.jsx';
import { toast } from '../App.jsx';
import PlantAutocomplete, { PlantInfoCard, buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import YearOverYear from '../components/YearOverYear.jsx';

export default function GardenDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [garden, setGarden] = useState(null);
  const [pins, setPins] = useState([]);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingPinAt, setAddingPinAt] = useState(null); // { x, y } in percentages
  const [editingPinId, setEditingPinId] = useState(null);
  const [editingBed, setEditingBed] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  // P3: Map toolbar state
  const [rotation, setRotation] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [upscaling, setUpscaling] = useState(false);
  // P4: Drag & drop state — používá pointer events (mouse + touch)
  const [draggingPin, setDraggingPin] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  // P5: Záhony — režim vytváření + náhled při kreslení
  const [bedMode, setBedMode] = useState(false);
  const [drawingBed, setDrawingBed] = useState(null); // { x, y, w, h } v %
  const drawStartRef = useRef(null);
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
      const [ps, bs] = await Promise.all([
        api.listPins(id),
        api.listBeds(id).catch(() => []),
      ]);
      setPins(ps);
      setBeds(bs);
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

  // P4: Drag & drop — pointer events fungují pro myš i dotyk
  const getMapPercent = (clientX, clientY) => {
    if (!mapRef.current) return { x: 0, y: 0 };
    const rect = mapRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handlePinPointerDown = (e, pin) => {
    if (bedMode) return; // V režimu kreslení záhonu pin nepřesouváme
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDraggingPin(pin);
    setDragPos({ x: pin.x, y: pin.y });
  };

  const handlePinPointerMove = (e) => {
    if (!draggingPin) return;
    setDragPos(getMapPercent(e.clientX, e.clientY));
  };

  const handlePinPointerUp = async (e) => {
    if (!draggingPin || !dragPos) {
      setDraggingPin(null);
      setDragPos(null);
      return;
    }
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
    const pin = draggingPin;
    const pos = dragPos;
    setDraggingPin(null);
    setDragPos(null);
    // Pokud se pin téměř nepohnul, otevřeme detail (chování "tap")
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
    } catch (err) {
      toast('Chyba: ' + err.message);
      load();
    }
  };

  // P5: Záhony — pointer handlery na mapě
  const handleMapPointerDown = (e) => {
    if (!garden || !garden.image_path) return;
    if (!bedMode) return;
    // Pouze primární tlačítko / dotyk
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const pos = getMapPercent(e.clientX, e.clientY);
    drawStartRef.current = pos;
    setDrawingBed({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMapPointerMove = (e) => {
    if (draggingPin) {
      setDragPos(getMapPercent(e.clientX, e.clientY));
      return;
    }
    if (!drawingBed || !drawStartRef.current) return;
    const cur = getMapPercent(e.clientX, e.clientY);
    const start = drawStartRef.current;
    const x = Math.min(start.x, cur.x);
    const y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x);
    const h = Math.abs(cur.y - start.y);
    setDrawingBed({ x, y, w, h });
  };

  const handleMapPointerUp = async (e) => {
    if (draggingPin) {
      // Pin drag uvolnění je řešeno přímo na pinu, ale pokud jsme přijeli sem (mimo pin), uložíme.
      if (dragPos) {
        const pin = draggingPin;
        const pos = dragPos;
        setDraggingPin(null);
        setDragPos(null);
        try {
          const fd = new FormData();
          fd.append('x', pos.x.toFixed(4));
          fd.append('y', pos.y.toFixed(4));
          await api.updatePin(pin.id, fd);
          setPins((prev) => prev.map((p) => (p.id === pin.id ? { ...p, x: pos.x, y: pos.y } : p)));
        } catch (err) {
          toast('Chyba: ' + err.message);
        }
      }
      return;
    }
    if (!drawingBed) return;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch {}
    const bed = drawingBed;
    setDrawingBed(null);
    drawStartRef.current = null;
    // Pokud je obdélník moc malý, ignorovat (vyhneme se omylem vytvořeným záhonům)
    if (bed.w < 2 || bed.h < 2) return;
    try {
      const nextNumber = beds.length + 1;
      const created = await api.createBed({
        garden_id: Number(id),
        name: `Záhon ${nextNumber}`,
        x: Number(bed.x.toFixed(4)),
        y: Number(bed.y.toFixed(4)),
        width: Number(bed.w.toFixed(4)),
        height: Number(bed.h.toFixed(4)),
      });
      setBeds((prev) => [...prev, created]);
      setBedMode(false);
      setEditingBed(created);
      toast('🟫 Záhon vytvořen');
    } catch (err) {
      toast('Chyba: ' + err.message);
    }
  };

  const handleMapClick = (e) => {
    if (draggingPin || drawingBed || bedMode) return;
    if (!garden || !garden.image_path) return;
    const pos = getMapPercent(e.clientX, e.clientY);
    setAddingPinAt(pos);
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
          <GardenConditionsLine garden={garden} />
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="btn ghost small"
            onClick={() => window.open(`/api/gardens/${garden.id}/season-plan?print=1`, '_blank')}
            title="Stáhnout sezónní plán jako PDF (přes tisk)"
          >
            📄 Plán PDF
          </button>
          <button className="btn ghost small" onClick={() => setShowShare(true)} title="Sdílet zahradu">
            🔗 Sdílet
          </button>
          <button className="btn ghost small" onClick={() => setShowEdit(true)}>
            ✏️ Upravit
          </button>
        </div>
      </div>

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
              {/* Záhon */}
              <button
                className={`btn ghost small${bedMode ? ' active' : ''}`}
                onClick={() => setBedMode((v) => !v)}
                style={bedMode ? { background: 'rgba(139,111,71,0.18)', border: '1px solid #8b6f47' } : {}}
                title="Vytvořit záhon (klik a táhni přes mapu)"
              >
                {bedMode ? '✋ Zrušit kreslení' : '🟫 Záhon'}
              </button>
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
              {bedMode
                ? '🟫 Klikněte a táhněte pro vytvoření záhonu.'
                : '💡 Klikněte na mapu pro přidání místa. Přetáhněte pin pro přesun.'}
            </div>
            <div
              className="map-container"
              ref={mapRef}
              onClick={handleMapClick}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={handleMapPointerUp}
              onPointerCancel={handleMapPointerUp}
              style={{
                aspectRatio: garden.image_width && garden.image_height
                  ? `${garden.image_width} / ${garden.image_height}`
                  : undefined,
                cursor: bedMode ? 'crosshair' : draggingPin ? 'grabbing' : 'crosshair',
                touchAction: bedMode || draggingPin ? 'none' : 'manipulation',
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
              {/* Záhony — vykreslujeme pod piny */}
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
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (bedMode) return;
                    setEditingBed(b);
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
              {/* Náhled kresleného záhonu */}
              {drawingBed && (
                <div
                  className="bed-rect drawing"
                  style={{
                    left: `${drawingBed.x}%`,
                    top: `${drawingBed.y}%`,
                    width: `${drawingBed.w}%`,
                    height: `${drawingBed.h}%`,
                  }}
                />
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
                    onPointerDown={(e) => handlePinPointerDown(e, p)}
                    onPointerMove={handlePinPointerMove}
                    onPointerUp={handlePinPointerUp}
                    onPointerCancel={handlePinPointerUp}
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

          {beds.length > 0 && (
            <>
              <h3 className="section-title">
                🟫 Záhony ({beds.length})
              </h3>
              <div className="bed-list">
                {beds.map((b) => (
                  <div
                    key={b.id}
                    className="bed-list-item"
                    onClick={() => setEditingBed(b)}
                  >
                    <span
                      className="bed-swatch"
                      style={{ background: b.color || '#8b6f47' }}
                    />
                    <div className="bed-list-info">
                      <div className="bed-list-name">{b.name}</div>
                      <div className="bed-list-meta small muted">
                        {b.width_m && b.height_m
                          ? `${b.width_m} × ${b.height_m} m`
                          : `${b.width.toFixed(1)} × ${b.height.toFixed(1)} %`}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-dim)' }}>›</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="section-title">
            📍 Místa v zahradě ({pins.length})
          </h3>
          {pins.length === 0 ? (
            <div className="card empty small">
              Zatím žádná místa. Klikněte na mapu výše pro přidání.
            </div>
          ) : (
            pins.map((p) => (
              <PlantRow
                key={p.id}
                pin={p}
                onOpen={() => setEditingPinId(p.id)}
                onPhotoUpdated={(photoPath) =>
                  setPins((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, photo_path: photoPath } : x)),
                  )
                }
              />
            ))
          )}

          {/* Meziroční srovnání péče v této zahradě */}
          <YearOverYear gardenId={garden.id} title={`Meziroční srovnání · ${garden.name}`} />
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

      {showShare && (
        <ShareGardenModal
          garden={garden}
          onClose={() => setShowShare(false)}
        />
      )}

      {editingBed && (
        <BedEditModal
          bed={editingBed}
          onClose={() => setEditingBed(null)}
          onSaved={(b) => {
            setBeds((prev) => prev.map((x) => (x.id === b.id ? b : x)));
            setEditingBed(null);
          }}
          onDeleted={(bedId) => {
            setBeds((prev) => prev.filter((x) => x.id !== bedId));
            setEditingBed(null);
          }}
        />
      )}
    </>
  );
}

function BedEditModal({ bed, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(bed.name || 'Záhon');
  const [widthM, setWidthM] = useState(bed.width_m ?? '');
  const [heightM, setHeightM] = useState(bed.height_m ?? '');
  const [color, setColor] = useState(bed.color || '#8b6f47');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Zadejte název záhonu');
    setSaving(true);
    try {
      const updated = await api.updateBed(bed.id, {
        name: name.trim(),
        width_m: widthM === '' ? null : Number(widthM),
        height_m: heightM === '' ? null : Number(heightM),
        color,
      });
      toast('✅ Uloženo');
      onSaved(updated);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Smazat záhon? Piny zůstanou.')) return;
    try {
      await api.deleteBed(bed.id);
      toast('🗑️ Záhon smazán');
      onDeleted(bed.id);
    } catch (err) {
      toast('Chyba: ' + err.message);
    }
  };

  return (
    <Modal title="🟫 Upravit záhon" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Název</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Záhon u plotu"
            autoFocus
          />
        </div>
        <div className="field row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Šířka (m)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={widthM}
              onChange={(e) => setWidthM(e.target.value)}
              placeholder="2.0"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Délka (m)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={heightM}
              onChange={(e) => setHeightM(e.target.value)}
              placeholder="3.0"
            />
          </div>
        </div>
        <div className="field">
          <label>Barva</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn danger ghost small" onClick={remove}>
            🗑️ Smazat
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              Zrušit
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ShareGardenModal({ garden, onClose }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .createShareToken(garden.id)
      .then((r) => { if (!cancelled) setToken(r.token); })
      .catch((e) => { if (!cancelled) toast('Chyba: ' + e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [garden.id]);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : '';

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast('📋 Odkaz zkopírován');
      } else {
        // Fallback — vybrat text
        const input = document.getElementById('share-url-input');
        input?.select();
        document.execCommand('copy');
        toast('📋 Odkaz zkopírován');
      }
    } catch (e) {
      toast('Nelze kopírovat: ' + e.message);
    }
  };

  const revoke = async () => {
    if (!confirm('Zrušit sdílení? Odkaz přestane fungovat.')) return;
    setRevoking(true);
    try {
      await api.revokeShareToken(garden.id);
      toast('🔒 Sdílení zrušeno');
      onClose();
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Modal title="🔗 Sdílet zahradu" onClose={onClose}>
      {loading ? (
        <div className="empty small">Načítám…</div>
      ) : (
        <>
          <div className="small muted mb-2">
            Kdokoliv s tímto odkazem uvidí vaši zahradu, rostliny a nadcházející úkony.
            Bez možnosti úprav.
          </div>
          <div className="field">
            <label>Veřejný odkaz</label>
            <input
              id="share-url-input"
              type="text"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </div>
          <div className="row mt-2" style={{ gap: 8 }}>
            <button type="button" className="btn" onClick={copy}>
              📋 Zkopírovat
            </button>
            <a
              className="btn secondary"
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              👁️ Otevřít náhled
            </a>
          </div>
          <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn danger ghost small"
              onClick={revoke}
              disabled={revoking}
            >
              {revoking ? 'Ruším…' : '🔒 Zrušit sdílení'}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Zavřít
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function PlantRow({ pin, onOpen, onPhotoUpdated }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleFile = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Nelze načíst soubor'));
        r.readAsDataURL(file);
      });
      const out = await api.setPinPhoto(pin.id, dataUrl);
      onPhotoUpdated(out.photo_path);
      toast('✅ Fotka uložena');
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openPicker = (e) => {
    e.stopPropagation();
    fileRef.current?.click();
  };

  return (
    <div className="garden-card" onClick={onOpen}>
      {pin.photo_path ? (
        <img src={pin.photo_path} alt="" className="plant-avatar" />
      ) : (
        <div
          className="plant-avatar plant-avatar-placeholder"
          style={{ background: (pin.color || '#4a7c3a') + '22', color: pin.color || '#4a7c3a' }}
        >
          🌿
        </div>
      )}
      <div className="details">
        <div className="name">{pin.name}</div>
        {pin.plant_name && <div className="meta">🌿 {pin.plant_name}</div>}
        {pin.planting_date && (
          <div className="meta">
            📅 Vysazeno {new Date(pin.planting_date).toLocaleDateString('cs-CZ')}
          </div>
        )}
        <button
          type="button"
          className="btn ghost small mt-1"
          onClick={openPicker}
          disabled={uploading}
        >
          {uploading ? '⏳ Nahrávám…' : pin.photo_path ? '📷 Změnit foto' : '📷 Přidat foto'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
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

const EXPOSURE_LABELS = {
  N: '⬆️ sever',
  S: '⬇️ jih',
  E: '➡️ východ',
  W: '⬅️ západ',
  mixed: '🧭 smíšená',
};

function GardenConditionsLine({ garden }) {
  const parts = [];
  if (garden.soil_type) parts.push(`🪴 ${garden.soil_type}`);
  if (garden.exposure && EXPOSURE_LABELS[garden.exposure]) parts.push(EXPOSURE_LABELS[garden.exposure]);
  if (garden.altitude_m) parts.push(`⛰️ ${garden.altitude_m} m`);
  if (parts.length === 0) return null;
  return (
    <div className="small muted" style={{ marginTop: 4 }}>
      {parts.join(' · ')}
    </div>
  );
}

function EditGardenModal({ garden, onClose, onSaved, onDelete, onMapUpload, uploading }) {
  const [name, setName] = useState(garden.name);
  const [soilType, setSoilType] = useState(garden.soil_type || '');
  const [exposure, setExposure] = useState(garden.exposure || '');
  const [altitudeM, setAltitudeM] = useState(garden.altitude_m ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('soil_type', soilType.trim());
      fd.append('exposure', exposure);
      fd.append('altitude_m', altitudeM === '' ? '' : String(altitudeM));
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
          <label>🌍 Pěstební podmínky</label>
          <div className="small muted mb-2">
            Ovlivňují doporučené termíny úkonů (chladná/teplá poloha posune kalendář).
          </div>
        </div>

        <div className="field">
          <label>Typ půdy</label>
          <input
            type="text"
            value={soilType}
            placeholder="např. hlinitá, písčitá, jílovitá…"
            onChange={(e) => setSoilType(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="field">
          <label>Expozice (orientace)</label>
          <select value={exposure} onChange={(e) => setExposure(e.target.value)}>
            <option value="">— neuvedeno —</option>
            <option value="N">⬆️ Sever</option>
            <option value="S">⬇️ Jih</option>
            <option value="E">➡️ Východ</option>
            <option value="W">⬅️ Západ</option>
            <option value="mixed">🧭 Smíšená</option>
          </select>
        </div>

        <div className="field">
          <label>Nadmořská výška (m)</label>
          <input
            type="number"
            min="0"
            max="3000"
            step="10"
            value={altitudeM}
            placeholder="např. 350"
            onChange={(e) => setAltitudeM(e.target.value === '' ? '' : Number(e.target.value))}
          />
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
