// List of gardens + create new
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import TemplateGardenModal from '../components/TemplateGardenModal.jsx';
import { toast } from '../App.jsx';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
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
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => setShowTemplate(true)} title="Vytvořit ze šablony">
              🌱 Šablona
            </button>
            <button className="btn" onClick={() => setShowNew(true)}>
              + Nová
            </button>
          </div>
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

      {loading ? (
        <div className="empty">🌱 Načítám...</div>
      ) : gardens.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌻</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Zatím žádná zahrada</div>
          <div className="small muted" style={{ marginBottom: 14 }}>
            Přidejte fotografii z leteckého pohledu nebo začněte ze šablony.
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn ghost" onClick={() => setShowTemplate(true)}>
              🌱 Šablona
            </button>
            <button className="btn" onClick={() => setShowNew(true)}>
              + Vytvořit zahradu
            </button>
          </div>
        </div>
      ) : (
        <div className="gardens-grid">
          {gardens.map((g) => (
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

      {showTemplate && (
        <TemplateGardenModal
          onClose={() => setShowTemplate(false)}
          onCreated={(g) => {
            setShowTemplate(false);
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
