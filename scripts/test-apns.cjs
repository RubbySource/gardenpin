// Smoke test pro APNs implementaci v backend/push.js.
// Bez Apple creds → ověř že sendToNative je no-op (skipped).
// S testovacím .p8 → ověř že JWT má 3 segmenty, header.alg=ES256, payload.iss=TEAM,
// podpis je 64 B (ES256 JOSE raw r||s), a že cache vrací identický token v 55min okně.
// HTTP/2 odeslání nejde reálně otestovat bez Apple sandbox accountu — to ověříme
// v produkci až dostaneme creds.
// Spuštění: node scripts/test-apns.cjs
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };

// ---------- 1) Bez creds: apnsConfigured = false, sendToNative je no-op ----
delete process.env.APNS_KEY_PATH;
delete process.env.APNS_KEY_ID;
delete process.env.APNS_TEAM_ID;
delete process.env.APNS_BUNDLE_ID;

// Reload push.js (musíme vyčistit require cache, protože dotenv mohl env nastavit)
const pushPath = require.resolve(path.join(__dirname, '..', 'backend', 'push.js'));
delete require.cache[pushPath];

// Mock db modul (push.js ho vyžaduje, ale my chceme test bez SQLite závislosti)
const mockTokens = [];
const mockSubs = [];
const dbMock = {
  prepare: (sql) => ({
    run: () => {},
    all: () => {
      if (/native_push_tokens/.test(sql)) return mockTokens;
      if (/push_subscriptions/.test(sql)) return mockSubs;
      return [];
    },
    get: () => null,
  }),
};
const dbPath = require.resolve(path.join(__dirname, '..', 'backend', 'db.js'));
delete require.cache[dbPath];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock };

// Test 1a: bez creds, žádné tokeny → return { total:0, sent:0, skipped:0 }
(async () => {
  const push = require(pushPath);
  // Bez creds, ale s tokeny → skipped == total
  mockTokens.length = 0;
  mockTokens.push({ token: 'fake-device-token-aaaa', platform: 'ios' });
  // sendToNative není přímo exportovaná, ale sendToAll ji volá. Test přes vnitřní.
  // Lepší: re-export sendToNative pro test. Místo toho testujeme sendToAll s mock subscriptions.
  // Mock listSubscriptions = [], listNativeTokens = mockTokens
  // sendToAll vrací { total: 0 + tokens.total, sent: 0 + 0, native: { total, sent:0, skipped: total } }
  const stats = await push.sendToAll({ title: 'T', body: 'B' });
  ok(stats.total === 1, `bez creds: total=1, got ${stats.total}`);
  ok(stats.sent === 0, `bez creds: sent=0, got ${stats.sent}`);
  ok(stats.native.skipped === 1, `bez creds: native.skipped=1, got ${stats.native.skipped}`);
  console.log('Test 1: bez creds → no-op OK');
})()
  .then(async () => {
    // ---------- 2) S testovacím .p8: ověř JWT strukturu ----------
    // Vygeneruj ECDSA P-256 klíč a ulož jako PKCS#8 PEM (formát .p8)
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const tmpKey = path.join(os.tmpdir(), `apns-test-${Date.now()}.p8`);
    fs.writeFileSync(tmpKey, pem);

    process.env.APNS_KEY_PATH = tmpKey;
    process.env.APNS_KEY_ID = 'TESTKEYID1';
    process.env.APNS_TEAM_ID = 'TESTTEAMID';
    process.env.APNS_BUNDLE_ID = 'cz.gardenpin.app';

    // Reload modulu, aby se zachytily nové env
    delete require.cache[pushPath];
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: dbMock };

    // K otestování buildApnsJwt potřebujeme přímý přístup — exportujeme ho z push.js.
    // (push.js po patchi tuto funkci exportuje skrz module.exports.__test.)
    const push2 = require(pushPath);
    ok(push2.__test && typeof push2.__test.buildApnsJwt === 'function', '__test hook exportován');

    const jwt = push2.__test.buildApnsJwt();
    const parts = jwt.split('.');
    ok(parts.length === 3, `JWT má 3 segmenty (got ${parts.length})`);

    const headerJson = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    ok(headerJson.alg === 'ES256', `header.alg=ES256, got ${headerJson.alg}`);
    ok(headerJson.kid === 'TESTKEYID1', `header.kid=TESTKEYID1, got ${headerJson.kid}`);
    ok(headerJson.typ === 'JWT', 'header.typ=JWT');

    const payloadJson = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    ok(payloadJson.iss === 'TESTTEAMID', `payload.iss=TESTTEAMID, got ${payloadJson.iss}`);
    ok(typeof payloadJson.iat === 'number' && payloadJson.iat > 1700000000, 'payload.iat je unix sekundy');

    const sigBytes = Buffer.from(parts[2], 'base64url');
    ok(sigBytes.length === 64, `ES256 JOSE signature = 64 B (r||s), got ${sigBytes.length}`);

    // Ověř podpis kryptograficky (verify s public key)
    const signingInput = `${parts[0]}.${parts[1]}`;
    const publicKey = crypto.createPublicKey(privateKey);
    const verified = crypto.verify(
      'SHA256',
      Buffer.from(signingInput),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      sigBytes,
    );
    ok(verified, 'JWT podpis se ověří public key');

    // Cache: 2. volání v rámci 55 min vrátí stejný token
    const jwt2 = push2.__test.buildApnsJwt();
    ok(jwt === jwt2, 'JWT cache vrací identický token v 55min okně');

    console.log('Test 2: JWT struktura + podpis + cache OK');

    // ---------- 3) Cleanup ----------
    fs.unlinkSync(tmpKey);

    console.log(`\nVšech ${passed} assertions prošlo ✅`);
  })
  .catch((e) => {
    console.error('TEST SELHAL:', e);
    process.exit(1);
  });
