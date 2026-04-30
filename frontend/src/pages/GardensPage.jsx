// List of gardens + create new — GardenPin design
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { toast } from '../App.jsx';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [pinCounts, setPinCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      const gs = await api.listGardens();
      setGardens(gs);
      // Načti počty pinů paralelně pro každou zahradu
      const counts = await Promise.all(
        gs.map((g) => api.listPins(g.id).then((ps) => [g.id, ps.length]).catch(() => [g.id, 0])),
      );
      setPinCounts(Object.fromEntries(counts));
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="heading">
          <div className="eyebrow">🌿 GardenPin</div>
          <h1>Vaše zahrady</h1>
          <div className="subtitle">
            {gardens.length === 0
              ? 'Začněte vytvořením první zahrady'
              : `${gardens.length} ${gardens.length === 1 ? 'zahrada' : gardens.length < 5 ? 'zahrady' : 'zahrad'}`}
          </div>
        </div>
        {gardens.length > 0 && (
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Nová
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty">Načítám...</div>
      ) : gardens.length === 0 ? (
        <div className="gp-empty">
          <span className="gp-empty-icon">🌻</span>
          <div className="gp-empty-title">Ještě žádná zahrada</div>
          <div className="gp-empty-text">
            Vytvořte zahradu, nahrajte fotku z leteckého pohledu a začněte zaznamenávat své rostliny pomocí pinů.
          </div>
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Vytvořit první zahradu
          </button>
        </div>
      ) : (
        <div className="gardens-grid">
          {gardens.map((g) => {
            const count = pinCounts[g.id] ?? 0;
            const pinLabel = count === 1 ? 'pin' : count >= 2 && count <= 4 ? 'piny' : 'pinů';
            return (
              <div
                key={g.id}
                className="garden-card-v2"
                onClick={() => nav(`/zahrada/${g.id}`)}
              >
                <div className="img-wrap">
                  {g.image_path ? <img src={g.image_path} alt={g.name} /> : <span>🌱</span>}
                </div>
                <div className="card-body">
                  <div>
                    <div className="g-name">{g.name}</div>
                    <div className="g-meta">
                      📍 {count} {pinLabel} ·{' '}
                      {new Date(g.created_at + 'Z').toLocaleDateString('cs-CZ', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.3rem', color: 'var(--text-dim)' }}>›</span>
                </div>
              </div>
            );
          })}
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
    </>
  );
}

function NewGardenModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    setFile(f);
    if (f) {
      const r = new FileReader();
      r.onload = () => setPreview(r.result);
      r.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Zadejte název');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      if (file) {
        const img = new Image();
        img.src = preview;
        await new Promise((res) => (img.onload = res));
        fd.append('width', img.naturalWidth);
        fd.append('height', img.naturalHeight);
        fd.append('image', file);
      }
      const g = await api.createGarden(fd);
      onCreated(g);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nová zahrada" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Název zahrady</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Zahrada u domu"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Fotografie z leteckého pohledu (volitelné)</label>
          <div className="file-input-wrap" onClick={() => inputRef.current?.click()}>
            {preview ? (
              <img
                src={preview}
                alt=""
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
              />
            ) : (
              <>
                <div style={{ fontSize: '2rem' }}>📷</div>
                <div className="small muted">Klikněte pro nahrání fotky</div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {preview && (
            <button
              type="button"
              className="btn ghost small mt-2"
              onClick={() => handleFile(null)}
            >
              Odstranit fotku
            </button>
          )}
        </div>
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn-cta" disabled={saving}>
            {saving ? 'Ukládám...' : 'Vytvořit zahradu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
