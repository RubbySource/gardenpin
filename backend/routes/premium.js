// GardenPin Premium routes — mock Stripe (zatím bez skutečného Stripe).
// Zatím jednouživatelská aplikace → pracujeme s users.id = 1.
const express = require('express');
const db = require('../db');

const router = express.Router();

const PREMIUM_FEATURES = [
  'unlimited_gardens',
  'weather_location',
  'photo_upload',
  'sharing',
  'push_notifications',
];

const FREE_FEATURES = ['photo_upload']; // upload fotek je dostupný i ve free plánu

function getDefaultUser() {
  let user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  if (!user) {
    db.prepare("INSERT INTO users (id, email, plan) VALUES (1, NULL, 'free')").run();
    user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  }
  return user;
}

function featuresForPlan(plan) {
  return plan === 'premium' ? PREMIUM_FEATURES : FREE_FEATURES;
}

// GET /api/premium/status — aktuální plán + dostupné funkce
router.get('/status', (req, res) => {
  const user = getDefaultUser();
  res.json({
    plan: user.plan,
    features: featuresForPlan(user.plan),
    allFeatures: PREMIUM_FEATURES,
    email: user.email,
  });
});

// POST /api/premium/checkout — fake Stripe checkout (zatím bez skutečné integrace)
router.post('/checkout', (req, res) => {
  // Skutečný Stripe by zde vracel HTTPS URL na hosted checkout.
  // Mock: vrátíme lokální URL, kterou frontend může otevřít a po návratu
  // zavolat /success endpoint.
  res.json({
    checkoutUrl: '/premium/success?mock=true',
    mock: true,
    note: 'Stripe není zatím připojený — toto je placeholder.',
  });
});

// GET /api/premium/success — aktivuje plán premium pro default usera.
// V produkci by sem směřoval Stripe webhook nebo redirect ze success_url.
router.get('/success', (req, res) => {
  db.prepare("UPDATE users SET plan = 'premium' WHERE id = 1").run();
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  res.json({
    ok: true,
    plan: user.plan,
    features: featuresForPlan(user.plan),
    mock: req.query.mock === 'true',
  });
});

// POST /api/premium/cancel — pro testování downgrade zpět na free
router.post('/cancel', (req, res) => {
  db.prepare("UPDATE users SET plan = 'free' WHERE id = 1").run();
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  res.json({ ok: true, plan: user.plan, features: featuresForPlan(user.plan) });
});

module.exports = router;
module.exports.PREMIUM_FEATURES = PREMIUM_FEATURES;
