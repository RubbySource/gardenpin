// Main Express server for Zahradní tracker
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const stripeRoutes = require('./routes/stripeRoutes');

// Sharp — optional, pro upscale. Nenačítat tvrdě (nemusí být nainstalován)
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

// Web Push — optional (pokud web-push není nainstalován, push se vypne)
let push;
try { push = require('./push'); } catch (e) {
  console.warn('Web Push není dostupný:', e.message);
  push = null;
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

app.post('/api/gardens', upload.single('image'), (req, res) => {
  const name = req.body.name || 'Nová zahrada';
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;
  const w = req.body.width ? parseInt(req.body.width, 10) : null;
  const h = req.body.height ? parseInt(req.body.height, 10) : null;
  const info = db
    .prepare('INSERT INTO gardens (name, image_path, image_width, image_height) VALUES (?, ?, ?, ?)')
    .run(name, imagePath, w, h);
  const garden = db.prepare('SELECT * FROM gardens WHERE id = ?').get(info.lastInsertRowid);
  res.json(garden);
});

app.put('/api/gardens/:id', upload.single('image'), (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM gardens WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Zahrada nenalezena' });
  const name = req.body.name ?? current.name;
  const rotation = req.body.rotation !== undefined ? parseInt(req.body.rotation, 10) : (current.rotation || 0);
  let imagePath = current.image_path;
  if (req.file) {
    // Delete previous image
    if (current.image_path) {
      const old = path.join(__dirname, current.image_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    imagePath = '/uploads/' + req.file.filename;
  }
  const w = req.body.width ? parseInt(req.body.width, 10) : current.image_width;
  const h = req.body.height ? parseInt(req.body.height, 10) : current.image_height;
  db.prepare('UPDATE gardens SET name=?, image_path=?, image_width=?, image_height=?, rotation=? WHERE id=?').run(
    name,
    imagePath,
    w,
    h,
    rotation,
    id,
  );
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
  for (const pin of pins) {
    if (pin.photo_path) {
      const p = path.join(__dirname, pin.photo_path);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  res.json({ ok: true });
});

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
  const tasks = db.prepare('SELECT * FROM tasks WHERE pin_id = ? ORDER BY next_due').all(pin.id);
  const history = db
    .prepare('SELECT * FROM care_history WHERE pin_id = ? ORDER BY done_at DESC LIMIT 50')
    .all(pin.id);
  res.json({ ...pin, tasks, history });
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

// Nejnovější fotky napříč všemi piny — pro Home grid "Poslední fotky"
app.get('/api/photos/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '4', 10) || 4, 24);
  const rows = db
    .prepare(
      `SELECT ph.id, ph.pin_id, ph.filename, ph.uploaded_at, ph.caption,
              p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name
         FROM pin_photos ph
         JOIN pins p ON p.id = ph.pin_id
         JOIN gardens g ON g.id = p.garden_id
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

app.get('/api/pins/:id/photo', (req, res) => {
  const pin = db.prepare('SELECT photo_path FROM pins WHERE id = ?').get(req.params.id);
  if (!pin) return res.status(404).json({ error: 'Pin nenalezen' });
  if (!pin.photo_path) return res.json({ photo: null });
  const p = path.join(__dirname, pin.photo_path);
  if (!fs.existsSync(p)) return res.json({ photo: null });
  const ext = path.extname(p).toLowerCase().replace('.', '') || 'jpeg';
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const buf = fs.readFileSync(p);
  res.json({ photo: `data:image/${mime};base64,${buf.toString('base64')}` });
});

// ======================= TASKS =======================
app.get('/api/tasks', (req, res) => {
  // All tasks with related pin + garden data
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       ORDER BY t.next_due ASC`,
    )
    .all();
  res.json(rows);
});

app.get('/api/tasks/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE t.next_due <= ?
       ORDER BY t.next_due ASC`,
    )
    .all(today);
  res.json(rows);
});

app.get('/api/tasks/week', (req, res) => {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);
  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, p.garden_id, g.name AS garden_name
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE t.next_due <= ?
       ORDER BY t.next_due ASC`,
    )
    .all(endStr);
  res.json({ start: startStr, end: endStr, tasks: rows });
});

app.post('/api/tasks', (req, res) => {
  const { pin_id, title, task_type, frequency_days, specific_date, notes, recurring, recurrence_pattern } = req.body;
  const tmp = { specific_date, frequency_days, last_done: null };
  const next_due = computeNextDue(tmp);
  const info = db
    .prepare(
      `INSERT INTO tasks (pin_id, title, task_type, frequency_days, specific_date, next_due, notes, recurring, recurrence_pattern)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const next_due = computeNextDue({ specific_date, frequency_days, last_done: current.last_done });
  db.prepare(
    `UPDATE tasks SET title=?, task_type=?, frequency_days=?, specific_date=?, next_due=?, notes=?, recurring=?, recurrence_pattern=? WHERE id=?`,
  ).run(title, task_type, frequency_days, specific_date, next_due, notes, recurring, recurrence_pattern, id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mark task as done and reschedule
app.post('/api/tasks/:id/done', (req, res) => {
  const id = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Úkol nenalezen' });
  const today = new Date().toISOString().slice(0, 10);

  // Record care history
  db.prepare(
    `INSERT INTO care_history (task_id, pin_id, action, notes) VALUES (?, ?, ?, ?)`,
  ).run(id, task.pin_id, task.title, req.body?.notes || null);

  if (task.specific_date) {
    if (task.recurring && task.recurrence_pattern === 'yearly') {
      // Yearly recurring: posunout specific_date o rok dopředu
      const d = new Date(task.specific_date);
      d.setFullYear(d.getFullYear() + 1);
      const newDate = d.toISOString().slice(0, 10);
      db.prepare('UPDATE tasks SET last_done=?, specific_date=?, next_due=? WHERE id=?').run(
        today,
        newDate,
        newDate,
        id,
      );
      return res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    }
    // One-time task: delete after completion
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return res.json({ ok: true, removed: true });
  }
  // Recurring: update last_done and compute next
  const next_due = computeNextDue({ ...task, last_done: today });
  db.prepare('UPDATE tasks SET last_done=?, next_due=? WHERE id=?').run(today, next_due, id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

// ======================= HISTORY =======================
app.get('/api/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT h.*, p.name AS pin_name, p.plant_name, g.id AS garden_id, g.name AS garden_name
       FROM care_history h
       JOIN pins p ON p.id = h.pin_id
       JOIN gardens g ON g.id = p.garden_id
       ORDER BY h.done_at DESC
       LIMIT 200`,
    )
    .all();
  res.json(rows);
});

app.post('/api/history', (req, res) => {
  const { pin_id, action, notes } = req.body;
  const info = db
    .prepare('INSERT INTO care_history (pin_id, action, notes) VALUES (?, ?, ?)')
    .run(pin_id, action, notes || null);
  res.json(db.prepare('SELECT * FROM care_history WHERE id = ?').get(info.lastInsertRowid));
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

// ======================= WEATHER =======================
// Proxy na Open-Meteo — backend zajistí CORS a stabilní rozhraní
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat a lon jsou povinné parametry' });
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Europe%2FPrague`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Open-Meteo nedostupné' });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ======================= ICAL EXPORT =======================
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
    plet: '🌿', sklizen: '🧺', kontrola: '🔍', jine: '📋',
  };
  const typeLabel = {
    zalivka: 'Zálivka', hnojeni: 'Hnojení', strihani: 'Stříhání', presazeni: 'Přesazení',
    plet: 'Plení', sklizen: 'Sklizeň', kontrola: 'Kontrola', jine: 'Úkol',
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

// ======================= EXPORT =======================
app.get('/api/export', (req, res) => {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    gardens: db.prepare('SELECT * FROM gardens').all(),
    pins: db.prepare('SELECT * FROM pins').all(),
    tasks: db.prepare('SELECT * FROM tasks').all(),
    care_history: db.prepare('SELECT * FROM care_history').all(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="zahradni-tracker-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
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
});
