// OnboardingFlow — iOS-style interaktivní průvodce pro nové uživatele.
// 5 kroků: Vítej → klimatická zóna → první zahrada → první rostlina → hotovo.
// Na rozdíl od původní čistě informační verze tenhle průvodce reálně zakládá
// data (zahradu, pin, sezónní úkony) přes API, takže nový uživatel skončí
// rovnou s první naplánovanou péčí. Lze kdykoliv přeskočit.
// Flag v localStorage pod klíčem `gp_onboarded`, aby se neobjevoval znovu.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName } from '../utils.js';
import i18n from '../i18n.js';
import { COUNTRIES, getZonesByCountry, getZoneCountry, describeZone, getZoneOffsetDays } from '../data/climateZones.js';
import { taskTypeFromEmoji } from '../data/taskTypes.js';
import { findPlantByName } from '../plantDatabase.js';
import PlantAutocomplete from './PlantAutocomplete.jsx';

const STORAGE_KEY = 'gp_onboarded';
const USER_NAME_KEY = 'gardenpin.userName';
const DEMO_GARDEN_KEY = 'gardenpin.demoGardenId';
const DEMO_HINT_DISMISSED_KEY = 'gardenpin.demoHintDismissed';

// Pevný seed demo zahrady — 3 rostliny rozmístěné po mapě, každá s jedním
// hlavním sezónním úkonem v jiném měsíci (květen / červen / léto opakovaně).
// Pozice x/y jsou procenta (0–100), task_type z `data/taskTypes.js`.
const DEMO_PLANTS = [
  { nameCz: 'Salát hlávkový', x: 25, y: 35, emoji: '🧺', taskType: 'sklizen',
    titleKey: 'demoTaskLettuce', month: 5, recurring: false },
  { nameCz: 'Rajče',          x: 50, y: 55, emoji: '🌱', taskType: 'hnojeni',
    titleKey: 'demoTaskTomato', month: 6, recurring: false },
  { nameCz: 'Máta peprná',    x: 75, y: 35, emoji: '🧺', taskType: 'sklizen',
    titleKey: 'demoTaskMint',   month: 7, recurring: true  },
];

export function getDemoGardenId() {
  try {
    const v = localStorage.getItem(DEMO_GARDEN_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function clearDemoGardenFlag() {
  try {
    localStorage.removeItem(DEMO_GARDEN_KEY);
    localStorage.removeItem(DEMO_HINT_DISMISSED_KEY);
  } catch {}
}

export function isDemoHintDismissed() {
  try {
    return !!localStorage.getItem(DEMO_HINT_DISMISSED_KEY);
  } catch {
    return false;
  }
}

export function dismissDemoHint() {
  try {
    localStorage.setItem(DEMO_HINT_DISMISSED_KEY, '1');
  } catch {}
}

// Kroky průvodce — pořadí dle vize (zóna → zahrada → rostlina → úkon).
const STEPS = ['welcome', 'zone', 'garden', 'plant', 'done'];

export function shouldShowOnboardingFlow() {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markOnboardingFlowDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

export function resetOnboardingFlow() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// Konkrétní datum pro sezónní úkon: 15. den daného měsíce, posunutý dle
// klimatické zóny (jako RecommendedTasks/PlantAutocomplete). Letošní rok, nebo
// příští pokud měsíc už uplynul.
function monthSpecificDate(month, zoneId) {
  const now = new Date();
  const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
  const d = new Date(year, month - 1, 15);
  d.setDate(d.getDate() + getZoneOffsetDays(zoneId));
  return d.toISOString().slice(0, 10);
}

export default function OnboardingFlow({ onClose }) {
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const nav = useNavigate();
  const total = STEPS.length;
  const kind = STEPS[stepIdx];

  // Sebraná data napříč kroky
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem(USER_NAME_KEY) || ''; } catch { return ''; }
  });
  const [zoneId, setZoneId] = useState('');
  const [gardenName, setGardenName] = useState('');
  const [gardenFile, setGardenFile] = useState(null);
  const [gardenPreview, setGardenPreview] = useState(null);
  const [garden, setGarden] = useState(null);          // vytvořená zahrada
  const [plantValue, setPlantValue] = useState('');
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [pinCreated, setPinCreated] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [firstTask, setFirstTask] = useState(null);    // nejbližší naplánovaný úkon
  const [busy, setBusy] = useState(false);

  const fileRef = useRef();

  const goNext = () => setStepIdx((i) => Math.min(i + 1, total - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const finish = () => {
    markOnboardingFlowDone();
    persistName();
    onClose?.();
    nav(garden ? `/zahrada/${garden.id}` : '/zahrady');
  };

  const skip = () => {
    markOnboardingFlowDone();
    persistName();
    onClose?.();
  };

  function persistName() {
    try {
      const n = userName.trim();
      if (n) localStorage.setItem(USER_NAME_KEY, n);
    } catch {}
  }

  // Body scroll lock + Escape přeskočí
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') skip(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (f) => {
    setGardenFile(f);
    if (f) {
      const r = new FileReader();
      r.onload = () => setGardenPreview(r.result);
      r.readAsDataURL(f);
    } else {
      setGardenPreview(null);
    }
  };

  // Krok „zahrada" — založí zahradu (+ klimatickou zónu) a postoupí dál.
  const createGarden = async () => {
    if (garden) { goNext(); return; }       // už vytvořeno (návrat zpět)
    const name = gardenName.trim();
    if (!name) return toast(t('onboarding.enterGardenName'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      if (zoneId) fd.append('climate_zone', zoneId);
      if (gardenFile && gardenPreview) {
        const img = new Image();
        img.src = gardenPreview;
        await new Promise((res) => (img.onload = res));
        fd.append('width', img.naturalWidth);
        fd.append('height', img.naturalHeight);
        fd.append('image', gardenFile);
      }
      const g = await api.createGarden(fd);
      setGarden(g);
      persistName();
      goNext();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  // Krok „rostlina" — založí pin uprostřed mapy a vygeneruje sezónní úkony.
  const addPlant = async () => {
    if (!garden) { goNext(); return; }
    if (!selectedPlant) return toast(t('onboarding.selectPlant'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('garden_id', garden.id);
      fd.append('name', selectedPlant.nameCz);
      fd.append('plant_name', selectedPlant.nameCz);
      fd.append('x', '50');   // střed mapy (x/y jsou procenta)
      fd.append('y', '50');
      const pin = await api.createPin(fd);

      // Sezónní úkony rostliny — hlavní akce (zástřih/hnojení/přesazení…),
      // ne micro-tasky. Datum posunuté dle klimatické zóny.
      const seasonal = selectedPlant.seasonalTasks || [];
      const payloads = seasonal.map((t) => ({
        pin_id: pin.id,
        title: `${t.emoji} ${t.action}`,
        task_type: taskTypeFromEmoji(t.emoji),
        frequency_days: null,
        specific_date: monthSpecificDate(t.month, zoneId),
        notes: i18n.t('onboarding.seasonalNote', { month: monthName(t.month - 1).toLowerCase() }),
      }));
      await Promise.all(payloads.map((p) => api.createTask(p)));

      // Najdi nejbližší úkon (od dneška) pro ukázku v posledním kroku.
      const today = new Date().toISOString().slice(0, 10);
      const withDates = seasonal
        .map((t) => ({ ...t, date: monthSpecificDate(t.month, zoneId) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const upcoming = withDates.find((t) => t.date >= today) || withDates[0] || null;

      setPinCreated(true);
      setTaskCount(payloads.length);
      setFirstTask(upcoming);
      goNext();
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  // Demo zahrada — jeden klik, založí "Moje testovací zahrada" se 3 piny a
  // 3 sezónními úkony. ID demo zahrady uloží do localStorage, aby Home a
  // Settings mohly nabídnout odpovídající hint / smazání.
  const createDemoGarden = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', i18n.t('onboarding.demoGardenName'));
      if (zoneId) fd.append('climate_zone', zoneId);
      const g = await api.createGarden(fd);

      const pinPayloads = DEMO_PLANTS.map((dp) => {
        const plant = findPlantByName(dp.nameCz);
        return { dp, plant };
      });

      for (const { dp, plant } of pinPayloads) {
        const pinFd = new FormData();
        pinFd.append('garden_id', g.id);
        pinFd.append('name', plant?.nameCz || dp.nameCz);
        pinFd.append('plant_name', plant?.nameCz || dp.nameCz);
        pinFd.append('x', String(dp.x));
        pinFd.append('y', String(dp.y));
        const pin = await api.createPin(pinFd);

        await api.createTask({
          pin_id: pin.id,
          title: `${dp.emoji} ${i18n.t(`onboarding.${dp.titleKey}`)}`,
          task_type: dp.taskType,
          frequency_days: null,
          specific_date: monthSpecificDate(dp.month, zoneId),
          notes: i18n.t('onboarding.demoTaskNote'),
          recurring: dp.recurring ? 1 : 0,
          recurrence_pattern: dp.recurring ? 'yearly' : null,
        });
      }

      try { localStorage.setItem(DEMO_GARDEN_KEY, String(g.id)); } catch {}
      try { localStorage.removeItem(DEMO_HINT_DISMISSED_KEY); } catch {}
      markOnboardingFlowDone();
      persistName();
      toast(t('onboarding.demoCreated'));
      onClose?.();
      nav(`/zahrada/${g.id}`);
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const onPlantChange = (v, plant) => {
    setPlantValue(v);
    if (plant) setSelectedPlant(plant);
    else if (selectedPlant && v !== selectedPlant.nameCz) setSelectedPlant(null);
  };

  return (
    <div className="ob-flow" role="dialog" aria-modal="true" aria-label={t('onboarding.dialogAria')}>
      <div className="ob-top">
        {stepIdx > 0 && kind !== 'done' ? (
          <button type="button" className="ob-back" onClick={goBack} aria-label={t('onboarding.back')}>‹ {t('onboarding.back')}</button>
        ) : (
          <span />
        )}
        {kind !== 'done' && (
          <button type="button" className="ob-skip" onClick={skip} aria-label={t('onboarding.skipAria')}>
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      <div className="ob-track">
        <div className="ob-slide" key={kind}>
          {kind === 'welcome' && (
            <WelcomeStep userName={userName} setUserName={setUserName} />
          )}
          {kind === 'zone' && (
            <ZoneStep zoneId={zoneId} setZoneId={setZoneId} />
          )}
          {kind === 'garden' && (
            <GardenStep
              gardenName={gardenName}
              setGardenName={setGardenName}
              preview={gardenPreview}
              onPickFile={() => fileRef.current?.click()}
              onClearFile={() => handleFile(null)}
              created={!!garden}
              fileRef={fileRef}
              onFile={(f) => handleFile(f)}
            />
          )}
          {kind === 'plant' && (
            <PlantStep
              gardenName={garden?.name || gardenName}
              value={plantValue}
              onChange={onPlantChange}
              onSelect={setSelectedPlant}
              plant={selectedPlant}
            />
          )}
          {kind === 'done' && (
            <DoneStep taskCount={taskCount} firstTask={firstTask} plant={selectedPlant} />
          )}
        </div>
      </div>

      <div className="ob-bottom">
        <div className="ob-dots" aria-label={t('onboarding.progress')}>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`ob-dot${i === stepIdx ? ' active' : ''}${i < stepIdx ? ' done' : ''}`}
              aria-current={i === stepIdx ? 'step' : undefined}
            />
          ))}
        </div>

        {kind === 'welcome' && (
          <>
            <button type="button" className="ob-cta" onClick={() => { persistName(); goNext(); }}>
              {t('onboarding.start')}
            </button>
            <button
              type="button"
              className="ob-secondary"
              onClick={createDemoGarden}
              disabled={busy}
            >
              {busy ? t('onboarding.creatingDemo') : t('onboarding.createDemo')}
            </button>
          </>
        )}
        {kind === 'zone' && (
          <button type="button" className="ob-cta" onClick={goNext}>
            {zoneId ? t('onboarding.next') : t('onboarding.skipForNow')}
          </button>
        )}
        {kind === 'garden' && (
          <button type="button" className="ob-cta" onClick={createGarden} disabled={busy}>
            {busy ? t('onboarding.creating') : garden ? t('onboarding.next') : t('onboarding.createGarden')}
          </button>
        )}
        {kind === 'plant' && (
          <>
            <button type="button" className="ob-cta" onClick={addPlant} disabled={busy}>
              {busy ? t('onboarding.adding') : t('onboarding.addAndContinue')}
            </button>
            <button type="button" className="ob-secondary" onClick={goNext} disabled={busy}>
              {t('onboarding.skipPlant')}
            </button>
          </>
        )}
        {kind === 'done' && (
          <button type="button" className="ob-cta" onClick={finish}>
            {t('onboarding.letsGo')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Jednotlivé kroky ---------------- */

function WelcomeStep({ userName, setUserName }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🌱</div>
      <h1 className="ob-title">{t('onboarding.welcomeTitle')}</h1>
      <p className="ob-text">
        {t('onboarding.welcomeText')}
      </p>
      <div className="ob-field">
        <label htmlFor="ob-name">{t('onboarding.nameLabel')}</label>
        <input
          id="ob-name"
          className="ob-input"
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={t('onboarding.namePlaceholder')}
          autoComplete="given-name"
          maxLength={40}
        />
      </div>
    </>
  );
}

// Krátký label do chipu — bez nativního názvu v závorce (ten zůstává v nápovědě).
function shortZoneLabel(label) {
  return label.replace(/\s*\(.*?\)\s*$/, '');
}

function ZoneStep({ zoneId, setZoneId }) {
  const { t } = useTranslation();
  // Aktivní země — odvozená z už vybraného regionu (návrat zpět), jinak Česko.
  const [country, setCountry] = useState(() => getZoneCountry(zoneId) || 'CZ');
  const zones = getZonesByCountry(country);
  return (
    <>
      <div className="ob-icon" aria-hidden="true">📍</div>
      <h1 className="ob-title">{t('onboarding.zoneTitle')}</h1>
      <p className="ob-text">
        {t('onboarding.zoneText')}
      </p>
      <div className="ob-country-row no-scrollbar">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            className={`ob-country-chip${country === c.code ? ' active' : ''}`}
            onClick={() => setCountry(c.code)}
          >
            <span aria-hidden="true">{c.flag}</span> {c.label}
          </button>
        ))}
      </div>
      <div className="ob-zone-grid">
        {zones.map((z) => (
          <button
            key={z.id}
            type="button"
            className={`ob-zone-chip${zoneId === z.id ? ' active' : ''}`}
            onClick={() => setZoneId((cur) => (cur === z.id ? '' : z.id))}
            title={z.label}
          >
            {shortZoneLabel(z.label)}
          </button>
        ))}
      </div>
      {zoneId && <p className="ob-hint">{describeZone(zoneId)}</p>}
    </>
  );
}

function GardenStep({ gardenName, setGardenName, preview, onPickFile, onClearFile, created, fileRef, onFile }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🗺️</div>
      <h1 className="ob-title">{t('onboarding.gardenTitle')}</h1>
      <p className="ob-text">
        {t('onboarding.gardenText')}
      </p>
      <div className="ob-field">
        <label htmlFor="ob-garden">{t('onboarding.gardenNameLabel')}</label>
        <input
          id="ob-garden"
          className="ob-input"
          type="text"
          value={gardenName}
          onChange={(e) => setGardenName(e.target.value)}
          placeholder={t('onboarding.gardenNamePlaceholder')}
          disabled={created}
          maxLength={80}
          autoFocus
        />
      </div>
      <div className="ob-file" onClick={created ? undefined : onPickFile}>
        {preview ? (
          <img src={preview} alt="" className="ob-file-preview" />
        ) : (
          <>
            <div className="ob-file-icon" aria-hidden="true">📷</div>
            <div className="ob-hint">{t('onboarding.uploadHint')}</div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {preview && !created && (
        <button type="button" className="ob-secondary" onClick={onClearFile}>{t('onboarding.removePhoto')}</button>
      )}
      {created && <p className="ob-hint">{t('onboarding.gardenCreated')}</p>}
    </>
  );
}

function PlantStep({ gardenName, value, onChange, onSelect, plant }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🌿</div>
      <h1 className="ob-title">
        {gardenName
          ? t('onboarding.plantTitleNamed', { name: gardenName })
          : t('onboarding.plantTitle')}
      </h1>
      <p className="ob-text">
        {t('onboarding.plantText')}
      </p>
      <div className="ob-plant-wrap">
        <PlantAutocomplete
          value={value}
          onChange={onChange}
          onSelect={onSelect}
          placeholder={t('onboarding.plantSearchPlaceholder')}
        />
      </div>
      {plant && (
        <div className="ob-plant-preview">
          <span className="ob-plant-emoji" style={{ background: plant.category.color + '22' }}>
            {plant.category.icon}
          </span>
          <div className="ob-plant-meta">
            <div className="ob-plant-name">{plant.nameCz}</div>
            <div className="ob-plant-lat">{plant.nameLat}</div>
          </div>
          <span className="ob-plant-count">
            {plant.seasonalTasks?.length
              ? t('onboarding.taskCount', { count: plant.seasonalTasks.length })
              : t('onboarding.ready')}
          </span>
        </div>
      )}
    </>
  );
}

function DoneStep({ taskCount, firstTask, plant }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="ob-icon" aria-hidden="true">✅</div>
      <h1 className="ob-title">{t('onboarding.doneTitle')}</h1>
      {taskCount > 0 ? (
        <p className="ob-text">
          {plant
            ? t('onboarding.doneScheduledForPlant', { count: taskCount, plant: plant.nameCz.toLowerCase() })
            : t('onboarding.doneScheduled', { count: taskCount })}
        </p>
      ) : (
        <p className="ob-text">
          {t('onboarding.doneNoTasks')}
        </p>
      )}

      {firstTask && (
        <div className="ob-task-card">
          <div className="ob-task-label">{t('onboarding.firstTask')}</div>
          <div className="ob-task-row">
            <span className="ob-task-emoji" aria-hidden="true">{firstTask.emoji}</span>
            <div className="ob-task-text">
              <div className="ob-task-action">{firstTask.action}</div>
              <div className="ob-hint">{monthName(firstTask.month - 1)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
