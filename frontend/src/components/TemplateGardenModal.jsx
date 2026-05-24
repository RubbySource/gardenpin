// Modal pro vytvoření zahrady ze šablony (předpřipravený set rostlin + sezónních úkonů).
import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { GARDEN_TEMPLATES, gridPositions } from '../gardenTemplates.js';
import { findPlantByName } from '../plantDatabase.js';
import { buildSeasonalTaskPayloads } from './PlantAutocomplete.jsx';

export default function TemplateGardenModal({ onClose, onCreated }) {
  const [templateKey, setTemplateKey] = useState(GARDEN_TEMPLATES[0].key);
  const [name, setName] = useState('');
  const [excluded, setExcluded] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const template = useMemo(
    () => GARDEN_TEMPLATES.find((t) => t.key === templateKey),
    [templateKey],
  );

  // Vytáhne enriched rostliny pro zobrazení v seznamu (s ikonou kategorie)
  const plants = useMemo(() => {
    return template.plants.map((nm) => ({
      name: nm,
      plant: findPlantByName(nm),
    }));
  }, [template]);

  const toggleExclude = (nm) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(nm)) next.delete(nm);
      else next.add(nm);
      return next;
    });
  };

  const selectedPlants = plants.filter(({ name: nm }) => !excluded.has(nm));

  const handleTemplate = (key) => {
    setTemplateKey(key);
    setExcluded(new Set());
    if (!name) {
      const t = GARDEN_TEMPLATES.find((x) => x.key === key);
      setName(t.name);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const gardenName = name.trim() || template.name;
    if (selectedPlants.length === 0) return toast('Vyberte alespoň jednu rostlinu');
    setSaving(true);
    try {
      // 1) Vytvoř zahradu
      const fd = new FormData();
      fd.append('name', gardenName);
      const garden = await api.createGarden(fd);

      // 2) Vytvoř piny v gridu
      const positions = gridPositions(selectedPlants.length);
      const today = new Date().toISOString().slice(0, 10);
      const taskPromises = [];

      for (let i = 0; i < selectedPlants.length; i++) {
        const { name: nm, plant } = selectedPlants[i];
        const pos = positions[i];
        const color = plant?.category?.color || template.color;
        const pinFd = new FormData();
        pinFd.append('garden_id', garden.id);
        pinFd.append('name', nm);
        pinFd.append('x', pos.x);
        pinFd.append('y', pos.y);
        pinFd.append('plant_name', nm);
        pinFd.append('planting_date', today);
        pinFd.append('notes', '');
        pinFd.append('color', color);
        // Pozn.: piny vytváříme sekvenčně kvůli SQLite WAL a stabilnímu pořadí;
        // úkoly k pinu už paralelně.
        const pin = await api.createPin(pinFd);
        if (!plant) continue;

        (plant.tasks || []).forEach((t) => {
          taskPromises.push(
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
        const allCare = new Set((plant.careActions || []).map((_, idx) => idx));
        buildSeasonalTaskPayloads(plant, allCare, pin.id).forEach((payload) => {
          taskPromises.push(api.createTask(payload));
        });
      }
      await Promise.all(taskPromises);

      toast(`✅ Vytvořeno ${selectedPlants.length} rostlin z šablony`);
      onCreated(garden);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🌱 Zahrada ze šablony" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Vyberte typ zahrady a šablona předpřipraví piny rostlin i jejich sezónní úkony. Mapu fotky můžete nahrát později.
      </p>

      <div className="template-picker-grid">
        {GARDEN_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`template-picker-card ${templateKey === t.key ? 'active' : ''}`}
            onClick={() => handleTemplate(t.key)}
            style={templateKey === t.key ? { borderColor: t.color, background: `${t.color}14` } : undefined}
          >
            <div className="template-picker-icon" style={{ background: t.color }}>{t.icon}</div>
            <div className="template-picker-title">{t.name}</div>
            <div className="template-picker-count">{t.plants.length} rostlin</div>
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Název zahrady</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={template.name}
            autoFocus
          />
        </div>

        <div className="field">
          <label>
            Rostliny v šabloně
            <span className="small muted" style={{ marginLeft: 8, fontWeight: 400 }}>
              ({selectedPlants.length}/{plants.length} — klikni pro vyloučení)
            </span>
          </label>
          <div className="template-plant-list">
            {plants.map(({ name: nm, plant }) => {
              const isOff = excluded.has(nm);
              const cat = plant?.category;
              return (
                <button
                  key={nm}
                  type="button"
                  className={`template-plant-chip ${isOff ? 'off' : ''}`}
                  onClick={() => toggleExclude(nm)}
                  style={!isOff && cat ? { borderColor: cat.color, background: `${cat.color}10` } : undefined}
                  title={plant ? `${plant.nameLat}` : 'Rostlina nenalezena v katalogu'}
                >
                  <span>{cat?.icon || '🌿'}</span>
                  <span>{nm}</span>
                  {!plant && <span className="small muted">(?)</span>}
                  <span className="template-plant-x">{isOff ? '+' : '×'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="template-summary small muted">
          Bude vytvořeno: <strong>{selectedPlants.length} pinů</strong> a všechny jejich pravidelné i sezónní úkony.
        </div>

        <div className="row mt-3">
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            Zrušit
          </button>
          <button type="submit" className="btn-cta" disabled={saving || selectedPlants.length === 0}>
            {saving ? 'Vytvářím…' : `Vytvořit zahradu`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
