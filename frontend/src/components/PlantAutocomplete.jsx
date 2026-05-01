// Autocomplete input pro výběr rostliny + plant info card v GardenPin designu
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchPlants } from '../plantDatabase.js';

// Design tokeny — GardenPin paleta
const PALETTE = {
  forest: '#2d5a27',
  forestDark: '#1f3e1a',
  sand: '#f5f0e8',
  sandDark: '#e5e0d8',
  white: '#ffffff',
  charcoal: '#1a1a1a',
  muted: '#6b7280',
  border: '#e5e0d8',
};

const MONTH_NAMES_CZ = [
  '', 'led', 'úno', 'bře', 'dub', 'kvě', 'čer',
  'črc', 'srp', 'zář', 'říj', 'lis', 'pro',
];

// Convert selected care chips into POST /api/tasks payloads (sezónní úkoly s konkrétním datem 15. v měsíci).
// Reused by PlantInfoCard's CTA i NewPinModal submit, aby se chovaly stejně.
export function buildSeasonalTaskPayloads(plant, selectedCareSet, pinId) {
  if (!plant?.careActions?.length || !selectedCareSet?.size) return [];
  const now = new Date();
  const year = now.getFullYear();
  const monthNow = now.getMonth() + 1;
  const out = [];
  plant.careActions.forEach((care, idx) => {
    if (!selectedCareSet.has(idx)) return;
    const targetYear = care.month >= monthNow ? year : year + 1;
    const m = String(care.month).padStart(2, '0');
    out.push({
      pin_id: pinId,
      title: `${care.emoji} ${care.text}`,
      task_type: 'jine',
      frequency_days: null,
      specific_date: `${targetYear}-${m}-15`,
      notes: `Sezónní péče (${MONTH_NAMES_CZ[care.month]})`,
      recurring: true,
      recurrence_pattern: 'yearly',
    });
  });
  return out;
}

/**
 * PlantAutocomplete
 * Props:
 *   value: string — aktuální hodnota
 *   onChange: (value, plant|null) => void — volá se při každé změně textu
 *   onSelect: (plant) => void — volá se při výběru z dropdownu
 *   placeholder: string
 */
export default function PlantAutocomplete({ value, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const wrapRef = useRef();

  useEffect(() => {
    const r = searchPlants(value);
    setResults(r);
    setOpen(r.length > 0 && value.length >= 1);
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (plant) => {
    setOpen(false);
    onChange(plant.nameCz, plant);
    onSelect?.(plant);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        placeholder={placeholder || 'Název rostliny…'}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            zIndex: 200,
            background: PALETTE.white,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {results.map((p) => (
            <PlantSearchRow key={p.id} plant={p} onPick={() => handleSelect(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Kompaktní řádek dropdownu — thumbnail + jméno + kategorie badge
function PlantSearchRow({ plant, onPick }) {
  const [hover, setHover] = useState(false);
  const cat = plant.category;
  return (
    <div
      onMouseDown={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        borderBottom: `1px solid ${PALETTE.border}`,
        background: hover ? PALETTE.sand : PALETTE.white,
        transition: 'background 0.12s',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: cat.color + '22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: PALETTE.charcoal,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {plant.nameCz}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            color: PALETTE.muted,
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {plant.nameLat}
        </div>
      </div>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          background: cat.color,
          color: '#fff',
          padding: '3px 8px',
          borderRadius: 999,
          flexShrink: 0,
        }}
      >
        {cat.label}
      </span>
    </div>
  );
}

/**
 * PlantInfoCard — nový GardenPin styl
 * - Hero (4:5 ratio, kategorie ikona pokud chybí foto)
 * - Kategorie + zóna badge
 * - Czech & Latin name
 * - Stats row (Světlo / Zálivka / Výška) na sand pozadí
 * - Sezónní péče: care chips s checkboxem
 * - Sticky CTA "+ Přidat do zahrady" s počítadlem zaškrtnutých chips
 */
export function PlantInfoCard({ plant, pinId, onTasksCreated, onSelectionChange }) {
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedCare, setSelectedCare] = useState(() => new Set());

  // Reset výběru při změně rostliny
  useEffect(() => {
    setSelectedCare(new Set());
    setDone(false);
    onSelectionChange?.(new Set());
  }, [plant?.id]);

  if (!plant) return null;

  const toggleCare = (idx) => {
    setSelectedCare((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      onSelectionChange?.(next);
      return next;
    });
  };

  const selectedCount = selectedCare.size;
  const hasDbTasks = plant.tasks?.length > 0;
  const ctaCount = selectedCount + (hasDbTasks ? plant.tasks.length : 0);

  const createTasks = async () => {
    if (!pinId) return;
    setCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const promises = [];

      // 1. Pravidelné úkoly z databáze (zalévání, hnojení, ...)
      if (hasDbTasks) {
        plant.tasks.forEach((t) => {
          promises.push(
            fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pin_id: pinId,
                title: t.title,
                task_type: t.task_type,
                frequency_days: t.frequency_days ?? null,
                specific_date: t.specific_date ?? null,
                notes: t.notes ?? null,
              }),
            }),
          );
        });
      }

      // 2. Vybrané sezónní úkoly z care chips → konkrétní datum letošního roku (nebo příští rok pokud měsíc už uplynul)
      buildSeasonalTaskPayloads(plant, selectedCare, pinId).forEach((payload) => {
        promises.push(
          fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
      });

      await Promise.all(promises);
      setDone(true);
      onTasksCreated?.();
    } catch (e) {
      console.error('Chyba při vytváření úkolů', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        background: PALETTE.white,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 10,
        boxShadow: '0 4px 16px rgba(31,62,26,0.08)',
      }}
    >
      <PlantHero plant={plant} />

      <div style={{ padding: '14px 14px 4px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <CategoryBadge category={plant.category} />
          <ZoneBadge zone={plant.zone} />
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: PALETTE.charcoal,
            lineHeight: 1.2,
          }}
        >
          {plant.nameCz}
        </div>
        <div
          style={{
            fontSize: 14,
            fontStyle: 'italic',
            color: PALETTE.muted,
            marginTop: 2,
          }}
        >
          {plant.nameLat}
        </div>
      </div>

      <StatsRow plant={plant} />

      {plant.careActions?.length > 0 && (
        <CareSection
          actions={plant.careActions}
          selected={selectedCare}
          onToggle={toggleCare}
        />
      )}

      <DetailedInfo plant={plant} />

      {pinId && (hasDbTasks || plant.careActions?.length > 0) && !done && (
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: PALETTE.white,
            padding: '12px 14px 14px',
            borderTop: `1px solid ${PALETTE.border}`,
          }}
        >
          <button
            type="button"
            onClick={createTasks}
            disabled={creating}
            style={{
              width: '100%',
              minHeight: 48,
              padding: '12px 16px',
              background: PALETTE.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: creating ? 'wait' : 'pointer',
              opacity: creating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s, transform 0.05s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {creating ? 'Vytvářím úkoly…' : '+ Přidat do zahrady'}
            {!creating && ctaCount > 0 && (
              <span
                style={{
                  background: '#fff',
                  color: PALETTE.forest,
                  borderRadius: 999,
                  padding: '2px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  marginLeft: 4,
                  minWidth: 28,
                  textAlign: 'center',
                }}
              >
                +{ctaCount}
              </span>
            )}
          </button>
          {hasDbTasks && (
            <div
              style={{
                fontSize: 11,
                color: PALETTE.muted,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              {plant.tasks.length} pravidelných úkolů
              {selectedCount > 0 && ` + ${selectedCount} sezónních`}
            </div>
          )}
        </div>
      )}

      {done && (
        <div
          style={{
            padding: 14,
            color: PALETTE.forest,
            fontSize: 14,
            fontWeight: 700,
            textAlign: 'center',
            background: PALETTE.sand,
            borderTop: `1px solid ${PALETTE.border}`,
          }}
        >
          ✅ Úkoly přidány ({ctaCount})
        </div>
      )}
    </div>
  );
}

// Hero — fotka pinu nebo placeholder s kategorickou ikonou (4:5 poměr)
function PlantHero({ plant }) {
  const cat = plant.category;
  const photo = plant.photo_path || plant.photoUrl || null;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        maxHeight: 360,
        background: photo ? '#000' : cat.color + '15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={plant.nameCz}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ textAlign: 'center', color: cat.color }}>
          <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 8 }}>{cat.icon}</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              opacity: 0.7,
            }}
          >
            {cat.label}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }) {
  return (
    <span
      style={{
        background: PALETTE.forest,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '4px 10px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {category.icon} {category.label}
    </span>
  );
}

function ZoneBadge({ zone }) {
  return (
    <span
      style={{
        background: PALETTE.sand,
        color: PALETTE.charcoal,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '4px 10px',
        borderRadius: 999,
      }}
    >
      Zóna {zone}
    </span>
  );
}

function StatsRow({ plant }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        background: PALETTE.sand,
        margin: '12px 14px',
        borderRadius: 12,
        padding: '12px 8px',
        gap: 4,
      }}
    >
      <Stat label="Světlo" value={plant.light} icon="☀️" />
      <Stat label="Zálivka" value={plant.water} icon="💧" />
      <Stat label="Výška" value={plant.height || '—'} icon="📏" />
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 4px', minWidth: 0 }}>
      <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: PALETTE.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: PALETTE.charcoal,
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CareSection({ actions, selected, onToggle }) {
  return (
    <div style={{ padding: '4px 14px 12px' }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: PALETTE.charcoal,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        🗓️ Sezónní péče
        <span style={{ fontSize: 11, color: PALETTE.muted, fontWeight: 500 }}>
          (vyberte úkoly k přidání)
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {actions.map((a, idx) => (
          <CareChip
            key={idx}
            action={a}
            checked={selected.has(idx)}
            onToggle={() => onToggle(idx)}
          />
        ))}
      </div>
    </div>
  );
}

function CareChip({ action, checked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: checked ? PALETTE.forest + '12' : PALETTE.white,
        border: `1.5px solid ${checked ? PALETTE.forest : PALETTE.border}`,
        borderRadius: 12,
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
        color: PALETTE.charcoal,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${checked ? PALETTE.forest : '#cbd5d0'}`,
          background: checked ? PALETTE.forest : PALETTE.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
        {action.emoji} {action.text}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: checked ? PALETTE.forest : PALETTE.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          background: checked ? PALETTE.forest + '22' : PALETTE.sand,
          padding: '3px 8px',
          borderRadius: 999,
          flexShrink: 0,
        }}
      >
        {MONTH_NAMES_CZ[action.month]}
      </span>
    </button>
  );
}

// Detailní info (původní pole z DB) — sbalitelné, méně dominantní
function DetailedInfo({ plant }) {
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => [
      { label: 'Půda', value: plant.soil, icon: '🪴' },
      { label: 'Hnojení', value: plant.fertilizing, icon: '🌱' },
      { label: 'Řez', value: plant.pruning, icon: '✂️' },
      { label: 'Výsadba', value: plant.planting, icon: '📅' },
      { label: 'Poznámky', value: plant.notes, icon: '💡' },
    ].filter((i) => i.value),
    [plant],
  );

  if (items.length === 0) return null;

  return (
    <div style={{ padding: '0 14px 12px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '8px 0',
          fontSize: 13,
          fontWeight: 600,
          color: PALETTE.muted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{open ? '▾' : '▸'} Detaily pěstování</span>
        <span style={{ fontSize: 11 }}>{items.length}</span>
      </button>
      {open && (
        <div
          style={{
            display: 'grid',
            gap: 6,
            background: PALETTE.sand,
            padding: 10,
            borderRadius: 10,
            fontSize: 13,
            color: PALETTE.charcoal,
          }}
        >
          {items.map((i) => (
            <div key={i.label}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: PALETTE.muted,
                  marginRight: 6,
                }}
              >
                {i.icon} {i.label}
              </span>
              <span>{i.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
