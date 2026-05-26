// List of gardens + create new — iOS redesign:
// large title + hledání · velké karty s hero fotkou + status chipy ·
// swipe-to-reveal akce (Sdílet / Upravit / Smazat) + „•••" menu pro desktop.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import TemplateGardenModal from '../components/TemplateGardenModal.jsx';
import Icon from '../components/Icon.jsx';
import { useSwipeReveal } from '../hooks/useSwipeReveal.js';
import { getClimateZone } from '../data/climateZones.js';
import { shareLink } from '../native/share.js';
import { toast } from '../App.jsx';

const EXPOSURE_TEXT = {
  N: 'severní expozice',
  S: 'jižní expozice',
  E: 'východní expozice',
  W: 'západní expozice',
  mixed: 'smíšená expozice',
};

const plural = (n, one, few, many) =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;

function gardenMeta(g) {
  const parts = [];
  if (g.location) parts.push(g.location);
  if (g.exposure && EXPOSURE_TEXT[g.exposure]) parts.push(EXPOSURE_TEXT[g.exposure]);
  const zone = getClimateZone(g.climate_zone);
  if (zone && !g.location) parts.push(zone.label);
  if (parts.length === 0) {
    parts.push(
      new Date(g.created_at + 'Z').toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }
  return parts.join(' · ');
}

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [query, setQuery] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState(null);
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

  const filtered = query.trim()
    ? gardens.filter((g) =>
        g.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        (g.location || '').toLowerCase().includes(query.trim().toLowerCase()),
      )
    : gardens;

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

  const handleShare = async (g) => {
    try {
      const { token } = await api.createShareToken(g.id);
      const url = `${window.location.origin}/share/${token}`;
      const status = await shareLink({
        url,
        title: g.name,
        text: `Podívej se na moji zahradu „${g.name}" v GardenPin`,
      });
      if (status === 'copied') toast('🔗 Odkaz na sdílení zkopírován');
      else if (status === 'shown') toast('🔗 ' + url);
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const subtitle =
    gardens.length === 0
      ? 'Začněte mapovat svou první zahradu'
      : `${gardens.length} ${plural(gardens.length, 'zahrada', 'zahrady', 'zahrad')} · ${totalPins} ${plural(totalPins, 'rostlina', 'rostliny', 'rostlin')} celkem`;

  return (
    <div className="gardens-page">
      <header className="gl-header">
        <div className="gl-header-row">
          <h1 className="ios-large-title">Zahrady</h1>
          <div className="gl-header-actions">
            <button
              className="gl-round-btn ghost"
              onClick={() => setShowTemplate(true)}
              aria-label="Vytvořit ze šablony"
              title="Vytvořit ze šablony"
            >
              <Icon name="leaf" size={19} stroke={1.9} />
            </button>
            <button
              className="gl-round-btn primary"
              onClick={() => setShowNew(true)}
              aria-label="Nová zahrada"
              title="Nová zahrada"
            >
              <Icon name="plus" size={20} stroke={2.4} />
            </button>
          </div>
        </div>
        <p className="gl-subtitle">{subtitle}</p>
      </header>

      {gardens.length > 1 && (
        <div className="gl-search">
          <Icon name="search" size={17} stroke={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat zahradu"
            aria-label="Hledat zahradu"
          />
          {query && (
            <button className="gl-search-clear" onClick={() => setQuery('')} aria-label="Vymazat">
              <Icon name="close" size={15} stroke={2.2} />
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
      ) : filtered.length === 0 ? (
        <div className="empty small muted">Žádná zahrada neodpovídá „{query}".</div>
      ) : (
        <div className="gl-list">
          {filtered.map((g) => (
            <GardenCard
              key={g.id}
              garden={g}
              swipeOpen={openSwipeId === g.id}
              onSwipeOpenChange={(open) => setOpenSwipeId(open ? g.id : null)}
              onOpen={() => nav(`/zahrada/${g.id}`)}
              onShare={() => handleShare(g)}
              onEdit={() => setRenaming(g)}
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

      {renaming && (
        <RenameGardenModal
          garden={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            load();
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
    </div>
  );
}

function GardenCard({ garden, swipeOpen, onSwipeOpenChange, onOpen, onShare, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { handlers, style, isOpen, consumeSwipeClick } = useSwipeReveal({
    width: 222,
    open: swipeOpen,
    onOpenChange: onSwipeOpenChange,
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleCardClick = () => {
    if (consumeSwipeClick()) return; // swallow click synthesised after a swipe
    if (isOpen) {
      onSwipeOpenChange(false); // tap on open row → close it
      return;
    }
    onOpen();
  };

  const runAction = (fn) => {
    onSwipeOpenChange(false);
    setMenuOpen(false);
    fn();
  };

  const meta = gardenMeta(garden);
  const taskCount = garden.task_count || 0;
  const pinCount = garden.pin_count || 0;
  const urgent = garden.urgent_count || 0;

  return (
    <div className="gl-card-cell">
      <div className="gl-swipe-actions" aria-hidden={!isOpen}>
        <button
          className="gl-swipe-action share"
          onClick={() => runAction(onShare)}
          tabIndex={isOpen ? 0 : -1}
        >
          <Icon name="share" size={21} stroke={1.9} />
          <span>Sdílet</span>
        </button>
        <button
          className="gl-swipe-action edit"
          onClick={() => runAction(onEdit)}
          tabIndex={isOpen ? 0 : -1}
        >
          <Icon name="pencil" size={21} stroke={1.9} />
          <span>Upravit</span>
        </button>
        <button
          className="gl-swipe-action delete"
          onClick={() => runAction(onDelete)}
          tabIndex={isOpen ? 0 : -1}
        >
          <Icon name="trash" size={21} stroke={1.9} />
          <span>Smazat</span>
        </button>
      </div>

      <div className="gl-card" style={style} {...handlers} onClick={handleCardClick}>
        <div className="gl-card-hero">
          {garden.image_path ? (
            <img src={garden.image_path} alt={garden.name} />
          ) : (
            <div className="gl-card-hero-ph">
              <span>🌱</span>
            </div>
          )}
          {urgent > 0 && (
            <span className="gl-urgent-badge">
              {urgent} po termínu
            </span>
          )}
          <div className="gl-card-menu" ref={menuRef}>
            <button
              className="gl-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Možnosti zahrady"
              title="Možnosti"
            >
              <span className="gl-dots" aria-hidden="true">•••</span>
            </button>
            {menuOpen && (
              <div className="gd-action-menu gl-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => runAction(onShare)}>
                  <Icon name="share" size={18} /> Sdílet zahradu
                </button>
                <button onClick={() => runAction(onEdit)}>
                  <Icon name="pencil" size={18} /> Přejmenovat
                </button>
                <button onClick={() => runAction(onDelete)} className="danger">
                  <Icon name="trash" size={18} /> Smazat
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="gl-card-body">
          <div className="gl-card-name">{garden.name}</div>
          <div className="gl-card-meta">{meta}</div>
          <div className="gl-card-chips">
            <span className="gl-chip">
              🌱 {pinCount} {plural(pinCount, 'rostlina', 'rostliny', 'rostlin')}
            </span>
            {taskCount > 0 ? (
              <span className="gl-chip primary">
                📅 {taskCount} {plural(taskCount, 'úkol', 'úkoly', 'úkolů')}
              </span>
            ) : pinCount > 0 ? (
              <span className="gl-chip done">✓ Vše hotovo</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenameGardenModal({ garden, onClose, onSaved }) {
  const [name, setName] = useState(garden.name);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', trimmed);
      await api.updateGarden(garden.id, fd);
      toast('✏️ Zahrada přejmenována');
      onSaved();
    } catch (err) {
      toast('Chyba: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Přejmenovat zahradu" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Název zahrady</label>
          <input
            type="text"
            value={name}
            autoFocus
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Pěstební podmínky a mapu upravíš v detailu zahrady.
        </p>
        <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Zrušit
          </button>
          <button type="submit" className="btn" disabled={saving || !name.trim()}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
