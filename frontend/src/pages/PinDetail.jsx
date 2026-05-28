// PinDetail — iOS-style mobile sheet: hero, tabs (URL hash), FAB, scroll-aware sticky header
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n.js';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { toast, followUpForTask } from '../App.jsx';
import { TASK_TYPES, dueBadge, formatDate, formatDateTime, taskLabel, taskIconName } from '../utils.js';
import PlantAutocomplete, { PlantInfoCard } from '../components/PlantAutocomplete.jsx';
import { findPlantByName } from '../plantDatabase.js';
import RecommendedTasks from '../components/RecommendedTasks.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import CareGapCard from '../components/CareGapCard.jsx';
import AgeTaskCard from '../components/AgeTaskCard.jsx';
import SummerPruningCard from '../components/SummerPruningCard.jsx';
import DivisionTaskCard from '../components/DivisionTaskCard.jsx';
import CutbackTaskCard from '../components/CutbackTaskCard.jsx';
import HedgeTrimCard from '../components/HedgeTrimCard.jsx';
import SowingTaskCard from '../components/SowingTaskCard.jsx';
import HardeningOffCard from '../components/HardeningOffCard.jsx';
import BulbPlantingCard from '../components/BulbPlantingCard.jsx';
import CuttingTaskCard from '../components/CuttingTaskCard.jsx';
import PlantSupportCard from '../components/PlantSupportCard.jsx';
import PinchingCard from '../components/PinchingCard.jsx';
import SpringMulchingCard from '../components/SpringMulchingCard.jsx';
import GraftingTaskCard from '../components/GraftingTaskCard.jsx';
import FruitThinningCard from '../components/FruitThinningCard.jsx';
import PeachLeafCurlSprayCard from '../components/PeachLeafCurlSprayCard.jsx';
import FruitNettingCard from '../components/FruitNettingCard.jsx';
import StrawberryRenewalCard from '../components/StrawberryRenewalCard.jsx';
import TrunkWhitewashCard from '../components/TrunkWhitewashCard.jsx';
import SoilAcidCard from '../components/SoilAcidCard.jsx';
import WoodRipeningCard from '../components/WoodRipeningCard.jsx';
import SeedSavingCard from '../components/SeedSavingCard.jsx';
import SnoozeButton from '../components/SnoozeButton.jsx';
import Icon from '../components/Icon.jsx';
import { hapticNotification } from '../native/haptics.js';
import { openPhotoPicker } from '../native/camera.js';

// Tab keys odrážejí URL hash; pořadí = pořadí v tab baru.
const PD_TABS = ['ukony', 'pece', 'fotky', 'info'];
const PD_DEFAULT_TAB = 'ukony';

function readTabFromHash() {
  if (typeof window === 'undefined') return PD_DEFAULT_TAB;
  const h = window.location.hash.replace(/^#/, '');
  return PD_TABS.includes(h) ? h : PD_DEFAULT_TAB;
}

// Emoji ikona dle kategorie rostliny v plantDatabase.
const CATEGORY_ICONS = {
  vegetables: '🥕',
  fruits: '🍓',
  herbs: '🌿',
  ornamental: '🌸',
  bulbs: '🌷',
  climbers: '🌱',
  shrubs: '🌳',
  trees: '🌳',
  grasses: '🌾',
  water: '💧',
  succulents: '🌵',
  annuals: '🌻',
};
function categoryIcon(plant) {
  if (plant?.category && CATEGORY_ICONS[plant.category]) return CATEGORY_ICONS[plant.category];
  return '📍';
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function PinDetail({ pinId, onClose }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(readTabFromHash);
  const [editing, setEditing] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [members, setMembers] = useState([]); // členové zahrady (pro přiřazení úkolů)

  // Sticky header se objeví, když uživatel posune scroll dolů (a zmizí při zpětném scrollu).
  const sheetRef = useRef(null);
  const lastScrollY = useRef(0);
  const [headerShown, setHeaderShown] = useState(false);

  // Drag-to-dismiss: tah za grip handle dolů zavře sheet (iOS gesto).
  const [drag, setDrag] = useState({ y: 0, dragging: false, released: false });
  const gripStartY = useRef(null);
  const dragY = useRef(0);
  const onGripStart = (e) => { gripStartY.current = e.touches[0].clientY; };
  const onGripMove = (e) => {
    if (gripStartY.current == null) return;
    const dy = Math.max(0, e.touches[0].clientY - gripStartY.current);
    dragY.current = dy;
    setDrag({ y: dy, dragging: true, released: false });
  };
  const onGripEnd = () => {
    if (gripStartY.current == null) return;
    gripStartY.current = null;
    if (dragY.current > 90) { onClose(); return; }
    dragY.current = 0;
    setDrag({ y: 0, dragging: false, released: true });
  };

  const load = async () => {
    try {
      const p = await api.getPin(pinId);
      setPin(p);
      if (p.garden_id) api.listMembers(p.garden_id).then(setMembers).catch(() => {});
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [pinId]);

  // ESC zavírá. Body scroll lock po dobu otevření sheetu.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Sync stavu tabu s URL hash (← / → v prohlížeči zachová tab).
  useEffect(() => {
    const onHash = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Scroll detector: zobraz sticky header při scroll-down, schovej při scroll-up nahoru.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 60) setHeaderShown(false);
      else if (y > lastScrollY.current + 4) setHeaderShown(true);
      else if (y < lastScrollY.current - 6) setHeaderShown(true);
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pin]);

  const changeTab = (t) => {
    setTab(t);
    try {
      window.history.replaceState(null, '', `#${t}`);
    } catch {}
  };

  const completeTask = async (task) => {
    try {
      await api.completeTask(task.id);
      hapticNotification('success');
      toast(t('pin.toastTaskDone'));
      load();
      followUpForTask(task);
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const deleteTask = async (task) => {
    if (!confirm(t('pin.confirmDeleteTask', { title: task.title }))) return;
    try {
      await api.deleteTask(task.id);
      toast(t('pin.toastDeleted'));
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const deletePin = async () => {
    if (!confirm(t('pin.confirmDeletePin'))) return;
    try {
      await api.deletePin(pin.id);
      toast(t('pin.toastPinDeleted'));
      onClose();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  if (loading || !pin) {
    return (
      <div className="pd-backdrop" onClick={onClose}>
        <div className="pd-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="empty" style={{ padding: 40 }}>{t('common.loadingShort')}</div>
        </div>
      </div>
    );
  }

  // Edit formulář otevíráme stále jako Modal (drží se původní UX).
  if (editing) {
    return (
      <EditPinForm
        pin={pin}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />
    );
  }

  const plant = findPlantByName(pin.plant_name);
  const icon = categoryIcon(plant);
  const since = daysSince(pin.planting_date);

  const sheetStyle = (drag.dragging || drag.released)
    ? { transform: `translateY(${drag.y}px)`, transition: drag.dragging ? 'none' : 'transform 0.32s var(--ios-spring)' }
    : undefined;

  return (
    <div className="pd-backdrop" onClick={onClose}>
      <div
        className="pd-sheet"
        ref={sheetRef}
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Grip handle — tah dolů zavře sheet (iOS bottom-sheet gesto) */}
        <div
          className="pd-grip-zone"
          onTouchStart={onGripStart}
          onTouchMove={onGripMove}
          onTouchEnd={onGripEnd}
        >
          <div className="pd-grip" aria-hidden="true" />
        </div>

        {/* Sticky compact header — vrátí se při scrollu nahoru */}
        <div className={`pd-sticky-header ${headerShown ? 'shown' : ''}`}>
          <button className="pd-back-sticky" onClick={onClose} aria-label={t('pin.back')}>‹</button>
          <span className="pd-sticky-title">{pin.name}</span>
        </div>

        {/* Hero */}
        <div className="pd-hero">
          <button type="button" className="pd-back-floating" onClick={onClose}>
            ‹ {t('pin.back')}
          </button>
          <div className="pd-hero-row">
            <div className="pd-hero-icon" aria-hidden="true">{icon}</div>
            <div className="pd-hero-text">
              <h1 className="pd-hero-name">{pin.name}</h1>
              {pin.plant_name && <div className="pd-hero-plant">{pin.plant_name}</div>}
              {plant?.nameLat && <div className="pd-hero-latin">{plant.nameLat}</div>}
              {pin.planting_date && (
                <div className="pd-hero-meta">
                  📅 {t('pin.heroPlanted', { date: formatDate(pin.planting_date) })}
                  {since != null && since >= 0 && <> · {t('pin.heroDaysAgo', { count: since })}</>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs (sticky) */}
        <div className="pd-tabs">
          <TabBtn id="ukony" active={tab} onSelect={changeTab}>
            ✅ {t('pin.tabTasks')}{pin.tasks.length > 0 && <span className="pd-tab-count">{pin.tasks.length}</span>}
          </TabBtn>
          <TabBtn id="pece" active={tab} onSelect={changeTab}>🌿 {t('pin.tabCare')}</TabBtn>
          <TabBtn id="fotky" active={tab} onSelect={changeTab}>📷 {t('pin.tabPhotos')}</TabBtn>
          <TabBtn id="info" active={tab} onSelect={changeTab}>ℹ️ {t('pin.tabInfo')}</TabBtn>
        </div>

        <div className="pd-content">
          {tab === 'ukony' && (
            <UkonyTab
              pin={pin}
              onComplete={completeTask}
              onSnoozed={load}
              onEdit={setEditingTask}
              onDelete={deleteTask}
              onReload={load}
            />
          )}
          {tab === 'pece' && <PeceTab pin={pin} plant={plant} onEditPin={() => setEditing(true)} />}
          {tab === 'fotky' && <PhotoGallery pinId={pin.id} />}
          {tab === 'info' && (
            <InfoTab
              pin={pin}
              plant={plant}
              onReload={load}
              onDeletePin={deletePin}
            />
          )}
        </div>

        {/* FAB — palec ho vždy dosáhne */}
        {tab === 'ukony' && (
          <button
            type="button"
            className="pd-fab"
            onClick={() => setShowNewTask(true)}
            aria-label={t('pin.addTask')}
            title={t('pin.addTask')}
          >
            +
          </button>
        )}

        {showNewTask && (
          <NewTaskForm
            pinId={pin.id}
            members={members}
            onClose={() => setShowNewTask(false)}
            onCreated={() => { setShowNewTask(false); load(); }}
          />
        )}
        {editingTask && (
          <EditTaskForm
            task={editingTask}
            members={members}
            onClose={() => setEditingTask(null)}
            onSaved={() => { setEditingTask(null); load(); }}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({ id, active, onSelect, children }) {
  return (
    <button
      type="button"
      className={`pd-tab-btn${active === id ? ' active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {children}
    </button>
  );
}

// ===================== Úkony tab — iOS grouped list + choroby & škůdci =====================
function UkonyTab({ pin, onComplete, onSnoozed, onEdit, onDelete, onReload }) {
  const { t } = useTranslation();
  const hasTasks = pin.tasks.length > 0;
  return (
    <div>
      {hasTasks ? (
        <div className="pd-task-list">
          {pin.tasks.map((t) => {
            const badge = dueBadge(t.next_due);
            const cls = badge?.cls ? `is-${badge.cls}` : '';
            const canSnooze = t.next_due || t.specific_date;
            return (
              <div key={t.id} className={`pd-task-row ${cls}`}>
                <button
                  type="button"
                  className="pd-task-check"
                  onClick={() => onComplete(t)}
                  aria-label={i18n.t('pin.completeTask')}
                  title={i18n.t('pin.complete')}
                >
                  <Icon name="check" size={15} stroke={2.5} />
                </button>
                <span className="pd-task-ic" aria-hidden="true">
                  <Icon name={taskIconName(t.task_type)} size={16} />
                </span>
                <div className="pd-task-main">
                  <div className="pd-task-name">{t.title}</div>
                  <div className="pd-task-sub">
                    {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
                    {t.frequency_days ? <span className="badge">{i18n.t('pin.everyNDays', { count: t.frequency_days })}</span> : null}
                    {t.specific_date && !t.frequency_days ? <span className="badge">{i18n.t('pin.oneTime')}</span> : null}
                    <span className="badge type">{taskLabel(t.task_type)}</span>
                    {t.assignee_name && (
                      <span className="badge assignee" style={{ '--assignee-color': t.assignee_color || '#7BA889' }}>
                        👤 {t.assignee_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pd-task-trailing">
                  {canSnooze && <SnoozeButton task={t} onSnoozed={onSnoozed} compact />}
                  <button
                    type="button"
                    className="pd-task-mini"
                    onClick={() => onEdit(t)}
                    aria-label={i18n.t('pin.editTask')}
                    title={i18n.t('common.edit')}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="pd-task-mini danger"
                    onClick={() => onDelete(t)}
                    aria-label={i18n.t('pin.deleteTask')}
                    title={i18n.t('common.delete')}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pd-empty">
          <span className="pd-empty-icon">✅</span>
          <div className="pd-empty-text">{t('pin.tasksEmpty')}</div>
        </div>
      )}

      {/* Mezery v péči — „loni ano, letos chybí" (vykreslí se jen jsou-li mezery) */}
      <CareGapCard pin={pin} onPlanned={onReload} />

      {/* Věkově citlivý řez — dle stáří dřeviny (vykreslí se jen pro relevantní věk/kategorii) */}
      <AgeTaskCard pin={pin} onPlanned={onReload} />

      {/* Letní zelený řez ovocných stromů — regulace letošního přírůstku (vykreslí se jen pro jádroviny/třešeň v sezóně 7–8) */}
      <SummerPruningCard pin={pin} onPlanned={onReload} />

      {/* Dělení trsu trvalek/trav dle cyklu (vykreslí se jen pro relevantní věk/kategorii) */}
      <DivisionTaskCard pin={pin} onPlanned={onReload} />

      {/* Každoroční sestřih trvalek/trav — zjara (strukturní/trávy) nebo na podzim (měkké) */}
      <CutbackTaskCard pin={pin} onPlanned={onReload} />

      {/* Letní tvarovací řez formálních živých plotů (vykreslí se jen pro plotové dřeviny v sezóně 7/9) */}
      <HedgeTrimCard pin={pin} onPlanned={onReload} />

      {/* Jarní opory pro vysoké trvalky/popínavé — postav podpěry včas (vykreslí se jen v sezóně 4–5) */}
      <PlantSupportCard pin={pin} onPlanned={onReload} />

      {/* Pinčování letniček + Chelsea chop strukturních trvalek (vykreslí se jen pro letnicky/trvalky/bylinky v sezóně 5–6) */}
      <PinchingCard pin={pin} onPlanned={onReload} />

      {/* Jarní mulčování trvalek a dřevin — 5–8 cm kůry/štěpky pro vlhkost a proti plevelu (vykreslí se jen pro trvalky/letnicky/kere/stromy/ovoce/popinave v sezóně 4–5) */}
      <SpringMulchingCard pin={pin} onPlanned={onReload} />

      {/* Předjarní výsev do předpěstování (vykreslí se jen pro teplomilné plodiny v sezóně) */}
      <SowingTaskCard pin={pin} onPlanned={onReload} />

      {/* Otužování předpěstovaných sazenic — postupné vystavení ven před výsadbou (vykreslí se jen pro zeleninu/letničky v sezóně 4–6) */}
      <HardeningOffCard pin={pin} onPlanned={onReload} />

      {/* Podzimní výsadba jarních cibulovin (vykreslí se jen pro jarní cibule v podzimní sezóně) */}
      <BulbPlantingCard pin={pin} onPlanned={onReload} />

      {/* Množení řízkováním (vykreslí se jen pro keře/popínavé/polodřevité v řízkové sezóně) */}
      <CuttingTaskCard pin={pin} onPlanned={onReload} />

      {/* Roubování / očkování ovocných stromů (vykreslí se jen pro ovoce/stromy v sezóně) */}
      <GraftingTaskCard pin={pin} onPlanned={onReload} />

      {/* Probírka násady ovoce — červnová protrhávka (vykreslí se jen pro jádroviny/velkoplodé peckoviny v sezóně 6) */}
      <FruitThinningCard pin={pin} onPlanned={onReload} />

      {/* Preventivní jarní postřik proti kadeřavosti broskvoně (vykreslí se jen pro broskev/meruňka v sezóně 3) */}
      <PeachLeafCurlSprayCard pin={pin} onPlanned={onReload} />

      {/* Síťování dozrávajícího ovoce proti ptákům (vykreslí se jen pro drobné ovoce / třešně v sezóně 6–7) */}
      <FruitNettingCard pin={pin} onPlanned={onReload} />

      {/* Obnova jahodníku po sklizni — sestřih listů + odběr odnoží (vykreslí se jen pro Fragaria v sezóně 7) */}
      <StrawberryRenewalCard pin={pin} onPlanned={onReload} />

      {/* Bílení kmenů na zimu (vykreslí se jen pro ovoce/stromy v podzimní sezóně 11–12) */}
      <TrunkWhitewashCard pin={pin} onPlanned={onReload} />

      {/* Okyselení půdy pod acidofilní rostlinou (vykreslí se jen pro acidofilní v sezóně 10–11) */}
      <SoilAcidCard pin={pin} onPlanned={onReload} />

      {/* PK přihnojení pro vyzrání dřeva (vykreslí se jen pro trvalé dřeviny v sezóně 8–9) */}
      <WoodRipeningCard pin={pin} onPlanned={onReload} />

      {/* Sběr semen z odkvetlých rostlin — podzimní samosběr na příští sezónu (vykreslí se jen pro letnicky/bylinky/trvalky/zelenina/okrasne v sezóně 8–10) */}
      <SeedSavingCard pin={pin} onPlanned={onReload} />

      {/* Choroby & škůdci — hned pod hlavními úkony (vykreslí se jen má-li rostlina záznamy) */}
      {pin.plant_name && (
        <div className="pd-warnings-section">
          <PlantWarnings plantName={pin.plant_name} />
        </div>
      )}
    </div>
  );
}

// ===================== Péče tab — kompaktní řádky =====================
function CareRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="pd-care-row">
      <span className="pd-care-icon" aria-hidden="true">{icon}</span>
      <div className="pd-care-content">
        <div className="pd-care-label">{label}</div>
        <div className="pd-care-value">{value}</div>
      </div>
    </div>
  );
}

function PeceTab({ pin, plant, onEditPin }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const companions = plant?.companions;
  const hasCompanions = companions && ((companions.good?.length > 0) || (companions.bad?.length > 0));
  const hasAny =
    pin.photo_path ||
    pin.planting_date ||
    pin.notes ||
    plant?.soil || plant?.sun || plant?.watering || plant?.fertilizing || plant?.pruning || plant?.planting || plant?.notes ||
    plant?.hardy || plant?.height || plant?.spread ||
    hasCompanions;
  const goToCatalog = (name) => nav(`/katalog?q=${encodeURIComponent(name)}`);
  return (
    <div>
      {pin.photo_path && (
        <img
          src={pin.photo_path}
          alt={pin.name}
          className="pin-photo-preview"
          style={{ borderRadius: 14, marginBottom: 14 }}
        />
      )}

      {!hasAny ? (
        <div className="pd-empty">
          <span className="pd-empty-icon">🌿</span>
          <div className="pd-empty-text">
            {t('pin.careEmpty')}
          </div>
        </div>
      ) : (
        <div className="pd-care-list">
          <CareRow icon="🪴" label={t('pin.careSoil')} value={plant?.soil} />
          <CareRow icon="☀️" label={t('pin.careSun')} value={plant?.sun} />
          <CareRow icon="💧" label={t('pin.careWatering')} value={plant?.watering} />
          <CareRow icon="🌱" label={t('pin.careFertilizing')} value={plant?.fertilizing} />
          <CareRow icon="✂️" label={t('pin.carePruning')} value={plant?.pruning} />
          <CareRow icon="📅" label={t('pin.carePlanting')} value={plant?.planting} />
          <CareRow icon="❄️" label={t('pin.careHardy')} value={plant?.hardy} />
          <CareRow icon="📏" label={t('pin.careHeight')} value={plant?.height} />
          <CareRow icon="↔️" label={t('pin.careSpread')} value={plant?.spread} />
          <CareRow icon="ℹ️" label={t('pin.careSpeciesNotes')} value={plant?.notes} />
          <CareRow icon="📝" label={t('pin.careOwnNotes')} value={pin.notes} />
        </div>
      )}

      {hasCompanions && (
        <div className="companion-section">
          <div className="companion-title">🤝 {t('pin.companionTitle')}</div>
          {companions.good?.length > 0 && (
            <div className="companion-row">
              <span className="companion-label">{t('pin.companionGood')}</span>
              <div className="companion-pills">
                {companions.good.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="companion-pill good"
                    onClick={() => goToCatalog(name)}
                    title={t('pin.companionSearch', { name })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {companions.bad?.length > 0 && (
            <div className="companion-row">
              <span className="companion-label">{t('pin.companionBad')}</span>
              <div className="companion-pills">
                {companions.bad.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="companion-pill bad"
                    onClick={() => goToCatalog(name)}
                    title={t('pin.companionSearch', { name })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button type="button" className="btn ghost block" onClick={onEditPin}>
        ✏️ {t('pin.editPin')}
      </button>
    </div>
  );
}

// ===================== Info tab =====================
function InfoTab({ pin, plant, onReload, onDeletePin }) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const cond = pin.garden_conditions;
  const condParts = [];
  if (cond) {
    if (cond.soil_type) condParts.push(`🪴 ${cond.soil_type}`);
    if (cond.exposure) {
      const map = {
        N: `⬆️ ${t('pin.exposureN')}`,
        S: `⬇️ ${t('pin.exposureS')}`,
        E: `➡️ ${t('pin.exposureE')}`,
        W: `⬅️ ${t('pin.exposureW')}`,
        mixed: `🧭 ${t('pin.exposureMixed')}`,
      };
      condParts.push(map[cond.exposure] || cond.exposure);
    }
    if (cond.altitude_m) condParts.push(`⛰️ ${cond.altitude_m} m`);
    if (cond.climate_zone) condParts.push(`📍 ${cond.climate_zone}`);
  }

  return (
    <div>
      {/* Pěstební podmínky */}
      {condParts.length > 0 && (
        <div className="pd-section">
          <div className="pd-section-title">🌍 {t('pin.growingConditions')}</div>
          <div className="pd-care-list">
            <div className="pd-care-row">
              <div className="pd-care-content">
                <div className="pd-care-value">{condParts.join(' · ')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sezónní doporučení (RecommendedTasks slouží jako sezónní kalendář pro tuto rostlinu) */}
      {pin.plant_name && (
        <div className="pd-section">
          <RecommendedTasks
            plantName={pin.plant_name}
            pinId={pin.id}
            existingTasks={pin.tasks}
            gardenConditions={pin.garden_conditions}
            onTaskAdded={onReload}
          />
        </div>
      )}

      {/* Sklizeň */}
      <div className="pd-section">
        <div className="pd-section-title">🧺 {t('pin.harvestTitle')}</div>
        <HarvestTab pinId={pin.id} />
      </div>

      {/* Více — historie péče */}
      {!showMore ? (
        <button type="button" className="pd-more" onClick={() => setShowMore(true)}>
          ▾ {t('pin.moreHistory', { count: pin.history.length })}
        </button>
      ) : (
        <div className="pd-section">
          <div className="pd-section-title">📜 {t('pin.historyTitle')}</div>
          {pin.history.length === 0 ? (
            <div className="empty small">{t('pin.historyEmpty')}</div>
          ) : (
            pin.history.map((h) => (
              <div key={h.id} className="history-item">
                <div className="dot" />
                <div className="info">
                  <div>{h.action}</div>
                  {h.notes && <div className="small muted">{h.notes}</div>}
                  <div className="date">{formatDateTime(h.done_at)}</div>
                </div>
              </div>
            ))
          )}
          <button type="button" className="pd-more" onClick={() => setShowMore(false)}>
            ▴ {t('pin.hide')}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className="pd-danger-zone">
        <button type="button" className="pd-danger-btn" onClick={onDeletePin}>
          🗑️ {t('pin.deletePin')}
        </button>
      </div>
    </div>
  );
}

function EditPinForm({ pin, onClose, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(pin.name);
  const [plantName, setPlantName] = useState(pin.plant_name || '');
  const [selectedPlant, setSelectedPlant] = useState(() => findPlantByName(pin.plant_name));
  const [plantingDate, setPlantingDate] = useState(pin.planting_date || '');
  const [notes, setNotes] = useState(pin.notes || '');
  const [color, setColor] = useState(pin.color || '#4a7c3a');
  const [file, setFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('plant_name', plantName);
      fd.append('planting_date', plantingDate);
      fd.append('notes', notes);
      fd.append('color', color);
      if (file) fd.append('photo', file);
      if (removePhoto) fd.append('remove_photo', 'true');
      await api.updatePin(pin.id, fd);
      toast(t('pin.toastSaved'));
      onSaved();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('pin.editPinTitle')} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>{t('pin.fieldPinName')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('pin.fieldPlant')}</label>
          <PlantAutocomplete
            value={plantName}
            onChange={(val, plant) => {
              setPlantName(val);
              if (!plant) setSelectedPlant(null);
            }}
            onSelect={(plant) => {
              setSelectedPlant(plant);
              setPlantName(plant.nameCz);
            }}
            placeholder={t('pin.plantPlaceholder')}
          />
          {selectedPlant && (
            <PlantInfoCard
              plant={selectedPlant}
              pinId={pin.id}
              onTasksCreated={() => toast(t('pin.toastRecommendedAdded'))}
            />
          )}
        </div>
        <div className="field">
          <label>{t('pin.fieldPlantingDate')}</label>
          <input
            type="date"
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('pin.fieldNotes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('pin.fieldPinColor')}</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('pin.fieldPlantPhoto')}</label>
          {pin.photo_path && !removePhoto && !file && (
            <>
              <img src={pin.photo_path} alt="" className="pin-photo-preview mb-2" />
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setRemovePhoto(true)}
              >
                {t('pin.removePhoto')}
              </button>
            </>
          )}
          <div
            className="file-input-wrap mt-2"
            onClick={() =>
              openPhotoPicker({
                multiple: false,
                inputRef: fileRef,
                onFiles: (files) => {
                  setFile(files[0]);
                  setRemovePhoto(false);
                },
              })
            }
          >
            {file ? (
              <div className="small">📎 {file.name}</div>
            ) : (
              <div className="small muted">
                {pin.photo_path ? t('pin.uploadDifferentPhoto') : t('pin.uploadPhotoHint')}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFile(e.target.files?.[0]);
                setRemovePhoto(false);
              }}
            />
          </div>
        </div>
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewTaskForm({ pinId, members = [], onClose, onCreated }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('zalivka');
  const [mode, setMode] = useState('frequency'); // 'frequency' | 'specific'
  const [frequency, setFrequency] = useState(3);
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Auto-fill title from type
    if (!title) {
      const t = TASK_TYPES.find((x) => x.id === taskType);
      if (t) setTitle(t.label);
    }
  }, [taskType]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast(t('pin.toastEnterTaskName'));
    setSaving(true);
    try {
      const data = {
        pin_id: pinId,
        title,
        task_type: taskType,
        notes,
        assigned_to: assignedTo || null,
      };
      if (mode === 'frequency') {
        data.frequency_days = parseInt(frequency, 10);
      } else {
        data.specific_date = specificDate;
      }
      await api.createTask(data);
      toast(t('pin.toastTaskAdded'));
      onCreated();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('pin.newTaskTitle')} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>{t('pin.fieldTaskType')}</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('pin.fieldTaskName')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pin.taskNamePlaceholder')}
          />
        </div>
        <div className="field">
          <label>{t('pin.fieldWhen')}</label>
          <div className="tabs">
            <button
              type="button"
              className={mode === 'frequency' ? 'active' : ''}
              onClick={() => setMode('frequency')}
            >
              🔁 {t('pin.modeRepeating')}
            </button>
            <button
              type="button"
              className={mode === 'specific' ? 'active' : ''}
              onClick={() => setMode('specific')}
            >
              📅 {t('pin.modeOneTime')}
            </button>
          </div>
          {mode === 'frequency' ? (
            <div className="row">
              <label className="small muted">{t('pin.everyLabel')}</label>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={{ width: 80 }}
              />
              <label className="small muted">{t('pin.daysLabel')}</label>
            </div>
          ) : (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>
        <div className="field">
          <label>{t('pin.fieldNotes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {members.length > 0 && (
          <div className="field">
            <label>{t('pin.fieldAssignee')}</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">{t('pin.assigneeNobody')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t('common.saving') : t('pin.addTaskBtn')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===================== P5: Editace úkolu =====================
function EditTaskForm({ task, members = [], onClose, onSaved }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState(task.task_type);
  const [mode, setMode] = useState(task.specific_date ? 'specific' : 'frequency');
  const [frequency, setFrequency] = useState(task.frequency_days || 7);
  const [specificDate, setSpecificDate] = useState(
    task.specific_date || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(task.notes || '');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ? String(task.assigned_to) : '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast(t('pin.toastEnterTaskName'));
    setSaving(true);
    try {
      const data = {
        title,
        task_type: taskType,
        notes,
        frequency_days: mode === 'frequency' ? parseInt(frequency, 10) : null,
        specific_date: mode === 'specific' ? specificDate : null,
        assigned_to: assignedTo || null,
      };
      await api.updateTask(task.id, data);
      toast(t('pin.toastTaskSaved'));
      onSaved();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('pin.editTaskTitle')} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>{t('pin.fieldTaskType')}</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {TASK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('pin.fieldTaskName')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('pin.fieldWhen')}</label>
          <div className="tabs">
            <button
              type="button"
              className={mode === 'frequency' ? 'active' : ''}
              onClick={() => setMode('frequency')}
            >
              🔁 {t('pin.modeRepeating')}
            </button>
            <button
              type="button"
              className={mode === 'specific' ? 'active' : ''}
              onClick={() => setMode('specific')}
            >
              📅 {t('pin.modeOneTime')}
            </button>
          </div>
          {mode === 'frequency' ? (
            <div className="row">
              <label className="small muted">{t('pin.everyLabel')}</label>
              <input
                type="number"
                min="1"
                max="365"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={{ width: 80 }}
              />
              <label className="small muted">{t('pin.daysLabel')}</label>
            </div>
          ) : (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>
        <div className="field">
          <label>{t('pin.fieldNotes')}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {members.length > 0 && (
          <div className="field">
            <label>{t('pin.fieldAssignee')}</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">{t('pin.assigneeNobody')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t('common.saving') : t('pin.saveChanges')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ===================== Photo gallery — fotky rostlin =====================
// Klient-side resize pomocí canvas (max 1600px na delší straně, JPEG 0.85).
async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(i18n.t('pin.errCannotReadFile')));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error(i18n.t('pin.errCannotLoadImage')));
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
            if (!blob) return reject(new Error(i18n.t('pin.errResizeFailed')));
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

function PhotoGallery({ pinId }) {
  const { t } = useTranslation();
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
      toast(t('common.error', { msg: e.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pinId]);

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
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
      toast(t('pin.toastPhotosUploaded'));
      load();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm(t('pin.confirmDeletePhoto'))) return;
    try {
      await api.deletePinPhoto(pinId, photo.id);
      toast(t('pin.toastDeleted'));
      setLightbox(null);
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  return (
    <div className="photo-gallery">
      <div
        className="file-input-wrap mb-2"
        onClick={() =>
          !uploading &&
          openPhotoPicker({ multiple: true, inputRef: fileRef, onFiles: uploadFiles })
        }
        style={{ cursor: uploading ? 'wait' : 'pointer' }}
      >
        <div className="small">
          {uploading ? t('pin.photoUploading') : t('pin.photoAdd')}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div className="empty small">{t('common.loadingShort')}</div>
      ) : photos.length === 0 ? (
        <div className="empty small">{t('pin.photosEmpty')}</div>
      ) : (
        <div className="pd-photo-strip">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="pd-photo-cell"
              onClick={() => setLightbox(i)}
              aria-label={t('pin.viewPhoto')}
            >
              <img src={p.url} alt={p.caption || t('pin.plantPhotoAlt')} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox != null && photos[lightbox] && (
        <div
          className="photo-lightbox pd-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="pd-lb-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label={t('common.close')}
          >
            ✕
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              className="pd-lb-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + photos.length) % photos.length); }}
              aria-label={t('pin.prevPhoto')}
            >
              ‹
            </button>
          )}

          <div className="pd-lb-stage" onClick={(e) => e.stopPropagation()}>
            <PinchImage
              key={photos[lightbox].id}
              src={photos[lightbox].url}
              alt={photos[lightbox].caption || ''}
            />
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              className="pd-lb-nav next"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % photos.length); }}
              aria-label={t('pin.nextPhoto')}
            >
              ›
            </button>
          )}

          <div className="pd-lb-bar" onClick={(e) => e.stopPropagation()}>
            <div className="small muted">
              {photos[lightbox].uploaded_at ? formatDateTime(photos[lightbox].uploaded_at) : ''}
              {photos.length > 1 ? ` · ${lightbox + 1}/${photos.length}` : ''}
            </div>
            <button className="btn danger small" onClick={() => handleDelete(photos[lightbox])}>
              🗑️ {t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Obrázek v lightboxu s pinch-zoom (dva prsty), pan při přiblížení a double-tap zoom.
function PinchImage({ src, alt }) {
  const imgRef = useRef(null);
  const st = useRef({ scale: 1, x: 0, y: 0, startDist: 0, startScale: 1, panX: 0, panY: 0, lastTap: 0, mode: null });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0, animating: false });

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const s = st.current;
    const distOf = (touches) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const set = (scale, x, y, animating = false) => {
      const sc = Math.max(1, Math.min(4, scale));
      if (sc === 1) { x = 0; y = 0; }
      s.scale = sc; s.x = x; s.y = y;
      setView({ scale: sc, x, y, animating });
    };
    const onStart = (e) => {
      if (e.touches.length === 2) {
        s.mode = 'pinch';
        s.startDist = distOf(e.touches);
        s.startScale = s.scale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - s.lastTap < 280) {
          set(s.scale > 1 ? 1 : 2.5, 0, 0, true);
          s.lastTap = 0;
          s.mode = null;
          e.preventDefault();
          return;
        }
        s.lastTap = now;
        if (s.scale > 1) {
          s.mode = 'pan';
          s.panX = e.touches[0].clientX - s.x;
          s.panY = e.touches[0].clientY - s.y;
        } else {
          s.mode = null;
        }
      }
    };
    const onMove = (e) => {
      if (s.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const ratio = distOf(e.touches) / (s.startDist || 1);
        set(s.startScale * ratio, s.x, s.y);
      } else if (s.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        set(s.scale, e.touches[0].clientX - s.panX, e.touches[0].clientY - s.panY);
      }
    };
    const onEnd = (e) => { if (e.touches.length === 0) s.mode = null; };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const onDoubleClick = () => {
    const s = st.current;
    const sc = s.scale > 1 ? 1 : 2.5;
    s.scale = sc; s.x = 0; s.y = 0;
    setView({ scale: sc, x: 0, y: 0, animating: true });
  };

  return (
    <img
      ref={imgRef}
      className="pd-lb-img"
      src={src}
      alt={alt}
      draggable={false}
      onDoubleClick={onDoubleClick}
      style={{
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        transition: view.animating ? 'transform 0.22s var(--ios-ease)' : 'none',
      }}
    />
  );
}

// ===================== Sklizeň (harvests) =====================
const HARVEST_UNITS = ['kg', 'g', 'ks', 'l', 'svazek'];

function HarvestTab({ pinId }) {
  const { t } = useTranslation();
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('kg');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.listPinHarvests(pinId);
      setHarvests(list);
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pinId]);

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(String(amount).replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) return toast(t('pin.toastEnterAmount'));
    setSaving(true);
    try {
      await api.createHarvest({ pin_id: pinId, date, amount: amt, unit, note: note || null });
      toast(t('pin.toastHarvestRecorded'));
      setAmount('');
      setNote('');
      load();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h) => {
    if (!confirm(t('pin.confirmDeleteHarvest', { date: formatDate(h.date) }))) return;
    try {
      await api.deleteHarvest(h.id);
      toast(t('pin.toastDeleted'));
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  // Součet po jednotkách, jen pro tuto rostlinu
  const totals = harvests.reduce((acc, h) => {
    acc[h.unit] = (acc[h.unit] || 0) + Number(h.amount);
    return acc;
  }, {});
  const totalsLine = Object.entries(totals)
    .map(([u, v]) => `${Math.round(v * 100) / 100} ${u}`)
    .join(' · ');

  return (
    <div>
      <form onSubmit={submit} className="harvest-form" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 130px', marginBottom: 8 }}>
            <label className="small muted">{t('pin.harvestDate')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px', marginBottom: 8 }}>
            <label className="small muted">{t('pin.harvestAmount')}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field" style={{ flex: '0 1 110px', marginBottom: 8 }}>
            <label className="small muted">{t('pin.harvestUnit')}</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {HARVEST_UNITS.map((u) => (
                <option key={u} value={u}>{t(`pin.unit_${u}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label className="small muted">{t('pin.harvestNote')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('pin.harvestNotePlaceholder')}
          />
        </div>
        <button type="submit" className="btn block" disabled={saving}>
          {saving ? t('common.saving') : t('pin.recordHarvest')}
        </button>
      </form>

      {totalsLine && (
        <div className="small muted" style={{ marginBottom: 8 }}>
          {t('pin.harvestTotal')} <strong>{totalsLine}</strong>
        </div>
      )}

      {loading ? (
        <div className="empty small">{t('common.loadingShort')}</div>
      ) : harvests.length === 0 ? (
        <div className="empty small">{t('pin.harvestEmpty')}</div>
      ) : (
        harvests.map((h) => (
          <div key={h.id} className="history-item">
            <div className="dot" style={{ background: 'var(--warning)' }} />
            <div className="info">
              <div>
                🧺 <strong>{h.amount} {h.unit}</strong>
              </div>
              {h.note && <div className="small muted">{h.note}</div>}
              <div className="date">{formatDate(h.date)}</div>
            </div>
            <button
              className="btn ghost small"
              onClick={() => remove(h)}
              aria-label={t('pin.deleteHarvest')}
              title={t('pin.deleteHarvest')}
            >
              🗑️
            </button>
          </div>
        ))
      )}
    </div>
  );
}
