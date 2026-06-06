// BedDetailModal — záhon ↔ rostliny (many-to-many).
// Sekce:
//   1) Hlavička s barvou / typem / rozměry záhonu
//   2) Aktivní rostliny v záhonu (CRUD: count edit, remove, otevřít pin)
//   3) Přidat rostlinu (autocomplete) → vytvoří bed_plants + pin
//   4) "Sloučit do záhonu?" CTA — detekuje 3+ osamocené piny geometricky uvnitř záhonu
//   5) Záhon: editace (název, typ, rozměry m, barva, smazat)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sheet from './Sheet.jsx';
import PlantAutocomplete from './PlantAutocomplete.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';

const BED_TYPES = [
  { id: 'vegetable', label: '🥕 Zelenina' },
  { id: 'flower', label: '🌸 Květiny' },
  { id: 'herb', label: '🌿 Byliny' },
  { id: 'mixed', label: '🌻 Smíšený' },
];

export default function BedDetailModal({ bed, onClose, onBedUpdated, onBedDeleted, onPinOpen }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('plants'); // 'plants' | 'edit'
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insidePins, setInsidePins] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  // bed lokální state — synchronizujeme s parentem po uložení edit záložky
  const [localBed, setLocalBed] = useState(bed);

  const refresh = async () => {
    setLoading(true);
    try {
      const [bp, inside] = await Promise.all([
        api.listBedPlants(localBed.id),
        api.pinsInsideBed(localBed.id),
      ]);
      setPlants(bp);
      setInsidePins(inside);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [localBed.id]);

  const totalPlants = useMemo(
    () => plants.reduce((s, p) => s + (p.count || 1), 0),
    [plants],
  );

  return (
    <Sheet title={`🟫 ${localBed.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BedSummaryHeader bed={localBed} totalPlants={totalPlants} plantTypes={plants.length} />

        <div className="row" style={{ gap: 6 }}>
          <button
            className={`btn small${tab === 'plants' ? '' : ' ghost'}`}
            onClick={() => setTab('plants')}
            type="button"
          >
            🌱 Rostliny ({plants.length})
          </button>
          <button
            className={`btn small${tab === 'edit' ? '' : ' ghost'}`}
            onClick={() => setTab('edit')}
            type="button"
          >
            ⚙️ Záhon
          </button>
        </div>

        {tab === 'plants' && (
          <>
            {loading && <p className="muted">Načítám…</p>}

            {!loading && plants.length === 0 && !showAdd && (
              <EmptyState onAdd={() => setShowAdd(true)} />
            )}

            {!loading && plants.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plants.map((bp) => (
                  <BedPlantRow
                    key={bp.id}
                    bp={bp}
                    onChanged={(updated) =>
                      setPlants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                    }
                    onRemoved={(removedId) =>
                      setPlants((prev) => prev.filter((x) => x.id !== removedId))
                    }
                    onPinOpen={onPinOpen}
                  />
                ))}
              </div>
            )}

            {!loading && plants.length > 0 && !showAdd && (
              <button
                className="btn"
                type="button"
                onClick={() => setShowAdd(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                ➕ Přidat rostlinu
              </button>
            )}

            {showAdd && (
              <AddPlantForm
                bedId={localBed.id}
                onDone={() => setShowAdd(false)}
                onAdded={(row) => {
                  setPlants((prev) => [...prev, row]);
                  toast('🌱 Rostlina přidána do záhonu');
                }}
              />
            )}

            {insidePins.length >= 3 && (
              <MergePinsCTA
                count={insidePins.length}
                onMerge={async () => {
                  if (!confirm(`Sloučit ${insidePins.length} pinů uvnitř záhonu do tohoto záhonu? Piny zůstanou, jen získají vztah k záhonu (úkoly a historie se zachovají).`)) return;
                  try {
                    const result = await api.mergePinsIntoBed(
                      localBed.id,
                      insidePins.map((p) => p.id),
                    );
                    toast(`✅ Sloučeno: ${result.created_count} rostlin`);
                    await refresh();
                  } catch (e) {
                    toast('Chyba: ' + e.message);
                  }
                }}
              />
            )}
          </>
        )}

        {tab === 'edit' && (
          <BedEditForm
            bed={localBed}
            onClose={onClose}
            onSaved={(updated) => {
              setLocalBed(updated);
              onBedUpdated?.(updated);
              toast('💾 Uloženo');
            }}
            onDeleted={(bedId) => {
              onBedDeleted?.(bedId);
              onClose();
            }}
          />
        )}
      </div>
    </Sheet>
  );
}

function BedSummaryHeader({ bed, totalPlants, plantTypes }) {
  const typeLabel = BED_TYPES.find((t) => t.id === bed.type)?.label;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        background: 'var(--sand)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: bed.color || '#8b6f47',
          flexShrink: 0,
          border: '2px solid rgba(0,0,0,0.1)',
        }}
        aria-hidden
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {typeLabel || 'Nezařazený záhon'}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {plantTypes > 0
            ? `${plantTypes} ${plural(plantTypes, 'druh', 'druhy', 'druhů')} · ${totalPlants} ks`
            : 'Žádné rostliny'}
          {bed.width_m && bed.height_m ? ` · ${bed.width_m}×${bed.height_m} m` : ''}
        </div>
      </div>
    </div>
  );
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function EmptyState({ onAdd }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '24px 12px',
        background: 'var(--sand)',
        borderRadius: 12,
        border: '1px dashed var(--border)',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 4 }}>🌱</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Záhon je zatím prázdný
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Přidej rostlinu — sezónní úkony se vygenerují automaticky.
      </div>
      <button className="btn" onClick={onAdd} type="button">
        ➕ Přidat první rostlinu
      </button>
    </div>
  );
}

function BedPlantRow({ bp, onChanged, onRemoved, onPinOpen }) {
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(bp.count);
  const [name, setName] = useState(bp.plant_name);
  const [plantedAt, setPlantedAt] = useState(bp.planted_at || '');
  const [notes, setNotes] = useState(bp.notes || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast('Název rostliny je povinný');
    setBusy(true);
    try {
      const updated = await api.updateBedPlant(bp.id, {
        plant_name: name.trim(),
        count,
        planted_at: plantedAt || null,
        notes: notes || null,
      });
      onChanged(updated);
      setEditing(false);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const keepPin = bp.pin_id
      ? !confirm(`Smazat "${bp.plant_name}" ze záhonu — smazat i pin (včetně úkolů a historie)? OK = smazat vše, Storno = ponechat pin samostatně.`)
      : false;
    setBusy(true);
    try {
      await api.removeBedPlant(bp.id, { keepPin });
      onRemoved(bp.id);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
      }}
    >
      {!editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              minWidth: 36,
              height: 36,
              borderRadius: 8,
              background: bp.pin_color || '#4a7c3a',
              color: 'white',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {bp.count}×
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{bp.plant_name}</div>
            {(bp.planted_at || bp.notes) && (
              <div className="muted" style={{ fontSize: 12 }}>
                {bp.planted_at && <>📅 {bp.planted_at}</>}
                {bp.planted_at && bp.notes ? ' · ' : ''}
                {bp.notes}
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 4 }}>
            {bp.pin_id && onPinOpen && (
              <button
                className="btn ghost small"
                onClick={() => onPinOpen(bp.pin_id)}
                title="Otevřít detail rostliny (úkony, historie)"
                type="button"
              >
                📖
              </button>
            )}
            <button
              className="btn ghost small"
              onClick={() => setEditing(true)}
              disabled={busy}
              type="button"
            >
              ✏️
            </button>
            <button
              className="btn ghost small danger"
              onClick={remove}
              disabled={busy}
              type="button"
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="field">
            <label>Název rostliny</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Počet kusů</label>
              <input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Vysazeno</label>
              <input
                type="date"
                value={plantedAt}
                onChange={(e) => setPlantedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Poznámka</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="např. odrůda, dodavatel…"
            />
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn ghost small"
              onClick={() => {
                setEditing(false);
                setCount(bp.count);
                setName(bp.plant_name);
                setPlantedAt(bp.planted_at || '');
                setNotes(bp.notes || '');
              }}
              type="button"
            >
              Zrušit
            </button>
            <button className="btn small" onClick={save} disabled={busy} type="button">
              {busy ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPlantForm({ bedId, onDone, onAdded }) {
  const [name, setName] = useState('');
  const [plantId, setPlantId] = useState(null);
  const [count, setCount] = useState(1);
  // plantedAt si držíme mezi přidáními — typicky sázíš víc rostlin ve stejný den.
  const [plantedAt, setPlantedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const autocompleteWrapRef = useRef(null);

  const focusAutocomplete = () => {
    const input = autocompleteWrapRef.current?.querySelector('input');
    if (input) input.focus();
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!name.trim()) return toast('Vyber rostlinu');
    setBusy(true);
    try {
      const row = await api.addBedPlant(bedId, {
        plant_id: plantId,
        plant_name: name.trim(),
        count: Math.max(1, parseInt(count, 10) || 1),
        planted_at: plantedAt || null,
        notes: notes || null,
        color,
        auto_pin: true,
      });
      onAdded(row);
      // Reset polí pro další rostlinu — plantedAt zachovat (stejný den).
      setName('');
      setPlantId(null);
      setCount(1);
      setNotes('');
      setColor(null);
      setAddedCount((n) => n + 1);
      // Fokus zpět na našeptávač pro rychlé multi-add.
      setTimeout(focusAutocomplete, 30);
    } catch (e2) {
      toast('Chyba: ' + e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        background: 'var(--sand)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}
    >
      {addedCount > 0 && (
        <div
          className="muted"
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}
        >
          ✅ Přidáno {addedCount} {addedCount === 1 ? 'rostlina' : addedCount < 5 ? 'rostliny' : 'rostlin'} — pokračuj nebo klikni na Hotovo.
        </div>
      )}
      <div className="field" ref={autocompleteWrapRef}>
        <label>Rostlina</label>
        <PlantAutocomplete
          value={name}
          onChange={(val, plant) => {
            setName(val);
            setPlantId(plant?.id || null);
            if (plant?.color) setColor(plant.color);
          }}
          onSelect={(plant) => {
            setName(plant.nameCz);
            setPlantId(plant.id);
            if (plant.color) setColor(plant.color);
          }}
          placeholder="např. Rajče"
        />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Počet</label>
          <input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Vysazeno</label>
          <input
            type="date"
            value={plantedAt}
            onChange={(e) => setPlantedAt(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>Poznámka (volitelné)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="odrůda, dodavatel…"
        />
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn ghost small" onClick={onDone} type="button">
          ✓ Hotovo
        </button>
        <button className="btn small" type="submit" disabled={busy}>
          {busy ? 'Přidávám…' : addedCount > 0 ? '➕ Přidat další' : '➕ Přidat'}
        </button>
      </div>
    </form>
  );
}

function MergePinsCTA({ count, onMerge }) {
  return (
    <div
      style={{
        padding: 12,
        background: 'rgba(123,168,137,0.12)',
        border: '1px solid rgba(123,168,137,0.4)',
        borderRadius: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        🔗 {count} pinů uvnitř záhonu
      </div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Vypadá to, že už máš v ploše záhonu samostatné piny. Můžeš je sloučit
        do tohoto záhonu — úkoly a historie zůstanou zachované.
      </div>
      <button className="btn small" onClick={onMerge} type="button">
        Sloučit do záhonu
      </button>
    </div>
  );
}

function BedEditForm({ bed, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(bed.name || 'Záhon');
  const [type, setType] = useState(bed.type || '');
  const [widthM, setWidthM] = useState(bed.width_m ?? '');
  const [heightM, setHeightM] = useState(bed.height_m ?? '');
  const [color, setColor] = useState(bed.color || '#8b6f47');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Název je povinný');
    setSaving(true);
    try {
      const updated = await api.updateBed(bed.id, {
        name: name.trim(),
        type: type || null,
        width_m: widthM === '' ? null : Number(widthM),
        height_m: heightM === '' ? null : Number(heightM),
        color,
      });
      onSaved(updated);
    } catch (err) {
      toast('Chyba: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Smazat záhon? Rostliny v záhonu se ztratí.')) return;
    try {
      await api.deleteBed(bed.id);
      onDeleted(bed.id);
    } catch (err) {
      toast('Chyba: ' + err.message);
    }
  };

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="field">
        <label>Název záhonu</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="např. Záhon u plotu"
        />
      </div>
      <div className="field">
        <label>Typ</label>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {BED_TYPES.map((bt) => (
            <button
              key={bt.id}
              className={`btn small${type === bt.id ? '' : ' ghost'}`}
              onClick={() => setType(type === bt.id ? '' : bt.id)}
              type="button"
            >
              {bt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Šířka (m)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={widthM}
            onChange={(e) => setWidthM(e.target.value)}
            placeholder="2.0"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Délka (m)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={heightM}
            onChange={(e) => setHeightM(e.target.value)}
            placeholder="3.0"
          />
        </div>
      </div>
      <div className="field">
        <label>Barva</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <button type="button" className="btn danger ghost small" onClick={remove}>
          🗑️ Smazat záhon
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Zavřít
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </form>
  );
}
