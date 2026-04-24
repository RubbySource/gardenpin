// Autocomplete input pro výběr rostliny z databáze
import React, { useEffect, useRef, useState } from 'react';
import { searchPlants } from '../plantDatabase.js';

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

  // Zavřít dropdown při kliknutí mimo
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
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {results.map((p) => (
            <div
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, rgba(74,124,58,0.08))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>🌿 {p.nameCz}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                {p.nameLat}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * PlantInfoCard — zobrazí info o vybrané rostlině z databáze
 */
export function PlantInfoCard({ plant, pinId, onTasksCreated }) {
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const createTasks = async () => {
    if (!pinId || !plant?.tasks?.length) return;
    setCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const promises = plant.tasks.map((t) =>
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
      await Promise.all(promises);
      setDone(true);
      onTasksCreated?.();
    } catch (e) {
      console.error('Chyba při vytváření úkolů', e);
    } finally {
      setCreating(false);
    }
  };

  if (!plant) return null;
  return (
    <div
      style={{
        background: 'rgba(74,124,58,0.07)',
        border: '1px solid rgba(74,124,58,0.2)',
        borderRadius: 10,
        padding: '12px 14px',
        marginTop: 8,
        fontSize: '0.85rem',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        🌿 {plant.nameCz}{' '}
        <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          {plant.nameLat}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>☀️ Slunce: </span>
          {plant.sun}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>💧 Zálivka: </span>
          {plant.watering}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>🌱 Hnojení: </span>
          {plant.fertilizing}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>✂️ Řez: </span>
          {plant.pruning}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>📅 Výsadba: </span>
          {plant.planting}
        </div>
        {plant.notes && (
          <div style={{ marginTop: 4, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            💡 {plant.notes}
          </div>
        )}
      </div>
      {pinId && plant.tasks?.length > 0 && !done && (
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: 10, width: '100%', fontSize: '0.82rem' }}
          onClick={createTasks}
          disabled={creating}
        >
          {creating
            ? 'Vytvářím úkoly…'
            : `✅ Přidat ${plant.tasks.length} doporučených úkolů z databáze`}
        </button>
      )}
      {done && (
        <div style={{ marginTop: 8, color: '#4a7c3a', fontSize: '0.82rem', fontWeight: 600 }}>
          ✅ Úkoly přidány ({plant.tasks.length})
        </div>
      )}
    </div>
  );
}
