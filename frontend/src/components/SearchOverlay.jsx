// Globální vyhledávání — overlay s inputem; hledá zahrady, piny a rostliny
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import PinDetail from '../pages/PinDetail.jsx';

// Zvýrazni shodu v textu (case + diacritics insensitive)
function highlight(text, q) {
  if (!text || !q) return text || '';
  const stripDia = (s) =>
    (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tNorm = stripDia(text);
  const qNorm = stripDia(q);
  const idx = tNorm.indexOf(qNorm);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-hit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchOverlay({ onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ gardens: [], pins: [] });
  const [loading, setLoading] = useState(false);
  const [openPin, setOpenPin] = useState(null);
  const inputRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults({ gardens: [], pins: [] });
      return;
    }
    let cancel = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.search(q);
        if (!cancel) setResults({ gardens: r.gardens || [], pins: r.pins || [] });
      } catch {
        if (!cancel) setResults({ gardens: [], pins: [] });
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 180);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [query]);

  const goGarden = (id) => {
    onClose();
    nav(`/zahrada/${id}`);
  };

  const total = results.gardens.length + results.pins.length;

  return (
    <>
      <div className="search-overlay" role="dialog" aria-label={t('search.dialogLabel')} onClick={onClose}>
        <div className="search-modal" onClick={(e) => e.stopPropagation()}>
          <div className="search-header">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label={t('search.clear')}
                title={t('search.clear')}
              >
                ×
              </button>
            )}
            <button type="button" className="search-close" onClick={onClose} aria-label={t('common.close')}>
              {t('common.cancel')}
            </button>
          </div>

          <div className="search-results">
            {query.trim().length === 0 && (
              <div className="search-empty">
                <div className="search-empty-icon">🌿</div>
                <div className="search-empty-title">{t('search.promptTitle')}</div>
                <div className="search-empty-sub">
                  {t('search.promptSub')}
                </div>
              </div>
            )}

            {query.trim().length > 0 && !loading && total === 0 && (
              <div className="search-empty">
                <div className="search-empty-icon">🤷</div>
                <div className="search-empty-title">{t('search.nothingFound')}</div>
                <div className="search-empty-sub">
                  {t('search.noMatches', { query: query.trim() })}
                </div>
              </div>
            )}

            {loading && query.trim().length > 0 && total === 0 && (
              <div className="search-empty small muted">{t('search.searching')}</div>
            )}

            {results.gardens.length > 0 && (
              <div className="search-group">
                <div className="search-group-title">🗺️ {t('search.groupGardens')} · {results.gardens.length}</div>
                {results.gardens.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="search-row"
                    onClick={() => goGarden(g.id)}
                  >
                    <div className="search-row-thumb">
                      {g.image_path ? <img src={g.image_path} alt="" /> : <span>🌱</span>}
                    </div>
                    <div className="search-row-body">
                      <div className="search-row-title">{highlight(g.name, query)}</div>
                      <div className="search-row-meta">
                        {t('search.plantsCount', { count: g.pin_count ?? 0 })}
                        {g.urgent_count > 0 && (
                          <span className="search-row-urgent"> · {t('search.urgentCount', { count: g.urgent_count })}</span>
                        )}
                      </div>
                    </div>
                    <span className="search-row-arrow">›</span>
                  </button>
                ))}
              </div>
            )}

            {results.pins.length > 0 && (
              <div className="search-group">
                <div className="search-group-title">🌿 {t('search.groupPlants')} · {results.pins.length}</div>
                {results.pins.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="search-row"
                    onClick={() => {
                      setOpenPin(p.id);
                    }}
                  >
                    <div className="search-row-thumb">
                      {p.photo_path ? <img src={p.photo_path} alt="" /> : <span>📍</span>}
                    </div>
                    <div className="search-row-body">
                      <div className="search-row-title">{highlight(p.name, query)}</div>
                      <div className="search-row-meta">
                        {p.plant_name && <>{highlight(p.plant_name, query)} · </>}
                        🗺️ {p.garden_name}
                      </div>
                    </div>
                    <span className="search-row-arrow">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {openPin && (
        <PinDetail
          pinId={openPin}
          onClose={() => {
            setOpenPin(null);
            onClose();
          }}
        />
      )}
    </>
  );
}
