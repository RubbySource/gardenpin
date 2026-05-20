// List of gardens + create new — iOS-style: sticky blur search, swipe-to-delete, pull-to-refresh
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import { toast } from '../App.jsx';

const PULL_THRESHOLD = 70;
const PULL_MAX = 110;
const SWIPE_DELETE_THRESHOLD = 96;
const SWIPE_DELETE_MAX = 160;

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullActive = useRef(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      setGardens(await api.listGardens());
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  // Pull-to-refresh — only triggers when scroll is at top
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      pullActive.current = true;
    };
    const onTouchMove = (e) => {
      if (!pullActive.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      if (window.scrollY > 0) {
        pullActive.current = false;
        setPull(0);
        return;
      }
      // dampen
      const damped = Math.min(PULL_MAX, dy * 0.55);
      setPull(damped);
    };
    const onTouchEnd = async () => {
      if (!pullActive.current) return;
      pullActive.current = false;
      const triggered = pull >= PULL_THRESHOLD;
      startY.current = null;
      if (triggered) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        try {
          await load();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pull]);

  const totalPins = gardens.reduce((sum, g) => sum + (g.pin_count || 0), 0);
  const totalTasks = gardens.reduce((sum, g) => sum + (g.task_count || 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gardens;
    return gardens.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [gardens, query]);

  const handleDelete = async (g) => {
    try {
      await api.deleteGarden(g.id);
      toast('🗑️ Zahrada smazána');
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const pullProgress = Math.min(1, pull / PULL_THRESHOLD);

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <div
        className="ptr-indicator"
        style={{
          transform: `translateY(${pull - 30}px)`,
          opacity: pullProgress,
        }}
        aria-hidden="true"
      >
        <span
          className={`ptr-spinner ${refreshing ? 'spinning' : ''}`}
          style={{ transform: `rotate(${pullProgress * 360}deg)` }}
        >
          🌿
        </span>
        <span className="ptr-text">
          {refreshing
            ? 'Obnovuji…'
            : pull >= PULL_THRESHOLD
            ? 'Pustit pro obnovu'
            : 'Táhněte pro obnovu'}
        </span>
      </div>

      <div className="gardens-hero" style={{ transform: `translateY(${pull * 0.5}px)` }}>
        <div className="gardens-hero-row">
          <div>
            <div className="gardens-hero-eyebrow">🗺️ Moje zahrady</div>
            <div className="gardens-hero-title">
              {gardens.length === 0
                ? 'Začněte mapovat'
                : gardens.length === 1
                ? '1 zahrada'
                : `${gardens.length} ${gardens.length < 5 ? 'zahrady' : 'zahrad'}`}
            </div>
          </div>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Nová
          </button>
        </div>
        {gardens.length > 0 && (
          <div className="gardens-hero-stats">
            <div className="gardens-hero-stat">
              <div className="val">{totalPins}</div>
              <div className="lbl">Rostlin</div>
            </div>
            <div className="gardens-hero-stat">
              <div className="val">{totalTasks}</div>
              <div className="lbl">Úkolů</div>
            </div>
            <div className="gardens-hero-stat">
              <div className="val">{gardens.length}</div>
              <div className="lbl">Zahrad</div>
            </div>
          </div>
        )}
      </div>

      {gardens.length > 0 && (
        <div className="sticky-search">
          <div className="sticky-search-inner">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              className="search-input"
              placeholder="Hledat zahradu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
            />
            {query && (
              <button
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Vyčistit"
                title="Vyčistit"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty">🌱 Načítám...</div>
      ) : gardens.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌻</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Zatím žádná zahrada</div>
          <div className="small muted" style={{ marginBottom: 14 }}>
            Přidejte fotografii z leteckého pohledu a začněte mapovat.
          </div>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Vytvořit první zahradu
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <div className="icon">🔍</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Nic nenalezeno</div>
          <div className="small muted">Pro „{query}“ nejsou žádné zahrady.</div>
        </div>
      ) : (
        <div className="gardens-grid">
          {filtered.map((g) => (
            <SwipeableGardenCard
              key={g.id}
              garden={g}
              onOpen={() => nav(`/zahrada/${g.id}`)}
              onDelete={() => setConfirmDelete(g)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewGardenModal
          onClose={() => setShowNew(false)}
          onCreated={(g) => {
            setShowNew(false);
            toast('✅ Zahrada vytvořena');
            nav(`/zahrada/${g.id}`);
          }}
        />
      )}

      {confirmDelete && (
        <Modal title="Smazat zahradu?" onClose={() => setConfirmDelete(null)}>
          <p style={{ marginTop: 0 }}>
            Opravdu chcete smazat zahradu <strong>{confirmDelete.name}</strong>?
          </p>
          <p className="small muted">
            Smaže se mapa, všechny piny ({confirmDelete.pin_count || 0}) i jejich úkoly. Akce nejde
            vrátit zpět.
          </p>
          <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>
              Zrušit
            </button>
            <button className="btn danger" onClick={() => handleDelete(confirmDelete)}>
              Smazat
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function SwipeableGardenCard({ garden, onOpen, onDelete }) {
  const [drag, setDrag] = useState(0);
  const startX = useRef(null);
  const startY = useRef(null);
  const horizontal = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    horizontal.current = false;
  };
  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!horizontal.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontal.current) {
        startX.current = null;
        return;
      }
    }
    // Only allow swipe left (negative dx) to reveal delete
    setDrag(dx < 0 ? Math.max(dx, -SWIPE_DELETE_MAX) : 0);
  };
  const onTouchEnd = () => {
    if (startX.current == null) {
      setDrag(0);
      return;
    }
    if (drag <= -SWIPE_DELETE_THRESHOLD) {
      setDrag(-SWIPE_DELETE_MAX);
      setTimeout(() => {
        onDelete?.();
        setDrag(0);
      }, 160);
    } else {
      setDrag(0);
    }
    startX.current = null;
    horizontal.current = false;
  };

  const triggered = drag <= -SWIPE_DELETE_THRESHOLD;
  const style = {
    transform: `translateX(${drag}px)`,
    transition: drag < 0 && startX.current != null ? 'none' : 'transform 0.25s ease',
  };

  return (
    <div className="swipe-card-wrap">
      <div
        className={`swipe-delete-bg ${triggered ? 'triggered' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (triggered) onDelete?.();
        }}
        aria-hidden={!triggered}
      >
        <span className="swipe-delete-icon">🗑️</span>
        <span className="swipe-delete-label">
          {triggered ? 'Pustit pro smazání' : 'Smazat'}
        </span>
      </div>
      <div
        className="swipe-card-foreground"
        style={style}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <GardenCard garden={garden} onOpen={onOpen} onDelete={onDelete} />
      </div>
    </div>
  );
}

function GardenCard({ garden, onOpen, onDelete }) {
  const created = new Date(garden.created_at + 'Z').toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="garden-card-v3" onClick={onOpen}>
      <div className="img-wrap">
        {garden.image_path ? (
          <img src={garden.image_path} alt={garden.name} />
        ) : (
          <div className="img-placeholder">
            <span style={{ fontSize: '3.5rem' }}>🌱</span>
          </div>
        )}
        {garden.urgent_count > 0 && (
          <div className="garden-urgent-badge">⚠️ {garden.urgent_count}</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-head">
          <div className="g-name">{garden.name}</div>
          <button
            className="card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Smazat zahradu"
            title="Smazat zahradu"
          >
            🗑️
          </button>
        </div>
        <div className="g-meta">{created}</div>
        <div className="garden-stats-row">
          <div className="garden-stat">
            <span className="garden-stat-icon">📍</span>
            <span className="garden-stat-val">{garden.pin_count || 0}</span>
            <span className="garden-stat-lbl">
              {garden.pin_count === 1 ? 'pin' : 'pinů'}
            </span>
          </div>
          <div className="garden-stat">
            <span className="garden-stat-icon">📋</span>
            <span className="garden-stat-val">{garden.task_count || 0}</span>
            <span className="garden-stat-lbl">
              {garden.task_count === 1 ? 'úkol' : 'úkolů'}
            </span>
          </div>
          <span className="garden-open-arrow">›</span>
        </div>
      </div>
    </div>
  );
}
