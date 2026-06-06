// Spolupráce na zahradě — správa členů (rodina/přátelé).
// iOS grouped-list: vlastník + členové s avatary, rolí a statistikami;
// pozvánka přes odkaz / nativní share / email. Role: editor (může upravovat),
// viewer (jen čte). Atribuce splnění a přiřazování úkolů viz member.js.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { api } from '../api.js';
import { toast } from '../App.jsx';
import { getCurrentMember, getOwnerName } from '../member.js';
import { shareLink, isNativeShare } from '../native/share.js';

const OWNER_COLOR = '#4A6E57';

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, color, size = 40 }) {
  return (
    <span
      className="member-avatar"
      style={{ background: color || OWNER_COLOR, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export default function MembersModal({ garden, onClose }) {
  const { t } = useTranslation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState(null); // { url, email_sent }
  const current = getCurrentMember();
  const ownerName = getOwnerName() || t('members.you');

  const load = () => {
    setLoading(true);
    api
      .listMembers(garden.id)
      .then(setMembers)
      .catch((e) => toast(t('common.error', { msg: e.message })))
      .finally(() => setLoading(false));
  };
  useEffect(load, [garden.id]);

  const removeMember = async (m) => {
    if (!confirm(t('members.removeConfirm', { name: m.name }))) return;
    try {
      await api.removeMember(garden.id, m.id);
      toast(t('members.removed'));
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const toggleRole = async (m) => {
    const next = m.role === 'editor' ? 'viewer' : 'editor';
    try {
      await api.updateMember(garden.id, m.id, { role: next });
      load();
    } catch (e) {
      toast(t('common.error', { msg: e.message }));
    }
  };

  const shareInvite = async (url) => {
    try {
      const status = await shareLink({
        url,
        title: t('members.shareTitle', { garden: garden.name }),
        text: t('members.shareText', { garden: garden.name }),
      });
      if (status === 'copied') toast(t('members.linkCopied'));
      else if (status === 'shown') toast('🔗 ' + url);
    } catch {
      toast('🔗 ' + url);
    }
  };

  return (
    <Sheet title={t('members.title')} onClose={onClose}>
      <p className="small muted mb-2">{t('members.intro')}</p>

      {/* Pozvat člena */}
      {inviting ? (
        <InviteForm
          garden={garden}
          ownerName={getOwnerName()}
          onCancel={() => setInviting(false)}
          onInvited={(res) => {
            setInviting(false);
            setLastInvite({ url: res.invite_url, email_sent: res.email_sent });
            load();
          }}
        />
      ) : (
        <button type="button" className="btn member-add-btn" onClick={() => { setLastInvite(null); setInviting(true); }}>
          <Icon name="plus" size={18} stroke={2.4} />
          {t('members.invite')}
        </button>
      )}

      {/* Výsledek poslední pozvánky — odkaz ke sdílení */}
      {lastInvite && (
        <div className="member-invite-result">
          <div className="small" style={{ fontWeight: 600 }}>
            {lastInvite.email_sent ? t('members.inviteSentEmail') : t('members.inviteCreated')}
          </div>
          <div className="field mt-2">
            <input type="text" value={lastInvite.url} readOnly onFocus={(e) => e.target.select()} />
          </div>
          <button type="button" className="btn secondary small mt-2" onClick={() => shareInvite(lastInvite.url)}>
            {isNativeShare() ? t('members.shareLink') : t('members.copyLink')}
          </button>
        </div>
      )}

      {/* Roster */}
      <div className="member-list mt-3">
        {/* Vlastník */}
        <div className="member-row">
          <Avatar name={ownerName} color={OWNER_COLOR} />
          <div className="member-main">
            <div className="member-name">
              {ownerName}
              {!current && <span className="member-you">{t('members.youBadge')}</span>}
            </div>
            <div className="member-sub">{t('members.ownerRole')}</div>
          </div>
        </div>

        {loading ? (
          <div className="empty small">{t('common.loadingShort')}</div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="member-row">
              <Avatar name={m.name} color={m.color} />
              <div className="member-main">
                <div className="member-name">
                  {m.name}
                  {current?.id === m.id && <span className="member-you">{t('members.youBadge')}</span>}
                  {m.pending && <span className="member-pending">{t('members.pending')}</span>}
                </div>
                <div className="member-sub">
                  {m.email ? `${m.email} · ` : ''}
                  {m.completed_count > 0 ? t('members.doneCount', { count: m.completed_count }) : t('members.roleHint')}
                </div>
              </div>
              <div className="member-trailing">
                <button
                  type="button"
                  className={`member-role-chip ${m.role}`}
                  onClick={() => toggleRole(m)}
                  title={t('members.toggleRoleHint')}
                >
                  {m.role === 'editor' ? t('members.roleEditor') : t('members.roleViewer')}
                </button>
                <button
                  type="button"
                  className="pd-task-mini danger"
                  onClick={() => removeMember(m)}
                  aria-label={t('members.remove')}
                  title={t('members.remove')}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
        {!loading && members.length === 0 && (
          <div className="member-empty small muted">{t('members.empty')}</div>
        )}
      </div>
    </Sheet>
  );
}

function InviteForm({ garden, ownerName, onCancel, onInvited }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast(t('members.nameRequired'));
    setSaving(true);
    try {
      const res = await api.inviteMember(garden.id, {
        name: name.trim(),
        email: memberEmail.trim() || undefined,
        role,
        inviter: ownerName || undefined,
        origin: window.location.origin,
      });
      toast(t('members.invited', { name: name.trim() }));
      onInvited(res);
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="member-invite-form" onSubmit={submit}>
      <div className="field">
        <label>{t('members.fieldName')}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('members.namePlaceholder')} autoFocus />
      </div>
      <div className="field">
        <label>{t('members.fieldEmail')}</label>
        <input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder={t('members.emailPlaceholder')} />
        <div className="small muted" style={{ marginTop: 4 }}>{t('members.emailHint')}</div>
      </div>
      <div className="field">
        <label>{t('members.fieldRole')}</label>
        <div className="member-role-select">
          <button type="button" className={role === 'editor' ? 'active' : ''} onClick={() => setRole('editor')}>
            ✏️ {t('members.roleEditor')}
          </button>
          <button type="button" className={role === 'viewer' ? 'active' : ''} onClick={() => setRole('viewer')}>
            👀 {t('members.roleViewer')}
          </button>
        </div>
      </div>
      <div className="row mt-2" style={{ gap: 8 }}>
        <button type="button" className="btn ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? t('common.saving') : t('members.sendInvite')}
        </button>
      </div>
    </form>
  );
}
