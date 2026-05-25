// Generuje backend/plant-categories.json z PLANT_DATABASE.
// Slouží serveru pro filtraci iCal exportu podle `categories=` URL parametru
// (server nemá přístup k frontend/src/plantDatabase.js po rsync deploy).
//
// Spouští se automaticky před `vite build` (viz frontend/package.json "build" script).
import { PLANT_DATABASE, getPlantCategory, CATEGORY_DEFS } from '../src/plantDatabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inverze CATEGORY_DEFS: vnitřní 'key' (zelenina/ovoce/…) → vnější ('vegetables'/'fruits'/…)
const INNER_TO_OUTER = {};
for (const [outer, def] of Object.entries(CATEGORY_DEFS)) {
  INNER_TO_OUTER[def.key] = outer;
}
// Fallbacky pro historické inner keys, které nejsou v CATEGORY_DEFS
const LEGACY_INNER_FALLBACK = {
  okrasne: 'ornamental',
};

function resolveCategoryKey(plant) {
  // Nové (id ≥ 86): plant.category je string odpovídající outer key
  if (typeof plant.category === 'string' && CATEGORY_DEFS[plant.category]) {
    return plant.category;
  }
  // Staré (id ≤ 85): getPlantCategory vrátí objekt s `key` polem
  const obj = getPlantCategory(plant.id);
  if (!obj?.key) return null;
  return INNER_TO_OUTER[obj.key] || LEGACY_INNER_FALLBACK[obj.key] || null;
}

const byName = {};
let missing = 0;
for (const p of PLANT_DATABASE) {
  if (!p.nameCz) continue;
  const key = resolveCategoryKey(p);
  if (key) {
    byName[p.nameCz] = key;
  } else {
    missing += 1;
  }
}

const target = path.resolve(__dirname, '..', '..', 'backend', 'plant-categories.json');
fs.writeFileSync(target, JSON.stringify(byName));
console.log(`[plant-categories] wrote ${Object.keys(byName).length} entries to ${target}`);
if (missing > 0) {
  console.warn(`[plant-categories] ${missing} plantů bez kategorie (přeskočeno)`);
}
