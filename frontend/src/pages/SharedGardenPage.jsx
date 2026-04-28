// Read-only veřejné zobrazení zahrady (bez auth, bez editace)
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function SharedGardenPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activePin, setActivePin] = useState(null);

  useEffect(() => {
    api
      .getSharedGarden(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="shared-page">
        <div className="card empty">
          <div className="icon">🔒</div>
          <div>Sdílená zahrada nenalezena nebo byla odstraněna.</div>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="shared-page"><div className="empty">Načítám…</div></div>;
  }

  const { garden, pins } = data;

  return (
    <div className="shared-page">
      <header className="shared-header">
        <h1>🌿 {garden.name}</h1>
        <div className="small muted">Sdílená zahrada — pouze pro čtení</div>
      </header>

      {garden.image_path ? (
        <div className="card">
          <div
            className="map-container"
            style={{
              aspectRatio:
                garden.image_width && garden.image_height
                  ? `${garden.image_width} / ${garden.image_height}`
                  : undefined,
              cursor: 'default',
            }}
          >
            <img
              src={garden.image_path}
              alt={garden.name}
              className="map-image"
              draggable={false}
              style={{ transform: `rotate(${garden.rotation || 0}deg)` }}
            />
            {pins.map((p) => (
              <div
                key={p.id}
                className="pin"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                onClick={() => setActivePin(p)}
                title={p.name}
              >
                <div className="pin-body" style={{ background: p.color || '#4a7c3a' }} />
                <div className="pin-label">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card empty">Tato zahrada nemá nahranou mapu.</div>
      )}

      <h3 className="section-title">📍 Místa v zahradě ({pins.length})</h3>
      {pins.length === 0 ? (
        <div className="card empty small">Zatím žádná místa.</div>
      ) : (
        pins.map((p) => (
          <div key={p.id} className="garden-card" onClick={() => setActivePin(p)}>
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
          </div>
        ))
      )}

      {activePin && (
        <Modal title={activePin.name} onClose={() => setActivePin(null)}>
          {activePin.photo_path && (
            <img
              src={activePin.photo_path}
              alt=""
              style={{ width: '100%', borderRadius: 12, marginBottom: 12 }}
            />
          )}
          {activePin.plant_name && <div>🌿 {activePin.plant_name}</div>}
          {activePin.planting_date && (
            <div className="muted small">
              📅 Vysazeno {new Date(activePin.planting_date).toLocaleDateString('cs-CZ')}
            </div>
          )}
          {activePin.notes && (
            <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>{activePin.notes}</div>
          )}
        </Modal>
      )}

      <footer className="shared-footer small muted">
        Vytvořeno v aplikaci Zahradní tracker 🌱
      </footer>
    </div>
  );
}
