// Main Express server for Zahradní tracker
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const stripeRoutes = require('./routes/stripeRoutes');
const { ZONE_LABELS, normalizeZoneId } = require('./climateZones');

// Sharp — optional, pro upscale. Nenačítat tvrdě (nemusí být nainstalován)
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

// Web Push — optional (pokud web-push není nainstalován, push se vypne)
let push;
try { push = require('./push'); } catch (e) {
  console.warn('Web Push není dostupný:', e.message);
  push = null;
}

// Email připomínky — optional (pokud nodemailer není nainstalován, email se vypne)
let email;
try { email = require('./email'); } catch (e) {
  console.warn('Email modul není dostupný:', e.message);
  email = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp|heic|heif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Pouze obrázky jsou povolené'));
  },
});

app.use(cors());

// Stripe webhook MUSÍ být před express.json() — ověřuje signature na raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeRoutes.webhookHandler);

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Ostatní Stripe routes po json parseru
app.use('/api/stripe', stripeRoutes.router);

// Serve built frontend (production)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ---------- Helper: compute next_due for a task ----------
function computeNextDue(task) {
  if (task.specific_date) return task.specific_date;
  if (task.frequency_days) {
    const base = task.last_done || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() + Number(task.frequency_days));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// ---------- TASK-1: roční regenerace yearly recurring úkonů ----------
// Když user yearly recurring task v sezóně nestihne (např. "ořež levanduli 15.8."),
// zůstane stuck ve starém roce a v dalším roce se sám neobjeví. Tato funkce ho
// lazy posune: zachová původní měsíc/den (klimatický shift je už zapečený),
// nastaví rok na aktuální (pokud datum letos ještě nepřišlo), jinak na příští.
// Spouští se 1× za den per proces (memoizace) na začátku list endpointů.
// Idempotentní — po regeneraci už řádek do filtru nespadá. Care_history zůstává netknuté.
let _lastYearlyRegenDay = null;
function regenerateYearlyTasks() {
  const today = new Date().toISOString().slice(0, 10);
  if (_lastYearlyRegenDay === today) return 0;
  _lastYearlyRegenDay = today;
  const todayYear = parseInt(today.slice(0, 4), 10);
  const todayMonthDay = today.slice(5); // 'MM-DD'
  const stale = db
    .prepare(
      `SELECT id, specific_date FROM tasks
       WHERE recurring = 1 AND recurrence_pattern = 'yearly'
         AND specific_date IS NOT NULL
         AND length(specific_date) = 10
         AND CAST(substr(specific_date, 1, 4) AS INTEGER) < ?`,
    )
    .all(todayYear);
  if (!stale.length) return 0;
  const upd = db.prepare('UPDATE tasks SET specific_date = ?, next_due = ? WHERE id = ?');
  const tx = db.transaction((rows) => {
    for (const t of rows) {
      const monthDay = t.specific_date.slice(5); // 'MM-DD'
      const targetYear = monthDay >= todayMonthDay ? todayYear : todayYear + 1;
      const newDate = `${targetYear}-${monthDay}`;
      upd.run(newDate, newDate, t.id);
    }
  });
  tx(stale);
  if (stale.length > 0) {
    console.log(`[task-1] regenerated ${stale.length} yearly recurring task(s) → next occurrence`);
  }
  return stale.length;
}

// Spustit jednou při startu (zachytí dlouhý outage v WSL/PM2)
try { regenerateYearlyTasks(); } catch (e) { console.warn('regenerateYearlyTasks at boot failed:', e.message); }

// ======================= GARDENS =======================
app.get('/api/gardens', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM pins WHERE garden_id = g.id) AS pin_count,
        (SELECT COUNT(*) FROM tasks t JOIN pins p ON p.id = t.pin_id WHERE p.garden_id = g.id) AS task_count,
        (SELECT COUNT(*) FROM tasks t JOIN pins p ON p.id = t.pin_id WHERE p.garden_id = g.id AND t.next_due <= ?) AS urgent_count
       FROM gardens g
       ORDER BY g.created_at DESC`,
    )
    .all(today);
  res.json(rows);
});

// API-1: detail jedné zahrady (sjednocení API contractu — předtím se musel detail brát filtrováním /api/gardens).
// Stejný shape jako řádek z listu (vč. pin_count/task_count/urgent_count), takže frontend nepotřebuje speciální mapper.
app.get('/api/gardens/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Neplatné ID' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM pins WHERE garden_id = g.id) AS pin_count,
        (SELECT COUNT(*) FROM tasks t JOIN pins p ON p.id = t.pin_id WHERE p.garden_id = g.id) AS task_count,
        (SELECT COUNT(*) FROM tasks t JOIN pins p ON p.id = t.pin_id WHERE p.garden_id = g.id AND t.next_due <= ?) AS urgent_count
       FROM gardens g
       WHERE g.id = ?`,
    )
    .get(today, id);
  if (!row) return res.status(404).json({ error: 'Zahrada nenalezena' });
  res.json(row);
});

app.post('/api/gardens', upload.single('image'), async (req, res) => {
  const name = req.body.name || 'Nová zahrada';
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;
  // UX2-2: rozměry serverově z uploadnutého souboru (sharp metadata),
  // nikoli z `req.body.width/height` — klient někdy posílá NaN/chybí,
  // což pak rozhodí poměr stran na mapě (piny se kladou špatně).
  let w = null;
  let h = null;
  if (req.file && sharp) {
    try {
      const meta = await sharp(req.file.path).metadata();
      if (meta.width && meta.height) {
        w = meta.width;
        h = meta.height;
      }
    } catch (e) {
      console.warn('sharp metadata selhalo, fallback na klienta:', e.message);
    }
  }
  if (!w && req.body.width) w = parseInt(req.body.width, 10) || null;
  if (!h && req.body.height) h = parseInt(req.body.height, 10) || null;
  // Klimatická zóna lze nastavit už při vytvoření (onboarding); jinak NULL a doplní se v detailu.
  const climate_zone = normalizeZoneId(req.body.climate_zone);
  try {
    const info = db
      .prepare('INSERT INTO gardens (name, image_path, image_width, image_height, climate_zone) VALUES (?, ?, ?, ?, ?)')
      .run(name, imagePath, w, h, climate_zone);
    const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(info.lastInsertRowid);
    res.json(garden);
  } catch (e) {
    // Úklid: smaž osiřelý soubor v uploads/, ať se nehromadí.
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('POST /api/gardens failed:', e);
    res.status(500).json({ error: 'Nepodařilo se vytvořit zahradu: ' + e.message });
  }
});

app.put('/api/gardens/:id', upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const name = req.body.name ?? current.name;
  const rotation = req.body.rotation !== undefined ? parseInt(req.body.rotation, 10) : (current.rotation || 0);
  let imagePath = current.image_path;
  let clearOriginal = false;
  if (req.file) {
    // Delete previous image
    if (current.image_path) {
      const old = path.join(__dirname, current.image_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    // UX2-2: nová fotka invaliduje uložený originál ořezu — smaž ho a vyčisti referenci.
    if (current.original_image_path && current.original_image_path !== current.image_path) {
      const oldOrig = path.join(__dirname, current.original_image_path);
      if (fs.existsSync(oldOrig)) {
        try { fs.unlinkSync(oldOrig); } catch {}
      }
    }
    clearOriginal = true;
    imagePath = '/uploads/' + req.file.filename;
  }
  // UX2-2: rozměry serverově ze sharp metadat při uploadu nové fotky.
  let w = current.image_width;
  let h = current.image_height;
  if (req.file && sharp) {
    try {
      const meta = await sharp(req.file.path).metadata();
      if (meta.width && meta.height) { w = meta.width; h = meta.height; }
    } catch (e) {
      console.warn('PUT /api/gardens: sharp metadata selhalo:', e.message);
    }
  }
  if (req.file && (!w || !h)) {
    w = req.body.width ? parseInt(req.body.width, 10) : current.image_width;
    h = req.body.height ? parseInt(req.body.height, 10) : current.image_height;
  } else if (!req.file) {
    if (req.body.width) w = parseInt(req.body.width, 10);
    if (req.body.height) h = parseInt(req.body.height, 10);
  }

  // Pěstební podmínky — všechna pole volitelná, prázdný string → NULL
  const soil_type = req.body.soil_type !== undefined
    ? (req.body.soil_type ? String(req.body.soil_type).slice(0, 80) : null)
    : current.soil_type;
  const VALID_EXPOSURE = ['N', 'S', 'E', 'W', 'mixed'];
  const exposure = req.body.exposure !== undefined
    ? (VALID_EXPOSURE.includes(req.body.exposure) ? req.body.exposure : null)
    : current.exposure;
  const altitude_m = req.body.altitude_m !== undefined
    ? (req.body.altitude_m === '' || req.body.altitude_m === null ? null : parseInt(req.body.altitude_m, 10) || null)
    : current.altitude_m;
  const climate_zone = req.body.climate_zone !== undefined
    ? normalizeZoneId(req.body.climate_zone)
    : current.climate_zone;
  const location = req.body.location !== undefined
    ? (req.body.location ? String(req.body.location).slice(0, 240) : null)
    : current.location;

  // UX2-2: pokud user nahrál novou fotku, originál (pre-crop) je k ní irelevantní → vynuluj.
  if (clearOriginal) {
    db.prepare('UPDATE gardens SET name=?, image_path=?, image_width=?, image_height=?, rotation=?, soil_type=?, exposure=?, altitude_m=?, climate_zone=?, location=?, original_image_path=NULL, garden_polygon=NULL WHERE id=?').run(
      name, imagePath, w, h, rotation, soil_type, exposure, altitude_m, climate_zone, location, id,
    );
  } else {
    db.prepare('UPDATE gardens SET name=?, image_path=?, image_width=?, image_height=?, rotation=?, soil_type=?, exposure=?, altitude_m=?, climate_zone=?, location=? WHERE id=?').run(
      name, imagePath, w, h, rotation, soil_type, exposure, altitude_m, climate_zone, location, id,
    );
  }
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  res.json(garden);
});

app.delete('/api/gardens/:id', (req, res) => {
  const id = req.params.id;
  const g = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  // Collect all photo paths to delete
  const pins = db.prepare('SELECT photo_path FROM pins WHERE garden_id = ?').all(id);
  db.prepare('DELETE FROM gardens WHERE id = ?').run(id);
  if (g.image_path) {
    const p = path.join(__dirname, g.image_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  // UX2-2: smaž i uložený originál (pre-crop), pokud existuje a liší se od image_path.
  if (g.original_image_path && g.original_image_path !== g.image_path) {
    const op = path.join(__dirname, g.original_image_path);
    if (fs.existsSync(op)) {
      try { fs.unlinkSync(op); } catch {}
    }
  }
  for (const pin of pins) {
    if (pin.photo_path) {
      const p = path.join(__dirname, pin.photo_path);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  res.json({ ok: true });
});

// Smazat VŠECHNA zahradní data (nebezpečná zóna v Nastavení).
// Smaže všechny zahrady — FK ON DELETE CASCADE pokryje piny, úkoly, historii,
// fotky, záhony a sklizně. Nemaže účet/Premium ani push subscriptions.
app.delete('/api/all-data', (req, res) => {
  try {
    // Posbírej cesty k souborům před smazáním DB řádků
    const gardenImgs = db.prepare('SELECT image_path FROM gardens WHERE image_path IS NOT NULL').all();
    const pinImgs = db.prepare('SELECT photo_path FROM pins WHERE photo_path IS NOT NULL').all();

    const result = db.prepare('DELETE FROM gardens').run();

    // Úklid souborů — chyby u jednotlivých souborů ignoruj (data už jsou pryč)
    for (const row of [...gardenImgs, ...pinImgs]) {
      const rel = row.image_path || row.photo_path;
      if (!rel) continue;
      const p = path.join(__dirname, rel);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
    // Galerie fotek pinů — celý strom uploads/pins/
    const pinsDir = path.join(uploadsDir, 'pins');
    try { if (fs.existsSync(pinsDir)) fs.rmSync(pinsDir, { recursive: true, force: true }); } catch {}

    res.json({ ok: true, gardensDeleted: result.changes });
  } catch (e) {
    res.status(500).json({ error: 'Smazání selhalo: ' + e.message });
  }
});

// ======================= SHARING =======================
// URL-safe random token, alfanum, 10 znaků (kolize prakticky nemožná)
function generateShareToken(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// Vytvořit / vrátit share token zahrady
app.post('/api/gardens/:id/share', (req, res) => {
  const id = req.params.id;
  const g = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  if (g.share_token) {
    return res.json({ token: g.share_token, shared_at: g.shared_at });
  }
  // Generuj unikátní token (retry při kolizi)
  let token;
  for (let i = 0; i < 5; i++) {
    token = generateShareToken(10);
    const exists = db.prepare('SELECT 1 FROM gardens WHERE share_token = ?').get(token);
    if (!exists) break;
    token = null;
  }
  if (!token) return res.status(500).json({ error: 'Nepodařilo se vygenerovat unikátní token' });
  const now = new Date().toISOString();
  db.prepare('UPDATE gardens SET share_token = ?, shared_at = ? WHERE id = ?').run(token, now, id);
  res.json({ token, shared_at: now });
});

// Zrušit share token
app.delete('/api/gardens/:id/share', (req, res) => {
  const id = req.params.id;
  const g = db.prepare('SELECT id FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  db.prepare('UPDATE gardens SET share_token = NULL, shared_at = NULL WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Veřejný read-only pohled na sdílenou zahradu — bez autentizace
app.get('/api/share/:token', (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 6 || token.length > 32) {
    return res.status(404).json({ error: 'Neplatný odkaz' });
  }
  const g = db.prepare('SELECT * FROM gardens WHERE share_token = ?').get(token);
  if (!g) return res.status(404).json({ error: 'Sdílení neexistuje nebo bylo zrušeno' });

  const pins = db.prepare('SELECT id, name, x, y, plant_name, planting_date, notes, photo_path, color FROM pins WHERE garden_id = ? ORDER BY created_at DESC').all(g.id);
  const beds = db.prepare('SELECT id, name, x, y, width, height, width_m, height_m, color FROM beds WHERE garden_id = ? ORDER BY created_at ASC').all(g.id);

  // Nadcházející úkony — pouze hlavní (ne zalévání) v rozumném horizontu
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonStr = horizon.toISOString().slice(0, 10);
  const tasks = db.prepare(
    `SELECT t.id, t.title, t.task_type, t.next_due, t.notes, p.name AS pin_name, p.plant_name
     FROM tasks t
     JOIN pins p ON p.id = t.pin_id
     WHERE p.garden_id = ?
       AND t.next_due IS NOT NULL
       AND t.next_due >= ?
       AND t.next_due <= ?
       AND t.task_type != 'zalivka'
     ORDER BY t.next_due ASC
     LIMIT 50`,
  ).all(g.id, today, horizonStr);

  res.json({
    garden: {
      id: g.id,
      name: g.name,
      image_path: g.image_path,
      image_width: g.image_width,
      image_height: g.image_height,
      rotation: g.rotation || 0,
      shared_at: g.shared_at,
    },
    pins,
    beds,
    upcoming_tasks: tasks,
  });
});

// ======================= SPOLUPRÁCE / ČLENOVÉ =======================
// Paleta barev pro avatary členů (deterministicky dle pořadí přidání).
const MEMBER_COLORS = ['#7BA889', '#E0A458', '#6C8EBF', '#C97B84', '#9B7BC9', '#5BA8A0', '#D08770', '#A3A847'];
const MEMBER_ROLES = ['editor', 'viewer'];

// Vrátí člena obohaceného o počet splněných úkonů (care_history.member_id) v dané zahradě.
function memberWithStats(m) {
  const done = db.prepare(
    `SELECT COUNT(*) AS c FROM care_history h
     JOIN pins p ON p.id = h.pin_id
     WHERE p.garden_id = ? AND h.member_id = ?`,
  ).get(m.garden_id, m.id).c;
  const assigned = db.prepare(
    `SELECT COUNT(*) AS c FROM tasks t
     JOIN pins p ON p.id = t.pin_id
     WHERE p.garden_id = ? AND t.assigned_to = ?`,
  ).get(m.garden_id, m.id).c;
  return {
    id: m.id,
    garden_id: m.garden_id,
    name: m.name,
    email: m.email,
    role: m.role,
    color: m.color,
    invited_at: m.invited_at,
    accepted_at: m.accepted_at,
    pending: !m.accepted_at,
    completed_count: done,
    assigned_count: assigned,
  };
}

// Seznam členů zahrady
app.get('/api/gardens/:id/members', (req, res) => {
  const g = db.prepare('SELECT id FROM gardens WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const rows = db.prepare('SELECT * FROM garden_members WHERE garden_id = ? ORDER BY invited_at ASC').all(req.params.id);
  res.json(rows.map(memberWithStats));
});

// Pozvat člena — vytvoří řádek + invite token. Email je best-effort (nezablokuje vznik pozvánky).
app.post('/api/gardens/:id/members', async (req, res) => {
  const id = req.params.id;
  const g = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Jméno člena je povinné' });
  const email = (req.body?.email || '').toString().trim() || null;
  const role = MEMBER_ROLES.includes(req.body?.role) ? req.body.role : 'editor';
  const inviterName = (req.body?.inviter || '').toString().trim() || null;

  // Barva = první nepoužitá z palety, jinak cyklicky dle počtu členů.
  const existing = db.prepare('SELECT color FROM garden_members WHERE garden_id = ?').all(id).map((r) => r.color);
  const color = MEMBER_COLORS.find((c) => !existing.includes(c)) || MEMBER_COLORS[existing.length % MEMBER_COLORS.length];

  // Unikátní invite token
  let token;
  for (let i = 0; i < 5; i++) {
    token = generateShareToken(12);
    if (!db.prepare('SELECT 1 FROM garden_members WHERE invite_token = ?').get(token)) break;
    token = null;
  }
  if (!token) return res.status(500).json({ error: 'Nepodařilo se vygenerovat pozvánku' });

  const info = db.prepare(
    'INSERT INTO garden_members (garden_id, name, email, role, color, invite_token) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, email, role, color, token);
  const member = db.prepare('SELECT * FROM garden_members WHERE id = ?').get(info.lastInsertRowid);

  // Email pozvánka (pokud je email modul nakonfigurovaný a člen má adresu).
  let emailSent = false;
  const origin = (req.body?.origin || '').toString().replace(/\/+$/, '');
  const inviteUrl = origin ? `${origin}/pozvanka/${token}` : `/pozvanka/${token}`;
  if (email && emailModuleHasInvite()) {
    try {
      await email.sendGardenInvite({ to: email, gardenName: g.name, inviterName, memberName: name, role, url: inviteUrl });
      emailSent = true;
    } catch (e) {
      console.error('[members] invite email selhal:', e.message);
    }
  }
  res.json({ ...memberWithStats(member), invite_token: token, invite_url: inviteUrl, email_sent: emailSent });
});

// Upravit člena (role / jméno)
app.put('/api/gardens/:id/members/:memberId', (req, res) => {
  const m = db.prepare('SELECT * FROM garden_members WHERE id = ? AND garden_id = ?').get(req.params.memberId, req.params.id);
  if (!m) return res.status(404).json({ error: 'Člen nenalezen' });
  const name = req.body?.name !== undefined ? (req.body.name || '').toString().trim() || m.name : m.name;
  const role = MEMBER_ROLES.includes(req.body?.role) ? req.body.role : m.role;
  db.prepare('UPDATE garden_members SET name = ?, role = ? WHERE id = ?').run(name, role, m.id);
  res.json(memberWithStats(db.prepare('SELECT * FROM garden_members WHERE id = ?').get(m.id)));
});

// Odebrat člena — přiřazené úkoly se uvolní (assigned_to → NULL), atribuce v historii zůstává.
app.delete('/api/gardens/:id/members/:memberId', (req, res) => {
  const m = db.prepare('SELECT * FROM garden_members WHERE id = ? AND garden_id = ?').get(req.params.memberId, req.params.id);
  if (!m) return res.status(404).json({ error: 'Člen nenalezen' });
  db.prepare('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?').run(m.id);
  db.prepare('DELETE FROM garden_members WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

// Veřejný náhled pozvánky (bez autentizace) — pro accept obrazovku
app.get('/api/invite/:token', (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 6 || token.length > 32) return res.status(404).json({ error: 'Neplatná pozvánka' });
  const m = db.prepare('SELECT * FROM garden_members WHERE invite_token = ?').get(token);
  if (!m) return res.status(404).json({ error: 'Pozvánka neexistuje nebo byla zrušena' });
  const g = db.prepare('SELECT id, name, image_path FROM gardens WHERE id = ?').get(m.garden_id);
  res.json({
    garden: g ? { id: g.id, name: g.name, image_path: g.image_path } : null,
    member: { id: m.id, name: m.name, role: m.role, color: m.color },
    accepted: !!m.accepted_at,
  });
});

// Přijmout pozvánku — označí accepted_at; klient si uloží identitu lokálně.
app.post('/api/invite/:token/accept', (req, res) => {
  const m = db.prepare('SELECT * FROM garden_members WHERE invite_token = ?').get(req.params.token);
  if (!m) return res.status(404).json({ error: 'Pozvánka neexistuje nebo byla zrušena' });
  if (!m.accepted_at) {
    db.prepare("UPDATE garden_members SET accepted_at = datetime('now') WHERE id = ?").run(m.id);
  }
  const g = db.prepare('SELECT id, name FROM gardens WHERE id = ?').get(m.garden_id);
  const fresh = db.prepare('SELECT * FROM garden_members WHERE id = ?').get(m.id);
  res.json({
    member: { id: fresh.id, garden_id: fresh.garden_id, name: fresh.name, role: fresh.role, color: fresh.color },
    garden: g ? { id: g.id, name: g.name } : null,
  });
});

function emailModuleHasInvite() {
  return Boolean(email && typeof email.sendGardenInvite === 'function' && email.isConfigured && email.isConfigured());
}

// ======================= PINS =======================
app.get('/api/gardens/:id/pins', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM pins WHERE garden_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json(rows);
});

app.get('/api/pins/:id', (req, res) => {
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  const tasks = db.prepare(
    `SELECT t.*, m.name AS assignee_name, m.color AS assignee_color
     FROM tasks t LEFT JOIN garden_members m ON m.id = t.assigned_to
     WHERE t.pin_id = ? ORDER BY t.next_due`,
  ).all(pin.id);
  const history = db
    .prepare(
      `SELECT h.*, m.name AS member_name, m.color AS member_color
       FROM care_history h LEFT JOIN garden_members m ON m.id = h.member_id
       WHERE h.pin_id = ? ORDER BY h.done_at DESC LIMIT 50`,
    )
    .all(pin.id);
  const garden = db.prepare('SELECT soil_type, exposure, altitude_m, climate_zone FROM gardens WHERE id = ?').get(pin.garden_id);
  res.json({
    ...pin,
    tasks,
    history,
    garden_conditions: garden || null,
  });
});

app.post('/api/pins', upload.single('photo'), (req, res) => {
  const { garden_id, name, x, y, plant_name, planting_date, notes, color } = req.body;
  const photoPath = req.file ? '/uploads/' + req.file.filename : null;
  const info = db
    .prepare(
      `INSERT INTO pins (garden_id, name, x, y, plant_name, planting_date, notes, photo_path, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      garden_id,
      name || 'Nové místo',
      parseFloat(x),
      parseFloat(y),
      plant_name || null,
      planting_date || null,
      notes || null,
      photoPath,
      color || '#4a7c3a',
    );
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(info.lastInsertRowid);
  res.json(pin);
});

app.put('/api/pins/:id', upload.single('photo'), (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM pins WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Pin nenalezen' });

  let photoPath = current.photo_path;
  if (req.file) {
    if (current.photo_path) {
      const old = path.join(__dirname, current.photo_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    photoPath = '/uploads/' + req.file.filename;
  } else if (req.body.remove_photo === 'true') {
    if (current.photo_path) {
      const old = path.join(__dirname, current.photo_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    photoPath = null;
  }

  const name = req.body.name ?? current.name;
  const x = req.body.x !== undefined ? parseFloat(req.body.x) : current.x;
  const y = req.body.y !== undefined ? parseFloat(req.body.y) : current.y;
  const plant_name = req.body.plant_name ?? current.plant_name;
  const planting_date = req.body.planting_date ?? current.planting_date;
  const notes = req.body.notes ?? current.notes;
  const color = req.body.color ?? current.color;

  db.prepare(
    `UPDATE pins SET name=?, x=?, y=?, plant_name=?, planting_date=?, notes=?, photo_path=?, color=? WHERE id=?`,
  ).run(name, x, y, plant_name, planting_date, notes, photoPath, color, id);

  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(id);
  res.json(pin);
});

app.delete('/api/pins/:id', (req, res) => {
  const id = req.params.id;
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  db.prepare('DELETE FROM pins WHERE id = ?').run(id);
  if (pin.photo_path) {
    const p = path.join(__dirname, pin.photo_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  // Smaž celou složku s galerií fotek pinu
  const photosDir = path.join(uploadsDir, 'pins', String(id));
  if (fs.existsSync(photosDir)) {
    try { fs.rmSync(photosDir, { recursive: true, force: true }); } catch {}
  }
  res.json({ ok: true });
});

// Base64 photo upload — přijme data URL, ořízne přes Sharp na max 800px, uloží do uploads/.
app.put('/api/pins/:id/photo', async (req, res) => {
  const id = req.params.id;
  const pin = db.prepare('SELECT * FROM pins WHERE id = ?').get(id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });

  const { photo } = req.body || {};
  if (!photo || typeof photo !== 'string') {
    return res.status(400).json({ error: 'Chybí pole photo (data URL)' });
  }
  const m = photo.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Neplatný formát — očekávám data:image/...;base64,...' });
  const buf = Buffer.from(m[2], 'base64');

  try {
    const filename = Date.now() + '-' + Math.round(Math.random() * 1e9) + '.jpg';
    const dest = path.join(uploadsDir, filename);
    if (sharp) {
      await sharp(buf)
        .rotate() // respektuj EXIF orientaci
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(dest);
    } else {
      // Fallback bez Sharp: ulož raw buffer (bez resize)
      fs.writeFileSync(dest, buf);
    }

    if (pin.photo_path) {
      const old = path.join(__dirname, pin.photo_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const photoPath = '/uploads/' + filename;
    db.prepare('UPDATE pins SET photo_path = ? WHERE id = ?').run(photoPath, id);
    res.json({ ok: true, photo_path: photoPath });
  } catch (e) {
    res.status(500).json({ error: 'Chyba při zpracování fotky: ' + e.message });
  }
});

// ======================= PIN PHOTOS GALLERY =======================
// Multer storage pro fotky rostlin — podsložka per pin
const pinPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, 'pins', String(req.params.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  },
});
const pinPhotoUpload = multer({
  storage: pinPhotoStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp|heic|heif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Pouze obrázky jsou povolené'));
  },
});

// Seznam fotek pinu
app.get('/api/pins/:id/photos', (req, res) => {
  const id = req.params.id;
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  const rows = db
    .prepare('SELECT * FROM pin_photos WHERE pin_id = ? ORDER BY uploaded_at DESC')
    .all(id);
  const photos = rows.map((r) => ({
    ...r,
    url: `/uploads/pins/${id}/${r.filename}`,
  }));
  res.json(photos);
});

// Upload jedné nebo více fotek (multipart, field "photos")
app.post('/api/pins/:id/photos', pinPhotoUpload.array('photos', 10), (req, res) => {
  const id = req.params.id;
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: 'Žádné soubory' });
  const caption = req.body.caption || null;
  const inserted = [];
  const stmt = db.prepare(
    'INSERT INTO pin_photos (pin_id, filename, caption) VALUES (?, ?, ?)',
  );
  for (const f of files) {
    const info = stmt.run(id, f.filename, caption);
    inserted.push({
      id: info.lastInsertRowid,
      pin_id: Number(id),
      filename: f.filename,
      caption,
      url: `/uploads/pins/${id}/${f.filename}`,
    });
  }
  res.json(inserted);
});

// Smazat fotku
app.delete('/api/pins/:id/photos/:photoId', (req, res) => {
  const { id, photoId } = req.params;
  const photo = db.prepare('SELECT * FROM pin_photos WHERE id = ? AND pin_id = ?').get(photoId, id);
  if (!photo) return res.status(404).json({ error: 'Fotka nenalezena' });
  const filePath = path.join(uploadsDir, 'pins', String(id), photo.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  db.prepare('DELETE FROM pin_photos WHERE id = ?').run(photoId);
  res.json({ ok: true });
});

// Posledních N fotek napříč všemi piny (pro home grid)
app.get('/api/photos/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 4, 20);
  const rows = db
    .prepare(
      `SELECT ph.id, ph.pin_id, ph.filename, ph.caption, ph.uploaded_at,
              p.name AS pin_name, p.plant_name, p.garden_id,
              g.name AS garden_name
       FROM pin_photos ph
       JOIN pins p ON p.id = ph.pin_id
       LEFT JOIN gardens g ON g.id = p.garden_id
       ORDER BY ph.uploaded_at DESC
       LIMIT ?`,
    )
    .all(limit);
  const photos = rows.map((r) => ({
    ...r,
    url: `/uploads/pins/${r.pin_id}/${r.filename}`,
  }));
  res.json(photos);
});

// ======================= BEDS (zahony) =======================
// Záhon je obdélníková plocha v zahradě s rozměry v procentech mapy
// a volitelně velikostí v metrech (pro orientační měřítko).
app.get('/api/gardens/:id/beds', (req, res) => {
  const garden = db.prepare('SELECT id FROM gardens WHERE id = ?').get(req.params.id);
  if (!garden) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const rows = db
    .prepare('SELECT * FROM beds WHERE garden_id = ? ORDER BY created_at ASC')
    .all(req.params.id);
  res.json(rows);
});

app.post('/api/beds', (req, res) => {
  const { garden_id, name, x, y, width, height, width_m, height_m, color, type } = req.body || {};
  if (!garden_id) return res.status(400).json({ error: 'garden_id je povinný' });
  const garden = db.prepare('SELECT id FROM gardens WHERE id = ?').get(garden_id);
  if (!garden) return res.status(404).json({ error: 'Zahrada nenalezena' });
  if ([x, y, width, height].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    return res.status(400).json({ error: 'x, y, width, height musí být čísla' });
  }
  const info = db
    .prepare(
      `INSERT INTO beds (garden_id, name, x, y, width, height, width_m, height_m, color, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      garden_id,
      name || 'Záhon',
      x,
      y,
      width,
      height,
      width_m ?? null,
      height_m ?? null,
      color || '#8b6f47',
      type || null,
    );
  res.json(db.prepare('SELECT * FROM beds WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/beds/:id', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Záhon nenalezen' });
  const name = req.body.name ?? current.name;
  const x = req.body.x !== undefined ? Number(req.body.x) : current.x;
  const y = req.body.y !== undefined ? Number(req.body.y) : current.y;
  const width = req.body.width !== undefined ? Number(req.body.width) : current.width;
  const height = req.body.height !== undefined ? Number(req.body.height) : current.height;
  const width_m = req.body.width_m !== undefined ? (req.body.width_m === null ? null : Number(req.body.width_m)) : current.width_m;
  const height_m = req.body.height_m !== undefined ? (req.body.height_m === null ? null : Number(req.body.height_m)) : current.height_m;
  const color = req.body.color ?? current.color;
  const type = req.body.type !== undefined ? (req.body.type || null) : current.type;
  db.prepare(
    `UPDATE beds SET name=?, x=?, y=?, width=?, height=?, width_m=?, height_m=?, color=?, type=? WHERE id=?`,
  ).run(name, x, y, width, height, width_m, height_m, color, type, id);
  res.json(db.prepare('SELECT * FROM beds WHERE id = ?').get(id));
});

app.delete('/api/beds/:id', (req, res) => {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(req.params.id);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });
  // BED-3: úklid vlastní fotky záhonu + uložený originál (pre-crop), pokud existují,
  // jinak by zůstaly osiřelé soubory v uploads/.
  for (const rel of [bed.image_path, bed.original_image_path]) {
    if (rel) {
      const abs = path.join(__dirname, rel);
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
    }
  }
  db.prepare('DELETE FROM beds WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ======================= BED PHOTO (BED-3) =======================
// Vlastní close-up fotka záhonu (volitelně). Když existuje, BedPlanView ji
// použije jako pozadí místo výřezu fotky zahrady. Reuse multer `upload` (25 MB
// limit, image-only filter) a sharp metadata pipeline ze /api/gardens.

app.put('/api/beds/:id/photo', upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
  if (!current) {
    // 404 — úklid osiřelého uploadu (multer ho stihl uložit, než zjistíme, že bed neexistuje)
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    return res.status(404).json({ error: 'Záhon nenalezen' });
  }
  if (!req.file) return res.status(400).json({ error: 'Chybí soubor (image)' });

  // Smaž předchozí fotku + uložený originál (kdyby v budoucnu šel crop, invaliduje se).
  for (const rel of [current.image_path, current.original_image_path]) {
    if (rel) {
      const abs = path.join(__dirname, rel);
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
    }
  }

  let w = null;
  let h = null;
  if (sharp) {
    try {
      const meta = await sharp(req.file.path).metadata();
      if (meta.width && meta.height) { w = meta.width; h = meta.height; }
    } catch (e) {
      console.warn('PUT /api/beds/:id/photo: sharp metadata selhalo:', e.message);
    }
  }

  const imagePath = '/uploads/' + req.file.filename;
  db.prepare(
    'UPDATE beds SET image_path=?, image_width=?, image_height=?, original_image_path=NULL, bed_polygon=NULL WHERE id=?',
  ).run(imagePath, w, h, id);
  res.json(db.prepare('SELECT * FROM beds WHERE id = ?').get(id));
});

app.delete('/api/beds/:id/photo', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM beds WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Záhon nenalezen' });
  for (const rel of [current.image_path, current.original_image_path]) {
    if (rel) {
      const abs = path.join(__dirname, rel);
      try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
    }
  }
  db.prepare(
    'UPDATE beds SET image_path=NULL, image_width=NULL, image_height=NULL, original_image_path=NULL, bed_polygon=NULL WHERE id=?',
  ).run(id);
  res.json(db.prepare('SELECT * FROM beds WHERE id = ?').get(id));
});

// ======================= BED PLANTS (rostliny v záhonu) =======================
// Záhon ↔ rostliny many-to-many. Každá rostlina/odrůda = vlastní záznam s počtem kusů.
// Pokud má pin_id, sezónní úkony se generují přes existující pin pipeline.
// "Aktivní" rostliny = removed_at IS NULL.

function bedCenter(bed) {
  return {
    x: bed.x + bed.width / 2,
    y: bed.y + bed.height / 2,
  };
}

// BED-1: aspekt-citlivá mřížka uvnitř obdélníku záhonu. Index = 0-based pořadí
// rostliny v záhonu, total = aktuální počet aktivních bed_plants (řídí cols/rows).
// Margin 14 % uvnitř záhonu, aby piny nelepily na hranici a zůstaly viditelné.
function bedPlantPosition(bed, index, total) {
  const t = Math.max(1, parseInt(total, 10) || 1);
  const i = Math.max(0, Math.min(t - 1, parseInt(index, 10) || 0));
  const w = Math.max(0.01, bed.width || 0);
  const h = Math.max(0.01, bed.height || 0);
  const aspect = w / h;
  const cols = Math.max(1, Math.round(Math.sqrt(t * aspect))) || 1;
  const rows = Math.max(1, Math.ceil(t / cols));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const margin = 0.14;
  const usableW = w * (1 - 2 * margin);
  const usableH = h * (1 - 2 * margin);
  return {
    x: bed.x + w * margin + (col + 0.5) * (usableW / cols),
    y: bed.y + h * margin + (row + 0.5) * (usableH / rows),
  };
}

// BED-1/BED-2: přepíše pozice bed_plant pinů záhonu. Rostliny s ručně nastavenou
// pozicí (bed_x/bed_y !NULL — z plánu záhonu) zůstávají; zbytek se rozprostře mřížkou
// (`bedPlantPosition`). Pořadí dle `created_at` (stabilní mezi voláními).
const _redistributeUpdate = () => db.prepare('UPDATE pins SET x = ?, y = ? WHERE id = ?');
function redistributeBedPins(bedId) {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(bedId);
  if (!bed) return 0;
  const rows = db
    .prepare(
      `SELECT bp.id, bp.pin_id, bp.bed_x, bp.bed_y
       FROM bed_plants bp
       WHERE bp.bed_id = ? AND bp.removed_at IS NULL AND bp.pin_id IS NOT NULL
       ORDER BY bp.created_at ASC, bp.id ASC`,
    )
    .all(bedId);
  const total = rows.length;
  if (total === 0) return 0;
  const upd = _redistributeUpdate();
  // BED-2: rostliny s manuální pozicí přeskočíme; mřížka jede jen přes zbytek
  // (auto rostliny dostávají index podle pořadí mezi sebou, ne globálně).
  const autoRows = rows.filter((r) => r.bed_x == null || r.bed_y == null);
  const tx = db.transaction(() => {
    // Manuální: zaručíme, že pin x/y sedí na bed_x/bed_y (idempotent self-heal).
    rows
      .filter((r) => r.bed_x != null && r.bed_y != null)
      .forEach((r) => {
        const px = bed.x + (r.bed_x / 100) * bed.width;
        const py = bed.y + (r.bed_y / 100) * bed.height;
        upd.run(px, py, r.pin_id);
      });
    // Auto: grid přes zbylé rostliny.
    autoRows.forEach((r, idx) => {
      const pos = bedPlantPosition(bed, idx, autoRows.length);
      upd.run(pos.x, pos.y, r.pin_id);
    });
  });
  tx();
  return total;
}

// BED-1: jednorázová boot migrace — najde záhony, kde mají 2+ bed_plant piny
// shodnou pozici (stacknuté od staré `bedCenter` logiky) a rozprostře je.
// Idempotentní: po prvním běhu už žádné stacknuté nejsou, takže další start no-op.
function bed1MigrateStackedPins() {
  try {
    const stackedBeds = db
      .prepare(
        `SELECT bp.bed_id, COUNT(*) AS dup
         FROM bed_plants bp
         JOIN pins p ON p.id = bp.pin_id
         WHERE bp.removed_at IS NULL AND bp.pin_id IS NOT NULL
         GROUP BY bp.bed_id, ROUND(p.x, 4), ROUND(p.y, 4)
         HAVING dup > 1`,
      )
      .all();
    if (!stackedBeds.length) return 0;
    const uniqueBedIds = [...new Set(stackedBeds.map((r) => r.bed_id))];
    let total = 0;
    for (const bedId of uniqueBedIds) total += redistributeBedPins(bedId);
    console.log(`[bed-1] redistributed ${total} stacked bed_plant pin(s) across ${uniqueBedIds.length} bed(s)`);
    return total;
  } catch (e) {
    console.warn('[bed-1] migration failed:', e.message);
    return 0;
  }
}
try { bed1MigrateStackedPins(); } catch (e) { console.warn('bed1MigrateStackedPins at boot failed:', e.message); }

// Vrátí všechny aktivní rostliny záhonu + propojený pin (pokud existuje).
app.get('/api/beds/:bedId/plants', (req, res) => {
  const bed = db.prepare('SELECT id FROM beds WHERE id = ?').get(req.params.bedId);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });
  const rows = db
    .prepare(
      `SELECT bp.*, p.name AS pin_name, p.x AS pin_x, p.y AS pin_y, p.color AS pin_color, p.photo_path AS pin_photo
       FROM bed_plants bp
       LEFT JOIN pins p ON p.id = bp.pin_id
       WHERE bp.bed_id = ? AND bp.removed_at IS NULL
       ORDER BY bp.created_at ASC`,
    )
    .all(req.params.bedId);
  res.json(rows);
});

// Přidá rostlinu do záhonu. Volitelně vytvoří podkladový pin ve středu záhonu
// (auto_pin=true, default), aby fungovaly sezónní úkony / care historie.
// Pokud má klient existující pin, který chce propojit, předá link_pin_id.
app.post('/api/beds/:bedId/plants', (req, res) => {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(req.params.bedId);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });
  const {
    plant_id = null,
    plant_name = null,
    count = 1,
    planted_at = null,
    notes = null,
    link_pin_id = null,
    auto_pin = true,
    color = null,
    bed_x = null,
    bed_y = null,
  } = req.body || {};

  if (!plant_name || !String(plant_name).trim()) {
    return res.status(400).json({ error: 'plant_name je povinný' });
  }
  const cnt = Math.max(1, parseInt(count, 10) || 1);
  // BED-2: pokud klient klepl na konkrétní místo v plánu záhonu, dostaneme
  // bed_x/bed_y v % (0-100). Klamp + ulož; null = grid distribuce z BED-1.
  const hasManualPos =
    bed_x != null && bed_y != null && !Number.isNaN(Number(bed_x)) && !Number.isNaN(Number(bed_y));
  const manualBedX = hasManualPos ? Math.max(0, Math.min(100, Number(bed_x))) : null;
  const manualBedY = hasManualPos ? Math.max(0, Math.min(100, Number(bed_y))) : null;

  let pinId = link_pin_id ? Number(link_pin_id) : null;
  if (pinId) {
    const linked = db.prepare('SELECT id FROM pins WHERE id = ?').get(pinId);
    if (!linked) return res.status(404).json({ error: 'Pin pro propojení nenalezen' });
  } else if (auto_pin) {
    // BED-2: pokud máme manuální pozici, vytvoř pin rovnou tam; jinak ve středu
    // a `redistributeBedPins` ho dorovná mřížkou.
    let px;
    let py;
    if (hasManualPos) {
      px = bed.x + (manualBedX / 100) * bed.width;
      py = bed.y + (manualBedY / 100) * bed.height;
    } else {
      const c = bedCenter(bed);
      px = c.x;
      py = c.y;
    }
    const info = db
      .prepare(
        `INSERT INTO pins (garden_id, name, x, y, plant_name, planting_date, notes, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        bed.garden_id,
        plant_name,
        px,
        py,
        plant_name,
        planted_at || null,
        notes || null,
        color || bed.color || '#4a7c3a',
      );
    pinId = info.lastInsertRowid;
  }

  const result = db
    .prepare(
      `INSERT INTO bed_plants (bed_id, plant_id, plant_name, count, pin_id, planted_at, notes, bed_x, bed_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      bed.id,
      plant_id,
      plant_name,
      cnt,
      pinId,
      planted_at || null,
      notes || null,
      manualBedX,
      manualBedY,
    );

  // BED-1: rozprostři aktivní bed_plant piny do mřížky (řeší stacking).
  // BED-2: rostliny s manuální pozicí přeskočí (`redistributeBedPins`).
  redistributeBedPins(bed.id);

  const row = db
    .prepare(
      `SELECT bp.*, p.name AS pin_name, p.x AS pin_x, p.y AS pin_y, p.color AS pin_color, p.photo_path AS pin_photo
       FROM bed_plants bp
       LEFT JOIN pins p ON p.id = bp.pin_id
       WHERE bp.id = ?`,
    )
    .get(result.lastInsertRowid);
  res.json(row);
});

app.put('/api/bed-plants/:id', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM bed_plants WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Záznam nenalezen' });
  const count = req.body.count !== undefined ? Math.max(1, parseInt(req.body.count, 10) || 1) : current.count;
  const plant_name = req.body.plant_name ?? current.plant_name;
  const plant_id = req.body.plant_id !== undefined ? (req.body.plant_id || null) : current.plant_id;
  const planted_at = req.body.planted_at !== undefined ? (req.body.planted_at || null) : current.planted_at;
  const notes = req.body.notes !== undefined ? (req.body.notes || null) : current.notes;

  db.prepare(
    `UPDATE bed_plants SET plant_id=?, plant_name=?, count=?, planted_at=?, notes=? WHERE id=?`,
  ).run(plant_id, plant_name, count, planted_at, notes, id);

  // Pokud existuje propojený pin, synchronizujeme název a planting_date — UI je očekává.
  if (current.pin_id) {
    db.prepare('UPDATE pins SET plant_name = ?, planting_date = ? WHERE id = ?').run(
      plant_name,
      planted_at,
      current.pin_id,
    );
  }

  const row = db
    .prepare(
      `SELECT bp.*, p.name AS pin_name, p.x AS pin_x, p.y AS pin_y, p.color AS pin_color, p.photo_path AS pin_photo
       FROM bed_plants bp
       LEFT JOIN pins p ON p.id = bp.pin_id
       WHERE bp.id = ?`,
    )
    .get(id);
  res.json(row);
});

// BED-2: nastaví pozici rostliny v plánu záhonu (% v rámci bed obdélníku).
// bed_x/bed_y v % (0-100). Mapuje se na pins.x/y v souřadnicích zahrady.
// null → zruší manuální pozici a nechá BED-1 grid distribuci.
app.put('/api/bed-plants/:id/position', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM bed_plants WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Záznam nenalezen' });
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(current.bed_id);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });

  const { bed_x = null, bed_y = null } = req.body || {};
  const clear = bed_x == null || bed_y == null;
  let newBedX = null;
  let newBedY = null;
  if (!clear) {
    if (Number.isNaN(Number(bed_x)) || Number.isNaN(Number(bed_y))) {
      return res.status(400).json({ error: 'bed_x/bed_y musí být čísla v rozsahu 0-100' });
    }
    newBedX = Math.max(0, Math.min(100, Number(bed_x)));
    newBedY = Math.max(0, Math.min(100, Number(bed_y)));
  }

  db.prepare('UPDATE bed_plants SET bed_x = ?, bed_y = ? WHERE id = ?').run(newBedX, newBedY, id);

  // Mapuj manuální % na souřadnice zahrady a propíš do pinu (pokud existuje).
  if (current.pin_id && !clear) {
    const px = bed.x + (newBedX / 100) * bed.width;
    const py = bed.y + (newBedY / 100) * bed.height;
    db.prepare('UPDATE pins SET x = ?, y = ? WHERE id = ?').run(px, py, current.pin_id);
  }
  // Při clearu (návrat do mřížky) přepustí pozici redistribuci.
  redistributeBedPins(current.bed_id);

  const row = db
    .prepare(
      `SELECT bp.*, p.name AS pin_name, p.x AS pin_x, p.y AS pin_y, p.color AS pin_color, p.photo_path AS pin_photo
       FROM bed_plants bp
       LEFT JOIN pins p ON p.id = bp.pin_id
       WHERE bp.id = ?`,
    )
    .get(id);
  res.json(row);
});

// Odstraní rostlinu ze záhonu. Soft delete (removed_at). Volitelně i podkladový pin.
// ?keep_pin=1 → pin zůstane samostatným pinem na mapě (default 0 = smaže i pin + jeho úkony).
app.delete('/api/bed-plants/:id', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM bed_plants WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Záznam nenalezen' });
  const keepPin = req.query.keep_pin === '1' || req.query.keep_pin === 'true';
  db.prepare('UPDATE bed_plants SET removed_at = datetime(\'now\') WHERE id = ?').run(id);
  if (!keepPin && current.pin_id) {
    db.prepare('DELETE FROM pins WHERE id = ?').run(current.pin_id);
  }
  // BED-1: po odebrání rostliny rozprostři zbývající piny záhonu (mřížka N-1).
  redistributeBedPins(current.bed_id);
  res.json({ ok: true, keep_pin: keepPin });
});

// Detekce pinů geometricky uvnitř záhonu — podklad pro "Sloučit do záhonu?" CTA.
app.get('/api/beds/:bedId/pins-inside', (req, res) => {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(req.params.bedId);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });
  // Vyloučí piny, které jsou už propojené s nějakým bed_plants (jakýkoliv záhon).
  const pins = db
    .prepare(
      `SELECT p.*
       FROM pins p
       WHERE p.garden_id = ?
         AND p.x >= ? AND p.x <= ?
         AND p.y >= ? AND p.y <= ?
         AND p.id NOT IN (SELECT pin_id FROM bed_plants WHERE pin_id IS NOT NULL AND removed_at IS NULL)
       ORDER BY p.created_at ASC`,
    )
    .all(bed.garden_id, bed.x, bed.x + bed.width, bed.y, bed.y + bed.height);
  res.json(pins);
});

// Sloučí existující piny do záhonu — pro každý pin vytvoří bed_plants záznam.
// Piny zůstávají (tasks/care_history přežijí); pouze získají vztah k záhonu.
app.post('/api/beds/:bedId/merge-pins', (req, res) => {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(req.params.bedId);
  if (!bed) return res.status(404).json({ error: 'Záhon nenalezen' });
  const ids = Array.isArray(req.body?.pin_ids) ? req.body.pin_ids : [];
  if (!ids.length) return res.status(400).json({ error: 'pin_ids prázdné' });

  const insert = db.prepare(
    `INSERT INTO bed_plants (bed_id, plant_id, plant_name, count, pin_id, planted_at, notes)
     VALUES (?, NULL, ?, 1, ?, ?, ?)`,
  );
  const created = [];
  const skipped = [];

  const tx = db.transaction((pinIds) => {
    for (const pid of pinIds) {
      const pin = db
        .prepare(
          `SELECT * FROM pins
           WHERE id = ? AND garden_id = ?
             AND id NOT IN (SELECT pin_id FROM bed_plants WHERE pin_id IS NOT NULL AND removed_at IS NULL)`,
        )
        .get(pid, bed.garden_id);
      if (!pin) {
        skipped.push(pid);
        continue;
      }
      const info = insert.run(
        bed.id,
        pin.plant_name || pin.name,
        pin.id,
        pin.planting_date || null,
        pin.notes || null,
      );
      created.push(info.lastInsertRowid);
    }
  });
  tx(ids);

  res.json({ ok: true, created_count: created.length, skipped });
});

// ======================= TASKS =======================
app.get('/api/tasks', (req, res) => {
  regenerateYearlyTasks();
  // All tasks with related pin + garden data
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name,
        m.name AS assignee_name, m.color AS assignee_color
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN garden_members m ON m.id = t.assigned_to
       ORDER BY t.next_due ASC`,
    )
    .all();
  res.json(rows);
});

app.get('/api/tasks/today', (req, res) => {
  regenerateYearlyTasks();
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name,
        m.name AS assignee_name, m.color AS assignee_color
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN garden_members m ON m.id = t.assigned_to
       WHERE t.next_due <= ?
       ORDER BY t.next_due ASC`,
    )
    .all(today);
  res.json(rows);
});

app.get('/api/tasks/week', (req, res) => {
  regenerateYearlyTasks();
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);
  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name,
        m.name AS assignee_name, m.color AS assignee_color
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN garden_members m ON m.id = t.assigned_to
       WHERE t.next_due <= ?
       ORDER BY t.next_due ASC`,
    )
    .all(endStr);
  res.json({ start: startStr, end: endStr, tasks: rows });
});

// Globální vyhledávání — zahrady + piny + rostliny, diakritika-insensitive
function stripDia(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

app.get('/api/search', (req, res) => {
  const raw = (req.query.q || '').toString().trim();
  if (raw.length < 1) return res.json({ gardens: [], pins: [] });
  const needle = stripDia(raw);
  const today = new Date().toISOString().slice(0, 10);

  const allGardens = db
    .prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM pins WHERE garden_id = g.id) AS pin_count,
        (SELECT COUNT(*) FROM tasks t JOIN pins p ON p.id = t.pin_id WHERE p.garden_id = g.id AND t.next_due <= ?) AS urgent_count
       FROM gardens g`,
    )
    .all(today);
  const gardens = allGardens.filter((g) => stripDia(g.name).includes(needle));

  const allPins = db
    .prepare(
      `SELECT p.*, g.name AS garden_name
       FROM pins p
       JOIN gardens g ON g.id = p.garden_id`,
    )
    .all();
  const pins = allPins.filter((p) =>
    stripDia(p.name).includes(needle) ||
    stripDia(p.plant_name).includes(needle) ||
    stripDia(p.notes).includes(needle),
  );

  res.json({
    query: raw,
    gardens: gardens.slice(0, 12),
    pins: pins.slice(0, 30),
    total: gardens.length + pins.length,
  });
});

// Souhrnný přehled — všechny úkony přes všechny zahrady, defaultně 14 dní dopředu (+overdue)
app.get('/api/tasks/overview', (req, res) => {
  regenerateYearlyTasks();
  const days = Math.max(1, Math.min(60, parseInt(req.query.days, 10) || 14));
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + days);
  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name, g.image_path AS garden_image,
        m.name AS assignee_name, m.color AS assignee_color
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN garden_members m ON m.id = t.assigned_to
       WHERE t.next_due <= ?
       ORDER BY t.next_due ASC`,
    )
    .all(endStr);
  res.json({ start: startStr, end: endStr, days, tasks: rows });
});

app.post('/api/tasks', (req, res) => {
  const { pin_id, title, task_type, frequency_days, specific_date, notes, recurring, recurrence_pattern, assigned_to } = req.body;
  const tmp = { specific_date, frequency_days, last_done: null };
  const next_due = computeNextDue(tmp);
  const info = db
    .prepare(
      `INSERT INTO tasks (pin_id, title, task_type, frequency_days, specific_date, next_due, notes, recurring, recurrence_pattern, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      pin_id,
      title,
      task_type,
      frequency_days ? parseInt(frequency_days, 10) : null,
      specific_date || null,
      next_due,
      notes || null,
      recurring ? 1 : 0,
      recurrence_pattern || null,
      assigned_to ? parseInt(assigned_to, 10) : null,
    );
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Úkol nenalezen' });
  const title = req.body.title ?? current.title;
  const task_type = req.body.task_type ?? current.task_type;
  const frequency_days =
    req.body.frequency_days !== undefined
      ? req.body.frequency_days
        ? parseInt(req.body.frequency_days, 10)
        : null
      : current.frequency_days;
  const specific_date =
    req.body.specific_date !== undefined ? req.body.specific_date || null : current.specific_date;
  const notes = req.body.notes ?? current.notes;
  const recurring =
    req.body.recurring !== undefined ? (req.body.recurring ? 1 : 0) : current.recurring;
  const recurrence_pattern =
    req.body.recurrence_pattern !== undefined
      ? req.body.recurrence_pattern || null
      : current.recurrence_pattern;
  const assigned_to =
    req.body.assigned_to !== undefined
      ? (req.body.assigned_to ? parseInt(req.body.assigned_to, 10) : null)
      : current.assigned_to;
  const next_due = computeNextDue({ specific_date, frequency_days, last_done: current.last_done });
  db.prepare(
    `UPDATE tasks SET title=?, task_type=?, frequency_days=?, specific_date=?, next_due=?, notes=?, recurring=?, recurrence_pattern=?, assigned_to=? WHERE id=?`,
  ).run(title, task_type, frequency_days, specific_date, next_due, notes, recurring, recurrence_pattern, assigned_to, id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ISO 8601 týden ve formátu YYYY-Www (např. 2026-W22). Použito pro frozen-day kvótu
// "jednou týdně" — porovnává se proti uloženému `user_stats.frozen_used_week`.
function isoWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO weekday: 1 (Mon) … 7 (Sun); JS getUTCDay 0=Sun → mapuj
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Bump streak counter — den-v-řadě logika, vrací updated row.
// Frozen-day pravidlo: 1× týdně může user vynechat přesně 1 den (gap=2) bez resetu —
// streak se zvýší jako by den nechyběl, ale v daný ISO týden už nelze frozen použít znovu.
function bumpStreakForToday(userId = 1) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentWeek = isoWeekString(now);
  const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  if (!stats) {
    db.prepare(
      'INSERT INTO user_stats (user_id, current_streak, longest_streak, last_done_date, total_completed) VALUES (?, 1, 1, ?, 1)',
    ).run(userId, today);
    return { current_streak: 1, longest_streak: 1, last_done_date: today, total_completed: 1, increased: true, frozen_used: false };
  }
  const last = stats.last_done_date;
  let current = stats.current_streak || 0;
  let increased = false;
  let frozenUsed = false;
  let frozenUsedWeek = stats.frozen_used_week || null;
  if (last === today) {
    // už dnes počítáno — jen total++
  } else {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    const dayBeforeYest = new Date(now);
    dayBeforeYest.setDate(dayBeforeYest.getDate() - 2);
    const dayBeforeYestStr = dayBeforeYest.toISOString().slice(0, 10);
    if (last === yestStr) {
      current = current + 1;
    } else if (last === dayBeforeYestStr && current > 0 && frozenUsedWeek !== currentWeek) {
      // Gap přesně 1 den (předevčírem byl poslední úkol) a frozen ještě nepoužitý
      // tento ISO týden → zmrazení: streak pokračuje + 1 jako by včerejšek nechyběl.
      current = current + 1;
      frozenUsed = true;
      frozenUsedWeek = currentWeek;
    } else {
      current = 1;
    }
    increased = true;
  }
  const longest = Math.max(stats.longest_streak || 0, current);
  const total = (stats.total_completed || 0) + 1;
  db.prepare(
    `UPDATE user_stats SET current_streak=?, longest_streak=?, last_done_date=?, total_completed=?, frozen_used_week=?, updated_at=datetime('now') WHERE user_id=?`,
  ).run(current, longest, today, total, frozenUsedWeek, userId);
  return { current_streak: current, longest_streak: longest, last_done_date: today, total_completed: total, increased, frozen_used: frozenUsed };
}

// GET streak / user stats
app.get('/api/stats/streak', (req, res) => {
  const row = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(1);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestStr = yest.toISOString().slice(0, 10);
  const dayBeforeYest = new Date(now);
  dayBeforeYest.setDate(dayBeforeYest.getDate() - 2);
  const dayBeforeYestStr = dayBeforeYest.toISOString().slice(0, 10);
  const currentWeek = isoWeekString(now);

  let current = row?.current_streak ?? 0;
  let frozenAvailable = current > 0 && (row?.frozen_used_week ?? null) !== currentWeek;

  if (row?.last_done_date) {
    if (row.last_done_date === today || row.last_done_date === yestStr) {
      // Streak živý — frozenAvailable už spočítáno výše
    } else if (
      row.last_done_date === dayBeforeYestStr
      && current > 0
      && row.frozen_used_week !== currentWeek
    ) {
      // Mezera přesně 1 den a frozen tento týden nevyužitý → streak je live,
      // user může dnes splnit úkol a frozen se aplikuje při příštím bumpu.
      // Žádný downgrade; jen necháme současný streak.
    } else {
      current = 0;
      frozenAvailable = false;
    }
  }
  res.json({
    current_streak: current,
    longest_streak: row?.longest_streak ?? 0,
    last_done_date: row?.last_done_date ?? null,
    total_completed: row?.total_completed ?? 0,
    is_weekly_gardener: current >= 7,
    frozen_available: frozenAvailable,
    frozen_used_week: row?.frozen_used_week ?? null,
    current_week: currentWeek,
  });
});

// Mark task as done and reschedule
app.post('/api/tasks/:id/done', (req, res) => {
  const id = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen' });
  const today = new Date().toISOString().slice(0, 10);

  // Atribuce splnění — který člen úkol dokončil (NULL = vlastník). Ověř, že
  // member_id patří do téže zahrady jako pin, jinak ignoruj (uložíme NULL).
  let memberId = req.body?.member_id ? parseInt(req.body.member_id, 10) : null;
  if (memberId) {
    const ok = db.prepare(
      `SELECT 1 FROM garden_members m JOIN pins p ON p.garden_id = m.garden_id
       WHERE m.id = ? AND p.id = ?`,
    ).get(memberId, task.pin_id);
    if (!ok) memberId = null;
  }

  // Record care history
  db.prepare(
    `INSERT INTO care_history (task_id, pin_id, action, notes, member_id) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, task.pin_id, task.title, req.body?.notes || null, memberId);

  // Bump streak
  const streak = bumpStreakForToday(1);

  if (task.specific_date) {
    if (task.recurring && task.recurrence_pattern === 'yearly') {
      // Yearly recurring: posunout specific_date o rok dopředu
      // TASK-3: po done resetuj snoozes počítadlo + undo zálohu (nová instance = čistý stav)
      const d = new Date(task.specific_date);
      d.setFullYear(d.getFullYear() + 1);
      const newDate = d.toISOString().slice(0, 10);
      db.prepare(
        'UPDATE tasks SET last_done=?, specific_date=?, next_due=?, snoozes=0, prev_specific_date=NULL, prev_next_due=NULL WHERE id=?',
      ).run(today, newDate, newDate, id);
      return res.json({ ...db.prepare('SELECT * FROM tasks WHERE id = ?').get(id), streak });
    }
    // One-time task: delete after completion
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return res.json({ ok: true, removed: true, streak });
  }
  // Recurring: update last_done and compute next
  // TASK-3: reset snoozes + prev_* (nová instance recurring úkolu = čistý stav)
  const next_due = computeNextDue({ ...task, last_done: today });
  db.prepare(
    'UPDATE tasks SET last_done=?, next_due=?, snoozes=0, prev_specific_date=NULL, prev_next_due=NULL WHERE id=?',
  ).run(today, next_due, id);
  res.json({ ...db.prepare('SELECT * FROM tasks WHERE id = ?').get(id), streak });
});

// Odložit úkol o N dní nebo na konkrétní datum.
// Body: { days?: number, until?: 'YYYY-MM-DD' } — jeden z těchto musí přijít.
// Aplikace: posun next_due a (pokud existuje) specific_date. Last_done se nemění.
// TASK-3: před UPDATE uložíme původní specific_date/next_due do prev_* (záloha pro
// 1-step undo) a inkrementujeme snoozes počítadlo. Frontend ukáže badge "odloženo ×N"
// + tlačítko "Vrátit odložení". Undo viz POST /api/tasks/:id/unsnooze.
// Vrací aktualizovaný task.
app.post('/api/tasks/:id/snooze', (req, res) => {
  const id = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen' });

  const { days, until } = req.body || {};
  let newDate;
  if (until && /^\d{4}-\d{2}-\d{2}$/.test(until)) {
    newDate = until;
  } else if (Number.isInteger(days) && days > 0 && days <= 365) {
    const base = task.next_due || task.specific_date || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    if (isNaN(d)) return res.status(400).json({ error: 'Nelze odložit úkol bez termínu' });
    d.setDate(d.getDate() + days);
    newDate = d.toISOString().slice(0, 10);
  } else {
    return res.status(400).json({ error: 'Zadej days (1–365) nebo until (YYYY-MM-DD)' });
  }

  const newSnoozes = (task.snoozes || 0) + 1;
  if (task.specific_date) {
    db.prepare(
      'UPDATE tasks SET specific_date=?, next_due=?, snoozes=?, prev_specific_date=?, prev_next_due=? WHERE id=?',
    ).run(newDate, newDate, newSnoozes, task.specific_date, task.next_due, id);
  } else {
    db.prepare(
      'UPDATE tasks SET next_due=?, snoozes=?, prev_specific_date=?, prev_next_due=? WHERE id=?',
    ).run(newDate, newSnoozes, task.specific_date, task.next_due, id);
  }
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

// TASK-3: Vrátit poslední odložení (1-step undo). Vrátí specific_date/next_due
// na zálohu v prev_* sloupcích, vyčistí je a dekrementuje snoozes počítadlo.
// 400 pokud nikdy nesnoozeno (prev_* obojí null). Sloupec snoozes je decremenován
// jen pro tento úkol — historie přechozích snoozů (×3 → undo → ×2) zachována.
app.post('/api/tasks/:id/unsnooze', (req, res) => {
  const id = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen' });
  // 1-step undo: bez prev_* nelze vrátit (nemáme co restorovat). Frontend
  // skrývá tlačítko podle stejné podmínky.
  if (task.prev_specific_date == null && task.prev_next_due == null) {
    return res.status(400).json({ error: 'Není co vrátit — úkol nebyl odložen' });
  }
  const nextSnoozes = Math.max(0, (task.snoozes || 0) - 1);
  db.prepare(
    'UPDATE tasks SET specific_date=?, next_due=?, snoozes=?, prev_specific_date=NULL, prev_next_due=NULL WHERE id=?',
  ).run(task.prev_specific_date, task.prev_next_due, nextSnoozes, id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

// ======================= HISTORY =======================
app.get('/api/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT h.*, p.name AS pin_name, p.plant_name, g.id AS garden_id, g.name AS garden_name,
        mem.name AS member_name, mem.color AS member_color
       FROM care_history h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       LEFT JOIN garden_members mem ON mem.id = h.member_id
       ORDER BY h.done_at DESC
       LIMIT 200`,
    )
    .all();
  res.json(rows);
});

// Agregovaná historie pro adaptivní termíny (CareHistoryHint): per (pin, akce) den v roce
// z minulých splnění. Lehká verze — vrací jen pin_id/akce/rok/doy (žádné notes/joiny),
// ať klient nestahuje celou care_history. done_at je UTC text; strftime '%j' = den v roce
// (001–366), '%Y' = rok. Víc splnění téže akce v jednom roce zprůměrujeme (zaokrouhleno).
app.get('/api/care-history/doy', (req, res) => {
  const rows = db
    .prepare(
      `SELECT pin_id, action,
        CAST(strftime('%Y', done_at) AS INTEGER) AS year,
        CAST(ROUND(AVG(CAST(strftime('%j', done_at) AS INTEGER))) AS INTEGER) AS doy
       FROM care_history
       WHERE done_at IS NOT NULL AND action IS NOT NULL AND action != ''
       GROUP BY pin_id, action, year
       ORDER BY pin_id, action, year DESC`,
    )
    .all();
  // Vnoříme do [{ pin_id, action, years: [{ year, doy }] }] pro O(1) lookup na klientu.
  const map = new Map();
  for (const r of rows) {
    if (r.pin_id == null || !r.action || r.year == null || r.doy == null) continue;
    const key = `${r.pin_id} ${r.action}`;
    if (!map.has(key)) map.set(key, { pin_id: r.pin_id, action: r.action, years: [] });
    map.get(key).years.push({ year: r.year, doy: r.doy });
  }
  res.json(Array.from(map.values()));
});

app.post('/api/history', (req, res) => {
  const { pin_id, action, notes } = req.body;
  const info = db
    .prepare('INSERT INTO care_history (pin_id, action, notes) VALUES (?, ?, ?)')
    .run(pin_id, action, notes || null);
  res.json(db.prepare('SELECT * FROM care_history WHERE id = ?').get(info.lastInsertRowid));
});

// ======================= HARVESTS =======================
const VALID_HARVEST_UNITS = ['kg', 'g', 'ks', 'l', 'svazek'];

// Všechny sklizně napříč zahradami (pro stats / overview)
app.get('/api/harvests', (req, res) => {
  const rows = db
    .prepare(
      `SELECT h.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name
       FROM harvests h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       ORDER BY h.date DESC, h.id DESC
       LIMIT 500`,
    )
    .all();
  res.json(rows);
});

// Sklizně pro konkrétní pin
app.get('/api/pins/:id/harvests', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM harvests WHERE pin_id = ? ORDER BY date DESC, id DESC')
    .all(req.params.id);
  res.json(rows);
});

app.post('/api/harvests', (req, res) => {
  const { pin_id, date, amount, unit, note } = req.body;
  if (!pin_id) return res.status(400).json({ error: 'pin_id je povinný' });
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(pin_id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount musí být kladné číslo' });
  }
  const u = VALID_HARVEST_UNITS.includes(unit) ? unit : 'kg';
  const d = (date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const info = db
    .prepare('INSERT INTO harvests (pin_id, date, amount, unit, note) VALUES (?, ?, ?, ?, ?)')
    .run(pin_id, d, amt, u, note || null);
  res.json(db.prepare('SELECT * FROM harvests WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/harvests/:id', (req, res) => {
  db.prepare('DELETE FROM harvests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Statistiky sklizně za rok — celkem podle jednotky + top rostliny + trend rok-od-roku
app.get('/api/stats/harvests', (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevStart = `${year - 1}-01-01`;
  const prevEnd = `${year - 1}-12-31`;

  // Součet podle jednotky pro daný rok
  const totalsByUnit = db
    .prepare(
      `SELECT unit, ROUND(SUM(amount), 2) AS total, COUNT(*) AS entries
       FROM harvests
       WHERE date >= ? AND date <= ?
       GROUP BY unit`,
    )
    .all(yearStart, yearEnd);

  const totalsByUnitPrev = db
    .prepare(
      `SELECT unit, ROUND(SUM(amount), 2) AS total
       FROM harvests
       WHERE date >= ? AND date <= ?
       GROUP BY unit`,
    )
    .all(prevStart, prevEnd);

  // Top rostliny (po jednotce) — která rostlina vynesla nejvíc
  const topPlants = db
    .prepare(
      `SELECT p.id AS pin_id, p.name AS pin_name, p.plant_name, g.name AS garden_name,
              h.unit, ROUND(SUM(h.amount), 2) AS total
       FROM harvests h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE h.date >= ? AND h.date <= ?
       GROUP BY p.id, h.unit
       ORDER BY total DESC
       LIMIT 5`,
    )
    .all(yearStart, yearEnd);

  // Celkový počet záznamů
  const entries = db
    .prepare('SELECT COUNT(*) AS c FROM harvests WHERE date >= ? AND date <= ?')
    .get(yearStart, yearEnd).c;

  res.json({
    year,
    entries,
    totalsByUnit,
    totalsByUnitPrev,
    topPlants,
  });
});

// FEAT-4: Forecast pro konkrétní pin — porovnání letošní YTD vs loňská YTD pro DRUH rostliny
// (agreguje přes všechny piny stejné `plant_name`, ne jen tento jeden, aby data dávala smysl
// i když si uživatel rostlinu loni vedl pod jiným pinem). Vrací totals per unit + měsíční
// rozpad letošek/loňsko pro dominantní jednotku (bar chart). Pokud rostlina nesklízí → empty.
app.get('/api/pins/:id/harvest-forecast', (req, res) => {
  const pin = db.prepare('SELECT id, plant_name FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  if (!pin.plant_name) {
    return res.json({ plant_name: null, hasData: false });
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const year = today.getFullYear();
  const mmdd = todayIso.slice(5); // "MM-DD"
  const thisYearStart = `${year}-01-01`;
  const thisYearTodayEnd = todayIso; // YTD letošek
  const lastYearStart = `${year - 1}-01-01`;
  const lastYearSameDay = `${year - 1}-${mmdd}`; // YTD loňsko — stejný kalendářní den
  const lastYearFullEnd = `${year - 1}-12-31`; // loňský celý rok (pro kontext)

  // YTD totals per unit — JOIN přes pins na stejný plant_name (case-sensitive — DB stringy
  // typicky pocházejí z plantDatabase, takže shoda by měla sedět; pokud by ne, je to risk
  // pro budoucí normalizaci).
  const sumYtd = (start, end) =>
    db
      .prepare(
        `SELECT h.unit, ROUND(SUM(h.amount), 3) AS total, COUNT(*) AS entries
         FROM harvests h
         JOIN pins p ON p.id = h.pin_id
         WHERE p.plant_name = ? AND h.date >= ? AND h.date <= ?
         GROUP BY h.unit
         ORDER BY total DESC`,
      )
      .all(pin.plant_name, start, end);

  const thisYearTotals = sumYtd(thisYearStart, thisYearTodayEnd);
  const lastYearTotals = sumYtd(lastYearStart, lastYearSameDay);
  const lastYearFullTotals = sumYtd(lastYearStart, lastYearFullEnd);

  // Dominantní jednotka = ta s nejvyšším součtem v letošku, jinak v loňsku, jinak 'kg'.
  const allUnits = [...thisYearTotals, ...lastYearTotals];
  const unitOrder = ['kg', 'g', 'ks', 'l', 'svazek'];
  let dominantUnit = null;
  if (thisYearTotals[0]) dominantUnit = thisYearTotals[0].unit;
  else if (lastYearTotals[0]) dominantUnit = lastYearTotals[0].unit;
  else if (allUnits[0]) dominantUnit = allUnits[0].unit;
  else dominantUnit = 'kg';

  // Měsíční rozpad pro dominantní jednotku — 12 hodnot per rok (Jan-Dec).
  const monthlyForYear = (yearN) => {
    const rows = db
      .prepare(
        `SELECT CAST(substr(h.date, 6, 2) AS INTEGER) AS m, ROUND(SUM(h.amount), 3) AS total
         FROM harvests h
         JOIN pins p ON p.id = h.pin_id
         WHERE p.plant_name = ? AND h.unit = ?
           AND h.date >= ? AND h.date <= ?
         GROUP BY m
         ORDER BY m`,
      )
      .all(pin.plant_name, dominantUnit, `${yearN}-01-01`, `${yearN}-12-31`);
    const arr = Array.from({ length: 12 }, () => 0);
    for (const r of rows) {
      if (r.m >= 1 && r.m <= 12) arr[r.m - 1] = Number(r.total) || 0;
    }
    return arr;
  };

  const monthlyThis = monthlyForYear(year);
  const monthlyLast = monthlyForYear(year - 1);

  const thisYearDominant =
    thisYearTotals.find((r) => r.unit === dominantUnit)?.total || 0;
  const lastYearDominant =
    lastYearTotals.find((r) => r.unit === dominantUnit)?.total || 0;
  const lastYearFullDominant =
    lastYearFullTotals.find((r) => r.unit === dominantUnit)?.total || 0;

  // % změna letošek vs loňsko YTD — null pokud loni 0 (dělit nulou nemůžeme).
  let deltaPct = null;
  if (lastYearDominant > 0) {
    deltaPct = Math.round(((thisYearDominant - lastYearDominant) / lastYearDominant) * 100);
  }

  const hasData =
    thisYearTotals.length > 0 || lastYearTotals.length > 0 || lastYearFullDominant > 0;

  res.json({
    plant_name: pin.plant_name,
    today: todayIso,
    year,
    hasData,
    dominantUnit,
    thisYear: {
      totals: thisYearTotals,
      dominantTotal: thisYearDominant,
      monthly: monthlyThis,
    },
    lastYear: {
      totals: lastYearTotals,
      dominantTotal: lastYearDominant,
      dominantFullYearTotal: lastYearFullDominant,
      monthly: monthlyLast,
    },
    deltaPct,
  });
});

// ======================= PIN ISSUES (FEAT-3: choroby/škůdci na pinu) =======================
// Záznam reálného výskytu (uživatel vidí varování z pestDatabase a zaloguje že to opravdu
// nastalo). Aktivní vs. vyřešené (treated_at). Side effect: každá akce (detekce, vyřešení,
// smazání) se zapisuje do care_history → splývá s ostatní péčí v historii pinu.
const VALID_ISSUE_SEVERITIES = ['mild', 'moderate', 'severe'];
const VALID_ISSUE_KINDS = ['disease', 'pest'];

function normalizeSeverity(sev) {
  return VALID_ISSUE_SEVERITIES.includes(sev) ? sev : 'moderate';
}
function normalizeIssueKind(k) {
  return VALID_ISSUE_KINDS.includes(k) ? k : null;
}
function isoDate(input) {
  if (!input) return null;
  const s = String(input).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

app.get('/api/pins/:id/issues', (req, res) => {
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  // Aktivní (treated_at IS NULL) první, pak vyřešené sestupně podle data vyřešení.
  const rows = db
    .prepare(
      `SELECT * FROM pin_issues
       WHERE pin_id = ?
       ORDER BY (treated_at IS NULL) DESC, detected_at DESC, id DESC`,
    )
    .all(req.params.id);
  res.json(rows);
});

app.post('/api/pins/:id/issues', (req, res) => {
  const pin = db.prepare('SELECT id FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  const { issue_id, issue_name, kind, severity, detected_at, treatment_notes } = req.body || {};
  const name = (issue_name || '').trim();
  if (!name) return res.status(400).json({ error: 'issue_name je povinný' });
  const sev = normalizeSeverity(severity);
  const k = normalizeIssueKind(kind);
  const date = isoDate(detected_at) || new Date().toISOString().slice(0, 10);
  const info = db
    .prepare(
      `INSERT INTO pin_issues (pin_id, issue_id, issue_name, kind, severity, detected_at, treatment_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(req.params.id, issue_id || null, name, k, sev, date, treatment_notes || null);
  // Audit do care_history — „Detekováno: X (závažnost)" — viditelné v Historii péče i ve statistikách.
  try {
    const sevLabel = sev === 'severe' ? 'silné' : sev === 'mild' ? 'lehké' : 'střední';
    db.prepare('INSERT INTO care_history (pin_id, action, notes) VALUES (?, ?, ?)').run(
      req.params.id,
      `Detekováno: ${name}`,
      `Závažnost: ${sevLabel}${treatment_notes ? ` · ${treatment_notes}` : ''}`,
    );
  } catch {}
  res.json(db.prepare('SELECT * FROM pin_issues WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/pin-issues/:issueId', (req, res) => {
  const id = req.params.issueId;
  const existing = db.prepare('SELECT * FROM pin_issues WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Problém nenalezen' });
  const body = req.body || {};
  const fields = [];
  const args = [];
  if (body.severity !== undefined) { fields.push('severity = ?'); args.push(normalizeSeverity(body.severity)); }
  if (body.treatment_notes !== undefined) { fields.push('treatment_notes = ?'); args.push(body.treatment_notes || null); }
  if (body.detected_at !== undefined) {
    const d = isoDate(body.detected_at);
    if (d) { fields.push('detected_at = ?'); args.push(d); }
  }
  if (body.issue_name !== undefined) {
    const name = (body.issue_name || '').trim();
    if (name) { fields.push('issue_name = ?'); args.push(name); }
  }
  // mark_resolved: true → treated_at = dnes; false → vrátit zpět na active (NULL)
  let resolvedChanged = null;
  if (body.mark_resolved === true || body.treated_at) {
    const d = isoDate(body.treated_at) || new Date().toISOString().slice(0, 10);
    fields.push('treated_at = ?'); args.push(d);
    if (!existing.treated_at) resolvedChanged = 'resolved';
  } else if (body.mark_resolved === false) {
    fields.push('treated_at = NULL');
    if (existing.treated_at) resolvedChanged = 'reopened';
  }
  if (fields.length === 0) return res.json(existing);
  args.push(id);
  db.prepare(`UPDATE pin_issues SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  const updated = db.prepare('SELECT * FROM pin_issues WHERE id = ?').get(id);
  // Audit přechodu do vyřešeného stavu (resolved = pozitivní akce, stojí za záznam v historii).
  if (resolvedChanged === 'resolved') {
    try {
      db.prepare('INSERT INTO care_history (pin_id, action, notes) VALUES (?, ?, ?)').run(
        existing.pin_id,
        `Vyřešeno: ${updated.issue_name}`,
        updated.treatment_notes || null,
      );
    } catch {}
  }
  res.json(updated);
});

app.delete('/api/pin-issues/:issueId', (req, res) => {
  const existing = db.prepare('SELECT * FROM pin_issues WHERE id = ?').get(req.params.issueId);
  if (!existing) return res.status(404).json({ error: 'Problém nenalezen' });
  db.prepare('DELETE FROM pin_issues WHERE id = ?').run(req.params.issueId);
  res.json({ ok: true });
});

// ======================= STATS =======================
app.get('/api/stats', (req, res) => {
  const gardens = db.prepare('SELECT COUNT(*) AS c FROM gardens').get().c;
  const pins = db.prepare('SELECT COUNT(*) AS c FROM pins').get().c;
  const tasks = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE next_due < ?').get(today).c;
  const dueToday = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE next_due = ?').get(today).c;
  const historyCount = db.prepare('SELECT COUNT(*) AS c FROM care_history').get().c;
  // care_history.done_at is stored as UTC text via SQLite CURRENT_TIMESTAMP
  const weeklyDone = db
    .prepare("SELECT COUNT(*) AS c FROM care_history WHERE done_at >= datetime('now', '-7 days')")
    .get().c;
  res.json({ gardens, pins, tasks, overdue, dueToday, historyCount, weeklyDone });
});

// Sezónní statistiky — splněné úkony tento měsíc/rok, graf po měsících, top zahrada, top rostlina
app.get('/api/stats/season', (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';

  // Splněné úkony tento měsíc a rok (sloupec done_at je UTC text)
  const doneThisMonth = db
    .prepare(
      "SELECT COUNT(*) AS c FROM care_history WHERE done_at >= ?",
    )
    .get(monthStart).c;
  const doneThisYear = db
    .prepare(
      'SELECT COUNT(*) AS c FROM care_history WHERE done_at >= ? AND done_at < ?',
    )
    .get(yearStart, yearEnd).c;

  // Graf po měsících — vrátí pole 12 čísel pro daný rok
  const monthlyRows = db
    .prepare(
      `SELECT CAST(strftime('%m', done_at) AS INTEGER) AS m, COUNT(*) AS c
       FROM care_history
       WHERE done_at >= ? AND done_at < ?
       GROUP BY m`,
    )
    .all(yearStart, yearEnd);
  const monthlyDone = Array.from({ length: 12 }, (_, i) => {
    const row = monthlyRows.find((r) => r.m === i + 1);
    return row ? row.c : 0;
  });

  // Nejaktivnější zahrada (nejvíc splněných úkonů v daném roce)
  const topGarden = db
    .prepare(
      `SELECT g.id, g.name, COUNT(*) AS done_count
       FROM care_history h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE h.done_at >= ? AND h.done_at < ?
       GROUP BY g.id
       ORDER BY done_count DESC
       LIMIT 1`,
    )
    .get(yearStart, yearEnd);

  // Nejpečovanější rostlina
  const topPlant = db
    .prepare(
      `SELECT p.id AS pin_id, p.name AS pin_name, p.plant_name, g.name AS garden_name, COUNT(*) AS done_count
       FROM care_history h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE h.done_at >= ? AND h.done_at < ?
       GROUP BY p.id
       ORDER BY done_count DESC
       LIMIT 1`,
    )
    .get(yearStart, yearEnd);

  res.json({
    year,
    doneThisMonth,
    doneThisYear,
    monthlyDone,
    topGarden: topGarden || null,
    topPlant: topPlant || null,
  });
});

// ======================= MEZIROČNÍ SROVNÁNÍ =======================
// Porovnání splněných úkonů letos vs. minulý rok, volitelně pro konkrétní zahradu.
// Vrací: měsíční pole pro oba roky, celkové součty, % změnu, a seznam loňských
// úkonů které letos zatím nebyly splněné (do dnešního dne).
app.get('/api/stats/yoy', (req, res) => {
  const now = new Date();
  const thisYear = parseInt(req.query.year, 10) || now.getFullYear();
  const lastYear = thisYear - 1;
  const gardenId = req.query.garden_id ? parseInt(req.query.garden_id, 10) : null;

  const thisStart = `${thisYear}-01-01`;
  const thisEnd = `${thisYear + 1}-01-01`;
  const lastStart = `${lastYear}-01-01`;
  const lastEnd = `${thisYear}-01-01`;
  const today = now.toISOString().slice(0, 10);
  // "Stejné období loni" — od začátku roku do MM-DD loni
  const lastYearToDate = `${lastYear}-${today.slice(5)}`;

  // Pro filtr přes zahradu spojíme přes pins.garden_id
  const gardenJoin = gardenId
    ? 'JOIN pins p ON p.id = h.pin_id WHERE h.done_at >= ? AND h.done_at < ? AND p.garden_id = ?'
    : 'WHERE h.done_at >= ? AND h.done_at < ?';

  const gardenJoinDate = gardenId
    ? 'JOIN pins p ON p.id = h.pin_id WHERE h.done_at >= ? AND h.done_at <= ? AND p.garden_id = ?'
    : 'WHERE h.done_at >= ? AND h.done_at <= ?';

  function monthlyFor(yStart, yEnd) {
    const params = gardenId ? [yStart, yEnd, gardenId] : [yStart, yEnd];
    const rows = db
      .prepare(
        `SELECT CAST(strftime('%m', done_at) AS INTEGER) AS m, COUNT(*) AS c
         FROM care_history h
         ${gardenJoin}
         GROUP BY m`,
      )
      .all(...params);
    return Array.from({ length: 12 }, (_, i) => {
      const row = rows.find((r) => r.m === i + 1);
      return row ? row.c : 0;
    });
  }

  function totalFor(yStart, yEnd) {
    const params = gardenId ? [yStart, yEnd, gardenId] : [yStart, yEnd];
    return db
      .prepare(
        `SELECT COUNT(*) AS c FROM care_history h ${gardenJoin}`,
      )
      .get(...params).c;
  }

  // "Do stejného data" — kolik bylo splněno od 1.1. do dnešního MM-DD v daném roce
  function totalToDate(yStart, yEndInclusive) {
    const params = gardenId ? [yStart, yEndInclusive, gardenId] : [yStart, yEndInclusive];
    return db
      .prepare(
        `SELECT COUNT(*) AS c FROM care_history h ${gardenJoinDate}`,
      )
      .get(...params).c;
  }

  const thisMonthly = monthlyFor(thisStart, thisEnd);
  const lastMonthly = monthlyFor(lastStart, lastEnd);
  const thisTotal = totalFor(thisStart, thisEnd);
  const lastTotal = totalFor(lastStart, lastEnd);

  const thisToDate = totalToDate(thisStart, today);
  const lastToDateSame = totalToDate(lastStart, lastYearToDate);

  // Procentuální změna — letos vs. loni do stejného data (férové srovnání)
  let percentChange = null;
  if (lastToDateSame > 0) {
    percentChange = Math.round(((thisToDate - lastToDateSame) / lastToDateSame) * 100);
  } else if (thisToDate > 0) {
    percentChange = 100; // loni nic, letos něco — "+100%" nový start
  }

  // Co loni do dnešního dne bylo splněno a letos zatím chybí
  // Porovnáváme po (pin_id + action) — stejná rostlina, stejný typ úkonu
  const missingParams = gardenId
    ? [lastStart, lastYearToDate, gardenId, thisStart, today, gardenId]
    : [lastStart, lastYearToDate, thisStart, today];
  const missing = db
    .prepare(
      `SELECT h.pin_id, h.action, MAX(h.done_at) AS last_done_at,
              p.name AS pin_name, p.plant_name, g.name AS garden_name, g.id AS garden_id
       FROM care_history h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE h.done_at >= ? AND h.done_at <= ?
         ${gardenId ? 'AND p.garden_id = ?' : ''}
         AND NOT EXISTS (
           SELECT 1 FROM care_history h2
           JOIN pins p2 ON p2.id = h2.pin_id
           WHERE h2.pin_id = h.pin_id
             AND h2.action = h.action
             AND h2.done_at >= ? AND h2.done_at <= ?
             ${gardenId ? 'AND p2.garden_id = ?' : ''}
         )
       GROUP BY h.pin_id, h.action
       ORDER BY last_done_at DESC
       LIMIT 8`,
    )
    .all(...missingParams);

  res.json({
    thisYear,
    lastYear,
    gardenId,
    thisTotal,
    lastTotal,
    thisMonthly,
    lastMonthly,
    thisToDate,
    lastToDateSame,
    percentChange,
    missing,
  });
});

// ======================= UPSCALE =======================
app.post('/api/gardens/:id/upscale', async (req, res) => {
  if (!sharp) return res.status(501).json({ error: 'Sharp není nainstalován. Spusť: npm install sharp' });
  const id = req.params.id;
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!garden || !garden.image_path) return res.status(404).json({ error: 'Zahrada nebo obrázek nenalezen' });

  const srcPath = path.join(__dirname, garden.image_path);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Soubor nenalezen' });

  try {
    const meta = await sharp(srcPath).metadata();
    const newW = meta.width * 4;
    const newH = meta.height * 4;
    const ext = path.extname(srcPath) || '.jpg';
    const newFilename = Date.now() + '-upscaled' + ext;
    const destPath = path.join(__dirname, 'uploads', newFilename);

    await sharp(srcPath)
      .resize(newW, newH, { kernel: sharp.kernel.cubic })
      .toFile(destPath);

    // Smazat starý soubor, uložit nový
    fs.unlinkSync(srcPath);
    const newImagePath = '/uploads/' + newFilename;
    db.prepare('UPDATE gardens SET image_path=?, image_width=?, image_height=? WHERE id=?').run(
      newImagePath, newW, newH, id,
    );
    res.json(db.prepare('SELECT * FROM gardens WHERE id = ?').get(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ======================= CROP TO POLYGON =======================
// Vstup: body { points: [{x, y}, ...] } v procentech (0–100) vůči rozměrům obrázku.
// Server vytvoří SVG masku, aplikuje ji přes sharp composite (dest-in) a uloží oříznutý obrázek.
// Body polygonu se ukládají do gardens.garden_polygon jako JSON pro validaci pinů.
app.post('/api/gardens/:id/crop-polygon', async (req, res) => {
  if (!sharp) return res.status(501).json({ error: 'Sharp není nainstalován. Spusť: npm install sharp' });
  const id = req.params.id;
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!garden || !garden.image_path) return res.status(404).json({ error: 'Zahrada nebo obrázek nenalezen' });

  const points = Array.isArray(req.body?.points) ? req.body.points : null;
  if (!points || points.length < 3) {
    return res.status(400).json({ error: 'Polygon musí mít alespoň 3 body' });
  }
  for (const p of points) {
    if (typeof p?.x !== 'number' || typeof p?.y !== 'number'
        || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) {
      return res.status(400).json({ error: 'Souřadnice musí být čísla 0–100 (procenta)' });
    }
  }

  const srcPath = path.join(__dirname, garden.image_path);
  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Soubor nenalezen' });

  try {
    const meta = await sharp(srcPath).metadata();
    const W = meta.width;
    const H = meta.height;

    // Pixelové souřadnice polygonu pro masku
    const px = points.map((p) => ({ x: (p.x / 100) * W, y: (p.y / 100) * H }));
    const polyPath = px.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';

    // SVG maska: bílá = zachovat, černá = odříznout. PNG s alfa kanálem.
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="100%" height="100%" fill="black"/>
      <path d="${polyPath}" fill="white"/>
    </svg>`;

    // Vyrobíme alfa-masku jako PNG (jeden kanál) a aplikujeme přes dest-in.
    const maskPng = await sharp(Buffer.from(maskSvg)).png().toBuffer();

    const ext = '.png'; // dest-in vrací s průhledností → uložíme jako PNG
    const newFilename = Date.now() + '-cropped' + ext;
    const destPath = path.join(__dirname, 'uploads', newFilename);

    await sharp(srcPath)
      .ensureAlpha()
      .composite([{ input: maskPng, blend: 'dest-in' }])
      .png()
      .toFile(destPath);

    // UX2-2: aktualizuj rozměry z oříznutého PNG (jinak v DB zůstane starý
    // aspect ratio a `<div class="map-container">` ho použije pro `aspectRatio`,
    // takže piny v % sednou na špatné místo).
    let newW = W;
    let newH = H;
    try {
      const newMeta = await sharp(destPath).metadata();
      if (newMeta.width && newMeta.height) {
        newW = newMeta.width;
        newH = newMeta.height;
      }
    } catch {}

    // UX2-2: zachovej originál pro "Vrátit ořez". Při prvním ořezu přesuneme
    // srcPath do `original_image_path` (nemažeme). Při re-cropu necháme původní
    // originál (ten první) a smažeme aktuální mezisoubor.
    const newImagePath = '/uploads/' + newFilename;
    const polygonJson = JSON.stringify(points);
    if (garden.original_image_path) {
      // Re-crop — originál už máme, srcPath byl předchozí ořez → smaž.
      try { fs.unlinkSync(srcPath); } catch {}
      db.prepare('UPDATE gardens SET image_path=?, image_width=?, image_height=?, garden_polygon=? WHERE id=?').run(
        newImagePath, newW, newH, polygonJson, id,
      );
    } else {
      // První ořez — srcPath je originál, nemažeme, jen ho uložíme jako original_image_path.
      db.prepare('UPDATE gardens SET image_path=?, image_width=?, image_height=?, original_image_path=?, garden_polygon=? WHERE id=?').run(
        newImagePath, newW, newH, garden.image_path, polygonJson, id,
      );
    }
    res.json(db.prepare('SELECT * FROM gardens WHERE id = ?').get(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// UX2-2: vrátit ořez — obnovit originál uložený v `original_image_path`.
// Smaže aktuální (oříznutou) verzi, přepne `image_path` na original, nuluje
// `garden_polygon` (uživatel musí znovu označit, pokud chce), aktualizuje rozměry.
app.post('/api/gardens/:id/revert-crop', async (req, res) => {
  const id = req.params.id;
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!garden) return res.status(404).json({ error: 'Zahrada nenalezena' });
  if (!garden.original_image_path) {
    return res.status(400).json({ error: 'Tato zahrada nemá uložený originál — ořez nelze vrátit.' });
  }

  const originalAbs = path.join(__dirname, garden.original_image_path);
  if (!fs.existsSync(originalAbs)) {
    // Originál byl smazán z disku — vyčisti referenci a vrať chybu.
    db.prepare('UPDATE gardens SET original_image_path=NULL WHERE id=?').run(id);
    return res.status(410).json({ error: 'Originál již není dostupný.' });
  }

  // Smaž aktuální oříznutý soubor (jen pokud se liší od originálu).
  if (garden.image_path && garden.image_path !== garden.original_image_path) {
    const curAbs = path.join(__dirname, garden.image_path);
    if (fs.existsSync(curAbs)) {
      try { fs.unlinkSync(curAbs); } catch {}
    }
  }

  // Načti rozměry originálu, ať `aspectRatio` zase sedí.
  let w = garden.image_width;
  let h = garden.image_height;
  if (sharp) {
    try {
      const meta = await sharp(originalAbs).metadata();
      if (meta.width && meta.height) { w = meta.width; h = meta.height; }
    } catch {}
  }

  db.prepare('UPDATE gardens SET image_path=?, image_width=?, image_height=?, garden_polygon=NULL, original_image_path=NULL WHERE id=?').run(
    garden.original_image_path, w, h, id,
  );
  res.json(db.prepare('SELECT * FROM gardens WHERE id = ?').get(id));
});

// ======================= WEB PUSH =======================
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!push) return res.status(503).json({ error: 'Push není dostupný' });
  res.json({ publicKey: push.getPublicKey() });
});

app.post('/api/push/subscribe', (req, res) => {
  if (!push) return res.status(503).json({ error: 'Push není dostupný' });
  try {
    push.saveSubscription(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/push/unsubscribe', (req, res) => {
  if (!push) return res.status(503).json({ error: 'Push není dostupný' });
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'endpoint je povinný' });
  push.deleteSubscription(endpoint);
  res.json({ ok: true });
});

// Nativní push — uloží APNs/FCM device token z Capacitor klienta.
app.post('/api/push/native-register', (req, res) => {
  if (!push) return res.status(503).json({ error: 'Push není dostupný' });
  const token = req.body?.token;
  const platform = req.body?.platform;
  if (!token) return res.status(400).json({ error: 'token je povinný' });
  try {
    push.saveNativeToken(token, platform);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Posílá push všem odběratelům. Bez body posílá denní souhrn (stejný jako cron).
app.post('/api/push/send', async (req, res) => {
  if (!push) return res.status(503).json({ error: 'Push není dostupný' });
  try {
    const payload =
      req.body && req.body.title
        ? { title: req.body.title, body: req.body.body || '', url: req.body.url || '/' }
        : push.buildDailyDigest();
    if (!payload) return res.json({ skipped: true, reason: 'Žádné úkoly na dnes/zítra' });
    const stats = await push.sendToAll(payload);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ======================= EMAIL PŘIPOMÍNKY =======================
// Jednoduchý in-memory regex pro validaci. Striktní RFC validátor by byl overkill.
function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

app.get('/api/email-settings', (req, res) => {
  const row = db.prepare('SELECT email, enabled FROM email_settings WHERE user_id = ?').get(1);
  res.json({
    email: row?.email || '',
    enabled: !!row?.enabled,
    configured: email ? email.isConfigured() : false,
  });
});

app.post('/api/email-settings', (req, res) => {
  const { email: addr, enabled } = req.body || {};
  const cleanEmail = addr ? String(addr).trim().slice(0, 200) : null;
  const cleanEnabled = enabled ? 1 : 0;
  if (cleanEnabled && !cleanEmail) {
    return res.status(400).json({ error: 'Pro zapnutí připomínek je potřeba zadat email' });
  }
  if (cleanEmail && !isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Neplatný formát emailu' });
  }
  db.prepare(
    `INSERT INTO email_settings (user_id, email, enabled, updated_at) VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, enabled=excluded.enabled, updated_at=datetime('now')`,
  ).run(cleanEmail, cleanEnabled);
  const row = db.prepare('SELECT email, enabled FROM email_settings WHERE user_id = ?').get(1);
  res.json({ email: row?.email || '', enabled: !!row?.enabled });
});

app.post('/api/email-settings/test', async (req, res) => {
  if (!email) return res.status(503).json({ error: 'Email modul není dostupný' });
  if (!email.isConfigured()) {
    return res.status(503).json({ error: 'Email server není nakonfigurovaný — chybí GMAIL_FROM nebo GMAIL_APP_PASSWORD v .env' });
  }
  const addr = (req.body?.email || '').trim()
    || db.prepare('SELECT email FROM email_settings WHERE user_id = 1').get()?.email;
  if (!addr) return res.status(400).json({ error: 'Není zadán email' });
  if (!isValidEmail(addr)) return res.status(400).json({ error: 'Neplatný formát emailu' });
  try {
    await email.sendTestEmail(addr);
    res.json({ ok: true, sent_to: addr });
  } catch (e) {
    console.error('[email] test send error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Ruční odeslání týdenního digestu (užitečné pro test / debug)
app.post('/api/email-settings/send-digest', async (req, res) => {
  if (!email) return res.status(503).json({ error: 'Email modul není dostupný' });
  if (!email.isConfigured()) {
    return res.status(503).json({ error: 'Email server není nakonfigurovaný' });
  }
  const addr = (req.body?.email || '').trim()
    || db.prepare('SELECT email FROM email_settings WHERE user_id = 1').get()?.email;
  if (!addr) return res.status(400).json({ error: 'Není zadán email' });
  if (!isValidEmail(addr)) return res.status(400).json({ error: 'Neplatný formát emailu' });
  try {
    const r = await email.sendWeeklyDigest(addr);
    res.json({ ok: true, sent_to: addr, ...r });
  } catch (e) {
    console.error('[email] digest send error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ======================= WEATHER =======================
// Citlivé rostliny — substring match na plant_name (lower-cased, bez diakritiky)
const SENSITIVE_PLANT_KEYWORDS = [
  'rajc', 'paprik', 'okurk', 'bazalk', 'cuket', 'dyn', 'tykv', 'tykev', 'fazol', 'meloun',
];

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function isSensitivePlant(plantName) {
  const n = normalize(plantName);
  return SENSITIVE_PLANT_KEYWORDS.some((k) => n.includes(k));
}

// Proxy na Open-Meteo — backend zajistí CORS a stabilní rozhraní
// Vrací current_weather + denní předpověď (min/max/mean/weathercode).
// Volitelné parametry (zpětně kompatibilní — bez nich = původní 3denní předpověď):
//   forecast_days (1–16, default 3), past_days (0–92) — fenologická vrstva (phenology.js)
//   si bere recent temperature_2m_mean přes past_days, aby spočítala teplotní anomálii.
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat a lon jsou povinné parametry' });
  }
  const pastDays = Math.max(0, Math.min(92, parseInt(req.query.past_days, 10) || 0));
  const forecastDays = Math.max(1, Math.min(16, parseInt(req.query.forecast_days, 10) || 3));
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true` +
    // precipitation_sum + wind_speed_10m_max navíc pro „ideální den v okně" (idealDay.js) —
    // suchý bezvětrný den na řez/postřik. Extra denní pole; frost/WeatherWidget je ignorují.
    `&daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weathercode` +
    `&forecast_days=${forecastDays}` +
    (pastDays > 0 ? `&past_days=${pastDays}` : '') +
    `&timezone=Europe%2FPrague`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Open-Meteo nedostupné' });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Vrací počet citlivých rostlin uživatele — používá WeatherWidget pro mrazové varování
app.get('/api/pins/sensitive', (req, res) => {
  const rows = db.prepare('SELECT id, name, plant_name FROM pins WHERE plant_name IS NOT NULL AND plant_name != ""').all();
  const sensitive = rows.filter((r) => isSensitivePlant(r.plant_name));
  res.json({
    count: sensitive.length,
    plants: sensitive.map((p) => ({ id: p.id, name: p.name, plant_name: p.plant_name })),
  });
});

// ======================= ICAL EXPORT (live calendar subscription) =======================
// Globální token pro all-gardens kalendář — uložen v souboru, přežije restart serveru.
// Per-garden tokeny jsou v gardens.ical_token.
function getDataDir() {
  return process.env.DATABASE_PATH
    ? path.dirname(path.resolve(process.env.DATABASE_PATH))
    : path.join(__dirname, 'data');
}
function getGlobalIcalToken() {
  const f = path.join(getDataDir(), '.ical-global-token');
  try {
    if (fs.existsSync(f)) {
      const t = fs.readFileSync(f, 'utf-8').trim();
      if (t.length >= 12) return t;
    }
  } catch {}
  const token = generateShareToken(20);
  try {
    if (!fs.existsSync(getDataDir())) fs.mkdirSync(getDataDir(), { recursive: true });
    fs.writeFileSync(f, token, { mode: 0o600 });
  } catch (e) {
    console.warn('[ical] could not persist global token:', e.message);
  }
  return token;
}
function getOrCreateGardenIcalToken(gardenId) {
  const g = db.prepare('SELECT ical_token FROM gardens WHERE id = ?').get(gardenId);
  if (!g) return null;
  if (g.ical_token) return g.ical_token;
  // Generate unique token (retry on collision)
  let token;
  for (let i = 0; i < 5; i++) {
    token = generateShareToken(14);
    const exists = db.prepare('SELECT 1 FROM gardens WHERE ical_token = ?').get(token);
    if (!exists) break;
    token = null;
  }
  if (!token) return null;
  db.prepare('UPDATE gardens SET ical_token = ? WHERE id = ?').run(token, gardenId);
  return token;
}

// Filtruj task: úkony, které NEexportujeme do kalendáře (per user spec).
// - zalivka a kontrola jsou zbytečně časté pro kalendář
// - frequency_days < 7 = zaplaví kalendář
function eligibleForIcal(task) {
  if (!task) return false;
  if (task.task_type === 'zalivka' || task.task_type === 'kontrola') return false;
  if (task.frequency_days && task.frequency_days < 7) return false;
  // Musí mít aspoň nějaký datum (next_due nebo specific_date)
  return !!(task.next_due || task.specific_date);
}

// Load plant categories from JSON (generated by frontend build script).
// Slim mapping nameCz → outer category key (vegetables/fruits/…).
let PLANT_CATEGORY_BY_NAME = null;
function loadPlantCategoryMap() {
  if (PLANT_CATEGORY_BY_NAME) return PLANT_CATEGORY_BY_NAME;
  PLANT_CATEGORY_BY_NAME = new Map();
  const f = path.join(__dirname, 'plant-categories.json');
  try {
    if (fs.existsSync(f)) {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      for (const [name, cat] of Object.entries(data)) {
        PLANT_CATEGORY_BY_NAME.set(name.toLowerCase(), cat);
      }
      console.log(`[ical] plant-categories.json loaded (${PLANT_CATEGORY_BY_NAME.size} entries)`);
    } else {
      console.warn('[ical] plant-categories.json not found — categories= filter disabled');
    }
  } catch (e) {
    console.warn('[ical] could not parse plant-categories.json:', e.message);
  }
  return PLANT_CATEGORY_BY_NAME;
}

// Mapování user-facing typů (URL `types=`) na podmínky filtru.
// Zrcadlí frontend/src/data/taskTypes.js (TASK_TYPES.icalCategory + ICAL_CATEGORIES) — drž v souladu.
// Match je dvoufázový: primárně přes kanonický task_type, fallback přes emoji v titulu
// (kvůli starším sezónním úkonům uloženým jako task_type='jine').
const ICAL_TYPE_FILTERS = {
  pruning:     { task_types: ['strihani'], title_emojis: ['✂️'] },
  fertilizing: { task_types: ['hnojeni'], title_emojis: ['🌱'] },
  planting:    { task_types: ['presazeni'], title_emojis: ['🪴'] },
  sowing:      { task_types: ['presazeni'], title_emojis: ['🪴', '🌱'] }, // alias k výsadbě/výsevu
  protection:  { task_types: [], title_emojis: ['🛡️', '🌾'] },
  prevention:  { task_types: ['postrik'], title_emojis: ['🛡️', '🐛'] },   // alias k ochraně + kontrole škůdců (postřik = preventivní fungicid)
  harvest:     { task_types: ['sklizen'], title_emojis: ['🧺'] },
};

function taskMatchesAllowedTypes(task, allowedTypes) {
  if (!allowedTypes || allowedTypes.length === 0) return true;
  const title = task.title || '';
  for (const a of allowedTypes) {
    const f = ICAL_TYPE_FILTERS[a];
    if (!f) continue;
    if (f.task_types.includes(task.task_type)) return true;
    // Sezónní tasky jsou task_type='jine' — rozlišíme přes emoji v titulu
    if (task.task_type === 'jine' && f.title_emojis.some((e) => title.includes(e))) return true;
  }
  return false;
}

function taskMatchesCategories(task, allowedCategories) {
  if (!allowedCategories || allowedCategories.length === 0) return true;
  const plant = (task.plant_name || '').toLowerCase();
  if (!plant) return false;
  const cat = loadPlantCategoryMap().get(plant);
  if (!cat) return false;
  return allowedCategories.includes(cat);
}

function taskMatchesPins(task, allowedPinIds) {
  if (!allowedPinIds || allowedPinIds.length === 0) return true;
  return allowedPinIds.includes(task.pin_id);
}

// Parsuje comma-separated query param → trimmed array nebo null.
function parseCsvParam(value) {
  if (!value) return null;
  const arr = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : null;
}
function parseIntCsvParam(value) {
  const arr = parseCsvParam(value);
  if (!arr) return null;
  return arr.map((s) => parseInt(s, 10)).filter(Number.isFinite);
}

// Helpers pro iCal generaci
function icalFoldLine(line) {
  const out = [];
  while (line.length > 75) {
    out.push(line.slice(0, 75));
    line = ' ' + line.slice(75);
  }
  out.push(line);
  return out.join('\r\n');
}
function icalEscape(s) {
  return (s || '').toString()
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
function icalDate(dateStr) {
  // 'YYYY-MM-DD' → 'YYYYMMDD' (pro DTSTART;VALUE=DATE)
  return (dateStr || '').replace(/-/g, '').slice(0, 8);
}
function icalNowUtc() {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}
function firstOfMonth(dateStr) {
  // Vrať 1. den téhož měsíce ve formátu YYYYMMDD
  return (dateStr || '').slice(0, 7).replace('-', '') + '01';
}
function firstOfNextMonth(dateStr) {
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(5, 7), 10);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}${String(next.m).padStart(2, '0')}01`;
}

const ICAL_TYPE_EMOJI = {
  zalivka: '💧', hnojeni: '🌱', strihani: '✂️', presazeni: '🪴',
  plet: '🌿', sklizen: '🧺', kontrola: '🔍', postrik: '🛡️', jine: '📋',
};

// Vykreslí jeden VEVENT pro task. All-day events, VALARM -P1D.
// Speciální chování:
// - task_type='sklizen' → multi-day spanning celého měsíce
// - recurring + yearly → DTSTART 1. den měsíce + RRULE FREQ=YEARLY
// - frequency_days >= 7 → RRULE FREQ=DAILY;INTERVAL=N
// - jednorázový → all-day na specific_date / next_due
function icalEventLines(task, nowStamp, reminderDays = 1) {
  const date = task.specific_date || task.next_due;
  if (!date) return [];
  const emoji = ICAL_TYPE_EMOJI[task.task_type] || '📋';
  const title = task.title || (task.plant_name || task.pin_name);
  const summary = `${emoji} ${title} — ${task.garden_name}`;
  const descParts = [];
  if (task.notes) descParts.push(icalEscape(task.notes));
  descParts.push(`Zahrada: ${icalEscape(task.garden_name)}.`);
  if (task.pin_name) descParts.push(`Místo: ${icalEscape(task.pin_name)}.`);
  if (task.plant_name && task.plant_name !== task.pin_name) {
    descParts.push(`Rostlina: ${icalEscape(task.plant_name)}.`);
  }
  const desc = descParts.join(' ');

  const isHarvest = task.task_type === 'sklizen';
  const isYearly = task.recurring && task.recurrence_pattern === 'yearly';
  const isFrequency = task.frequency_days && task.frequency_days >= 7;

  let dtstart;
  let dtend;
  let rrule;

  if (isHarvest) {
    dtstart = firstOfMonth(date);
    dtend = firstOfNextMonth(date);
    if (isYearly) rrule = 'FREQ=YEARLY';
  } else if (isYearly) {
    // Sezónní (jako z plantDatabase) — normalizovat na 1. den měsíce
    dtstart = firstOfMonth(date);
    rrule = 'FREQ=YEARLY';
  } else if (isFrequency) {
    dtstart = icalDate(date);
    rrule = `FREQ=DAILY;INTERVAL=${task.frequency_days}`;
  } else {
    dtstart = icalDate(date);
  }

  const lines = ['BEGIN:VEVENT'];
  lines.push(icalFoldLine(`UID:gardenpin-task-${task.id}@gardenpin`));
  lines.push(`DTSTAMP:${nowStamp}`);
  lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
  if (dtend) lines.push(`DTEND;VALUE=DATE:${dtend}`);
  lines.push(icalFoldLine(`SUMMARY:${icalEscape(summary)}`));
  if (task.garden_name) lines.push(icalFoldLine(`LOCATION:${icalEscape(task.garden_name)}`));
  if (desc) lines.push(icalFoldLine(`DESCRIPTION:${desc}`));
  if (rrule) lines.push(`RRULE:${rrule}`);
  // VALARM — uživatelem konfigurovaný předstih (0 = bez připomínky)
  if (reminderDays > 0) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(icalFoldLine(`DESCRIPTION:Připomínka: ${icalEscape(summary)}`));
    lines.push(`TRIGGER:-P${reminderDays}D`);
    lines.push('END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

// Postaví VCALENDAR string z pole tasks (joinů s pin/garden už uvnitř SQL).
// `opts` (vše volitelné): { types, categories, pins, reminderDays }
function buildIcalCalendar(tasks, calName, opts = {}) {
  const types = opts.types || null;
  const categories = opts.categories || null;
  const pins = opts.pins || null;
  const reminderDays = Number.isFinite(opts.reminderDays) ? opts.reminderDays : 1;

  const now = icalNowUtc();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GardenPin//GardenPin Calendar//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    icalFoldLine(`X-WR-CALNAME:${icalEscape(calName)}`),
    'X-WR-TIMEZONE:Europe/Prague',
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];
  for (const t of tasks) {
    if (!eligibleForIcal(t)) continue;
    if (!taskMatchesAllowedTypes(t, types)) continue;
    if (!taskMatchesCategories(t, categories)) continue;
    if (!taskMatchesPins(t, pins)) continue;
    lines.push(...icalEventLines(t, now, reminderDays));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// SQL — vrať tasks pro jednu zahradu nebo všechny (gardenId=null)
function fetchIcalTasks(gardenId) {
  const sql = `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id,
                      g.name AS garden_name
               FROM tasks t
               JOIN pins p ON p.id = t.pin_id
               JOIN gardens g ON g.id = p.garden_id
               WHERE (t.next_due IS NOT NULL OR t.specific_date IS NOT NULL)
                 ${gardenId ? 'AND g.id = ?' : ''}
               ORDER BY COALESCE(t.next_due, t.specific_date) ASC`;
  return gardenId ? db.prepare(sql).all(gardenId) : db.prepare(sql).all();
}

// Endpoint: GET token pro zahradu (auto-create pokud neexistuje)
app.get('/api/gardens/:id/ical-token', (req, res) => {
  const id = req.params.id;
  const g = db.prepare('SELECT id, name FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const token = getOrCreateGardenIcalToken(id);
  if (!token) return res.status(500).json({ error: 'Nepodařilo se vygenerovat token' });
  res.json({ token, garden_id: Number(id), garden_name: g.name });
});

// Endpoint: GET globální token (pro all-gardens kalendář)
app.get('/api/ical-token', (req, res) => {
  res.json({ token: getGlobalIcalToken() });
});

// Build iCal opts z query params (types, categories, pins, reminder).
// Bez params → backward-compatible (žádný filtr, reminder 1 den).
function icalOptsFromQuery(query) {
  const reminder = query.reminder !== undefined ? parseInt(query.reminder, 10) : 1;
  return {
    types: parseCsvParam(query.types),
    categories: parseCsvParam(query.categories),
    pins: parseIntCsvParam(query.pins),
    reminderDays: Number.isFinite(reminder) && reminder >= 0 ? reminder : 1,
  };
}

// Endpoint: živý iCal pro jednu zahradu
app.get('/api/gardens/:id/calendar.ics', (req, res) => {
  const id = req.params.id;
  const token = req.query.token;
  const g = db.prepare('SELECT id, name, ical_token FROM gardens WHERE id = ?').get(id);
  if (!g) return res.status(404).send('Garden not found');
  if (!token || token !== g.ical_token) return res.status(403).send('Invalid or missing token');

  const tasks = fetchIcalTasks(id);
  const ics = buildIcalCalendar(tasks, `GardenPin — ${g.name}`, icalOptsFromQuery(req.query));
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  if (req.query.download === '1') {
    const safeName = g.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'garden';
    res.setHeader('Content-Disposition', `attachment; filename="gardenpin-${safeName}.ics"`);
  }
  res.send(ics);
});

// Endpoint: živý iCal pro všechny zahrady (user-wide)
app.get('/api/calendar.ics', (req, res) => {
  const token = req.query.token;
  if (!token || token !== getGlobalIcalToken()) {
    return res.status(403).send('Invalid or missing token');
  }
  const tasks = fetchIcalTasks(null);
  const ics = buildIcalCalendar(tasks, 'GardenPin — vše', icalOptsFromQuery(req.query));
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', 'attachment; filename="gardenpin.ics"');
  }
  res.send(ics);
});

// ======================= ICAL EXPORT (legacy, dochází jednorázový download) =======================
app.get('/api/export/ical', (req, res) => {
  const tasks = db.prepare(
    `SELECT t.*, p.name AS pin_name, p.plant_name, g.name AS garden_name
     FROM tasks t
     JOIN pins p ON p.id = t.pin_id
     JOIN gardens g ON g.id = p.garden_id
     WHERE t.next_due IS NOT NULL
     ORDER BY t.next_due ASC`,
  ).all();

  const typeEmoji = {
    zalivka: '💧', hnojeni: '🌱', strihani: '✂️', presazeni: '🪴',
    plet: '🌿', sklizen: '🧺', kontrola: '🔍', postrik: '🛡️', jine: '📋',
  };
  const typeLabel = {
    zalivka: 'Zálivka', hnojeni: 'Hnojení', strihani: 'Stříhání', presazeni: 'Přesazení',
    plet: 'Plení', sklizen: 'Sklizeň', kontrola: 'Kontrola', postrik: 'Postřik', jine: 'Úkol',
  };

  // DTSTAMP must be UTC with Z suffix per RFC 5545
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const uid = (t) => `zahradni-${t.id}-${t.pin_id}@tracker`;

  const foldLine = (line) => {
    const out = [];
    while (line.length > 75) {
      out.push(line.slice(0, 75));
      line = ' ' + line.slice(75);
    }
    out.push(line);
    return out.join('\r\n');
  };

  const escape = (s) =>
    (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zahradní Tracker//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Zahradní tracker',
    'X-WR-TIMEZONE:Europe/Prague',
    // VTIMEZONE is required by RFC 5545 when TZID is referenced in events
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Prague',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];


  for (const t of tasks) {
    const emoji = typeEmoji[t.task_type] || '📋';
    const label = typeLabel[t.task_type] || 'Úkol';
    const plant = t.plant_name || t.pin_name;
    const summary = `${emoji} ${label} – ${plant} (${t.garden_name})`;
    const dtstart = (t.next_due || '').replace(/-/g, '') + 'T080000';
    const dtend = (t.next_due || '').replace(/-/g, '') + 'T083000';
    const desc = [
      t.notes ? escape(t.notes) : '',
      `Zahrada: ${escape(t.garden_name)}`,
      `Místo: ${escape(t.pin_name)}`,
      t.plant_name ? `Rostlina: ${escape(t.plant_name)}` : '',
      t.frequency_days ? `Opakování: každých ${t.frequency_days} dní` : '',
    ].filter(Boolean).join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${uid(t)}`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;TZID=Europe/Prague:${dtstart}`);
    lines.push(`DTEND;TZID=Europe/Prague:${dtend}`);
    lines.push(foldLine(`SUMMARY:${escape(summary)}`));
    if (desc) lines.push(foldLine(`DESCRIPTION:${desc}`));
    const isYearly = t.recurring && t.recurrence_pattern === 'yearly';
    if (t.frequency_days) {
      lines.push(`RRULE:FREQ=DAILY;INTERVAL=${t.frequency_days}`);
    } else if (isYearly) {
      lines.push('RRULE:FREQ=YEARLY');
    }
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:Připomínka: ${escape(summary)}`));
    lines.push(t.frequency_days || isYearly ? 'TRIGGER:-PT24H' : 'TRIGGER:PT0S');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zahradni-tracker.ics"');
  res.send(lines.join('\r\n'));
});

// ======================= SEASONAL PLAN (PDF print) =======================
// Vrací print-friendly HTML pro tisk nebo uložení jako PDF.
// Browser zobrazí tiskové menu (Save as PDF). Žádná nová server-side závislost.
function htmlEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MONTH_NAMES_CZ = [
  '', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const TASK_TYPE_EMOJI_PDF = {
  zalivka: '💧', hnojeni: '🌱', strihani: '✂️', presazeni: '🪴',
  plet: '🌿', sklizen: '🧺', kontrola: '🔍', postrik: '🛡️', jine: '📋',
};

app.get('/api/gardens/:id/season-plan', (req, res) => {
  const id = req.params.id;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!garden) return res.status(404).send('<h1>Zahrada nenalezena</h1>');

  const pins = db.prepare('SELECT * FROM pins WHERE garden_id = ? ORDER BY name').all(id);
  const tasks = db.prepare(
    `SELECT t.*, p.name AS pin_name, p.plant_name
     FROM tasks t
     JOIN pins p ON p.id = t.pin_id
     WHERE p.garden_id = ?
     ORDER BY p.name, t.next_due ASC`,
  ).all(id);

  // Skupiny: měsíc 1-12 = jednorázové úkony s specific_date v daném roce
  // (i ty s recurrence_pattern='yearly' patří do měsíce ze specific_date)
  const byMonth = Array.from({ length: 13 }, () => []);
  const recurring = []; // průběžné (frequency_days)
  for (const t of tasks) {
    if (t.specific_date) {
      const d = new Date(t.specific_date);
      if (!Number.isNaN(d.getTime())) {
        const m = d.getMonth() + 1;
        byMonth[m].push(t);
      }
    } else if (t.frequency_days) {
      recurring.push(t);
    }
  }

  const renderTask = (t) => {
    const emoji = TASK_TYPE_EMOJI_PDF[t.task_type] || '📋';
    const plant = t.plant_name || t.pin_name;
    const notes = t.notes ? `<div class="task-notes">${htmlEscape(t.notes)}</div>` : '';
    const dayMonth = t.specific_date ? new Date(t.specific_date).getDate() + '. ' : '';
    return `<li class="task">
      <span class="task-emoji">${emoji}</span>
      <div class="task-body">
        <div class="task-title"><strong>${htmlEscape(dayMonth + t.title)}</strong> · ${htmlEscape(plant)}</div>
        ${notes}
      </div>
    </li>`;
  };

  const months = [];
  for (let m = 1; m <= 12; m++) {
    if (byMonth[m].length === 0) continue;
    const items = byMonth[m].map(renderTask).join('\n');
    months.push(`
      <section class="month">
        <h2 class="month-title">${MONTH_NAMES_CZ[m]}</h2>
        <ul class="task-list">${items}</ul>
      </section>
    `);
  }

  const recurringHtml = recurring.length > 0
    ? `<section class="month recurring">
        <h2 class="month-title">Průběžné úkony</h2>
        <ul class="task-list">
          ${recurring.map((t) => {
            const emoji = TASK_TYPE_EMOJI_PDF[t.task_type] || '📋';
            const plant = t.plant_name || t.pin_name;
            const freq = t.frequency_days ? `každých ${t.frequency_days} dní` : '';
            return `<li class="task">
              <span class="task-emoji">${emoji}</span>
              <div class="task-body">
                <div class="task-title"><strong>${htmlEscape(t.title)}</strong> · ${htmlEscape(plant)}</div>
                <div class="task-notes">${htmlEscape(freq)}</div>
              </div>
            </li>`;
          }).join('\n')}
        </ul>
      </section>`
    : '';

  const conditions = [];
  if (garden.soil_type) conditions.push(`Půda: ${htmlEscape(garden.soil_type)}`);
  if (garden.exposure) {
    const expMap = { N: 'sever', S: 'jih', E: 'východ', W: 'západ', mixed: 'smíšená' };
    conditions.push(`Expozice: ${htmlEscape(expMap[garden.exposure] || garden.exposure)}`);
  }
  if (garden.altitude_m) conditions.push(`Nadm. výška: ${garden.altitude_m} m`);
  if (garden.climate_zone) {
    conditions.push(`Klimatická zóna: ${htmlEscape(ZONE_LABELS[garden.climate_zone] || garden.climate_zone)}`);
  }
  const conditionsHtml = conditions.length > 0
    ? `<div class="conditions">${conditions.join(' · ')}</div>`
    : '';

  const empty = months.length === 0 && recurring.length === 0
    ? '<p class="empty-state">V této zahradě zatím nejsou žádné úkony. Přidejte úkoly k jednotlivým rostlinám.</p>'
    : '';

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sezónní plán — ${htmlEscape(garden.name)} ${year}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #2d2d33;
    background: #f5f0e8;
    margin: 0;
    padding: 24px;
    line-height: 1.5;
  }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  header { border-bottom: 2px solid #4a7c3a; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 1.8rem; color: #2d5a27; }
  .subtitle { color: #6b6b70; font-size: 0.95rem; }
  .conditions { margin-top: 8px; color: #6b6b70; font-size: 0.85rem; }
  .meta { margin-top: 12px; font-size: 0.85rem; color: #6b6b70; }
  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .toolbar button {
    background: #4a7c3a;
    color: #fff;
    border: none;
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 0.9rem;
    cursor: pointer;
    font-weight: 600;
  }
  .toolbar button.ghost {
    background: #fff;
    color: #2d5a27;
    border: 1px solid #4a7c3a;
  }
  .month { margin-bottom: 28px; page-break-inside: avoid; break-inside: avoid; }
  .month-title {
    font-size: 1.25rem;
    color: #2d5a27;
    margin: 0 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e8e4dc;
  }
  .task-list { list-style: none; padding: 0; margin: 0; }
  .task {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed #e8e4dc;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .task:last-child { border-bottom: none; }
  .task-emoji { font-size: 1.1rem; flex-shrink: 0; }
  .task-body { flex: 1; min-width: 0; }
  .task-title { font-size: 0.95rem; }
  .task-notes { font-size: 0.85rem; color: #6b6b70; margin-top: 2px; }
  .recurring .month-title { color: #8b6f47; }
  .empty-state {
    text-align: center;
    color: #6b6b70;
    padding: 40px 20px;
    font-style: italic;
  }
  footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #e8e4dc;
    font-size: 0.75rem;
    color: #9b9ba0;
    text-align: center;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; padding: 20px; border-radius: 0; max-width: none; }
    .toolbar { display: none !important; }
    .month { page-break-inside: avoid; }
    .task { page-break-inside: avoid; }
    h1 { font-size: 1.5rem; }
    @page { size: A4; margin: 18mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button onclick="window.print()">🖨️ Tisk / Uložit PDF</button>
      <button class="ghost" onclick="window.close()">Zavřít</button>
    </div>
    <header>
      <h1>🌿 Sezónní plán — ${htmlEscape(garden.name)}</h1>
      <div class="subtitle">Rok ${year} · ${pins.length} ${pins.length === 1 ? 'místo' : (pins.length < 5 ? 'místa' : 'míst')} · ${tasks.length} ${tasks.length === 1 ? 'úkol' : (tasks.length < 5 ? 'úkoly' : 'úkolů')}</div>
      ${conditionsHtml}
    </header>
    ${months.join('\n')}
    ${recurringHtml}
    ${empty}
    <footer>Vytištěno z GardenPin · ${new Date().toLocaleDateString('cs-CZ')}</footer>
  </div>
  <script>
    // Auto-otevři tiskový dialog jen pokud je v URL ?print=1
    if (new URLSearchParams(location.search).get('print') === '1') {
      setTimeout(() => window.print(), 400);
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ======================= EXPORT =======================
// Helper: escape value for CSV (RFC 4180)
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

app.get('/api/export', (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const gardens = db.prepare('SELECT * FROM gardens').all();
  const pins = db.prepare('SELECT * FROM pins').all();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const care_history = db.prepare('SELECT * FROM care_history').all();
  const beds = db.prepare('SELECT * FROM beds').all();
  const pin_photos = db.prepare('SELECT * FROM pin_photos').all();
  const harvests = db.prepare('SELECT * FROM harvests').all();

  if (format === 'csv') {
    // Plochá tabulka: jeden řádek = jeden úkol (s informací o pinu a zahradě).
    // Piny bez úkolů se vypíšou s prázdnými task_* sloupci.
    const lines = [];
    lines.push(csvRow([
      'garden_id', 'garden_name',
      'pin_id', 'pin_name', 'plant_name', 'planting_date', 'pin_notes',
      'task_id', 'task_title', 'task_type', 'frequency_days', 'specific_date', 'next_due', 'last_done', 'recurring', 'recurrence_pattern', 'task_notes',
    ]));
    const gardenById = new Map(gardens.map((g) => [g.id, g]));
    const tasksByPin = new Map();
    for (const t of tasks) {
      if (!tasksByPin.has(t.pin_id)) tasksByPin.set(t.pin_id, []);
      tasksByPin.get(t.pin_id).push(t);
    }
    for (const p of pins) {
      const g = gardenById.get(p.garden_id) || { id: p.garden_id, name: '' };
      const pinTasks = tasksByPin.get(p.id) || [];
      if (pinTasks.length === 0) {
        lines.push(csvRow([
          g.id, g.name,
          p.id, p.name, p.plant_name, p.planting_date, p.notes,
          '', '', '', '', '', '', '', '', '', '',
        ]));
      } else {
        for (const t of pinTasks) {
          lines.push(csvRow([
            g.id, g.name,
            p.id, p.name, p.plant_name, p.planting_date, p.notes,
            t.id, t.title, t.task_type, t.frequency_days, t.specific_date, t.next_due, t.last_done, t.recurring, t.recurrence_pattern, t.notes,
          ]));
        }
      }
    }
    // UTF-8 BOM pro správný import do Excelu s diakritikou
    const body = '﻿' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zahradni-tracker-export.csv"');
    return res.send(body);
  }

  // JSON — kompletní export včetně relativních URL fotek (pro stažení samostatně)
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = `${proto}://${host}`;
  const data = {
    exportedAt: new Date().toISOString(),
    version: 2,
    baseUrl,
    gardens: gardens.map((g) => ({ ...g, image_url: g.image_path ? baseUrl + g.image_path : null })),
    pins: pins.map((p) => ({ ...p, photo_url: p.photo_path ? baseUrl + p.photo_path : null })),
    beds,
    tasks,
    care_history,
    harvests,
    pin_photos: pin_photos.map((ph) => ({
      ...ph,
      url: `${baseUrl}/uploads/pins/${ph.pin_id}/${ph.filename}`,
    })),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="zahradni-tracker-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

// ======================= API 404 (JSON) =======================
// API-1: jakákoliv neznámá /api/* cesta musí vrátit JSON { error }, ne Express HTML "Cannot GET …".
// SPA fallback níže neobsluhuje /api ani /uploads, takže by jinak request spadl do default 404 handleru.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint nenalezen', path: req.originalUrl });
});

// ======================= SPA fallback =======================
app.get(/^(?!\/(api|uploads)).*/, (req, res, next) => {
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  next();
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zahradní tracker běží na portu ${PORT}`);
  if (push) push.startDailyCron();
  if (email && email.isConfigured()) {
    email.startWeeklyCron();
  } else if (email) {
    console.log('[email] Modul načten, ale GMAIL_FROM/GMAIL_APP_PASSWORD chybí — cron neaktivní.');
  }
});
