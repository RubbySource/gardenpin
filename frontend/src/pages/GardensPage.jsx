// List of gardens + create new — GardenPin design
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import NewGardenModal from '../components/NewGardenModal.jsx';
import { toast } from '../App.jsx';

export default function GardensPage() {
  const [gardens, setGardens] = useState([]);
  const [pinCounts, setPinCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      const gs = await api.listGardens();
      setGardens(gs);
      // Načti počty pinů paralelně pro každou zahradu
      const counts = await Promise.all(
        gs.map((g) => api.listPins(g.id).then((ps) => [g.id, ps.length]).catch(() => [g.id, 0])),
      );
      setPinCounts(Object.fromEntries(counts));
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="heading">
          <div className="eyebrow">🌿 GardenPin</div>
          <h1>Vaše zahrady</h1>
          <div className="subtitle">
            {gardens.length === 0
              ? 'Začněte vytvořením první zahrady'
              : `${gardens.length} ${gardens.length === 1 ? 'zahrada' : gardens.length < 5 ? 'zahrady' : 'zahrad'}`}
          </div>
        </div>
        {gardens.length > 0 && (
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Nová
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty">Načítám...</div>
      ) : gardens.length === 0 ? (
        <div className="gp-empty">
          <FlowerBedIllustration />
          <div className="gp-empty-title">Ještě žádná zahrada</div>
          <div className="gp-empty-text">
            Vyfoťte zahradu z výšky, načrtněte záhony a začněte sledovat každou rostlinu na svém místě.
          </div>
          <button className="btn-cta" onClick={() => setShowNew(true)}>
            + Přidat první zahradu
          </button>
        </div>
      ) : (
        <div className="gardens-grid">
          {gardens.map((g) => {
            const count = pinCounts[g.id] ?? 0;
            const pinLabel = count === 1 ? 'pin' : count >= 2 && count <= 4 ? 'piny' : 'pinů';
            return (
              <div
                key={g.id}
                className="garden-card-v2"
                onClick={() => nav(`/zahrada/${g.id}`)}
              >
                <div className="img-wrap">
                  {g.image_path ? <img src={g.image_path} alt={g.name} /> : <span>🌱</span>}
                </div>
                <div className="card-body">
                  <div>
                    <div className="g-name">{g.name}</div>
                    <div className="g-meta">
                      📍 {count} {pinLabel} ·{' '}
                      {new Date(g.created_at + 'Z').toLocaleDateString('cs-CZ', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.3rem', color: 'var(--text-dim)' }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewGardenModal
          onClose={() => setShowNew(false)}
          onCreated={(g) => {
            setShowNew(false);
            toast('✅ Zahrada vytvořena');
            nav(`/zahrada/${g.id}`);
          }}
        />
      )}
    </>
  );
}

function FlowerBedIllustration() {
  return (
    <svg
      viewBox="0 0 200 130"
      width="200"
      height="130"
      role="img"
      aria-label="Ilustrace záhonu"
      style={{ maxWidth: 220, height: 'auto', marginBottom: 12, display: 'block' }}
    >
      {/* Soil mound shadow */}
      <ellipse cx="100" cy="112" rx="86" ry="12" fill="#8b6f47" opacity="0.18" />
      {/* Soil */}
      <path
        d="M14 100 Q40 78 70 84 Q100 70 130 84 Q160 78 186 100 L186 110 L14 110 Z"
        fill="#6b4f2c"
      />
      <path
        d="M14 100 Q40 78 70 84 Q100 70 130 84 Q160 78 186 100"
        fill="none"
        stroke="#4a3620"
        strokeWidth="1.2"
        opacity="0.4"
      />
      {/* Grass tufts */}
      <g stroke="#4a7c3a" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M28 96 L28 86 M32 97 L32 88 M36 96 L36 84" />
        <path d="M168 95 L168 85 M172 96 L172 87 M176 95 L176 82" />
      </g>
      {/* Sunflower */}
      <g>
        <path d="M50 100 Q48 70 52 40" stroke="#3d6b2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M52 60 Q60 56 66 60 Q60 64 52 60" fill="#4a7c3a" />
        <path d="M50 78 Q42 74 36 78 Q42 82 50 78" fill="#4a7c3a" />
        <g fill="#f4b942">
          <ellipse cx="52" cy="24" rx="3.5" ry="6" />
          <ellipse cx="62" cy="30" rx="6" ry="3.5" transform="rotate(35 62 30)" />
          <ellipse cx="66" cy="40" rx="6" ry="3.5" />
          <ellipse cx="62" cy="50" rx="6" ry="3.5" transform="rotate(-35 62 50)" />
          <ellipse cx="52" cy="54" rx="3.5" ry="6" />
          <ellipse cx="42" cy="50" rx="6" ry="3.5" transform="rotate(35 42 50)" />
          <ellipse cx="38" cy="40" rx="6" ry="3.5" />
          <ellipse cx="42" cy="30" rx="6" ry="3.5" transform="rotate(-35 42 30)" />
        </g>
        <circle cx="52" cy="40" r="9" fill="#f4b942" />
        <circle cx="52" cy="40" r="5" fill="#7a5a2b" />
      </g>
      {/* Bushy plant in middle */}
      <g>
        <path d="M100 100 L100 76" stroke="#3d6b2a" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="92" cy="72" r="10" fill="#4a7c3a" />
        <circle cx="108" cy="74" r="11" fill="#5a8c45" />
        <circle cx="100" cy="62" r="11" fill="#4a7c3a" />
        <circle cx="96" cy="68" r="2.5" fill="#e85d75" />
        <circle cx="106" cy="70" r="2.5" fill="#e85d75" />
        <circle cx="100" cy="58" r="2.5" fill="#e85d75" />
      </g>
      {/* Tulip */}
      <g>
        <path d="M148 100 L148 70" stroke="#3d6b2a" strokeWidth="2" strokeLinecap="round" />
        <path d="M148 80 Q142 78 138 82 Q142 86 148 82" fill="#4a7c3a" />
        <path
          d="M141 70 Q141 56 148 54 Q155 56 155 70 Q151 66 148 68 Q145 66 141 70 Z"
          fill="#e85d75"
        />
        <path d="M148 54 Q148 64 148 70" stroke="#c2435a" strokeWidth="0.8" fill="none" />
      </g>
      {/* Daisy */}
      <g>
        <path d="M126 100 L126 86" stroke="#3d6b2a" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="122" cy="84" r="2.5" fill="#fff8e1" />
        <circle cx="130" cy="84" r="2.5" fill="#fff8e1" />
        <circle cx="126" cy="80" r="2.5" fill="#fff8e1" />
        <circle cx="126" cy="88" r="2.5" fill="#fff8e1" />
        <circle cx="126" cy="84" r="2" fill="#f4b942" />
      </g>
      {/* Sun */}
      <circle cx="172" cy="22" r="9" fill="#f4b942" opacity="0.9" />
      <g stroke="#f4b942" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
        <line x1="172" y1="6" x2="172" y2="10" />
        <line x1="172" y1="34" x2="172" y2="38" />
        <line x1="156" y1="22" x2="160" y2="22" />
        <line x1="184" y1="22" x2="188" y2="22" />
        <line x1="161" y1="11" x2="164" y2="14" />
        <line x1="180" y1="30" x2="183" y2="33" />
      </g>
    </svg>
  );
}
