// OnboardingFlow — iOS-style interaktivní průvodce pro nové uživatele.
// 5 kroků: Vítej → klimatická zóna → první zahrada → první rostlina → hotovo.
// Na rozdíl od původní čistě informační verze tenhle průvodce reálně zakládá
// data (zahradu, pin, sezónní úkony) přes API, takže nový uživatel skončí
// rovnou s první naplánovanou péčí. Lze kdykoliv přeskočit.
// Flag v localStorage pod klíčem `gp_onboarded`, aby se neobjevoval znovu.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { COUNTRIES, getZonesByCountry, getZoneCountry, describeZone, getZoneOffsetDays } from '../data/climateZones.js';
import { taskTypeFromEmoji } from '../data/taskTypes.js';
import PlantAutocomplete from './PlantAutocomplete.jsx';

const STORAGE_KEY = 'gp_onboarded';
const USER_NAME_KEY = 'gardenpin.userName';

const MONTH_NAMES_CZ = [
  '', 'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

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
    if (!name) return toast('Zadej název zahrady');
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
      toast('Chyba: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  // Krok „rostlina" — založí pin uprostřed mapy a vygeneruje sezónní úkony.
  const addPlant = async () => {
    if (!garden) { goNext(); return; }
    if (!selectedPlant) return toast('Vyber rostlinu ze seznamu');
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
        notes: `Sezónní úkon (${MONTH_NAMES_CZ[t.month]})`,
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
      toast('Chyba: ' + err.message);
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
    <div className="ob-flow" role="dialog" aria-modal="true" aria-label="Onboarding průvodce">
      <div className="ob-top">
        {stepIdx > 0 && kind !== 'done' ? (
          <button type="button" className="ob-back" onClick={goBack} aria-label="Zpět">‹ Zpět</button>
        ) : (
          <span />
        )}
        {kind !== 'done' && (
          <button type="button" className="ob-skip" onClick={skip} aria-label="Přeskočit průvodce">
            Přeskočit
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
        <div className="ob-dots" aria-label="Postup">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`ob-dot${i === stepIdx ? ' active' : ''}${i < stepIdx ? ' done' : ''}`}
              aria-current={i === stepIdx ? 'step' : undefined}
            />
          ))}
        </div>

        {kind === 'welcome' && (
          <button type="button" className="ob-cta" onClick={() => { persistName(); goNext(); }}>
            Začít
          </button>
        )}
        {kind === 'zone' && (
          <button type="button" className="ob-cta" onClick={goNext}>
            {zoneId ? 'Dál →' : 'Zatím přeskočit →'}
          </button>
        )}
        {kind === 'garden' && (
          <button type="button" className="ob-cta" onClick={createGarden} disabled={busy}>
            {busy ? 'Vytvářím…' : garden ? 'Dál →' : 'Vytvořit zahradu'}
          </button>
        )}
        {kind === 'plant' && (
          <>
            <button type="button" className="ob-cta" onClick={addPlant} disabled={busy}>
              {busy ? 'Přidávám…' : 'Přidat a pokračovat'}
            </button>
            <button type="button" className="ob-secondary" onClick={goNext} disabled={busy}>
              Zatím přeskočit
            </button>
          </>
        )}
        {kind === 'done' && (
          <button type="button" className="ob-cta" onClick={finish}>
            Jdeme na to 🌱
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Jednotlivé kroky ---------------- */

function WelcomeStep({ userName, setUserName }) {
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🌱</div>
      <h1 className="ob-title">Vítej v GardenPinu</h1>
      <p className="ob-text">
        Tvůj zahradní deník. Pohlídá ti hlavní sezónní úkony po celý rok — zástřih,
        přesazení, hnojení. Za chvilku tě provedeme prvním nastavením.
      </p>
      <div className="ob-field">
        <label htmlFor="ob-name">Jak ti máme říkat?</label>
        <input
          id="ob-name"
          className="ob-input"
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Tvoje jméno (volitelné)"
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
  // Aktivní země — odvozená z už vybraného regionu (návrat zpět), jinak Česko.
  const [country, setCountry] = useState(() => getZoneCountry(zoneId) || 'CZ');
  const zones = getZonesByCountry(country);
  return (
    <>
      <div className="ob-icon" aria-hidden="true">📍</div>
      <h1 className="ob-title">Odkud zahradničíš?</h1>
      <p className="ob-text">
        Podle regionu upravíme termíny sezónních úkonů — jaro přichází v teplých
        nížinách dřív než v horách a na severovýchodě.
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
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🗺️</div>
      <h1 className="ob-title">Přidej svou první zahradu</h1>
      <p className="ob-text">
        Pojmenuj ji a nahraj fotku z leteckého pohledu — pomůže ti orientovat se
        mezi rostlinami. Fotka je volitelná.
      </p>
      <div className="ob-field">
        <label htmlFor="ob-garden">Název zahrady</label>
        <input
          id="ob-garden"
          className="ob-input"
          type="text"
          value={gardenName}
          onChange={(e) => setGardenName(e.target.value)}
          placeholder="Např. Zahrada u domu"
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
            <div className="ob-hint">Klikni pro nahrání fotky (volitelné)</div>
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
        <button type="button" className="ob-secondary" onClick={onClearFile}>Odstranit fotku</button>
      )}
      {created && <p className="ob-hint">✓ Zahrada vytvořena</p>}
    </>
  );
}

function PlantStep({ gardenName, value, onChange, onSelect, plant }) {
  return (
    <>
      <div className="ob-icon" aria-hidden="true">🌿</div>
      <h1 className="ob-title">Co {gardenName ? `v „${gardenName}"` : 'v ní'} roste?</h1>
      <p className="ob-text">
        Vyber první rostlinu z 321 druhů. GardenPin sám navrhne hlavní úkony a
        naplánuje je do správných měsíců.
      </p>
      <div className="ob-plant-wrap">
        <PlantAutocomplete
          value={value}
          onChange={onChange}
          onSelect={onSelect}
          placeholder="Hledat rostlinu… (např. Levandule)"
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
              ? `${plant.seasonalTasks.length} úkonů`
              : 'připraveno'}
          </span>
        </div>
      )}
    </>
  );
}

function DoneStep({ taskCount, firstTask, plant }) {
  return (
    <>
      <div className="ob-icon" aria-hidden="true">✅</div>
      <h1 className="ob-title">Vše připraveno!</h1>
      {taskCount > 0 ? (
        <p className="ob-text">
          Naplánovali jsme <strong>{taskCount}</strong>{' '}
          {taskCount === 1 ? 'sezónní úkon' : taskCount < 5 ? 'sezónní úkony' : 'sezónních úkonů'}
          {plant ? ` pro ${plant.nameCz.toLowerCase()}` : ''}. Každý měsíc tě GardenPin
          upozorní, ať nic nezapomeneš.
        </p>
      ) : (
        <p className="ob-text">
          Až přidáš rostliny, GardenPin ti sám naplánuje hlavní sezónní úkony a každý
          měsíc tě na ně upozorní.
        </p>
      )}

      {firstTask && (
        <div className="ob-task-card">
          <div className="ob-task-label">Tvůj první úkon</div>
          <div className="ob-task-row">
            <span className="ob-task-emoji" aria-hidden="true">{firstTask.emoji}</span>
            <div className="ob-task-text">
              <div className="ob-task-action">{firstTask.action}</div>
              <div className="ob-hint">{MONTH_NAMES_CZ[firstTask.month]}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
