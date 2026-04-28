// GardenPin Premium — pricing & Stripe Checkout
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { toast } from '../App.jsx';

const FEATURE_LABELS = {
  unlimited_gardens: 'Neomezený počet zahrad',
  weather_location: 'Počasí pro vlastní lokaci',
  photo_upload: 'Nahrávání fotek rostlin',
  sharing: 'Sdílení zahrad s rodinou',
  push_notifications: 'Push notifikace',
};

export default function PremiumPage() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const s = await api.premiumStatus();
      setStatus(s);
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Po návratu ze Stripe checkout (success_url / cancel_url) zobrazíme toast a uklidíme query.
  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast('🌟 Premium aktivován — díky za podporu!');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('canceled') === '1') {
      toast('Platba zrušena');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleBuy = async () => {
    setBusy(true);
    try {
      // Redirectne na Stripe hosted checkout. Po úspěchu se uživatel vrátí
      // na /premium?success=1 (success_url v backendu).
      await api.checkoutPremium();
    } catch (e) {
      toast('Chyba: ' + e.message);
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Opravdu zrušit Premium a vrátit se na Free plán?')) return;
    setBusy(true);
    try {
      await api.premiumCancel();
      toast('Premium zrušen — vrácen Free plán');
      await load();
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="empty">Načítám...</div>;

  const isPremium = status?.plan === 'premium';

  return (
    <>
      <div className="row spread mb-2">
        <div>
          <button className="btn ghost small" onClick={() => nav(-1)}>
            ← Zpět
          </button>
          <h2 className="section-title" style={{ margin: '4px 0 0' }}>
            🌟 GardenPin Premium
          </h2>
        </div>
      </div>

      {isPremium && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #4a7c3a 0%, #2d5a27 100%)',
            color: '#fff',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
            🌟 Máte aktivní Premium plán
          </div>
          <div className="small" style={{ opacity: 0.9 }}>
            Děkujeme za podporu! Všechny funkce jsou odemčené.
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {/* Free plán */}
        <div
          className="card"
          style={{
            border: !isPremium ? '2px solid #4a7c3a' : '1px solid var(--border)',
            position: 'relative',
          }}
        >
          {!isPremium && (
            <div
              style={{
                position: 'absolute',
                top: -10,
                left: 12,
                background: '#4a7c3a',
                color: '#fff',
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              ✓ Aktivní
            </div>
          )}
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Free
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 4 }}>
            0 Kč
          </div>
          <div className="small muted" style={{ marginBottom: 12 }}>navždy zdarma</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem' }}>
            <li>✅ Až 3 zahrady</li>
            <li>✅ Základní databáze rostlin</li>
            <li>✅ Sezónní úkoly + iCal export</li>
            <li>✅ Mapa s piny</li>
            <li style={{ color: 'var(--text-dim)' }}>✗ Počasí pro vlastní lokaci</li>
            <li style={{ color: 'var(--text-dim)' }}>✗ Sdílení zahrad</li>
            <li style={{ color: 'var(--text-dim)' }}>✗ Push notifikace</li>
          </ul>
        </div>

        {/* Premium plán */}
        <div
          className="card"
          style={{
            border: isPremium ? '2px solid #4a7c3a' : '2px solid #d4a017',
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(212, 160, 23, 0.05), transparent)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: 12,
              background: isPremium ? '#4a7c3a' : '#d4a017',
              color: '#fff',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {isPremium ? '✓ Aktivní' : '🌟 Doporučeno'}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d4a017', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Premium
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 4 }}>
            99 Kč<span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-dim)' }}> /měsíc</span>
          </div>
          <div className="small muted" style={{ marginBottom: 12 }}>kdykoli zrušitelné</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem' }}>
            <li>✅ <strong>Neomezený počet zahrad</strong></li>
            <li>✅ Plná databáze 85+ rostlin</li>
            <li>✅ Sezónní úkoly + iCal export</li>
            <li>✅ <strong>Počasí pro vlastní lokaci</strong></li>
            <li>✅ <strong>Sdílení zahrad s rodinou</strong></li>
            <li>✅ <strong>Push notifikace</strong></li>
            <li>✅ Foto upload bez limitu</li>
            <li>✅ Prioritní podpora</li>
          </ul>
          <div style={{ marginTop: 16 }}>
            {isPremium ? (
              <button
                className="btn ghost block"
                onClick={handleCancel}
                disabled={busy}
              >
                {busy ? 'Pracuji…' : 'Zrušit Premium'}
              </button>
            ) : (
              <button
                className="btn block"
                onClick={handleBuy}
                disabled={busy}
                style={{ background: '#d4a017', borderColor: '#d4a017' }}
              >
                {busy ? 'Pracuji…' : '🌟 Koupit Premium'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="small muted">
          💳 Platby zpracovává <strong>Stripe</strong>. Po kliknutí na „Koupit Premium"
          budete přesměrováni na zabezpečený Stripe Checkout. Předplatné lze
          kdykoli zrušit.
        </div>
      </div>
    </>
  );
}
