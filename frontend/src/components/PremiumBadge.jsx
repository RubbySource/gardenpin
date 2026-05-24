// GardenPin Premium — badge + upgrade tlačítko
import React, { useEffect, useState } from 'react';
import { toast } from '../App.jsx';
import { api } from '../api.js';

export default function PremiumBadge() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.stripeStatus().then(setStatus).catch(() => setStatus({ is_premium: false, configured: false }));

  useEffect(() => {
    load();
    // Po návratu z checkoutu si načti znovu — webhook už mohl proběhnout
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast('🎉 Vítej v GardenPin Premium!');
      // Krátké zpoždění, aby webhook stihl doběhnout
      setTimeout(load, 1500);
      // Vyčisti URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancel') {
      toast('Platba zrušena');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleUpgrade = async () => {
    setBusy(true);
    try {
      const { url } = await api.stripeCreateCheckout();
      if (url) window.location.href = url;
      else toast('Chyba: chybí URL z Stripe');
    } catch (e) {
      toast('Chyba: ' + e.message);
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>⭐ Premium</h3>
        <div className="small muted">Načítám…</div>
      </div>
    );
  }

  if (status.is_premium) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #f6b73c' }}>
        <h3 style={{ marginTop: 0 }}>
          ⭐ GardenPin Premium <span className="badge done">Premium ✓</span>
        </h3>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Děkujeme za podporu! Premium je aktivní.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #f6b73c' }}>
      <h3 style={{ marginTop: 0 }}>⭐ GardenPin Premium</h3>
      <p className="small muted">
        Odemkni pokročilé funkce a podpoř vývoj aplikace.
      </p>
      <ul className="small" style={{ marginTop: 8, marginBottom: 12, paddingLeft: 18 }}>
        <li>Neomezeně zahrad a pinů</li>
        <li>Pokročilé statistiky a analýzy</li>
        <li>Push notifikace s AI tipy</li>
        <li>Prioritní podpora</li>
      </ul>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>149 Kč/měsíc</div>
      {!status.configured && (
        <div className="small muted" style={{ marginBottom: 8, color: '#c44' }}>
          ⚠️ Stripe není zkonfigurován (chybí STRIPE_SECRET_KEY nebo STRIPE_PRICE_ID v .env)
        </div>
      )}
      <button
        className="btn"
        onClick={handleUpgrade}
        disabled={busy || !status.configured}
        style={{ background: '#f6b73c', color: '#222', borderColor: '#e0a020' }}
      >
        {busy ? 'Přesměrovávám…' : '⭐ Upgrade na Premium'}
      </button>
    </div>
  );
}
