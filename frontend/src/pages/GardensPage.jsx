// List of gardens — iOS-style: sticky search, swipe-to-delete, pull-to-refresh
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import Icon from '../components/Icon.jsx';
import { toast } from '../App.jsx';
import { useSwipeToDelete } from '../hooks/useSwipeToDelete.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState('');
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

  const { pull, loading: refreshing, triggered, indicatorStyle } = usePullToRefresh(load);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gardens;
    return gardens.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [gardens, query]);

  const totalPins = gardens.reduce((sum, g) => sum + (g.pin_count || 0), 0);
  const totalTasks = gardens.reduce((sum, g) => sum + (g.task_count || 0), 0);

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

  return (
    <>
      {/* Pull-to-refresh indikátor */}
      <div className="ptr-indicator" style={indicatorStyle} aria-hidden="true">
        <div className={`ptr-spinner ${refreshing ? 'spinning' : ''} ${triggered ? 'ready' : ''}`}>
          {refreshing ? '⟳' : triggered ? '↑' : '↓'}
        </div>
      </div>

      <div
        className="gardens-hero"
        style={{ transform: `translateY(${pull * 0.4}px)`, transition: pull ? 'none' : 'transform 0.22s ease' }}
      >
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
        <div className="ios-search-bar">
          <Icon name="search" size={18} className="ios-search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat zahradu…"
            aria-label="Hledat zahradu"
          />
          {query && (
            <button
              type="button"
              className="ios-search-clear"
              onClick={() => setQuery('')}
              aria-label="Vymazat"
            >
              <Icon name="close" size={14} />
            </button>
          )}
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
        <div className="gp-empty" style={{ padding: '32px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🔍</span>
          <div className="gp-empty-title">Žádné výsledky</div>
          <div className="gp-empty-text">Žádná zahrada nesplňuje hledaný výraz.</div>
        </div>
      ) : (
        <div className="gardens-grid">
          {filtered.map((g) => (
            <GardenCard
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

function GardenCard({ garden, onOpen, onDelete }) {
  const created = new Date(garden.created_at + 'Z').toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const { handlers, itemStyle, isOpen, close, revealWidth } = useSwipeToDelete(onDelete);

  const onCardClick = () => {
    if (isOpen) {
      close();
      return;
    }
    onOpen();
  };

  return (
    <div className="garden-swipe-wrap">
      <div
        className="garden-swipe-delete"
        style={{ width: revealWidth }}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className="garden-swipe-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            close();
            onDelete();
          }}
          aria-label="Smazat zahradu"
        >
          <Icon name="trash" size={22} />
          <span>Smazat</span>
        </button>
      </div>
      <div
        className="garden-card-v3"
        onClick={onCardClick}
        style={itemStyle}
        {...handlers}
      >
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
              <Icon name="trash" size={18} />
            </button>
          </div>
          <div className="g-meta">{created}</div>
          <div className="garden-stats-row">
            <div className="garden-stat">
              <span className="garden-stat-icon"><Icon name="pin" size={16} /></span>
              <span className="garden-stat-val">{garden.pin_count || 0}</span>
              <span className="garden-stat-lbl">
                {garden.pin_count === 1 ? 'pin' : 'pinů'}
              </span>
            </div>
            <div className="garden-stat">
              <span className="garden-stat-icon"><Icon name="check" size={16} /></span>
              <span className="garden-stat-val">{garden.task_count || 0}</span>
              <span className="garden-stat-lbl">
                {garden.task_count === 1 ? 'úkol' : 'úkolů'}
              </span>
            </div>
            <span className="garden-open-arrow"><Icon name="chevron" size={18} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
