// Izolovaný test feature Spolupráce — vlastní port + temp DB, produkční PM2 nedotčen.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 3987;
const dbPath = path.join(os.tmpdir(), `gp-members-test-${Date.now()}.db`);
const base = `http://127.0.0.1:${PORT}`;

const env = { ...process.env, PORT: String(PORT), DATABASE_PATH: dbPath, GMAIL_FROM: '', GMAIL_APP_PASSWORD: '' };
const srv = spawn('node', [path.join(__dirname, '..', 'backend', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(method, url, body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(base + url, opt);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${text}`);
  return data;
}

const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT FAIL: ' + msg); console.log('  ✓ ' + msg); };

(async () => {
  try {
    // čekej na start
    for (let i = 0; i < 40; i++) {
      try { await fetch(base + '/api/gardens'); break; } catch { await sleep(150); }
    }

    console.log('1) Vytvoř zahradu');
    // POST /api/gardens i /api/pins používá multer → musí to být multipart/form-data.
    const fd = new FormData();
    fd.append('name', 'Testovací zahrada');
    let r = await fetch(base + '/api/gardens', { method: 'POST', body: fd });
    const garden = await r.json();
    assert(garden.id, 'zahrada vytvořena id=' + garden.id);
    assert(garden.name === 'Testovací zahrada', 'jméno zahrady uloženo správně');

    console.log('2) Pozvi člena (bez emailu → jen odkaz)');
    const inv = await j('POST', `/api/gardens/${garden.id}/members`, { name: 'Jana Nováková', role: 'editor', origin: base });
    assert(inv.id && inv.invite_token, 'člen vytvořen, token=' + inv.invite_token);
    assert(inv.email_sent === false, 'email neodeslán (není konfigurován)');
    assert(inv.pending === true, 'člen je pending');
    assert(inv.invite_url.includes('/pozvanka/'), 'invite_url míří na /pozvanka/');

    console.log('3) Veřejný náhled pozvánky');
    const peek = await j('GET', `/api/invite/${inv.invite_token}`);
    assert(peek.garden.name === 'Testovací zahrada', 'náhled vrací jméno zahrady');
    assert(peek.member.name === 'Jana Nováková' && peek.accepted === false, 'náhled vrací člena, neaccept');

    console.log('4) Přijmi pozvánku');
    const acc = await j('POST', `/api/invite/${inv.invite_token}/accept`);
    assert(acc.member.garden_id === garden.id, 'accept vrací garden_id');
    const peek2 = await j('GET', `/api/invite/${inv.invite_token}`);
    assert(peek2.accepted === true, 'po accept je accepted=true');

    console.log('5) Vytvoř pin + úkol přiřazený členovi');
    const pfd = new FormData();
    pfd.append('garden_id', String(garden.id));
    pfd.append('name', 'Růže');
    pfd.append('x', '50'); pfd.append('y', '50'); pfd.append('plant_name', 'Růže');
    r = await fetch(base + '/api/pins', { method: 'POST', body: pfd });
    const pin = await r.json();
    assert(pin.id, 'pin vytvořen id=' + pin.id);
    const task = await j('POST', '/api/tasks', { pin_id: pin.id, title: 'Zastřihni', task_type: 'strihani', specific_date: '2026-06-01', assigned_to: inv.id });
    assert(task.assigned_to === inv.id, 'úkol přiřazen členovi');

    console.log('6) GET tasks vrací jméno řešitele');
    const all = await j('GET', '/api/tasks');
    const found = all.find((x) => x.id === task.id);
    assert(found && found.assignee_name === 'Jana Nováková', 'assignee_name=' + found?.assignee_name);
    assert(found.assignee_color, 'assignee_color=' + found.assignee_color);

    console.log('7) Splň úkol jako člen → atribuce');
    await j('POST', `/api/tasks/${task.id}/done`, { member_id: inv.id });
    const members = await j('GET', `/api/gardens/${garden.id}/members`);
    const m = members.find((x) => x.id === inv.id);
    assert(m.completed_count === 1, 'completed_count=1 po splnění');

    console.log('8) Atribuce v historii');
    const hist = await j('GET', '/api/history');
    const e1 = hist.find((x) => x.action === 'Zastřihni');
    assert(e1 && e1.member_name === 'Jana Nováková', 'historie zaznamenala member_name=' + e1?.member_name);

    console.log('9) Neplatný member_id při splnění → ignorován (NULL)');
    const t2 = await j('POST', '/api/tasks', { pin_id: pin.id, title: 'Kontrola', task_type: 'kontrola', specific_date: '2026-06-02' });
    await j('POST', `/api/tasks/${t2.id}/done`, { member_id: 99999 });
    const hist2 = await j('GET', '/api/history');
    const e2 = hist2.find((x) => x.action === 'Kontrola');
    assert(e2 && e2.member_name == null, 'neexistující člen → member_name NULL');

    console.log('10) Odeber člena → assigned_to se uvolní');
    // přiřaď ještě jeden úkol členovi
    const t3 = await j('POST', '/api/tasks', { pin_id: pin.id, title: 'Hnojení', task_type: 'hnojeni', specific_date: '2026-06-03', assigned_to: inv.id });
    await j('DELETE', `/api/gardens/${garden.id}/members/${inv.id}`);
    const after = await j('GET', `/api/gardens/${garden.id}/members`);
    assert(after.length === 0, 'člen odebrán');
    const all2 = await j('GET', '/api/tasks');
    const freed = all2.find((x) => x.id === t3.id);
    assert(freed.assigned_to == null, 'přiřazení uvolněno na NULL');
    // historie atribuce zůstává? member byl smazán → LEFT JOIN vrací NULL member_name (ok, atribuce ID zůstává v care_history)
    console.log('  ℹ atribuce v care_history zůstává jako member_id i po smazání člena');

    console.log('\nALL_TESTS_PASSED');
    srv.kill();
    setTimeout(() => { try { fs.unlinkSync(dbPath); } catch {}; process.exit(0); }, 200);
  } catch (e) {
    console.error('\nTEST ERROR:', e.message);
    srv.kill();
    setTimeout(() => { try { fs.unlinkSync(dbPath); } catch {}; process.exit(1); }, 200);
  }
})();
