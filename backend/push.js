// Web Push setup: VAPID config, subscription storage, send helper, daily cron
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const webpush = require('web-push');
const cron = require('node-cron');
const db = require('./db');

let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@gardenpin.local';

// Pokud .env neexistuje, vygeneruj klíče a ulož je
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = keys.publicKey;
  VAPID_PRIVATE_KEY = keys.privateKey;
  const envPath = path.join(__dirname, '.env');
  const content =
    `VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}\n` +
    `VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}\n` +
    `VAPID_SUBJECT=${VAPID_SUBJECT}\n`;
  try {
    fs.writeFileSync(envPath, content, { mode: 0o600 });
    console.log('Vygenerovány nové VAPID klíče → backend/.env');
  } catch (e) {
    console.warn('Nelze zapsat .env:', e.message);
  }
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function getPublicKey() {
  return VAPID_PUBLIC_KEY;
}

function saveSubscription(sub) {
  const endpoint = sub.endpoint;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error('Neplatný subscription objekt');
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth`,
  ).run(endpoint, p256dh, auth);
}

function deleteSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function listSubscriptions() {
  return db.prepare('SELECT * FROM push_subscriptions').all();
}

// ---- Nativní push (APNs/FCM device tokeny z Capacitoru) -------------------
// Reálné doručení vyžaduje APNs konfiguraci (Apple Push key .p8 + key/team id;
// viz docs/IOS_BUILD.md). Token ukládáme vždy, aby byl klient připraven dřív;
// dokud APNs creds nejsou nastaveny, sendToAll nativní tokeny jen přeskočí.
function saveNativeToken(token, platform) {
  if (!token) throw new Error('Chybí device token');
  db.prepare(
    `INSERT INTO native_push_tokens (token, platform) VALUES (?, ?)
     ON CONFLICT(token) DO UPDATE SET platform = excluded.platform`,
  ).run(token, platform || 'ios');
}

function deleteNativeToken(token) {
  db.prepare('DELETE FROM native_push_tokens WHERE token = ?').run(token);
}

function listNativeTokens() {
  return db.prepare('SELECT * FROM native_push_tokens').all();
}

// APNs je nakonfigurované, jen pokud máme všechny creds v prostředí.
function apnsConfigured() {
  return !!(
    process.env.APNS_KEY_PATH &&
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_BUNDLE_ID
  );
}

// Doručení nativních notifikací. Bez APNs creds je no-op (jen log), takže
// produkce běží dál a klient může tokeny registrovat. Až creds přibudou,
// zde se napojí HTTP/2 APNs odeslání (token-based JWT).
async function sendToNative(payload) {
  const tokens = listNativeTokens();
  if (tokens.length === 0) return { total: 0, sent: 0, skipped: 0 };
  if (!apnsConfigured()) {
    console.log(
      `[push] ${tokens.length} nativních tokenů přeskočeno — APNs není nakonfigurováno (viz docs/IOS_BUILD.md)`,
    );
    return { total: tokens.length, sent: 0, skipped: tokens.length };
  }
  // TODO(apns): odeslat přes APNs HTTP/2 + JWT (.p8). Vyžaduje Apple Push key.
  console.log(`[push] APNs odeslání zatím neimplementováno (${tokens.length} tokenů)`);
  return { total: tokens.length, sent: 0, skipped: tokens.length };
}

async function sendToOne(row, payload) {
  const sub = {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    // 404/410 = subscription neplatná → smazat
    if (err.statusCode === 404 || err.statusCode === 410) {
      deleteSubscription(row.endpoint);
      return { ok: false, removed: true };
    }
    return { ok: false, error: err.message };
  }
}

async function sendToAll(payload) {
  const subs = listSubscriptions();
  const [results, nativeStats] = await Promise.all([
    Promise.all(subs.map((s) => sendToOne(s, payload))),
    sendToNative(payload),
  ]);
  const webSent = results.filter((r) => r.ok).length;
  return {
    total: subs.length + nativeStats.total,
    sent: webSent + nativeStats.sent,
    removed: results.filter((r) => r.removed).length,
    failed: results.filter((r) => !r.ok && !r.removed).length,
    native: nativeStats,
  };
}

// Imperativní sloveso podle typu úkonu pro hezky čitelnou notifikaci
const TASK_VERBS = {
  zalivka: 'zalej',
  hnojeni: 'pohnoj',
  strihani: 'zastřihni',
  presazeni: 'přesaď',
  plet: 'vypleň',
  sklizen: 'sklízej',
  kontrola: 'zkontroluj',
  jine: null,
};

// "Dnes zastřihni levanduli v Zahradě u domu"
function formatTaskLine(t) {
  const verb = TASK_VERBS[t.task_type];
  const what = t.plant_name || t.pin_name || 'rostlinu';
  const where = t.garden_name ? ` v ${t.garden_name}` : '';
  // Vlastní úkon (task_type "jine") nemá pevné sloveso — použij název úkolu
  if (!verb) return `${t.title}${where}`;
  return `${verb} ${what}${where}`;
}

// Sestaví obsah denního upozornění — POUZE úkoly s next_due <= dnes (dnešní + zameškané).
// Backlog: "každý den ráno v 7:00 zkontrolovat task_date = dnes".
function buildDailyDigest() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pin_name, p.plant_name, g.name AS garden_name
       FROM tasks t
       JOIN pins p ON p.id = t.pin_id
       JOIN gardens g ON g.id = p.garden_id
       WHERE t.next_due IS NOT NULL AND t.next_due <= ?
       ORDER BY t.next_due ASC, t.id ASC`,
    )
    .all(todayStr);

  if (rows.length === 0) return null;

  let body;
  if (rows.length === 1) {
    // Jeden úkol → konkrétní formulace dle backlogu
    body = `Dnes ${formatTaskLine(rows[0])}`;
  } else {
    // Více úkolů → souhrn s prvními třemi pro náhled
    const top = rows.slice(0, 3).map(formatTaskLine).join(' · ');
    const more = rows.length > 3 ? ` (+${rows.length - 3} dalších)` : '';
    body = `Dnes ${rows.length} úkonů: ${top}${more}`;
  }

  return {
    title: '🌿 GardenPin',
    body,
    url: '/tasks',
  };
}

async function runDailyDigest() {
  const payload = buildDailyDigest();
  if (!payload) {
    console.log('[push] Žádné úkoly na dnes/zítra, neposílám.');
    return { skipped: true };
  }
  const stats = await sendToAll(payload);
  console.log(`[push] Daily digest sent: ${stats.sent}/${stats.total} (removed ${stats.removed})`);
  return stats;
}

let cronTask = null;
function startDailyCron() {
  if (cronTask) return;
  // Každý den v 07:00 lokálního času (Europe/Prague)
  cronTask = cron.schedule(
    '0 7 * * *',
    () => {
      runDailyDigest().catch((e) => console.error('[push] cron error', e));
    },
    { timezone: 'Europe/Prague' },
  );
  console.log('[push] Daily 07:00 cron aktivní (Europe/Prague)');
}

module.exports = {
  getPublicKey,
  saveSubscription,
  deleteSubscription,
  saveNativeToken,
  deleteNativeToken,
  sendToAll,
  buildDailyDigest,
  runDailyDigest,
  startDailyCron,
};
