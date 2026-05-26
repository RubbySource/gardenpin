// List of gardens + create new — iOS redesign:
// large title + hledání · velké karty s hero fotkou + status chipy ·
// swipe-to-reveal akce (Sdílet / Upravit / Smazat) + „•••" menu pro desktop.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n.js';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import NewGardenModal from '../components/NewGardenModal.jsx';
import TemplateGardenModal from '../components/TemplateGardenModal.jsx';
import Icon from '../components/Icon.jsx';
import { useSwipeReveal } from '../hooks/useSwipeReveal.js';
import { getClimateZone } from '../data/climateZones.js';
import { shareLink } from '../native/share.js';
import { formatDate } from '../utils.js';
import { toast } from '../App.jsx';

const EXPOSURE_TEXT = {
  N: 'gardens.exposureN',
  S: 'gardens.exposureS',
  E: 'gardens.exposureE',
  W: 'gardens.exposureW',
  mixed: 'gardens.exposureMixed',
};

function gardenMeta(g) {
  const parts = [];
  if (g.location) parts.push(g.location);
  if (g.exposure && EXPOSURE_TEXT[g.exposure]) parts.push(i18n.t(EXPOSURE_TEXT[g.exposure]));
  const zone = getClimateZone(g.climate_zone);
  if (zone && !g.location) parts.push(zone.label);
  if (parts.length === 0) {
    parts.push(formatDate(g.created_at + 'Z'));
  }
  return parts.join(' · ');
}

export default function GardensPage() {
  const { t } = useTranslation();
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
      toast(t('common.error', { msg: e.message }));
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
      toast(t('gardens.toastDeleted'));
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const handleShare = async (g) => {
    try {
      const { token } = await api.createShareToken(g.id);
      const url = `${window.location.origin}/share/${token}`;
      const status = await shareLink({
        url,
        title: g.name,
        text: t('gardens.shareText', { name: g.name }),
      });
      if (status === 'copied') toast(t('gardens.toastShareCopied'));
      else if (status === 'shown') toast('🔗 ' + url);
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const subtitle =
    gardens.length === 0
      ? t('gardens.subtitleEmpty')
      : `${t('gardens.gardenCount', { count: gardens.length })} · ${t('gardens.subtitlePlantsTotal', { count: totalPins })}`;

  return (
    <div className="gardens-page">
      <header className="gl-header">
        <div className="gl-header-row">
          <h1 className="ios-large-title">{t('gardens.title')}</h1>
          <div className="gl-header-actions">
            <button
              className="gl-round-btn ghost"
              onClick={() => setShowTemplate(true)}
              aria-label={t('gardens.createFromTemplate')}
              title={t('gardens.createFromTemplate')}
            >
              <Icon name="leaf" size={19} stroke={1.9} />
            </button>
            <button
              className="gl-round-btn primary"
              onClick={() => setShowNew(true)}
              aria-label={t('gardens.newGarden')}
              title={t('gardens.newGarden')}
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
            placeholder={t('gardens.searchPlaceholder')}
            aria-label={t('gardens.searchPlaceholder')}
          />
          {query && (
            <button className="gl-search-clear" onClick={() => setQuery('')} aria-label={t('gardens.clearSearch')}>
              <Icon name="close" size={15} stroke={2.2} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty">🌱 {t('common.loadingShort')}</div>
      ) : gardens.length === 0 ? (
        <div className="card empty">
          <div className="icon">🌻</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('gardens.emptyTitle')}</div>
          <div className="small muted" style={{ marginBottom: 14 }}>
            {t('gardens.emptyDesc')}
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn ghost" onClick={() => setShowTemplate(true)}>
              {t('gardens.btnTemplate')}
            </button>
            <button className="btn" onClick={() => setShowNew(true)}>
              {t('gardens.btnCreate')}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty small muted">{t('gardens.noMatch', { query })}</div>
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
            toast(t('gardens.toastCreated'));
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
        <Modal title={t('gardens.deleteTitle')} onClose={() => setConfirmDelete(null)}>
          <p style={{ marginTop: 0 }}>
            {t('gardens.deleteConfirmPre')} <strong>{confirmDelete.name}</strong>{t('gardens.deleteConfirmPost')}
          </p>
          <p className="small muted">
            {t('gardens.deleteWarning', { count: confirmDelete.pin_count || 0 })}
          </p>
          <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </button>
            <button className="btn danger" onClick={() => handleDelete(confirmDelete)}>
              {t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GardenCard({ garden, swipeOpen, onSwipeOpenChange, onOpen, onShare, onEdit, onDelete }) {
  const { t } = useTranslation();
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
          <span>{t('gardens.actionShare')}</span>
        </button>
        <button
          className="gl-swipe-action edit"
          onClick={() => runAction(onEdit)}
          tabIndex={isOpen ? 0 : -1}
        >
          <Icon name="pencil" size={21} stroke={1.9} />
          <span>{t('common.edit')}</span>
        </button>
        <button
          className="gl-swipe-action delete"
          onClick={() => runAction(onDelete)}
          tabIndex={isOpen ? 0 : -1}
        >
          <Icon name="trash" size={21} stroke={1.9} />
          <span>{t('common.delete')}</span>
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
              {t('gardens.overdueBadge', { count: urgent })}
            </span>
          )}
          <div className="gl-card-menu" ref={menuRef}>
            <button
              className="gl-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label={t('gardens.gardenOptions')}
              title={t('gardens.options')}
            >
              <span className="gl-dots" aria-hidden="true">•••</span>
            </button>
            {menuOpen && (
              <div className="gd-action-menu gl-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => runAction(onShare)}>
                  <Icon name="share" size={18} /> {t('gardens.menuShare')}
                </button>
                <button onClick={() => runAction(onEdit)}>
                  <Icon name="pencil" size={18} /> {t('gardens.menuRename')}
                </button>
                <button onClick={() => runAction(onDelete)} className="danger">
                  <Icon name="trash" size={18} /> {t('common.delete')}
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
              🌱 {t('gardens.plantCount', { count: pinCount })}
            </span>
            {taskCount > 0 ? (
              <span className="gl-chip primary">
                📅 {t('gardens.taskCount', { count: taskCount })}
              </span>
            ) : pinCount > 0 ? (
              <span className="gl-chip done">{t('gardens.allDone')}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenameGardenModal({ garden, onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('gardens.toastRenamed'));
      onSaved();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
      setSaving(false);
    }
  };

  return (
    <Modal title={t('gardens.renameTitle')} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>{t('gardens.nameLabel')}</label>
          <input
            type="text"
            value={name}
            autoFocus
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          {t('gardens.renameHint')}
        </p>
        <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={saving || !name.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
