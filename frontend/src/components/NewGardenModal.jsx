// Shared modal for creating a new garden
import React, { useState, useRef } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import Modal from './Modal.jsx';

export default function NewGardenModal({ onClose, onCreated }) {
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
