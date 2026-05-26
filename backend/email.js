// Email připomínky: Nodemailer + Gmail SMTP, týdenní digest každé pondělí 8:00.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const nodemailer = require('nodemailer');
const cron = require('node-cron');
const db = require('./db');

const GMAIL_FROM = process.env.GMAIL_FROM || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!GMAIL_FROM || !GMAIL_APP_PASSWORD) {
    throw new Error('Email není nakonfigurovaný — chybí GMAIL_FROM nebo GMAIL_APP_PASSWORD v .env');
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_FROM, pass: GMAIL_APP_PASSWORD },
  });
  return transporter;
}

// České názvy typů úkonů + emoji pro hezky čitelný email
const TASK_TYPE_LABEL = {
  zalivka: 'Zálivka', hnojeni: 'Hnojení', strihani: 'Stříhání', presazeni: 'Přesazení',
  plet: 'Plení', sklizen: 'Sklizeň', kontrola: 'Kontrola', jine: 'Úkol',
};
const TASK_TYPE_EMOJI = {
  zalivka: '💧', hnojeni: '🌱', strihani: '✂️', presazeni: '🪴',
  plet: '🌿', sklizen: '🧺', kontrola: '🔍', jine: '📋',
};

const DAYS_CZ = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const MONTHS_CZ = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

function htmlEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateCz(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${DAYS_CZ[d.getDay()]} ${d.getDate()}. ${MONTHS_CZ[d.getMonth()]}`;
}

// Vrací úkoly s next_due v rozsahu [dnes, dnes+7]. Sjednocené napříč všemi zahradami.
function getWeekTasks() {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 7);
  const startStr = today.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return db.prepare(
    `SELECT t.*, p.name AS pin_name, p.plant_name, g.name AS garden_name
     FROM tasks t
     JOIN pins p ON p.id = t.pin_id
     JOIN gardens g ON g.id = p.garden_id
     WHERE t.next_due IS NOT NULL AND t.next_due <= ?
     ORDER BY t.next_due ASC, g.name ASC, t.id ASC`,
  ).all(endStr);
}

function buildDigestHtml(tasks) {
  const today = new Date();
  const headerDate = formatDateCz(today.toISOString().slice(0, 10));

  const rowsHtml = tasks.length === 0
    ? `<tr><td style="padding: 24px; text-align: center; color: #6b6b70; font-style: italic;">
         Tento týden tě v zahradě nečekají žádné úkoly. Užij si klidný týden! 🌿
       </td></tr>`
    : tasks.map((t) => {
        const emoji = TASK_TYPE_EMOJI[t.task_type] || '📋';
        const label = TASK_TYPE_LABEL[t.task_type] || 'Úkol';
        const plant = t.plant_name || t.pin_name;
        const when = formatDateCz(t.next_due);
        const overdueBadge = t.next_due < today.toISOString().slice(0, 10)
          ? '<span style="display: inline-block; background: #c0392b; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 999px; margin-left: 6px;">po termínu</span>'
          : '';
        const notes = t.notes
          ? `<div style="font-size: 13px; color: #6b6b70; margin-top: 4px;">${htmlEscape(t.notes)}</div>`
          : '';
        return `<tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 14px 16px; vertical-align: top; width: 32px; font-size: 20px;">${emoji}</td>
          <td style="padding: 14px 16px; vertical-align: top;">
            <div style="font-weight: 600; color: #2d2d33; font-size: 15px;">
              ${htmlEscape(label)} — ${htmlEscape(plant)}
            </div>
            <div style="font-size: 13px; color: #4a7c3a; margin-top: 2px;">
              📍 ${htmlEscape(t.garden_name)} · 🗓 ${htmlEscape(when)}${overdueBadge}
            </div>
            ${notes}
          </td>
        </tr>`;
      }).join('\n');

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GardenPin — týdenní souhrn</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f5f0e8; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #4a7c3a 0%, #2d5a27 100%); padding: 28px 24px; color: #fff;">
              <div style="font-size: 13px; opacity: 0.85; letter-spacing: 0.5px; text-transform: uppercase;">${htmlEscape(headerDate)}</div>
              <h1 style="margin: 6px 0 0; font-size: 24px; font-weight: 700;">🌿 Co tě čeká tento týden</h1>
              <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">
                ${tasks.length === 0 ? 'Žádné úkoly' : `${tasks.length} ${tasks.length === 1 ? 'úkol' : (tasks.length < 5 ? 'úkoly' : 'úkolů')} v zahradě`}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rowsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px; background: #faf8f4; text-align: center; border-top: 1px solid #eee;">
              <div style="font-size: 13px; color: #6b6b70;">
                Tento email ti přišel, protože máš zapnuté týdenní připomínky v GardenPin.
              </div>
              <div style="font-size: 14px; color: #4a7c3a; font-weight: 600; margin-top: 8px;">
                GardenPin 🌱
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWeeklyDigest(email) {
  if (!email) throw new Error('Email je povinný');
  const tasks = getWeekTasks();
  const html = buildDigestHtml(tasks);
  const subject = tasks.length === 0
    ? '🌿 GardenPin — klidný týden v zahradě'
    : `🌿 GardenPin — tento týden ${tasks.length} ${tasks.length === 1 ? 'úkol' : (tasks.length < 5 ? 'úkoly' : 'úkolů')}`;

  const tx = getTransporter();
  await tx.sendMail({
    from: `"GardenPin 🌱" <${GMAIL_FROM}>`,
    to: email,
    subject,
    html,
  });
  return { sent: 1, tasks: tasks.length };
}

async function sendTestEmail(email) {
  if (!email) throw new Error('Email je povinný');
  const tx = getTransporter();
  await tx.sendMail({
    from: `"GardenPin 🌱" <${GMAIL_FROM}>`,
    to: email,
    subject: '🌿 GardenPin — testovací email',
    html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f5f0e8;">
      <div style="background: #fff; padding: 24px; border-radius: 12px;">
        <h2 style="color: #2d5a27; margin-top: 0;">🎉 Funguje to!</h2>
        <p>Tvůj email je správně nastavený — od teď budeš každé <strong>pondělí ráno</strong> dostávat
        souhrn úkolů na nadcházející týden.</p>
        <p style="color: #6b6b70; font-size: 14px;">Pokud bys chtěl emaily vypnout, stačí v aplikaci v Nastavení vypnout přepínač.</p>
        <p style="color: #4a7c3a; font-weight: 600; margin-top: 24px;">GardenPin 🌱</p>
      </div>
    </div>`,
  });
}

// Pozvánka ke spolupráci na zahradě — odešle se členovi s odkazem na přijetí.
const MEMBER_ROLE_LABEL = { editor: 'spoluzahradník (může upravovat)', viewer: 'pozorovatel (jen čte)' };

async function sendGardenInvite({ to, gardenName, inviterName, memberName, role, url }) {
  if (!to) throw new Error('Email je povinný');
  const roleLabel = MEMBER_ROLE_LABEL[role] || MEMBER_ROLE_LABEL.editor;
  const who = inviterName ? htmlEscape(inviterName) : 'Někdo';
  const html = `<!DOCTYPE html>
<html lang="cs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#7BA889 0%,#4A6E57 100%);padding:30px 26px;color:#fff;">
          <div style="font-size:13px;opacity:0.9;letter-spacing:0.5px;text-transform:uppercase;">Pozvánka do zahrady</div>
          <h1 style="margin:6px 0 0;font-size:23px;font-weight:700;">🌿 ${htmlEscape(gardenName)}</h1>
        </td></tr>
        <tr><td style="padding:26px;">
          <p style="font-size:16px;color:#2d2d33;margin:0 0 14px;">Ahoj ${htmlEscape(memberName)},</p>
          <p style="font-size:15px;color:#3a3a40;line-height:1.5;margin:0 0 18px;">
            ${who} tě zve ke spolupráci na zahradě <strong>${htmlEscape(gardenName)}</strong> v aplikaci GardenPin
            jako <strong>${htmlEscape(roleLabel)}</strong>. Budeš mít přehled o úkonech a můžeš přiložit ruku k dílu. 🌱
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${htmlEscape(url)}" style="display:inline-block;background:#4A6E57;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:14px;">
              Přijmout pozvánku
            </a>
          </div>
          <p style="font-size:13px;color:#6b6b70;line-height:1.5;margin:18px 0 0;">
            Pokud tlačítko nefunguje, otevři tento odkaz:<br>
            <a href="${htmlEscape(url)}" style="color:#4A6E57;word-break:break-all;">${htmlEscape(url)}</a>
          </p>
        </td></tr>
        <tr><td style="padding:18px 26px;background:#FAF7F2;text-align:center;border-top:1px solid #eee;">
          <div style="font-size:14px;color:#4A6E57;font-weight:600;">GardenPin 🌱</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const tx = getTransporter();
  await tx.sendMail({
    from: `"GardenPin 🌱" <${GMAIL_FROM}>`,
    to,
    subject: `🌿 Pozvánka do zahrady ${gardenName}`,
    html,
  });
  return { sent: 1 };
}

async function runWeeklyDigestForAll() {
  const rows = db.prepare('SELECT email FROM email_settings WHERE enabled = 1 AND email IS NOT NULL').all();
  if (rows.length === 0) {
    console.log('[email] Žádné aktivní odběratele týdenního digestu.');
    return { skipped: true };
  }
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sendWeeklyDigest(row.email);
      sent++;
    } catch (e) {
      failed++;
      console.error('[email] Chyba při odeslání na', row.email, ':', e.message);
    }
  }
  console.log(`[email] Weekly digest: ${sent}/${rows.length} odesláno (failed: ${failed})`);
  return { sent, failed, total: rows.length };
}

let cronTask = null;
function startWeeklyCron() {
  if (cronTask) return;
  // Každé pondělí v 08:00 lokálního času (Europe/Prague)
  cronTask = cron.schedule(
    '0 8 * * 1',
    () => {
      runWeeklyDigestForAll().catch((e) => console.error('[email] cron error', e));
    },
    { timezone: 'Europe/Prague' },
  );
  console.log('[email] Weekly digest cron (po 08:00) aktivní');
}

function isConfigured() {
  return Boolean(GMAIL_FROM && GMAIL_APP_PASSWORD);
}

module.exports = {
  sendWeeklyDigest,
  sendTestEmail,
  sendGardenInvite,
  runWeeklyDigestForAll,
  startWeeklyCron,
  isConfigured,
};
