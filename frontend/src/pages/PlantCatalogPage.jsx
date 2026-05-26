// Katalog rostlin — procházení DB rostlin s filtry, sezónním přehledem a přidáním do zahrady
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PLANT_DATABASE, enrichPlant, CATEGORY_DEFS } from '../plantDatabase.js';
import { buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { monthName, monthNameShort } from '../utils.js';

// Pevné pořadí pillů — iOS-style, ne dynamicky podle počtu.
// Climbers / Popínavé jdou poslední (uživatel je v spec vynechal, ale máme je v DB).
const CATEGORY_ORDER = [
  'vegetables', 'fruits', 'herbs', 'ornamental', 'annuals',
  'trees', 'conifers', 'shrubs', 'water', 'succulents',
  'bulbs', 'grasses', 'climbers',
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
  const { t } = useTranslation();
  // Init query from URL ?q=… (např. po kliknutí na companion pill v PinDetail nebo katalogu)
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  // Debounced query — filter běží proti tomuhle, ne proti syrovému inputu (200 ms).
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [pickerPlant, setPickerPlant] = useState(null);
  const [gardens, setGardens] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.listGardens().then(setGardens).catch(() => setGardens([]));
  }, []);

  // Sync URL ?q= když uživatel mění query — replace, ať se nemnoží history položky
  useEffect(() => {
    const current = searchParams.get('q') || '';
    if (query !== current) {
      const next = new URLSearchParams(searchParams);
      if (query) next.set('q', query); else next.delete('q');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Když přijde nová URL (např. zpět z PinDetail companion pillu), sync zpět do query
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== query) setQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Debounce search input (200 ms) — předejdeme zbytečnému přefilování 421 plantů při každé klávese
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Obohacený seznam s kategoriemi a sezónními tasky
  const allPlants = useMemo(
    () => PLANT_DATABASE.map(enrichPlant).filter(Boolean),
    [],
  );

  // Spočítej rostliny per kategorie pro pill badge
  const countsByCategory = useMemo(() => {
    const m = {};
    for (const p of allPlants) {
      const k = p.category?.key;
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  }, [allPlants]);

  // Pills — pevné pořadí dle CATEGORY_ORDER, ikona + label z CATEGORY_DEFS,
  // skip kategorie, kde není žádná rostlina (kdyby přibyla v CATEGORY_DEFS ale ne v DB).
  const categories = useMemo(() => {
    const out = [];
    for (const defKey of Object.values(CATEGORY_DEFS)) {
      // CATEGORY_DEFS používá string klíče jako vegetables/fruits/…; defKey je objekt {key,label,icon,color}
    }
    // Iterujeme přímo přes CATEGORY_ORDER, klíče v CATEGORY_DEFS jsou stringy (vegetables atd.)
    for (const cdKey of CATEGORY_ORDER) {
      const def = CATEGORY_DEFS[cdKey];
      if (!def) continue;
      const count = countsByCategory[def.key] || 0;
      if (count === 0) continue;
      out.push({ ...def, count, defsKey: cdKey });
    }
    return out;
  }, [countsByCategory]);

  const filtered = useMemo(() => {
    const q = normalize(debouncedQuery);
    const matches = allPlants.filter((p) => {
      if (categoryFilter !== 'all' && p.category?.key !== categoryFilter) return false;
      if (!q) return true;
      const cz = normalize(p.nameCz);
      const lat = normalize(p.nameLat);
      const notes = normalize(p.notes);
      return cz.includes(q) || lat.includes(q) || notes.includes(q);
    });
    // Seřadit abecedně podle českého názvu (locale-aware pro diakritiku)
    matches.sort((a, b) => a.nameCz.localeCompare(b.nameCz, 'cs'));
    return matches;
  }, [allPlants, debouncedQuery, categoryFilter]);

  const currentMonth = new Date().getMonth() + 1;

  const handleAddToGarden = (plant) => {
    if (gardens.length === 0) {
      toast(t('catalog.createGardenFirst'));
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

      toast(t('catalog.addedTo', { name: garden.name }));
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  return (
    <>
      {/* Sticky stack — search bar + kategorie pills se posouvají dohromady při scrollu */}
      <div className="catalog-sticky">
        <div className="ios-search-wrap" style={{ position: 'static', margin: 0, paddingBottom: 6 }}>
          <div className="ios-search-bar">
            <span className="ios-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              inputMode="search"
              className="ios-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('catalog.searchPlaceholder')}
              aria-label={t('catalog.searchLabel')}
            />
            {query && (
              <button
                type="button"
                className="ios-search-clear"
                onClick={() => setQuery('')}
                aria-label={t('catalog.clearSearch')}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="filter-pills catalog-filter no-scrollbar">
          <button
            className={`filter-pill ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            {t('catalog.allCategories')}
            <span className="pill-count">{allPlants.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.defsKey}
              className={`filter-pill ${categoryFilter === c.key ? 'active' : ''}`}
              onClick={() => setCategoryFilter(c.key)}
            >
              {c.icon} {c.label}
              <span className="pill-count">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-result-count small muted">
        {t('catalog.resultCount', { count: filtered.length })}
      </div>

      {filtered.length === 0 ? (
        <div className="gp-empty" style={{ padding: '32px 16px' }}>
          <span className="gp-empty-icon" style={{ fontSize: '2.4rem' }}>🔍</span>
          <div className="gp-empty-title">{t('catalog.emptyTitle')}</div>
          <div className="gp-empty-text">{t('catalog.emptyText')}</div>
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
              onCompanionClick={(name) => {
                // Stejná stránka — jen překlik filtru. Sbalíme expanded a scrollneme nahoru.
                setQuery(name);
                setExpandedId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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

function PlantCatalogCard({ plant, currentMonth, expanded, onToggle, onAdd, onCompanionClick }) {
  const { t } = useTranslation();
  const cat = plant.category || { label: t('catalog.plantFallback'), icon: '🌿', color: '#6b6b70' };
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
    <div className={`plant-catalog-card ${expanded ? 'expanded' : ' compact'}`}>
      <button
        type="button"
        className="plant-catalog-card-body"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="plant-catalog-compact-row">
          <span
            className="plant-catalog-compact-icon"
            style={{ background: cat.color + '22', color: cat.color }}
            aria-hidden="true"
          >
            {cat.icon}
          </span>
          <div className="plant-catalog-titles">
            <div className="plant-catalog-name">{plant.nameCz}</div>
            <div className="plant-catalog-lat">
              {plant.nameLat}
              {plant.hardy && (
                <span className="plant-catalog-hardy" title="Mrazuvzdornost">❄️ {plant.hardy}</span>
              )}
            </div>
          </div>
          <span className="plant-catalog-chev" aria-hidden="true">
            {expanded ? '▴' : '›'}
          </span>
        </div>

        {expanded && (
          <>
            <div className="plant-catalog-months" aria-label={t('catalog.seasonalOverview')}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const items = byMonth.get(m);
                const has = items && items.length > 0;
                const isNow = m === currentMonth;
                const tip = has
                  ? `${monthNameShort(m - 1)}: ${items.map((it) => `${it.emoji} ${it.action}`).join(', ')}`
                  : monthNameShort(m - 1);
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
                📋 {t('catalog.tasksPerYear', { count: yearlyCount })}
              </span>
              {next && (
                <span className="plant-catalog-meta-item">
                  ⏭️ {next.emoji} {next.action} {t('catalog.inMonth', { month: monthName(next.month - 1).toLowerCase() })}
                  {next.monthsAhead === 0 ? ` ${t('catalog.thisMonthParen')}` : ` ${t('catalog.monthsAheadParen', { count: next.monthsAhead })}`}
                </span>
              )}
            </div>
          </>
        )}

        {expanded && (
          <div className="plant-catalog-detail">
            {(plant.seasonalTasks || []).length === 0 && (plant.tasks || []).length === 0 ? (
              <div className="plant-catalog-empty">
                {t('catalog.noSeasonalTasks')}
              </div>
            ) : (
              <>
                {byMonth.size > 0 && (
                  <div className="plant-catalog-detail-section">
                    <div className="plant-catalog-detail-title">{t('catalog.seasonalCareTitle')}</div>
                    <div className="plant-catalog-detail-months">
                      {Array.from(byMonth.keys()).sort((a, b) => a - b).map((m) => (
                        <div key={m} className="plant-catalog-detail-month">
                          <div className="plant-catalog-detail-month-name">
                            {monthName(m - 1)}
                          </div>
                          <div className="plant-catalog-detail-month-tasks">
                            {byMonth.get(m).map((it, i) => (
                              <div key={i} className="plant-catalog-detail-task">
                                <span>{it.emoji}</span>
                                <span>{it.action}</span>
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
                    <div className="plant-catalog-detail-title">{t('catalog.regularTasksTitle')}</div>
                    <div className="plant-catalog-detail-tasks">
                      {plant.tasks.map((it, i) => (
                        <div key={i} className="plant-catalog-detail-task">
                          <span>•</span>
                          <span>
                            {it.title}
                            {it.frequency_days ? (
                              <span className="muted small">
                                {' '}
                                · {t('catalog.everyDays', { count: it.frequency_days })}
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
                    <div className="plant-catalog-detail-title">{t('catalog.needsTitle')}</div>
                    <div className="plant-catalog-detail-info">
                      {plant.soil && <div><strong>{t('catalog.soil')}</strong> {plant.soil}</div>}
                      {plant.sun && <div><strong>{t('catalog.light')}</strong> {plant.sun}</div>}
                      {plant.watering && <div><strong>{t('catalog.watering')}</strong> {plant.watering}</div>}
                      {plant.notes && <div><strong>{t('catalog.notes')}</strong> {plant.notes}</div>}
                    </div>
                  </div>
                )}

                {plant.companions && (
                  (plant.companions.good?.length > 0 || plant.companions.bad?.length > 0) && (
                    <div className="plant-catalog-detail-section">
                      <div className="plant-catalog-detail-title">{t('catalog.companionsTitle')}</div>
                      <div className="companion-section" style={{ marginTop: 4 }}>
                        {plant.companions.good?.length > 0 && (
                          <div className="companion-row">
                            <span className="companion-label">{t('catalog.companionsGood')}</span>
                            <div className="companion-pills">
                              {plant.companions.good.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  className="companion-pill good"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCompanionClick?.(name);
                                  }}
                                  title={t('catalog.filterBy', { name })}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {plant.companions.bad?.length > 0 && (
                          <div className="companion-row">
                            <span className="companion-label">{t('catalog.companionsBad')}</span>
                            <div className="companion-pills">
                              {plant.companions.bad.map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  className="companion-pill bad"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCompanionClick?.(name);
                                  }}
                                  title={t('catalog.filterBy', { name })}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                <PlantWarnings plantName={plant.nameCz} />
              </>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="plant-catalog-card-cta">
          <button
            type="button"
            className="btn small"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            {t('catalog.addToGarden')}
          </button>
          <button
            type="button"
            className="plant-catalog-expand-btn"
            onClick={onToggle}
            aria-label={t('catalog.hideDetail')}
          >
            {t('catalog.hide')}
          </button>
        </div>
      )}
    </div>
  );
}

function GardenPickerSheet({ plant, gardens, onPick, onClose }) {
  const { t } = useTranslation();
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
          <span>{t('catalog.pickerAddPrefix')} <em style={{ fontStyle: 'normal', color: 'var(--forest)' }}>{plant.nameCz}</em> {t('catalog.pickerAddSuffix')}</span>
          <button className="close-btn" onClick={onClose} aria-label={t('common.close')}>×</button>
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('catalog.pickerHint')}
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
                  📍 {t('catalog.pinCount', { count: g.pin_count || 0 })}
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
