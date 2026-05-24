// Katalog rostlin — procházení DB rostlin s filtry, sezónním přehledem a přidáním do zahrady
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLANT_DATABASE, enrichPlant } from '../plantDatabase.js';
import { buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';

const MONTH_NAMES_CZ = [
  '', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];
const MONTH_SHORT_CZ = [
  '', 'led', 'úno', 'bře', 'dub', 'kvě', 'čer',
  'črc', 'srp', 'zář', 'říj', 'lis', 'pro',
];

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Spočítej tasky za rok: pravidelné + sezónní (deduplikace podle title)
function countYearlyTasks(plant) {
  const regular = (plant.tasks || []).length;
  const seasonal = (plant.seasonalTasks || []).length;
  return regular + seasonal;
}

// Vrať nejbližší sezónní úkon od aktuálního měsíce (looping přes rok)
function nextSeasonalAction(plant, currentMonth) {
  const list = plant.seasonalTasks || [];
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.month - b.month);
  // Nejdřív hledej v aktuálním/budoucích měsících
  let found = sorted.find((t) => t.month >= currentMonth);
  // Když nic, vrať první v příštím roce
  if (!found) found = sorted[0];
  const diff = found.month >= currentMonth ? found.month - currentMonth : 12 - currentMonth + found.month;
  return { ...found, monthsAhead: diff };
}

export default function PlantCatalogPage() {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [pickerPlant, setPickerPlant] = useState(null);
  const [gardens, setGardens] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.listGardens().then(setGardens).catch(() => setGardens([]));
  }, []);

  // Obohacený seznam s kategoriemi a sezónními tasky
  const allPlants = useMemo(
    () => PLANT_DATABASE.map(enrichPlant).filter(Boolean),
    [],
  );

  // Dostupné kategorie (dynamicky z dat, seřazené podle počtu)
  const categories = useMemo(() => {
    const map = new Map();
    for (const p of allPlants) {
      const key = p.category?.key || 'other';
      if (!map.has(key)) {
        map.set(key, { key, label: p.category?.label || 'Ostatní', icon: p.category?.icon || '🌿', color: p.category?.color || '#6b6b70', count: 0 });
      }
      map.get(key).count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allPlants]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return allPlants.filter((p) => {
      if (categoryFilter !== 'all' && p.category?.key !== categoryFilter) return false;
      if (!q) return true;
      const cz = normalize(p.nameCz);
      const lat = normalize(p.nameLat);
      return cz.includes(q) || lat.includes(q);
    });
  }, [allPlants, query, categoryFilter]);

  const currentMonth = new Date().getMonth() + 1;

  const handleAddToGarden = (plant) => {
    if (gardens.length === 0) {
      toast('Nejprve vytvořte zahradu');
      nav('/zahrady');
      return;
    }
    setPickerPlant(plant);
  };

  const handlePickGarden = async (garden) => {
    const plant = pickerPlant;
    setPickerPlant(null);
    if (!plant || !garden) return;
    try {
      const fd = new FormData();
      fd.append('garden_id', garden.id);
      fd.append('name', plant.nameCz);
      fd.append('x', '0.5');
      fd.append('y', '0.5');
      fd.append('plant_name', plant.nameCz);
      fd.append('planting_date', new Date().toISOString().slice(0, 10));
      fd.append('notes', '');
      fd.append('color', plant.category?.color || '#4a7c3a');
      const pin = await api.createPin(fd);

      // Pravidelné úkoly z databáze (zalivka, hnojení, ...)
      const promises = [];
      (plant.tasks || []).forEach((t) => {
        promises.push(
          api.createTask({
            pin_id: pin.id,
            title: t.title,
            task_type: t.task_type,
            frequency_days: t.frequency_days ?? null,
            specific_date: t.specific_date ?? null,
            notes: t.notes ?? null,
          }),
        );
      });
      // Všechny sezónní akce — s posunem podle podmínek vybrané zahrady
      const allCare = new Set((plant.careActions || []).map((_, i) => i));
      const gardenConditions = {
        soil_type: garden.soil_type,
        exposure: garden.exposure,
        altitude_m: garden.altitude_m,
        climate_zone: garden.climate_zone,
      };
      buildSeasonalTaskPayloads(plant, allCare, pin.id, gardenConditions).forEach((payload) => {
        promises.push(api.createTask(payload));
      });
      await Promise.all(promises);

      toast(`✅ Přidáno do ${garden.name}`);
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  return (
    <>
      <div className="catalog-hero">
        <div className="catalog-hero-row">
          <div>
            <div className="catalog-hero-eyebrow">🌿 Katalog rostlin</div>
            <div className="catalog-hero-title">
              {filtered.length} {filtered.length === 1 ? 'rostlina' : filtered.length < 5 ? 'rostliny' : 'rostlin'}
            </div>
            <div className="catalog-hero-sub">
              Procházej, prohlédni si nároky a přidej do zahrady
            </div>
          </div>
        </div>
      </div>

      <div className="catalog-search-wrap">
        <span className="catalog-search-icon">🔍</span>
        <input
          type="search"
          className="catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat rostlinu (česky nebo latinsky)…"
          aria-label="Hledat rostlinu"
        />
        {query && (
          <button
            type="button"
            className="catalog-search-clear"
            onClick={() => setQuery('')}
            aria-label="Vymazat"
          >
            ×
          </button>
        )}
      </div>

      <div className="filter-pills catalog-filter">
        <button
          className={`filter-pill ${categoryFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          🌍 Vše
          <span className="pill-count">{allPlants.length}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            className={`filter-pill ${categoryFilter === c.key ? 'active' : ''}`}
            onClick={() => setCategoryFilter(c.key)}
          >
            {c.icon} {c.label}
            <span className="pill-count">{c.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="gp-empty" style={{ padding: '32px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🔍</span>
          <div className="gp-empty-title">Žádná rostlina nenalezena</div>
          <div className="gp-empty-text">Zkus změnit hledaný výraz nebo filtr.</div>
        </div>
      ) : (
        <div className="plant-catalog-grid">
          {filtered.map((p) => (
            <PlantCatalogCard
              key={p.id}
              plant={p}
              currentMonth={currentMonth}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onAdd={() => handleAddToGarden(p)}
            />
          ))}
        </div>
      )}

      {pickerPlant && (
        <GardenPickerSheet
          plant={pickerPlant}
          gardens={gardens}
          onPick={handlePickGarden}
          onClose={() => setPickerPlant(null)}
        />
      )}
    </>
  );
}

function PlantCatalogCard({ plant, currentMonth, expanded, onToggle, onAdd }) {
  const cat = plant.category || { label: 'Rostlina', icon: '🌿', color: '#6b6b70' };
  const yearlyCount = countYearlyTasks(plant);
  const next = nextSeasonalAction(plant, currentMonth);

  // Mapa měsíc → seznam úkonů (pro tooltipy a měsíční přehled)
  const byMonth = useMemo(() => {
    const m = new Map();
    (plant.seasonalTasks || []).forEach((t) => {
      if (!m.has(t.month)) m.set(t.month, []);
      m.get(t.month).push(t);
    });
    return m;
  }, [plant]);

  return (
    <div className={`plant-catalog-card ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="plant-catalog-card-body"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="plant-catalog-head">
          <div className="plant-catalog-titles">
            <div className="plant-catalog-name">{plant.nameCz}</div>
            <div className="plant-catalog-lat">{plant.nameLat}</div>
          </div>
          <span
            className="plant-catalog-cat-badge"
            style={{ background: cat.color }}
          >
            {cat.icon} {cat.label}
          </span>
        </div>

        <div className="plant-catalog-months" aria-label="Sezónní přehled">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const items = byMonth.get(m);
            const has = items && items.length > 0;
            const isNow = m === currentMonth;
            const tip = has
              ? `${MONTH_SHORT_CZ[m]}: ${items.map((t) => `${t.emoji} ${t.action}`).join(', ')}`
              : MONTH_SHORT_CZ[m];
            return (
              <span
                key={m}
                className={`plant-month-box ${has ? 'has' : ''} ${isNow ? 'now' : ''}`}
                title={tip}
                style={has ? { background: cat.color } : undefined}
              >
                {has && items.length > 1 ? items.length : ''}
              </span>
            );
          })}
        </div>

        <div className="plant-catalog-meta">
          <span className="plant-catalog-meta-item">
            📋 {yearlyCount} {yearlyCount === 1 ? 'úkon' : yearlyCount < 5 ? 'úkony' : 'úkonů'} ročně
          </span>
          {next && (
            <span className="plant-catalog-meta-item">
              ⏭️ {next.emoji} {next.action} v {MONTH_NAMES_CZ[next.month].toLowerCase()}
              {next.monthsAhead === 0 ? ' (tento měsíc)' : ` (za ${next.monthsAhead} ${next.monthsAhead === 1 ? 'měsíc' : next.monthsAhead < 5 ? 'měsíce' : 'měsíců'})`}
            </span>
          )}
        </div>

        {expanded && (
          <div className="plant-catalog-detail">
            {(plant.seasonalTasks || []).length === 0 && (plant.tasks || []).length === 0 ? (
              <div className="plant-catalog-empty">
                Žádné sezónní úkony v databázi.
              </div>
            ) : (
              <>
                {byMonth.size > 0 && (
                  <div className="plant-catalog-detail-section">
                    <div className="plant-catalog-detail-title">🗓️ Sezónní péče po měsících</div>
                    <div className="plant-catalog-detail-months">
                      {Array.from(byMonth.keys()).sort((a, b) => a - b).map((m) => (
                        <div key={m} className="plant-catalog-detail-month">
                          <div className="plant-catalog-detail-month-name">
                            {MONTH_NAMES_CZ[m]}
                          </div>
                          <div className="plant-catalog-detail-month-tasks">
                            {byMonth.get(m).map((t, i) => (
                              <div key={i} className="plant-catalog-detail-task">
                                <span>{t.emoji}</span>
                                <span>{t.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(plant.tasks || []).length > 0 && (
                  <div className="plant-catalog-detail-section">
                    <div className="plant-catalog-detail-title">🔁 Pravidelné úkony</div>
                    <div className="plant-catalog-detail-tasks">
                      {plant.tasks.map((t, i) => (
                        <div key={i} className="plant-catalog-detail-task">
                          <span>•</span>
                          <span>
                            {t.title}
                            {t.frequency_days ? (
                              <span className="muted small">
                                {' '}
                                · co {t.frequency_days} {t.frequency_days === 1 ? 'den' : t.frequency_days < 5 ? 'dny' : 'dní'}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(plant.soil || plant.sun || plant.watering || plant.notes) && (
                  <div className="plant-catalog-detail-section">
                    <div className="plant-catalog-detail-title">🌱 Nároky a poznámky</div>
                    <div className="plant-catalog-detail-info">
                      {plant.soil && <div><strong>Půda:</strong> {plant.soil}</div>}
                      {plant.sun && <div><strong>Světlo:</strong> {plant.sun}</div>}
                      {plant.watering && <div><strong>Zálivka:</strong> {plant.watering}</div>}
                      {plant.notes && <div><strong>Poznámky:</strong> {plant.notes}</div>}
                    </div>
                  </div>
                )}

                <PlantWarnings plantName={plant.nameCz} />
              </>
            )}
          </div>
        )}
      </button>

      <div className="plant-catalog-card-cta">
        <button
          type="button"
          className="btn small"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          + Přidat do zahrady
        </button>
        <button
          type="button"
          className="plant-catalog-expand-btn"
          onClick={onToggle}
          aria-label={expanded ? 'Skrýt detail' : 'Zobrazit detail'}
        >
          {expanded ? '▴ Skrýt' : '▾ Detail'}
        </button>
      </div>
    </div>
  );
}

function GardenPickerSheet({ plant, gardens, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <span>Přidat <em style={{ fontStyle: 'normal', color: 'var(--forest)' }}>{plant.nameCz}</em> do…</span>
          <button className="close-btn" onClick={onClose} aria-label="Zavřít">×</button>
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Pin vznikne ve středu mapy zahrady. Můžeš ho potom přesunout.
        </p>
        <div className="garden-picker-list">
          {gardens.map((g) => (
            <button
              key={g.id}
              type="button"
              className="garden-picker-item"
              onClick={() => onPick(g)}
            >
              <div className="garden-picker-img">
                {g.image_path ? (
                  <img src={g.image_path} alt={g.name} />
                ) : (
                  <span>🌱</span>
                )}
              </div>
              <div className="garden-picker-info">
                <div className="garden-picker-name">{g.name}</div>
                <div className="garden-picker-meta">
                  📍 {g.pin_count || 0} {g.pin_count === 1 ? 'pin' : 'pinů'}
                </div>
              </div>
              <span className="garden-picker-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
