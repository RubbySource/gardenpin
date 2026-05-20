// List of gardens + create new
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import PullToRefresh from '../components/PullToRefresh.jsx';
import {
  IconSearch,
  IconX,
  IconPlus,
  IconTrash,
  IconChevronRight,
  IconAlert,
} from '../components/Icons.jsx';
import { toast } from '../App.jsx';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const nav = useNavigate();

  const load = useCallback(async () => {
    try {
      setGardens(await api.listGardens());
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const filteredGardens = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('cs-CZ');
    if (!q) return gardens;
    return gardens.filter((g) => (g.name || '').toLocaleLowerCase('cs-CZ').includes(q));
  }, [gardens, search]);

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
    <PullToRefresh onRefresh={load}>
      <div className="gardens-hero">
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
          <button className="btn btn-icon-pill" onClick={() => setShowNew(true)} aria-label="Nová zahrada">
            <IconPlus size={18} strokeWidth={2.4} />
            <span>Nová</span>
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

      {gardens.length > 1 && (
        <div className="sticky-search">
          <div className="search-field">
            <span className="search-field-icon" aria-hidden="true">
              <IconSearch size={18} />
            </span>
            <input
              type="search"
              inputMode="search"
              placeholder="Hledat zahradu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Hledat zahradu"
            />
            {search && (
              <button
                type="button"
                className="search-field-clear"
                onClick={() => setSearch('')}
                aria-label="Vymazat hledání"
              >
                <IconX size={16} />
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
      ) : filteredGardens.length === 0 ? (
        <div className="card empty">
          <div className="icon"><IconSearch size={28} /></div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Nic nenalezeno</div>
          <div className="small muted">
            Zkuste jiný výraz nebo vymažte filtr.
          </div>
        </div>
      ) : (
        <div className="gardens-grid">
          {filteredGardens.map((g) => (
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
    </PullToRefresh>
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
          <div className="garden-urgent-badge">
            <IconAlert size={14} /> {garden.urgent_count}
          </div>
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
            <IconTrash size={18} />
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
          <span className="garden-open-arrow" aria-hidden="true">
            <IconChevronRight size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}
