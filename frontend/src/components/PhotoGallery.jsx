// Galerie fotek pinu — multi-upload, client-side resize, thumbnail grid, lightbox
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { formatDateTime } from '../utils.js';

// Klient-side resize pomocí canvas (max 1600px na delší straně, JPEG 0.85).
async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nelze přečíst soubor'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nelze načíst obrázek'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Resize selhal'));
            const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
            });
            resolve(out);
          },
          'image/jpeg',
          quality,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoGallery({ pinId }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.listPinPhotos(pinId);
      setPhotos(list);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pinId]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) {
        try {
          const resized = await resizeImage(f, 1600, 0.85);
          fd.append('photos', resized);
        } catch {
          // Pokud resize selže, pošli originál
          fd.append('photos', f);
        }
      }
      await api.uploadPinPhotos(pinId, fd);
      toast('✅ Fotky nahrány');
      load();
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm('Smazat tuto fotku?')) return;
    try {
      await api.deletePinPhoto(pinId, photo.id);
      toast('Smazáno');
      setLightbox(null);
      load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  return (
    <div className="photo-gallery">
      <div
        className="file-input-wrap mb-2"
        onClick={() => !uploading && fileRef.current?.click()}
        style={{ cursor: uploading ? 'wait' : 'pointer' }}
      >
        <div className="small">
          {uploading ? '⏳ Nahrávám…' : '📷 Přidat fotky (lze vybrat více)'}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div className="empty small">Načítám…</div>
      ) : photos.length === 0 ? (
        <div className="empty small">Zatím žádné fotky. Přidejte první fotku rostliny.</div>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className="photo-thumb"
              onClick={() => setLightbox(p)}
              aria-label="Zobrazit fotku"
            >
              <img src={p.url} alt={p.caption || 'Fotka rostliny'} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="photo-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="photo-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption || ''} />
            <div className="photo-lightbox-bar">
              <div className="small muted">
                {lightbox.uploaded_at ? formatDateTime(lightbox.uploaded_at) : ''}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn danger small"
                  onClick={() => handleDelete(lightbox)}
                >
                  🗑️ Smazat
                </button>
                <button className="btn ghost small" onClick={() => setLightbox(null)}>
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
