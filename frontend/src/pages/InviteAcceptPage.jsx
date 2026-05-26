// Přijetí pozvánky ke spolupráci na zahradě — veřejná stránka (bez topbaru/nav).
// Po přijetí si prohlížeč uloží identitu člena (member.js) a přesměruje do zahrady.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { setCurrentMember } from '../member.js';

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InviteAcceptPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getInvite(token)
      .then((d) => { if (!cancelled) setInfo(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await api.acceptInvite(token);
      setCurrentMember(res.member);
      // Přesměruj do hlavní aplikace na detail zahrady.
      nav(res.garden?.id ? `/zahrada/${res.garden.id}` : '/');
    } catch (e) {
      setError(e.message);
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="shared-app">
        <main className="main shared-page">
          <div className="empty">🌱 {t('common.loadingShort')}</div>
        </main>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="shared-app">
        <main className="main shared-page">
          <div className="shared-header"><h1>🌿 GardenPin</h1></div>
          <div className="card empty">
            <div className="icon">🔒</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('invite.invalidTitle')}</div>
            <div className="small muted">{error || t('invite.invalidText')}</div>
          </div>
        </main>
      </div>
    );
  }

  const { garden, member, accepted } = info;
  const roleLabel = member.role === 'viewer' ? t('members.roleViewer') : t('members.roleEditor');

  return (
    <div className="shared-app">
      <main className="main shared-page">
        <div className="shared-header"><h1>🌿 GardenPin</h1></div>
        <div className="card invite-card">
          <span
            className="member-avatar invite-avatar"
            style={{ background: member.color || '#4A6E57' }}
            aria-hidden="true"
          >
            {initials(member.name)}
          </span>
          <h2 className="invite-garden">{garden?.name || t('invite.aGarden')}</h2>
          <p className="invite-text">
            {t('invite.lead', { name: member.name, role: roleLabel })}
          </p>
          {accepted ? (
            <>
              <div className="invite-accepted small">{t('invite.alreadyAccepted')}</div>
              <button type="button" className="btn mt-2" onClick={accept} disabled={accepting}>
                {t('invite.continue')}
              </button>
            </>
          ) : (
            <button type="button" className="btn mt-2" onClick={accept} disabled={accepting}>
              {accepting ? t('common.loadingShort') : t('invite.accept')}
            </button>
          )}
          <p className="small muted mt-3">{t('invite.note')}</p>
        </div>
      </main>
    </div>
  );
}
