// Garden detail: interactive map with pins + pin detail modal
// (climate zones: per-region seasonal task shifting)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import i18n from '../i18n.js';
import { formatDate } from '../utils.js';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import PinDetail from './PinDetail.jsx';
import MembersModal from '../components/MembersModal.jsx';
import BulkCareModal from '../components/BulkCareModal.jsx';
import SeasonMomentModal from '../components/SeasonMomentModal.jsx';
import { toast } from '../App.jsx';
import PlantAutocomplete, { PlantInfoCard, buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import YearOverYear from '../components/YearOverYear.jsx';
import RotationCard from '../components/RotationCard.jsx';
import WinterPrepCard from '../components/WinterPrepCard.jsx';
import GreenManureCard from '../components/GreenManureCard.jsx';
import SoilPhCard from '../components/SoilPhCard.jsx';
import RotationPlantWarning from '../components/RotationPlantWarning.jsx';
import { COUNTRIES, getZonesByCountry, getClimateZone, describeZone } from '../data/climateZones.js';
import { ICAL_CATEGORIES } from '../data/taskTypes.js';
import { shareLink, isNativeShare } from '../native/share.js';
import { openPhotoPicker } from '../native/camera.js';
import PolygonEditor, {
  isPointInPolygon,
  DEFAULT_POLYGON_POINTS,
  polygonAreaFraction,
} from '../components/PolygonEditor.jsx';

// Otevře Google Maps v satelitním pohledu (parametr t=k). Bez API klíče.
function openSatelliteView(address) {
  const trimmed = (address || '').trim();
  const url = trimmed
    ? `https://www.google.com/maps?q=${encodeURIComponent(trimmed)}&t=k`
    : 'https://www.google.com/maps?t=k';
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Parsuje JSON string s body polygonu, vrátí pole nebo null.
function parsePolygon(json) {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length >= 3) return arr;
  } catch {}
  return null;
}

export default function GardenDetailPage() {
  const { t } = useTranslation();
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showBulkCare, setShowBulkCare] = useState(false);
  const [showSeasonMoment, setShowSeasonMoment] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const mapInputRef = useRef(null);
  // Redesign: segmented control (Mapa / Seznam / Statistiky) + akční menu v hlavičce
  const [tab, setTab] = useState('map'); // 'map' | 'list' | 'stats'
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
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
  // Vnitřní wrapper kolem fotky — když je aktivní polygon editor, zmenší se na 84 %
  // a vytvoří odsazení okolo fotky, aby rohové body šly chytit prsty.
  const mapStageRef = useRef();
  // P6: Polygon editor — režim ohraničení zahrady + ad-hoc adresa pro satelit
  const [polygonMode, setPolygonMode] = useState(false);
  const [croppingPolygon, setCroppingPolygon] = useState(false);
  const [adhocAddress, setAdhocAddress] = useState('');
  // Body polygonu drží rodič — tlačítka jsou MIMO mapu (v normálním flow),
  // takže musí mít přístup ke stavu.
  const [polygonPoints, setPolygonPoints] = useState(null);
  // Lifted selection + undo stack — toolbar pod mapou s nimi pracuje.
  // Snapshot pushuje editor PŘED každou diskrétní změnou (drag start, add,
  // delete) a toolbar je pak schopen vrátit krok zpět. Max 10 snapshotů.
  const [polygonSelectedIdx, setPolygonSelectedIdx] = useState(null);
  const [polygonUndoStack, setPolygonUndoStack] = useState([]);

  const load = async () => {
    try {
      const gardens = await api.listGardens();
      const g = gardens.find((x) => x.id === parseInt(id));
      if (!g) {
        toast(t('gardenDetail.gardenNotFound'));
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
      toast(t('common.error', { msg: e.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // P3: Upscale 4×
  const handleUpscale = async () => {
    if (!confirm(t('gardenDetail.upscaleConfirm'))) return;
    setUpscaling(true);
    try {
      const res = await fetch(`/api/gardens/${garden.id}/upscale`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Chyba');
      const updated = await res.json();
      setGarden(updated);
      toast(t('gardenDetail.upscaleDone'));
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
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
    if (bedMode || polygonMode) return; // V režimu kreslení záhonu / polygonu pin nepřesouváme
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
      toast(t('gardenDetail.pinMoved'));
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
      load();
    }
  };

  // P5: Záhony — pointer handlery na mapě
  const handleMapPointerDown = (e) => {
    if (!garden || !garden.image_path) return;
    if (polygonMode) return; // V režimu polygonu mapa neovládá nic
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
          toast(t('common.error', { msg: err.message }));
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
        name: t('gardenDetail.bedDefaultName', { number: nextNumber }),
        x: Number(bed.x.toFixed(4)),
        y: Number(bed.y.toFixed(4)),
        width: Number(bed.w.toFixed(4)),
        height: Number(bed.h.toFixed(4)),
      });
      setBeds((prev) => [...prev, created]);
      setBedMode(false);
      setEditingBed(created);
      toast(t('gardenDetail.bedCreated'));
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    }
  };

  const handleMapClick = (e) => {
    if (draggingPin || drawingBed || bedMode || polygonMode) return;
    if (!garden || !garden.image_path) return;
    const pos = getMapPercent(e.clientX, e.clientY);
    // Pokud má zahrada ohraničení, povol pin jen uvnitř
    const poly = parsePolygon(garden.garden_polygon);
    if (poly && !isPointInPolygon(pos, poly)) {
      toast(t('gardenDetail.pinInsideGarden'));
      return;
    }
    setAddingPinAt(pos);
  };

  // P6: Crop podle polygonu
  const handleCropPolygon = async (points) => {
    if (!points || points.length < 3) return;
    setCroppingPolygon(true);
    try {
      const res = await fetch(`/api/gardens/${garden.id}/crop-polygon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Chyba');
      const updated = await res.json();
      setGarden(updated);
      setPolygonMode(false);
      toast(t('gardenDetail.gardenCropped'));
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setCroppingPolygon(false);
    }
  };

  // Odvozené měřítko z prvního záhonu, který má rozměry v metrech (orientačně pro m²)
  const scaleHints = (() => {
    const bed = beds.find((b) => b.width_m && b.height_m && b.width && b.height);
    if (!bed) return { x: 0, y: 0 };
    return {
      x: bed.width_m / bed.width, // m na 1 % šířky mapy
      y: bed.height_m / bed.height, // m na 1 % výšky mapy
    };
  })();

  // Inicializace bodů polygonu při zapnutí editoru (existující polygon nebo defaultní 4 body)
  useEffect(() => {
    if (polygonMode) {
      setPolygonPoints(parsePolygon(garden?.garden_polygon) || DEFAULT_POLYGON_POINTS);
    } else {
      setPolygonPoints(null);
    }
    setPolygonSelectedIdx(null);
    setPolygonUndoStack([]);
  }, [polygonMode, garden?.garden_polygon]);

  // Snapshot — editor volá PŘED každou změnou (drag-start, add midpoint).
  // Stejnou funkci volá toolbar před add/remove/reset, ať undo funguje konzistentně.
  const pushPolygonSnapshot = () => {
    setPolygonUndoStack((prev) => {
      if (!polygonPoints) return prev;
      return [polygonPoints, ...prev].slice(0, 10);
    });
  };

  const handlePolygonUndo = () => {
    setPolygonUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      setPolygonPoints(head);
      setPolygonSelectedIdx(null);
      return rest;
    });
  };

  // Přidá bod uprostřed mezi vybraným bodem a jeho následníkem.
  // Pokud žádný bod není vybraný, přidá za poslední (cyklicky mezi N-1 a 0).
  const handlePolygonAdd = () => {
    if (!polygonPoints) return;
    pushPolygonSnapshot();
    const i = polygonSelectedIdx ?? (polygonPoints.length - 1);
    const a = polygonPoints[i];
    const b = polygonPoints[(i + 1) % polygonPoints.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...polygonPoints];
    next.splice(i + 1, 0, mid);
    setPolygonPoints(next);
    setPolygonSelectedIdx(i + 1);
  };

  const handlePolygonRemove = () => {
    if (!polygonPoints) return;
    if (polygonSelectedIdx == null) {
      toast(t('gardenDetail.polygonSelectFirst'));
      return;
    }
    if (polygonPoints.length <= 3) {
      toast(t('gardenDetail.polygonMinPoints'));
      return;
    }
    pushPolygonSnapshot();
    setPolygonPoints(polygonPoints.filter((_, i) => i !== polygonSelectedIdx));
    setPolygonSelectedIdx(null);
  };

  const handlePolygonResetShape = () => {
    if (!polygonPoints) return;
    pushPolygonSnapshot();
    setPolygonPoints(DEFAULT_POLYGON_POINTS);
    setPolygonSelectedIdx(null);
  };

  // Stats polygonu pro toolbar pod mapou
  const polygonStats = (() => {
    if (!polygonPoints || polygonPoints.length < 3) return null;
    const frac = polygonAreaFraction(polygonPoints);
    const percent = frac * 100;
    let m2 = null;
    if (scaleHints.x > 0 && scaleHints.y > 0) {
      m2 = frac * (100 * scaleHints.x) * (100 * scaleHints.y);
    }
    return { percent, m2 };
  })();

  const handleUploadMap = async (file) => {
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
      toast(t('gardenDetail.mapUploaded'));
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setUploadingMap(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('gardenDetail.deleteGardenConfirm'))) return;
    try {
      await api.deleteGarden(id);
      toast(t('gardenDetail.gardenDeleted'));
      nav('/zahrady');
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  // Přepnutí sekce — při odchodu z „Mapa" vypneme editační režimy, ať uživatele
  // nepřekvapí aktivní kreslení záhonu / polygonu na jiné záložce.
  const changeTab = (next) => {
    if (next !== 'map') {
      setBedMode(false);
      setPolygonMode(false);
    }
    setTab(next);
  };

  // Zavřít akční menu při kliknutí mimo / Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Rychlé statistiky pro záložku Statistiky
  const TABS = [
    { key: 'map', label: t('gardenDetail.tabMap') },
    { key: 'list', label: t('gardenDetail.tabList') },
    { key: 'stats', label: t('gardenDetail.tabStats') },
  ];
  const tabIdx = TABS.findIndex((t) => t.key === tab);
  const plantCount = pins.filter((p) => p.plant_name).length;
  const photoCount = pins.filter((p) => p.photo_path).length;
  // Plocha zahrady z uloženého polygonu (pokud máme měřítko ze záhonu)
  const gardenAreaM2 = (() => {
    const poly = parsePolygon(garden?.garden_polygon);
    if (!poly) return null;
    const frac = polygonAreaFraction(poly);
    if (scaleHints.x > 0 && scaleHints.y > 0) {
      return frac * (100 * scaleHints.x) * (100 * scaleHints.y);
    }
    return null;
  })();

  if (loading) return <div className="empty">{t('common.loadingShort')}</div>;
  if (!garden) return <div className="empty">{t('gardenDetail.gardenNotFound')}</div>;

  return (
    <>
      {/* iOS nav header — sticky pod globálním topbarem */}
      <header className="gd-nav">
        <button className="gd-nav-back" onClick={() => nav('/zahrady')}>
          <Icon name="chevronLeft" size={22} stroke={2.4} />
          <span>{t('gardenDetail.navGardens')}</span>
        </button>
        <span className="gd-nav-title">{garden.name}</span>
        <div className="gd-nav-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="gd-nav-action"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('gardenDetail.gardenActions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="gd-action-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowEdit(true); }}>
                {t('gardenDetail.menuEdit')}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowShare(true); }}>
                {t('gardenDetail.menuShare')}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowMembers(true); }}>
                {t('gardenDetail.menuMembers')}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowBulkCare(true); }}>
                {t('gardenDetail.menuBulkCare')}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowSeasonMoment(true); }}>
                {t('gardenDetail.menuSeasonMoment')}
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShowCalendar(true); }}>
                {t('gardenDetail.menuCalendar')}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  window.open(`/api/gardens/${garden.id}/season-plan?print=1`, '_blank');
                }}
              >
                {t('gardenDetail.menuSeasonPlan')}
              </button>
            </div>
          )}
        </div>
      </header>

      <GardenConditionsLine garden={garden} />

      {!garden.image_path ? (
        <div className="card">
          <div className="empty">
            <div className="icon">🖼️</div>
            <div className="mb-2">{t('gardenDetail.uploadAerialPrompt')}</div>
            <button
              type="button"
              className="btn"
              onClick={() =>
                openPhotoPicker({
                  multiple: false,
                  inputRef: mapInputRef,
                  onFiles: (files) => handleUploadMap(files[0]),
                })
              }
            >
              {t('gardenDetail.uploadPhoto')}
            </button>
            <input
              ref={mapInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleUploadMap(e.target.files?.[0])}
            />
            <div style={{ marginTop: 20, padding: '14px 12px 4px', borderTop: '1px dashed var(--border)' }}>
              <div className="small muted mb-2">
                {t('gardenDetail.satelliteTip')}
              </div>
              {!garden.location && (
                <input
                  type="text"
                  value={adhocAddress}
                  onChange={(e) => setAdhocAddress(e.target.value)}
                  placeholder={t('gardenDetail.addressPlaceholder')}
                  style={{ marginBottom: 8 }}
                />
              )}
              <button
                type="button"
                className="btn secondary"
                onClick={() => openSatelliteView(garden.location || adhocAddress)}
              >
                {t('gardenDetail.openSatellite')} {garden.location ? '— ' + garden.location : ''}
              </button>
              <div className="small muted" style={{ marginTop: 6 }}>
                {t('gardenDetail.screenshotHint')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* MAP — vždy nahoře */}
          <div className="card gd-map-card">
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
                cursor: polygonMode ? 'default' : bedMode ? 'crosshair' : draggingPin ? 'grabbing' : 'crosshair',
                touchAction: bedMode || draggingPin ? 'none' : 'manipulation',
                padding: polygonMode ? '20px 0' : 0,
                boxSizing: 'border-box',
                transition: 'padding 0.18s ease',
              }}
            >
              <div
                className="map-stage"
                ref={mapStageRef}
                style={{
                  position: 'absolute',
                  top: polygonMode ? '18%' : 0,
                  bottom: polygonMode ? '18%' : 0,
                  left: polygonMode ? '18%' : 0,
                  right: polygonMode ? '18%' : 0,
                  transition: 'top 0.18s ease, bottom 0.18s ease, left 0.18s ease, right 0.18s ease',
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
              {polygonMode && polygonPoints && (
                <PolygonEditor
                  containerRef={mapStageRef}
                  points={polygonPoints}
                  onPointsChange={setPolygonPoints}
                  selectedIdx={polygonSelectedIdx}
                  onSelectedIdxChange={setPolygonSelectedIdx}
                  onSnapshot={pushPolygonSnapshot}
                />
              )}
              </div>
              {!polygonMode && (
                <div className="gd-map-hint">
                  <Icon name="plus" size={15} stroke={2.4} />
                  {bedMode
                    ? t('gardenDetail.hintBedMode')
                    : t('gardenDetail.hintMapMode')}
                </div>
              )}
            </div>
            {polygonMode && polygonPoints && (
              <div className="polygon-toolbar">
                <p className="polygon-toolbar-hint">
                  {polygonSelectedIdx != null
                    ? t('gardenDetail.polygonHintSelected')
                    : t('gardenDetail.polygonHintTap')}
                </p>
                <div className="polygon-toolbar-bar" role="toolbar" aria-label={t('gardenDetail.polygonToolbarAria')}>
                  <button
                    type="button"
                    className="polygon-tool-btn"
                    onClick={handlePolygonAdd}
                    aria-label={t('gardenDetail.polygonAddAria')}
                    title={t('gardenDetail.polygonAddTitle')}
                  >
                    <span className="polygon-tool-glyph" aria-hidden="true">+</span>
                  </button>
                  <button
                    type="button"
                    className="polygon-tool-btn"
                    onClick={handlePolygonRemove}
                    disabled={polygonPoints.length <= 3 || polygonSelectedIdx == null}
                    aria-label={t('gardenDetail.polygonRemoveAria')}
                    title={t('gardenDetail.polygonRemoveTitle')}
                  >
                    <span className="polygon-tool-glyph" aria-hidden="true">−</span>
                  </button>
                  <button
                    type="button"
                    className="polygon-tool-btn"
                    onClick={handlePolygonUndo}
                    disabled={polygonUndoStack.length === 0}
                    aria-label={t('gardenDetail.polygonUndoAria')}
                    title={t('gardenDetail.polygonUndoTitle')}
                  >
                    <span className="polygon-tool-glyph" aria-hidden="true">↺</span>
                  </button>
                  <button
                    type="button"
                    className="polygon-tool-btn"
                    onClick={handlePolygonResetShape}
                    aria-label={t('gardenDetail.polygonResetAria')}
                    title={t('gardenDetail.polygonResetTitle')}
                  >
                    <span className="polygon-tool-glyph" aria-hidden="true">⟲</span>
                  </button>
                  <button
                    type="button"
                    className="polygon-tool-btn primary"
                    onClick={() => handleCropPolygon(polygonPoints)}
                    disabled={croppingPolygon || polygonPoints.length < 3}
                    aria-label={t('gardenDetail.polygonConfirmAria')}
                    title={t('gardenDetail.polygonConfirmTitle')}
                  >
                    <span className="polygon-tool-glyph" aria-hidden="true">{croppingPolygon ? '⏳' : '✓'}</span>
                  </button>
                </div>
                {polygonStats && (
                  <div className="polygon-toolbar-stats">
                    📐 {t('gardenDetail.polygonPercentOfMap', { percent: polygonStats.percent.toFixed(1) })}
                    {polygonStats.m2 != null && polygonStats.m2 > 0 && (
                      <> · ~{polygonStats.m2.toFixed(polygonStats.m2 < 10 ? 1 : 0)} m²</>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="btn ghost small polygon-toolbar-cancel"
                  onClick={() => setPolygonMode(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Segmented control: Mapa / Seznam / Statistiky */}
          <div className="gd-seg-wrap">
            <div className="ios-segmented" role="tablist" aria-label={t('gardenDetail.sectionsAria')}>
              {tabIdx >= 0 && (
                <span
                  className="ios-seg-thumb"
                  style={{ transform: `translateX(${tabIdx * 100}%)` }}
                  aria-hidden="true"
                />
              )}
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`ios-seg-btn ${tab === t.key ? 'active' : ''}`}
                  onClick={() => changeTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'map' && (
          <>
          {/* Nástroje mapy */}
          <div className="card gd-tools">
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
                  title={t('gardenDetail.rotateMinus90')}
                >
                  ↺
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => handleRotationChange((rotation + 90) % 360)}
                  title={t('gardenDetail.rotatePlus90')}
                >
                  ↻
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => handleRotationChange(0)}
                  title={t('gardenDetail.rotateReset')}
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
                  {t('gardenDetail.grid')}
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
                onClick={() => { setBedMode((v) => !v); setPolygonMode(false); }}
                style={bedMode ? { background: 'rgba(139,111,71,0.18)', border: '1px solid #8b6f47' } : {}}
                title={t('gardenDetail.bedToolTitle')}
              >
                {bedMode ? t('gardenDetail.bedCancelDraw') : t('gardenDetail.bedTool')}
              </button>
              {/* Ohraničení zahrady (polygon) */}
              <button
                className={`btn ghost small${polygonMode ? ' active' : ''}`}
                onClick={() => { setPolygonMode((v) => !v); setBedMode(false); }}
                style={polygonMode ? { background: 'rgba(74,124,58,0.18)', border: '1px solid #4a7c3a' } : {}}
                title={garden.garden_polygon ? t('gardenDetail.polygonReoutlineTitle') : t('gardenDetail.polygonOutlineTitle')}
              >
                {polygonMode ? t('gardenDetail.polygonCancel') : (garden.garden_polygon ? t('gardenDetail.polygonReoutline') : t('gardenDetail.polygonOutline'))}
              </button>
              {/* Upscale */}
              <button
                className="btn ghost small"
                onClick={handleUpscale}
                disabled={upscaling}
                title={t('gardenDetail.upscaleTitle')}
              >
                {upscaling ? '⏳' : '🔍'} {t('gardenDetail.upscaleLabel')}
              </button>
            </div>
          </div>

          {beds.length > 0 && (
            <>
              <h3 className="section-title">
                {t('gardenDetail.bedsSectionTitle', { count: beds.length })}
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
          </>
          )}

          {tab === 'list' && (
          <>
          <h3 className="section-title">
            {t('gardenDetail.placesSectionTitle', { count: pins.length })}
          </h3>
          {pins.length === 0 ? (
            <div className="card empty small">
              {t('gardenDetail.noPlaces')}
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
          </>
          )}

          {tab === 'stats' && (
          <>
            <div className="gd-stat-grid">
              <div className="gd-stat">
                <div className="val">{pins.length}</div>
                <div className="lbl">{t('gardenDetail.statPlaces')}</div>
              </div>
              <div className="gd-stat">
                <div className="val">{plantCount}</div>
                <div className="lbl">{t('gardenDetail.statPlants')}</div>
              </div>
              <div className="gd-stat">
                <div className="val">{beds.length}</div>
                <div className="lbl">{t('gardenDetail.statBeds')}</div>
              </div>
              <div className="gd-stat">
                <div className="val">{photoCount}</div>
                <div className="lbl">{t('gardenDetail.statWithPhoto')}</div>
              </div>
            </div>
            {gardenAreaM2 != null && gardenAreaM2 > 0 && (
              <div className="gd-area-banner">
                {t('gardenDetail.areaBanner', { area: gardenAreaM2.toFixed(gardenAreaM2 < 10 ? 1 : 0) })}
              </div>
            )}
            {/* Osevní postup — rotace plodin v záhonech */}
            <RotationCard beds={beds} pins={pins} />
            {/* Zazimování — vyrýt hlízy + zimní ochrana před prvním mrazem (jen 9–11) */}
            <WinterPrepCard garden={garden} pins={pins} />
            {/* Zelené hnojení — meziplodina do uvolněných zeleninových záhonů (jen 8–10) */}
            <GreenManureCard garden={garden} pins={pins} beds={beds} />
            {/* Vápnění záhonů s košťálovinami — úprava pH proti nádorovitosti (jen 10–11) */}
            <SoilPhCard garden={garden} pins={pins} beds={beds} />
            {/* Meziroční srovnání péče v této zahradě */}
            <YearOverYear gardenId={garden.id} title={t('gardenDetail.yearOverYearTitle', { name: garden.name })} />
          </>
          )}
        </>
      )}

      {addingPinAt && (
        <NewPinModal
          gardenId={garden.id}
          gardenConditions={{
            soil_type: garden.soil_type,
            exposure: garden.exposure,
            altitude_m: garden.altitude_m,
            climate_zone: garden.climate_zone,
          }}
          beds={beds}
          pins={pins}
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
            toast(t('gardenDetail.saved'));
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

      {showMembers && (
        <MembersModal
          garden={garden}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showBulkCare && (
        <BulkCareModal
          garden={garden}
          pins={pins}
          onClose={() => setShowBulkCare(false)}
          onCreated={() => load()}
        />
      )}

      {showSeasonMoment && (
        <SeasonMomentModal
          garden={garden}
          pins={pins}
          onClose={() => setShowSeasonMoment(false)}
          onCreated={() => load()}
        />
      )}

      {showCalendar && (
        <CalendarSubscribeModal
          garden={garden}
          onClose={() => setShowCalendar(false)}
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
  const { t } = useTranslation();
  const [name, setName] = useState(bed.name || i18n.t('gardenDetail.bedFallbackName'));
  const [widthM, setWidthM] = useState(bed.width_m ?? '');
  const [heightM, setHeightM] = useState(bed.height_m ?? '');
  const [color, setColor] = useState(bed.color || '#8b6f47');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast(t('gardenDetail.bedNameRequired'));
    setSaving(true);
    try {
      const updated = await api.updateBed(bed.id, {
        name: name.trim(),
        width_m: widthM === '' ? null : Number(widthM),
        height_m: heightM === '' ? null : Number(heightM),
        color,
      });
      toast(t('gardenDetail.saved'));
      onSaved(updated);
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('gardenDetail.bedDeleteConfirm'))) return;
    try {
      await api.deleteBed(bed.id);
      toast(t('gardenDetail.bedDeleted'));
      onDeleted(bed.id);
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    }
  };

  return (
    <Modal title={t('gardenDetail.bedEditTitle')} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>{t('gardenDetail.bedNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('gardenDetail.bedNamePlaceholder')}
            autoFocus
          />
        </div>
        <div className="field row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>{t('gardenDetail.bedWidthLabel')}</label>
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
            <label>{t('gardenDetail.bedHeightLabel')}</label>
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
          <label>{t('gardenDetail.bedColorLabel')}</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn danger ghost small" onClick={remove}>
            {t('gardenDetail.deleteWithIcon')}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ShareGardenModal({ garden, onClose }) {
  const { t } = useTranslation();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .createShareToken(garden.id)
      .then((r) => { if (!cancelled) setToken(r.token); })
      .catch((e) => { if (!cancelled) toast(t('common.error', { msg: e.message })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [garden.id]);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : '';

  const copy = async () => {
    try {
      const status = await shareLink({
        url: shareUrl,
        title: t('gardenDetail.shareTitle'),
        text: t('gardenDetail.shareText'),
      });
      if (status === 'copied') {
        toast(t('gardenDetail.linkCopied'));
      } else if (status === 'shown') {
        // Schránka nedostupná → vyber text v inputu jako poslední záchrana.
        const input = document.getElementById('share-url-input');
        input?.select();
        toast('🔗 ' + shareUrl);
      }
    } catch (e) {
      toast(t('gardenDetail.cannotShare', { msg: e.message }));
    }
  };

  const revoke = async () => {
    if (!confirm(t('gardenDetail.revokeConfirm'))) return;
    setRevoking(true);
    try {
      await api.revokeShareToken(garden.id);
      toast(t('gardenDetail.shareRevoked'));
      onClose();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Modal title={t('gardenDetail.shareModalTitle')} onClose={onClose}>
      {loading ? (
        <div className="empty small">{t('common.loadingShort')}</div>
      ) : (
        <>
          <div className="small muted mb-2">
            {t('gardenDetail.shareDescription')}
          </div>
          <div className="field">
            <label>{t('gardenDetail.publicLink')}</label>
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
              {isNativeShare() ? t('gardenDetail.shareBtn') : t('gardenDetail.copyBtn')}
            </button>
            <a
              className="btn secondary"
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('gardenDetail.openPreview')}
            </a>
          </div>
          <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn danger ghost small"
              onClick={revoke}
              disabled={revoking}
            >
              {revoking ? t('gardenDetail.revoking') : t('gardenDetail.revokeShare')}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Typy úkonů, které lze v kalendáři filtrovat (label v UI ↔ key v URL `types=`).
// Zdroj pravdy: data/taskTypes.js → ICAL_CATEGORIES.
const ICAL_TYPE_OPTIONS = ICAL_CATEGORIES;
const ALL_TYPE_KEYS = ICAL_TYPE_OPTIONS.map((t) => t.key);

// Kategorie nabízené v "Jen vybrané kategorie" módu — podmnožina relevantní pro zahradníky.
// Labely se počítají uvnitř komponenty přes t() (viz buildIcalCategoryOptions).
const buildIcalCategoryOptions = (t) => [
  { key: 'vegetables', label: t('gardenDetail.catVegetables'), icon: '🥕' },
  { key: 'fruits',     label: t('gardenDetail.catFruits'), icon: '🍓' },
  { key: 'herbs',      label: t('gardenDetail.catHerbs'), icon: '🌿' },
  { key: 'trees',      label: t('gardenDetail.catTrees'), icon: '🌳' },
  { key: 'shrubs',     label: t('gardenDetail.catShrubs'), icon: '🪴' },
  { key: 'conifers',   label: t('gardenDetail.catConifers'), icon: '🌲' },
  { key: 'ornamental', label: t('gardenDetail.catOrnamental'), icon: '🌼' },
  { key: 'annuals',    label: t('gardenDetail.catAnnuals'), icon: '🌺' },
  { key: 'bulbs',      label: t('gardenDetail.catBulbs'), icon: '🌷' },
  { key: 'grasses',    label: t('gardenDetail.catGrasses'), icon: '🌾' },
];

function CalendarSubscribeModal({ garden, onClose }) {
  const { t } = useTranslation();
  const icalCategoryOptions = buildIcalCategoryOptions(t);
  // Krok 1 = config formulář; krok 2 = vygenerovaný odkaz
  const [step, setStep] = useState('config');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState([]);

  // Config state
  const [selectedTypes, setSelectedTypes] = useState(() => new Set(ALL_TYPE_KEYS));
  const [pinMode, setPinMode] = useState('all'); // 'all' | 'categories' | 'pins'
  const [selectedCategories, setSelectedCategories] = useState(() => new Set());
  const [selectedPinIds, setSelectedPinIds] = useState(() => new Set());
  const [reminderDays, setReminderDays] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.gardenIcalToken(garden.id),
      api.listPins(garden.id).catch(() => []),
    ])
      .then(([tokRes, pinsList]) => {
        if (cancelled) return;
        setToken(tokRes.token);
        setPins(pinsList || []);
      })
      .catch((e) => { if (!cancelled) toast(t('common.error', { msg: e.message })); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [garden.id]);

  // Postaví finální URL z konfigurace. Defaultní hodnoty (vše/1den) se do URL nepíší,
  // aby odkaz zůstal stručný a backend default-handlery fungovaly.
  const buildUrl = (download = false) => {
    if (!token) return '';
    const host = window.location.host;
    const params = new URLSearchParams({ token });
    if (selectedTypes.size < ALL_TYPE_KEYS.length && selectedTypes.size > 0) {
      params.set('types', [...selectedTypes].join(','));
    }
    if (pinMode === 'categories' && selectedCategories.size > 0) {
      params.set('categories', [...selectedCategories].join(','));
    }
    if (pinMode === 'pins' && selectedPinIds.size > 0) {
      params.set('pins', [...selectedPinIds].join(','));
    }
    if (reminderDays !== 1) {
      params.set('reminder', String(reminderDays));
    }
    if (download) params.set('download', '1');
    const scheme = download ? `https://${host}` : `https://${host}`;
    return `${scheme}/api/gardens/${garden.id}/calendar.ics?${params.toString()}`;
  };
  const httpsUrl = step === 'link' ? buildUrl(false) : '';
  const webcalUrl = httpsUrl.replace(/^https:/, 'webcal:');
  const downloadUrl = step === 'link' ? buildUrl(true) : '';

  const toggleSet = (setter, key) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(httpsUrl);
        toast(t('gardenDetail.urlCopied'));
      }
    } catch (e) {
      toast(t('gardenDetail.cannotCopy', { msg: e.message }));
    }
  };

  // Validace: pokud uživatel zvolil "vybrané kategorie/piny" ale nic nezaškrtl, varuj
  const canGenerate =
    selectedTypes.size > 0 &&
    !(pinMode === 'categories' && selectedCategories.size === 0) &&
    !(pinMode === 'pins' && selectedPinIds.size === 0);

  return (
    <Modal title={t('gardenDetail.calendarModalTitle')} onClose={onClose}>
      {loading ? (
        <div className="empty small">{t('common.loadingShort')}</div>
      ) : !token ? (
        <div className="empty small">{t('gardenDetail.tokenUnavailable')}</div>
      ) : step === 'config' ? (
        <>
          <div className="small muted mb-2">
            {t('gardenDetail.calendarConfigIntro')}
          </div>

          <div className="field">
            <label>{t('gardenDetail.taskTypesLabel')}</label>
            <div className="ical-check-grid">
              {ICAL_TYPE_OPTIONS.map((opt) => (
                <label key={opt.key} className="ical-check">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(opt.key)}
                    onChange={() => toggleSet(setSelectedTypes, opt.key)}
                  />
                  <span>{opt.icon} {opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>{t('gardenDetail.plantsLabel')}</label>
            <div className="ical-radio-list">
              <label className="ical-radio">
                <input
                  type="radio"
                  name="pinMode"
                  value="all"
                  checked={pinMode === 'all'}
                  onChange={() => setPinMode('all')}
                />
                <span>{t('gardenDetail.allMyPlants', { count: pins.length })}</span>
              </label>
              <label className="ical-radio">
                <input
                  type="radio"
                  name="pinMode"
                  value="categories"
                  checked={pinMode === 'categories'}
                  onChange={() => setPinMode('categories')}
                />
                <span>{t('gardenDetail.onlySelectedCategories')}</span>
              </label>
              {pinMode === 'categories' && (
                <div className="ical-pill-row">
                  {icalCategoryOptions.map((c) => {
                    const active = selectedCategories.has(c.key);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={`filter-pill ${active ? 'active' : ''}`}
                        onClick={() => toggleSet(setSelectedCategories, c.key)}
                      >
                        {c.icon} {c.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="ical-radio">
                <input
                  type="radio"
                  name="pinMode"
                  value="pins"
                  checked={pinMode === 'pins'}
                  onChange={() => setPinMode('pins')}
                />
                <span>{t('gardenDetail.onlySpecificPlants')}</span>
              </label>
              {pinMode === 'pins' && (
                <div className="ical-pin-list">
                  {pins.length === 0 ? (
                    <div className="small muted">{t('gardenDetail.noPlantsInGarden')}</div>
                  ) : pins.map((p) => (
                    <label key={p.id} className="ical-check">
                      <input
                        type="checkbox"
                        checked={selectedPinIds.has(p.id)}
                        onChange={() => toggleSet(setSelectedPinIds, p.id)}
                      />
                      <span>{p.plant_name || p.name}{p.plant_name && p.plant_name !== p.name ? ` (${p.name})` : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label>{t('gardenDetail.reminderLeadLabel')}</label>
            <div className="ical-segmented">
              {[
                { v: 1, label: t('gardenDetail.reminder1Day') },
                { v: 3, label: t('gardenDetail.reminder3Days') },
                { v: 7, label: t('gardenDetail.reminder1Week') },
                { v: 0, label: t('gardenDetail.reminderNone') },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  className={`ical-segment ${reminderDays === opt.v ? 'active' : ''}`}
                  onClick={() => setReminderDays(opt.v)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setStep('link')}
              disabled={!canGenerate}
            >
              {t('gardenDetail.generateLink')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="small muted mb-2">
            {t('gardenDetail.liveLinkInfo')}
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <a className="btn" href={webcalUrl} style={{ flex: '1 1 200px' }}>
              {t('gardenDetail.addToIosCalendar')}
            </a>
            <a className="btn secondary" href={downloadUrl} style={{ flex: '1 1 200px' }}>
              {t('gardenDetail.downloadIcs')}
            </a>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>{t('gardenDetail.googleCalendarUrlLabel')}</label>
            <input
              type="text"
              value={httpsUrl}
              readOnly
              onFocus={(e) => e.target.select()}
              style={{ fontSize: '0.78rem' }}
            />
            <button type="button" className="btn ghost small mt-2" onClick={copy}>
              {t('gardenDetail.copyUrl')}
            </button>
          </div>

          <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn ghost" onClick={() => setStep('config')}>
              {t('gardenDetail.editConfig')}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.done')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function PlantRow({ pin, onOpen, onPhotoUpdated }) {
  const { t } = useTranslation();
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
        r.onerror = () => reject(new Error(t('gardenDetail.fileReadError')));
        r.readAsDataURL(file);
      });
      const out = await api.setPinPhoto(pin.id, dataUrl);
      onPhotoUpdated(out.photo_path);
      toast(t('gardenDetail.photoSaved'));
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
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
            {t('gardenDetail.plantedOn', { date: formatDate(pin.planting_date) })}
          </div>
        )}
        <button
          type="button"
          className="btn ghost small mt-1"
          onClick={openPicker}
          disabled={uploading}
        >
          {uploading ? t('gardenDetail.uploadingPhoto') : pin.photo_path ? t('gardenDetail.changePhoto') : t('gardenDetail.addPhoto')}
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

function NewPinModal({ gardenId, gardenConditions, beds, pins, x, y, onClose, onCreated }) {
  const { t } = useTranslation();
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
    if (!name.trim()) return toast(t('gardenDetail.placeNameRequired'));
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
        const seasonal = buildSeasonalTaskPayloads(selectedPlant, selectedCare, pin.id, gardenConditions);
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
        if (dbCount) parts.push(t('gardenDetail.regularTasks', { count: dbCount }));
        if (seasonalCount) parts.push(t('gardenDetail.seasonalTasks', { count: seasonalCount }));
        toast(t('gardenDetail.placeAddedWithTasks', { tasks: parts.join(' + ') }));
      } else {
        toast(t('gardenDetail.placeAdded'));
      }
      onCreated();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('gardenDetail.newPlaceTitle')} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>{t('gardenDetail.placeNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('gardenDetail.bedNamePlaceholder')}
            autoFocus
          />
        </div>
        <div className="field">
          <label>{t('gardenDetail.plantLabel')}</label>
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
            placeholder={t('gardenDetail.plantSearchPlaceholder')}
          />
          {selectedPlant && (
            <PlantInfoCard
              plant={selectedPlant}
              onSelectionChange={setSelectedCare}
            />
          )}
          {plantName && (
            <RotationPlantWarning
              plantName={plantName}
              x={x}
              y={y}
              beds={beds}
              pins={pins}
            />
          )}
        </div>
        <div className="field">
          <label>{t('gardenDetail.plantingDateLabel')}</label>
          <input
            type="date"
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('gardenDetail.notesLabel')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('gardenDetail.notesPlaceholder')}
          />
        </div>
        <div className="field">
          <label>{t('gardenDetail.pinColorLabel')}</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('gardenDetail.plantPhotoLabel')}</label>
          <div className="file-input-wrap" onClick={() => fileRef.current?.click()}>
            {file ? (
              <div className="small">📎 {file.name}</div>
            ) : (
              <>
                <div style={{ fontSize: '1.6rem' }}>📷</div>
                <div className="small muted">{t('gardenDetail.clickToUpload')}</div>
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
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t('common.saving') : t('gardenDetail.createPlace')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Labely expozice se počítají uvnitř komponenty přes t() (lowercase varianty pro řádek podmínek).
const buildExposureLabels = (t) => ({
  N: t('gardenDetail.exposureNorthLower'),
  S: t('gardenDetail.exposureSouthLower'),
  E: t('gardenDetail.exposureEastLower'),
  W: t('gardenDetail.exposureWestLower'),
  mixed: t('gardenDetail.exposureMixedLower'),
});

function GardenConditionsLine({ garden }) {
  const { t } = useTranslation();
  const exposureLabels = buildExposureLabels(t);
  const parts = [];
  if (garden.soil_type) parts.push(`🪴 ${garden.soil_type}`);
  if (garden.exposure && exposureLabels[garden.exposure]) parts.push(exposureLabels[garden.exposure]);
  if (garden.altitude_m) parts.push(`⛰️ ${garden.altitude_m} m`);
  const zone = getClimateZone(garden.climate_zone);
  if (zone) parts.push(`📍 ${zone.label}`);
  if (parts.length === 0) return null;
  return (
    <div className="small muted" style={{ marginTop: 4 }}>
      {parts.join(' · ')}
    </div>
  );
}

function EditGardenModal({ garden, onClose, onSaved, onDelete, onMapUpload, uploading }) {
  const { t } = useTranslation();
  const [name, setName] = useState(garden.name);
  const [location, setLocation] = useState(garden.location || '');
  const [soilType, setSoilType] = useState(garden.soil_type || '');
  const [exposure, setExposure] = useState(garden.exposure || '');
  const [altitudeM, setAltitudeM] = useState(garden.altitude_m ?? '');
  const [climateZone, setClimateZone] = useState(garden.climate_zone || '');
  const [saving, setSaving] = useState(false);
  const editMapInputRef = useRef(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('location', location.trim());
      fd.append('soil_type', soilType.trim());
      fd.append('exposure', exposure);
      fd.append('altitude_m', altitudeM === '' ? '' : String(altitudeM));
      fd.append('climate_zone', climateZone);
      const g = await api.updateGarden(garden.id, fd);
      onSaved(g);
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('gardenDetail.editGardenTitle')} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>{t('gardenDetail.bedNameLabel')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>{t('gardenDetail.gardenAddressLabel')}</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('gardenDetail.gardenAddressPlaceholder')}
            maxLength={240}
          />
          <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => openSatelliteView(location)}
            >
              {t('gardenDetail.openSatelliteShort')}
            </button>
            <span className="small muted">{t('gardenDetail.screenshotHint')}</span>
          </div>
        </div>

        <div className="field">
          <label>{t('gardenDetail.growingConditionsLabel')}</label>
          <div className="small muted mb-2">
            {t('gardenDetail.growingConditionsHint')}
          </div>
        </div>

        <div className="field">
          <label>{t('gardenDetail.soilTypeLabel')}</label>
          <input
            type="text"
            value={soilType}
            placeholder={t('gardenDetail.soilTypePlaceholder')}
            onChange={(e) => setSoilType(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="field">
          <label>{t('gardenDetail.exposureLabel')}</label>
          <select value={exposure} onChange={(e) => setExposure(e.target.value)}>
            <option value="">{t('gardenDetail.notSpecified')}</option>
            <option value="N">{t('gardenDetail.exposureNorth')}</option>
            <option value="S">{t('gardenDetail.exposureSouth')}</option>
            <option value="E">{t('gardenDetail.exposureEast')}</option>
            <option value="W">{t('gardenDetail.exposureWest')}</option>
            <option value="mixed">{t('gardenDetail.exposureMixed')}</option>
          </select>
        </div>

        <div className="field">
          <label>{t('gardenDetail.altitudeLabel')}</label>
          <input
            type="number"
            min="0"
            max="3000"
            step="10"
            value={altitudeM}
            placeholder={t('gardenDetail.altitudePlaceholder')}
            onChange={(e) => setAltitudeM(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label>{t('gardenDetail.climateZoneLabel')}</label>
          <select value={climateZone} onChange={(e) => setClimateZone(e.target.value)}>
            <option value="">{t('gardenDetail.notSpecified')}</option>
            {COUNTRIES.map((c) => (
              <optgroup key={c.code} label={`${c.flag} ${c.label}`}>
                {getZonesByCountry(c.code).map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {climateZone && (
            <div className="small muted" style={{ marginTop: 4 }}>
              {t('gardenDetail.climateZoneDescribed', { desc: describeZone(climateZone) })}
            </div>
          )}
        </div>

        <div className="field">
          <label>{t('gardenDetail.uploadNewMapLabel')}</label>
          <button
            type="button"
            className="btn secondary block"
            disabled={uploading}
            onClick={() =>
              openPhotoPicker({
                multiple: false,
                inputRef: editMapInputRef,
                onFiles: (files) => onMapUpload(files[0]),
              })
            }
          >
            {uploading ? t('gardenDetail.uploading') : t('gardenDetail.selectNewGardenPhoto')}
          </button>
          <input
            ref={editMapInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => onMapUpload(e.target.files?.[0])}
            disabled={uploading}
          />
        </div>
        <div className="row mt-3">
          <button type="button" className="btn danger" onClick={onDelete}>
            {t('gardenDetail.deleteGarden')}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
