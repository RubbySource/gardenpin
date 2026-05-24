// Schema validator for frontend/src/plantDatabase.js
//
// Run: node scripts/validate-plants.js
//
// Validates:
//  - Unique IDs (no duplicates)
//  - Required fields per plant: id (number), nameCz (string), nameLat (string),
//    tasks (array with at least 1 item)
//  - Continuous ID sequence (reports gaps)
//
// Note: the schema field is `tasks` (array of {title, task_type, frequency_days,
// notes}). The richer `careActions` array lives in a separate sparse PLANT_META
// map keyed by plant id and is not required for every plant.
//
// Last run (2026-04-30, gardenpin/master @ ce3ae61):
//   Total plants: 85
//   ID range:     1 – 85
//   Unique IDs:   85
//   Missing IDs:  none (continuous)
//   ✅ All checks passed

import { PLANT_DATABASE } from '../frontend/src/plantDatabase.js';

const errors = [];
const warnings = [];

// 1) Unique IDs
const seenIds = new Map();
for (const p of PLANT_DATABASE) {
  if (seenIds.has(p.id)) {
    errors.push(`Duplicate id ${p.id}: "${p.nameCz}" and "${seenIds.get(p.id)}"`);
  } else {
    seenIds.set(p.id, p.nameCz);
  }
}

// 2) Required fields
for (const p of PLANT_DATABASE) {
  const where = `id=${p.id} (${p.nameCz ?? '<no name>'})`;
  if (typeof p.id !== 'number' || !Number.isInteger(p.id)) {
    errors.push(`${where}: id must be an integer, got ${typeof p.id} (${p.id})`);
  }
  if (typeof p.nameCz !== 'string' || !p.nameCz.trim()) {
    errors.push(`${where}: nameCz missing or empty`);
  }
  if (typeof p.nameLat !== 'string' || !p.nameLat.trim()) {
    errors.push(`${where}: nameLat missing or empty`);
  }
  if (!Array.isArray(p.tasks) || p.tasks.length === 0) {
    errors.push(`${where}: tasks must be a non-empty array (got ${
      Array.isArray(p.tasks) ? '[]' : typeof p.tasks
    })`);
  }
}

// 3) ID sequence gaps
const ids = [...seenIds.keys()].sort((a, b) => a - b);
const minId = ids[0];
const maxId = ids[ids.length - 1];
const expected = new Set();
for (let i = minId; i <= maxId; i++) expected.add(i);
for (const id of ids) expected.delete(id);
const missing = [...expected].sort((a, b) => a - b);
if (missing.length > 0) {
  warnings.push(`Missing IDs in sequence ${minId}–${maxId}: ${missing.join(', ')}`);
}

// 4) Output
const total = PLANT_DATABASE.length;
console.log('— Plant database validation —');
console.log(`Total plants: ${total}`);
console.log(`ID range:     ${minId} – ${maxId}`);
console.log(`Unique IDs:   ${seenIds.size}`);
console.log(`Missing IDs:  ${missing.length === 0 ? 'none (continuous)' : missing.length}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log('  ! ' + w);
}

if (errors.length > 0) {
  console.log('\nErrors:');
  for (const e of errors) console.log('  ✗ ' + e);
  console.log(`\n❌ FAILED — ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}

console.log('\n✅ All checks passed');
