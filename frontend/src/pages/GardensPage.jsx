// List of gardens + create new
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { toast } from '../App.jsx';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
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

  return (
    <>
      <div className="row spread mb-2">
        <h2 className="section-title" style={{ margin: 0 }}>
          🗺️ Vaše zahrady
        </h2>
        <button className="btn small" onClick={() => setShowNew(true)}>
          + Nová
        </button>
      </div>

      {loading ? (
        <div className="empty">Načítám...</div>
      ) : gardens.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌻</div>
          <div className="mb-2">Ještě nemáte žádnou zahradu</div>
          <button className="btn" onClick={() => setShowNew(true)}>
            + Vytvořit první zahradu
          </button>
        </div>
      ) : (
        gardens.map((g) => (
          <div key={g.id} className="garden-card" onClick={() => nav(`/zahrada/${g.id}`)}>
            {g.image_path ? (
              <img src={g.image_path} alt="" className="thumb" />
            ) : (
              <div className="thumb thumb-placeholder">🌱</div>
            )}
            <div className="details">
              <div className="name">{g.name}</div>
              <div className="meta">
                Vytvořeno {new Date(g.created_at + 'Z').toLocaleDateString('cs-CZ')}
              </div>
            </div>
            <span style={{ fontSize: '1.4rem', color: 'var(--text-dim)' }}>›</span>
          </div>
        ))
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
        // Get image dimensions
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
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám...' : 'Vytvořit zahradu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
