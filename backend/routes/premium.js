// GardenPin Premium routes — real Stripe Checkout integration.
// Zatím jednouživatelská aplikace → pracujeme s users.id = 1.
//
// Required env vars (see backend/.env.example):
//   STRIPE_SECRET_KEY     — sk_live_... or sk_test_...
//   STRIPE_PUBLISHABLE_KEY — pk_live_... / pk_test_... (used by frontend if needed)
//   STRIPE_WEBHOOK_SECRET — whsec_... for verifying /webhook signatures
//   STRIPE_PRICE_ID       — price_... — recurring price for the Premium plan
//   FRONTEND_URL          — e.g. http://localhost:3000 — base for success/cancel redirects
const express = require('express');
const db = require('../db');

// Lazy-init Stripe so the server still boots without the key (e.g. in dev/CI).
// Routes that need it will return 503 if the key is missing.
let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require('stripe');
  stripe = new Stripe(key);
  return stripe;
}

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

function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
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

// POST /api/premium/checkout — vytvoří Stripe Checkout Session a vrátí URL pro redirect.
router.post('/checkout', async (req, res) => {
  const s = getStripe();
  if (!s) {
    return res.status(503).json({ error: 'Stripe není nakonfigurován (chybí STRIPE_SECRET_KEY).' });
  }
  const priceId = process.env.STRIPE_PRICE_ID; // např. price_1ABCxyz... pro 99 Kč/měsíc
  if (!priceId) {
    return res.status(503).json({ error: 'Chybí STRIPE_PRICE_ID v env.' });
  }
  const user = getDefaultUser();
  try {
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Po úspěšné platbě Stripe přesměruje sem; {CHECKOUT_SESSION_ID} doplní Stripe.
      success_url: `${frontendUrl()}/api/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl()}/api/premium/cancel`,
      customer_email: user.email || undefined,
      client_reference_id: String(user.id),
      metadata: { user_id: String(user.id) },
    });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error('Stripe checkout error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/premium/success — Stripe redirectne sem po úspěšné platbě.
// Ověříme session a aktivujeme plán (webhook to dělá také, tady pro okamžitou UX odezvu).
router.get('/success', async (req, res) => {
  const s = getStripe();
  const sessionId = req.query.session_id;
  if (s && sessionId) {
    try {
      const session = await s.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid' || session.status === 'complete') {
        const userId = Number(session.client_reference_id || session.metadata?.user_id || 1);
        db.prepare("UPDATE users SET plan = 'premium' WHERE id = ?").run(userId);
      }
    } catch (e) {
      console.error('Stripe session retrieve error:', e);
      // I když ověření selže, raději nepřepínejme — webhook stejně doplatí.
    }
  }
  // Po zpracování pošleme uživatele zpět do app na Premium stránku.
  res.redirect(`${frontendUrl()}/premium?success=1`);
});

// GET /api/premium/cancel — Stripe redirectne sem, když uživatel opustí checkout.
router.get('/cancel', (req, res) => {
  res.redirect(`${frontendUrl()}/premium?canceled=1`);
});

// POST /api/premium/cancel-subscription — pro testování downgrade zpět na free.
// (Skutečné rušení subscription přes Stripe by šlo přes Customer Portal.)
router.post('/cancel-subscription', (req, res) => {
  db.prepare("UPDATE users SET plan = 'free' WHERE id = 1").run();
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  res.json({ ok: true, plan: user.plan, features: featuresForPlan(user.plan) });
});

// POST /api/premium/webhook — Stripe webhook handler.
// POZOR: musí dostat raw body (Buffer), ne parsed JSON — v server.js je pro tuto cestu
// nasazen express.raw({ type: 'application/json' }) PŘED globálním express.json().
router.post('/webhook', (req, res) => {
  const s = getStripe();
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) {
    return res.status(503).send('Stripe webhook not configured');
  }
  let event;
  try {
    event = s.webhooks.constructEvent(req.body, sig, secret);
  } catch (e) {
    console.error('Stripe webhook signature verification failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = Number(session.client_reference_id || session.metadata?.user_id || 1);
      db.prepare("UPDATE users SET plan = 'premium' WHERE id = ?").run(userId);
    }
    // Případně další eventy: customer.subscription.deleted → downgrade na free.
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const userId = Number(sub.metadata?.user_id || 1);
      db.prepare("UPDATE users SET plan = 'free' WHERE id = ?").run(userId);
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
    return res.status(500).send('Handler error');
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.PREMIUM_FEATURES = PREMIUM_FEATURES;
