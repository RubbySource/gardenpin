// Katalog rostlin — procházení DB rostlin s filtry, sezónním přehledem a přidáním do zahrady
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PLANT_DATABASE, enrichPlant, CATEGORY_DEFS } from '../plantDatabase.js';
import { buildSeasonalTaskPayloads } from '../components/PlantAutocomplete.jsx';
import PlantWarnings from '../components/PlantWarnings.jsx';
import Sheet from '../components/Sheet.jsx';
import EmptyState from '../components/EmptyState.jsx';
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

  // Spočítej tlačítko/akci pro empty state — kontextový text + případný reset filtru
  const activeCat = categoryFilter !== 'all'
    ? categories.find((c) => c.key === categoryFilter)
    : null;
  let emptySubtitle = t('catalog.emptyText');
  if (debouncedQuery && activeCat) {
    emptySubtitle = t('catalog.emptyFilterCombo', { query: debouncedQuery, category: activeCat.label });
  } else if (debouncedQuery) {
    emptySubtitle = t('catalog.emptyFilterQuery', { query: debouncedQuery });
  } else if (activeCat) {
    emptySubtitle = t('catalog.emptyFilterCategory', { category: activeCat.label });
  }

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
        <EmptyState
          emoji="🔍"
          title={t('catalog.emptyTitle')}
          subtitle={emptySubtitle}
          actionLabel={(debouncedQuery || categoryFilter !== 'all') ? t('catalog.emptyReset') : undefined}
          onAction={(debouncedQuery || categoryFilter !== 'all') ? () => {
            setQuery('');
            setCategoryFilter('all');
          } : undefined}
          actionGhost
        />
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

  const sortedMonths = useMemo(() => Array.from(byMonth.keys()).sort((a, b) => a - b), [byMonth]);
  const hasSeasonal = sortedMonths.length > 0;
  const hasRegular = (plant.tasks || []).length > 0;
  const hasNeeds = plant.soil || plant.sun || plant.watering || plant.notes;
  const hasCompanions = plant.companions && (plant.companions.good?.length > 0 || plant.companions.bad?.length > 0);

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
            {!hasSeasonal && !hasRegular && (
              <div className="plant-catalog-empty">
                {t('catalog.noSeasonalTasks')}
              </div>
            )}

            {hasSeasonal && (
              <section className="ios-list-section plant-catalog-section">
                <div className="ios-list-section-label">{t('catalog.seasonalCareTitle')}</div>
                <div className="ios-group-list">
                  {sortedMonths.map((m, idx) => {
                    const items = byMonth.get(m);
                    const isNow = m === currentMonth;
                    return (
                      <React.Fragment key={m}>
                        {idx > 0 && <div className="ios-list-sep" />}
                        <div className={`ios-list-row plant-month-row ${isNow ? 'now' : ''}`}>
                          <span
                            className="ios-list-row-icon plant-month-icon"
                            style={{ background: cat.color }}
                            aria-hidden="true"
                          >
                            {items.length > 1 ? items.length : items[0].emoji}
                          </span>
                          <div className="ios-list-row-label">
                            {monthName(m - 1)}
                            <span className="ios-list-row-sub">
                              {items.map((it) => `${it.emoji} ${it.action}`).join(' · ')}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            )}

            {hasRegular && (
              <section className="ios-list-section plant-catalog-section">
                <div className="ios-list-section-label">{t('catalog.regularTasksTitle')}</div>
                <div className="ios-group-list">
                  {plant.tasks.map((it, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <div className="ios-list-sep" />}
                      <div className="ios-list-row">
                        <span
                          className="ios-list-row-icon plant-regular-icon"
                          style={{ background: 'var(--ios-fill)', color: 'var(--ios-accent)' }}
                          aria-hidden="true"
                        >
                          🔁
                        </span>
                        <div className="ios-list-row-label">
                          {it.title}
                          {it.frequency_days ? (
                            <span className="ios-list-row-sub">
                              {t('catalog.everyDays', { count: it.frequency_days })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </section>
            )}

            {hasNeeds && (
              <section className="ios-list-section plant-catalog-section">
                <div className="ios-list-section-label">{t('catalog.needsTitle')}</div>
                <div className="ios-group-list">
                  {plant.soil && (
                    <div className="ios-list-row plant-needs-row">
                      <div className="ios-list-row-label">
                        {t('catalog.soil').replace(/:$/, '')}
                        <span className="ios-list-row-sub">{plant.soil}</span>
                      </div>
                    </div>
                  )}
                  {plant.sun && (
                    <>
                      {plant.soil && <div className="ios-list-sep narrow" />}
                      <div className="ios-list-row plant-needs-row">
                        <div className="ios-list-row-label">
                          {t('catalog.light').replace(/:$/, '')}
                          <span className="ios-list-row-sub">{plant.sun}</span>
                        </div>
                      </div>
                    </>
                  )}
                  {plant.watering && (
                    <>
                      {(plant.soil || plant.sun) && <div className="ios-list-sep narrow" />}
                      <div className="ios-list-row plant-needs-row">
                        <div className="ios-list-row-label">
                          {t('catalog.watering').replace(/:$/, '')}
                          <span className="ios-list-row-sub">{plant.watering}</span>
                        </div>
                      </div>
                    </>
                  )}
                  {plant.notes && (
                    <>
                      {(plant.soil || plant.sun || plant.watering) && <div className="ios-list-sep narrow" />}
                      <div className="ios-list-row plant-needs-row">
                        <div className="ios-list-row-label">
                          {t('catalog.notes').replace(/:$/, '')}
                          <span className="ios-list-row-sub">{plant.notes}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {hasCompanions && (
              <section className="ios-list-section plant-catalog-section">
                <div className="ios-list-section-label">{t('catalog.companionsTitle')}</div>
                <div className="plant-catalog-companions-card">
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
              </section>
            )}

            <PlantWarnings plantName={plant.nameCz} />
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
  return (
    <Sheet
      title={`${t('catalog.pickerAddPrefix')} ${plant.nameCz} ${t('catalog.pickerAddSuffix')}`}
      subtitle={t('catalog.pickerHint')}
      onClose={onClose}
    >
      <div className="ios-group-list plant-garden-picker-list">
        {gardens.map((g, idx) => (
          <React.Fragment key={g.id}>
            {idx > 0 && <div className="ios-list-sep" />}
            <button
              type="button"
              className="ios-list-row plant-garden-picker-row"
              onClick={() => onPick(g)}
            >
              <span
                className="ios-list-row-icon plant-garden-picker-avatar"
                style={g.image_path ? undefined : { background: 'var(--forest-soft)', color: 'var(--ios-accent)' }}
                aria-hidden="true"
              >
                {g.image_path ? <img src={g.image_path} alt="" /> : '🌱'}
              </span>
              <div className="ios-list-row-label">
                {g.name}
                <span className="ios-list-row-sub">
                  📍 {t('catalog.pinCount', { count: g.pin_count || 0 })}
                </span>
              </div>
              <span className="ios-list-row-chevron" aria-hidden="true">›</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </Sheet>
  );
}
