// Stripe — Checkout pro GardenPin Premium (149 Kč/měsíc) + webhook
const express = require('express');
const db = require('../db');

const DEFAULT_USER_ID = 1; // Single-user MVP — viz db.js

let stripe = null;
function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripe = require('stripe')(key);
  return stripe;
}

const router = express.Router();

// GET /api/stripe/status — vrátí premium stav
router.get('/status', (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(DEFAULT_USER_ID);
  res.json({
    is_premium: !!(user && user.is_premium),
    configured: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID,
  });
});

// POST /api/stripe/create-checkout — vytvoří Stripe Checkout Session
router.post('/create-checkout', async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Stripe není nakonfigurován (chybí STRIPE_SECRET_KEY)' });
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return res.status(503).json({ error: 'Chybí STRIPE_PRICE_ID v .env' });

  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEFAULT_USER_ID);

  try {
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/nastaveni?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/nastaveni?checkout=cancel`,
      customer: user && user.stripe_customer_id ? user.stripe_customer_id : undefined,
      customer_email: user && !user.stripe_customer_id ? user.email : undefined,
      client_reference_id: String(DEFAULT_USER_ID),
      metadata: { user_id: String(DEFAULT_USER_ID), product: 'gardenpin_premium' },
      subscription_data: {
        metadata: { user_id: String(DEFAULT_USER_ID) },
      },
    });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/stripe/webhook — Stripe events (nasazený v server.js s express.raw)
async function webhookHandler(req, res) {
  const s = getStripe();
  if (!s) return res.status(503).send('Stripe nedostupný');
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (secret) {
      event = s.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Bez webhook_secret jen v dev — parsuje JSON přímo (raw body je Buffer)
      event = JSON.parse(req.body.toString('utf8'));
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = parseInt(session.client_reference_id || session.metadata?.user_id || DEFAULT_USER_ID, 10);
        db.prepare(
          `UPDATE users SET is_premium = 1, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?`,
        ).run(session.customer || null, session.subscription || null, userId);
        console.log(`✅ Premium aktivován pro user ${userId}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = parseInt(sub.metadata?.user_id || DEFAULT_USER_ID, 10);
        // Pokud user_id není v metadatech, zkus podle subscription_id
        const result = db
          .prepare(`UPDATE users SET is_premium = 0 WHERE id = ? OR stripe_subscription_id = ?`)
          .run(userId, sub.id);
        console.log(`⏹️ Premium zrušen (rows: ${result.changes})`);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const active = sub.status === 'active' || sub.status === 'trialing';
        db.prepare(
          `UPDATE users SET is_premium = ? WHERE stripe_subscription_id = ?`,
        ).run(active ? 1 : 0, sub.id);
        break;
      }
      default:
        // jiné events ignorujeme
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error('Webhook handler error:', e);
    res.status(500).json({ error: e.message });
  }
}

module.exports = { router, webhookHandler };
