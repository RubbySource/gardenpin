// AS-4: Integrační smoke testy core API. Spouští reálný Express + node:sqlite
// proti dočasné DB v os.tmpdir(). Cílem je chytit hrubé regrese (HTTP status,
// JSON shape, FK kaskáda) před TestFlightem, ne 100 % coverage.
//
// Spuštění: node --test tests/smoke.test.cjs
//          (nebo `npm test` v rootu — viz package.json)
//
// Žádné npm dependency — node:test, node:sqlite a node:http jsou built-in.
// Pokud něco selže, exit code != 0 (CI-ready).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

// MUSÍ být před require('../backend/server.js'), protože backend/db.js čte
// DATABASE_PATH na top-level při načtení modulu.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gardenpin-smoke-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
// Tichý NODE_ENV pro Stripe/Sharp warningy ať testy nelogují balast
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const app = require('../backend/server.js');

let server;
let baseUrl;

// Pomocný HTTP klient. Vrací { status, json, text, headers }.
function request(method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const isJson = body && typeof body === 'object' && !(body instanceof Buffer);
    const payload = isJson ? Buffer.from(JSON.stringify(body)) : body;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(headers || {}),
      },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Tmp DB cleanup — `force:true` swallows EBUSY na Windows (WAL sidecar files)
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

// ============================================================================
// Gardens CRUD
// ============================================================================
test('GET /api/gardens vrací prázdné pole na čisté DB', async () => {
  const r = await request('GET', '/api/gardens');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, []);
});

let gardenId;

test('POST /api/gardens vytvoří zahradu', async () => {
  const r = await request('POST', '/api/gardens', { name: 'Smoke zahrada' });
  assert.equal(r.status, 200);
  assert.equal(r.json.name, 'Smoke zahrada');
  assert.ok(Number.isInteger(r.json.id) && r.json.id > 0);
  gardenId = r.json.id;
});

test('GET /api/gardens/:id vrací detail s počítadly', async () => {
  const r = await request('GET', `/api/gardens/${gardenId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.id, gardenId);
  assert.equal(r.json.pin_count, 0);
  assert.equal(r.json.task_count, 0);
  assert.equal(r.json.urgent_count, 0);
});

test('GET /api/gardens/:id na neexistující ID vrací 404 JSON', async () => {
  const r = await request('GET', '/api/gardens/99999');
  assert.equal(r.status, 404);
  assert.ok(r.json && r.json.error);
});

test('GET /api/gardens/:id s nečíselným ID vrací 400 (API-2 validace)', async () => {
  const r = await request('GET', '/api/gardens/abc');
  assert.equal(r.status, 400);
  assert.ok(r.json && r.json.error);
});

test('PUT /api/gardens/:id upraví název', async () => {
  const r = await request('PUT', `/api/gardens/${gardenId}`, { name: 'Smoke zahrada 2' });
  assert.equal(r.status, 200);
  assert.equal(r.json.name, 'Smoke zahrada 2');
});

// ============================================================================
// Pins CRUD (vč. base64 photo upload)
// ============================================================================
let pinId;

test('POST /api/pins vytvoří pin v zahradě', async () => {
  const r = await request('POST', '/api/pins', {
    garden_id: gardenId,
    name: 'Smoke pin',
    x: 50,
    y: 50,
    plant_name: 'Rajče',
    color: '#7BA889',
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.garden_id, gardenId);
  assert.equal(r.json.plant_name, 'Rajče');
  assert.equal(r.json.x, 50);
  pinId = r.json.id;
});

test('GET /api/gardens/:id/pins vrací nově vytvořený pin', async () => {
  const r = await request('GET', `/api/gardens/${gardenId}/pins`);
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 1);
  assert.equal(r.json[0].id, pinId);
});

test('GET /api/pins/:id vrací detail s tasks/history poli', async () => {
  const r = await request('GET', `/api/pins/${pinId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.id, pinId);
  assert.ok(Array.isArray(r.json.tasks));
  assert.ok(Array.isArray(r.json.history));
});

test('PUT /api/pins/:id/photo přijme base64 data URL', async () => {
  // 1×1 px průhledný PNG (validní obraz pro sharp)
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const dataUrl = `data:image/png;base64,${pngBase64}`;
  const r = await request('PUT', `/api/pins/${pinId}/photo`, { photo: dataUrl });
  assert.equal(r.status, 200);
  assert.ok(r.json.ok);
  assert.match(r.json.photo_path, /^\/uploads\/.+\.jpg$/);
});

// ============================================================================
// Tasks CRUD + done + snooze/unsnooze (TASK-3)
// ============================================================================
let taskId;

test('POST /api/tasks vytvoří úkol s frequency_days', async () => {
  const r = await request('POST', '/api/tasks', {
    pin_id: pinId,
    title: 'Zalít',
    task_type: 'zalivka',
    frequency_days: 3,
    recurring: 1,
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.pin_id, pinId);
  assert.equal(r.json.task_type, 'zalivka');
  assert.equal(r.json.frequency_days, 3);
  assert.ok(r.json.next_due, 'next_due se má spočítat ze specific_date/frequency_days');
  taskId = r.json.id;
});

test('GET /api/tasks vrací nově vytvořený úkol s pin/garden joiny', async () => {
  const r = await request('GET', '/api/tasks');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json));
  const t = r.json.find((x) => x.id === taskId);
  assert.ok(t, 'task v listu /api/tasks');
});

test('POST /api/tasks/:id/snooze odloží + uloží zálohu pro undo (TASK-3)', async () => {
  const before = await request('GET', `/api/pins/${pinId}`);
  const original = before.json.tasks.find((t) => t.id === taskId);
  const r = await request('POST', `/api/tasks/${taskId}/snooze`, { days: 5 });
  assert.equal(r.status, 200);
  assert.equal(r.json.snoozes, 1);
  assert.equal(r.json.prev_next_due, original.next_due);
  assert.notEqual(r.json.next_due, original.next_due);
});

test('POST /api/tasks/:id/unsnooze vrátí původní datum (TASK-3)', async () => {
  const r = await request('POST', `/api/tasks/${taskId}/unsnooze`);
  assert.equal(r.status, 200);
  assert.equal(r.json.snoozes, 0);
  assert.equal(r.json.prev_next_due, null);
});

test('POST /api/tasks/:id/done označí splnění + bumpne streak', async () => {
  const r = await request('POST', `/api/tasks/${taskId}/done`, {});
  assert.equal(r.status, 200);
  // Recurring s frequency_days zůstává (jen se přepočte next_due), one-time by se smazal
  assert.ok(r.json.streak, 'odpověď obsahuje streak objekt');
  assert.equal(r.json.streak.current_streak, 1);
  assert.equal(r.json.streak.total_completed, 1);
});

test('GET /api/history obsahuje záznam z done', async () => {
  const r = await request('GET', '/api/history');
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 1);
  assert.equal(r.json[0].pin_id, pinId);
});

test('GET /api/stats/streak vrací current_streak=1 po done', async () => {
  const r = await request('GET', '/api/stats/streak');
  assert.equal(r.status, 200);
  assert.equal(r.json.current_streak, 1);
  assert.equal(r.json.total_completed, 1);
});

test('DELETE /api/tasks/:id smaže úkol', async () => {
  const r = await request('DELETE', `/api/tasks/${taskId}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.ok);
});

// ============================================================================
// Push subscribe
// ============================================================================
test('GET /api/push/vapid-public-key vrací VAPID public key', async () => {
  const r = await request('GET', '/api/push/vapid-public-key');
  assert.equal(r.status, 200);
  assert.ok(typeof r.json.publicKey === 'string' && r.json.publicKey.length > 0);
});

test('POST /api/push/subscribe uloží validní subscription', async () => {
  const sub = {
    endpoint: 'https://example.test/push/abc123',
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  };
  const r = await request('POST', '/api/push/subscribe', sub);
  assert.equal(r.status, 200);
  assert.ok(r.json.ok);
});

test('POST /api/push/subscribe odmítne neúplný subscription (400)', async () => {
  const r = await request('POST', '/api/push/subscribe', { endpoint: 'https://x' });
  assert.equal(r.status, 400);
  assert.ok(r.json.error);
});

// ============================================================================
// iCal export
// ============================================================================
test('GET /api/export/ical vrací validní VCALENDAR', async () => {
  // Nejdřív si vytvoříme úkol s next_due, ať VCALENDAR má aspoň jeden VEVENT
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await request('POST', '/api/tasks', {
    pin_id: pinId,
    title: 'iCal test',
    task_type: 'kontrola',
    specific_date: tomorrow,
  });
  const r = await request('GET', '/api/export/ical');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/calendar/);
  assert.match(r.text, /^BEGIN:VCALENDAR/);
  assert.match(r.text, /END:VCALENDAR$/);
  assert.match(r.text, /BEGIN:VEVENT/);
  assert.match(r.text, /TZID:Europe\/Prague/);
});

// ============================================================================
// API contract guards (API-1 / API-2)
// ============================================================================
test('GET /api/neznamy-endpoint vrací JSON 404 (API-1 catch-all)', async () => {
  const r = await request('GET', '/api/neznamy-endpoint');
  assert.equal(r.status, 404);
  assert.ok(r.json && r.json.error);
  assert.equal(r.json.path, '/api/neznamy-endpoint');
});

test('GET /api/pins/abc/photos vrací 400 (API-2 validace pinId)', async () => {
  const r = await request('GET', '/api/pins/abc/photos');
  assert.equal(r.status, 400);
  assert.ok(r.json && r.json.error);
});

// ============================================================================
// Cleanup: DELETE garden → FK CASCADE smaže piny/úkoly/historii
// ============================================================================
test('DELETE /api/gardens/:id zkaskáduje smazání pinů a úkolů', async () => {
  const r = await request('DELETE', `/api/gardens/${gardenId}`);
  assert.equal(r.status, 200);
  assert.ok(r.json.ok);

  const pinsAfter = await request('GET', `/api/gardens/${gardenId}/pins`);
  assert.equal(pinsAfter.status, 200);
  assert.deepEqual(pinsAfter.json, []);

  const gardenAfter = await request('GET', `/api/gardens/${gardenId}`);
  assert.equal(gardenAfter.status, 404);
});
