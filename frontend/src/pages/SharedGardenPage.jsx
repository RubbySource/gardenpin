// Veřejná read-only stránka sdílené zahrady (žádná editace, žádné API mutace)
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function SharedGardenPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchSharedGarden(token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="shared-app">
        <div className="shared-page">
          <div className="empty" style={{ padding: '40px 16px' }}>Načítám sdílenou zahradu…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-app">
        <div className="shared-page">
          <div className="shared-header">
            <h1>🌿 GardenPin</h1>
            <div className="small muted">Sdílení zahrady</div>
          </div>
          <div className="card">
            <div className="empty">
              <div className="icon">🔒</div>
              <div className="mb-2"><strong>Sdílení není dostupné</strong></div>
              <div className="small muted">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { garden, pins } = data;
  const rotation = garden.rotation || 0;

  return (
    <div className="shared-app">
      <div className="shared-page">
        <div className="shared-header">
          <h1>🗺️ {garden.name}</h1>
          <div className="small muted">
            Sdíleno přes <strong>🌿 GardenPin</strong> · {pins.length}{' '}
            {pins.length === 1 ? 'rostlina' : pins.length < 5 ? 'rostliny' : 'rostlin'}
          </div>
        </div>

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
                style={{ transform: `rotate(${rotation}deg)` }}
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
                    userSelect: 'none',
                  }}
                  onClick={() => setSelectedPin(p)}
                  title={p.name}
                >
                  <div className="pin-body" style={{ background: p.color || '#4a7c3a' }} />
                  <div className="pin-label">{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="empty">
              <div className="icon">🌱</div>
              <div>Tato zahrada zatím nemá mapu.</div>
            </div>
          </div>
        )}

        <h3 className="section-title">📍 Rostliny ({pins.length})</h3>
        {pins.length === 0 ? (
          <div className="card empty small">Zatím žádné rostliny.</div>
        ) : (
          pins.map((p) => (
            <div
              key={p.id}
              className="garden-card"
              onClick={() => setSelectedPin(p)}
              style={{ cursor: 'pointer' }}
            >
              {p.photo_path ? (
                <img src={p.photo_path} alt="" className="plant-avatar" />
              ) : (
                <div
                  className="plant-avatar plant-avatar-placeholder"
                  style={{
                    background: (p.color || '#4a7c3a') + '22',
                    color: p.color || '#4a7c3a',
                  }}
                >
                  🌿
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

        <div className="shared-footer">
          <div className="small muted">
            Vytvořeno v <strong>🌿 GardenPin</strong> · Read-only sdílení
          </div>
        </div>
      </div>

      {selectedPin && (
        <SharedPinModal pin={selectedPin} onClose={() => setSelectedPin(null)} />
      )}
    </div>
  );
}

function SharedPinModal({ pin, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div className="row spread mb-2">
          <h3 style={{ margin: 0 }}>{pin.name}</h3>
          <button className="btn ghost small" onClick={onClose}>✕</button>
        </div>
        {pin.photo_path && (
          <img
            src={pin.photo_path}
            alt={pin.name}
            style={{
              width: '100%',
              borderRadius: 12,
              marginBottom: 12,
              maxHeight: 320,
              objectFit: 'cover',
            }}
          />
        )}
        {pin.plant_name && (
          <div className="mb-1"><strong>🌿 Rostlina:</strong> {pin.plant_name}</div>
        )}
        {pin.planting_date && (
          <div className="mb-1">
            <strong>📅 Vysazeno:</strong>{' '}
            {new Date(pin.planting_date).toLocaleDateString('cs-CZ')}
          </div>
        )}
        {pin.notes && (
          <div className="mb-1">
            <strong>📝 Poznámky:</strong>
            <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {pin.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
