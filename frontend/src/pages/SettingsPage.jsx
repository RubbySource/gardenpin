// Settings — iOS grouped list: účet, vzhled, notifikace, kalendář, data, nebezpečná zóna
import React, { useEffect, useState } from 'react';
import { toast } from '../App.jsx';
import { requestNotificationPermission } from '../utils.js';
import { api } from '../api.js';
import {
  isPushSupported,
  subscribePush,
  unsubscribePush,
  getCurrentSubscription,
} from '../push.js';
import OnboardingFlow, { resetOnboardingFlow } from '../components/OnboardingFlow.jsx';
import { getStoredTheme, applyTheme } from '../components/ThemeToggle.jsx';

const USER_NAME_KEY = 'gardenpin.userName';

// Malá ikona v zaobleném barevném čtverci (iOS row icon)
function RowIcon({ color, children }) {
  return (
    <span className="settings-row-icon" style={{ background: color }}>
      {children}
    </span>
  );
}

export default function SettingsPage() {
  // — Téma —
  const [theme, setTheme] = useState(() => getStoredTheme());
  useEffect(() => { applyTheme(theme); }, [theme]);

  // — Účet / Premium —
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_NAME_KEY) || '');
  const [premium, setPremium] = useState(null);
  const [premiumBusy, setPremiumBusy] = useState(false);

  // — Notifikace —
  const pushSupported = isPushSupported();
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [reminderDays, setReminderDays] = useState(
    parseInt(localStorage.getItem('notifReminderDays') ?? '1', 10),
  );

  // — Email digest —
  const [emailAddr, setEmailAddr] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);

  // — Kalendář —
  const [globalIcalToken, setGlobalIcalToken] = useState(null);

  // — Ostatní —
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    api.globalIcalToken().then((r) => setGlobalIcalToken(r.token)).catch(() => {});
    if (pushSupported) {
      getCurrentSubscription().then((s) => setPushSubscribed(!!s)).catch(() => {});
    }
    api.getEmailSettings().then((s) => {
      setEmailAddr(s.email || '');
      setEmailEnabled(!!s.enabled);
      setEmailConfigured(s.configured !== false);
    }).catch(() => {});

    // Premium + návrat z Stripe checkoutu
    const loadPremium = () =>
      api.stripeStatus().then(setPremium).catch(() => setPremium({ is_premium: false, configured: false }));
    loadPremium();
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast('🎉 Vítej v GardenPin Premium!');
      setTimeout(loadPremium, 1500);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancel') {
      toast('Platba zrušena');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [pushSupported]);

  // ---------- Handlers ----------
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleName = (v) => {
    setUserName(v);
    const t = v.trim();
    if (t) localStorage.setItem(USER_NAME_KEY, t);
    else localStorage.removeItem(USER_NAME_KEY);
  };

  const handleUpgrade = async () => {
    setPremiumBusy(true);
    try {
      const { url } = await api.stripeCreateCheckout();
      if (url) window.location.href = url;
      else toast('Chyba: chybí URL z Stripe');
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setPremiumBusy(false);
    }
  };

  const togglePush = async () => {
    // Bez podpory push spadni na žádost o lokální oprávnění
    if (!pushSupported) {
      const r = await requestNotificationPermission();
      setNotifStatus(r);
      if (r === 'granted') toast('✅ Notifikace povoleny');
      else if (r === 'denied') toast('Notifikace zamítnuty. Povol je v nastavení prohlížeče.');
      return;
    }
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribePush();
        setPushSubscribed(false);
        toast('Push notifikace vypnuté');
      } else {
        await subscribePush();
        setPushSubscribed(true);
        setNotifStatus('granted');
        toast('✅ Push notifikace aktivní');
      }
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestPush = async () => {
    try {
      const r = await api.pushSendTest();
      toast(`Odesláno: ${r.sent}/${r.total}`);
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
  };

  const handleReminderDays = (days) => {
    setReminderDays(days);
    localStorage.setItem('notifReminderDays', String(days));
    toast('✅ Uloženo');
  };

  const saveEmailSettings = async (overrides = {}) => {
    setEmailBusy(true);
    try {
      const payload = {
        email: overrides.email !== undefined ? overrides.email : emailAddr,
        enabled: overrides.enabled !== undefined ? overrides.enabled : emailEnabled,
      };
      const r = await api.saveEmailSettings(payload);
      setEmailAddr(r.email || '');
      setEmailEnabled(!!r.enabled);
      setEmailDirty(false);
      toast('✅ Nastavení uloženo');
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const toggleEmailEnabled = async () => {
    const next = !emailEnabled;
    if (next && !emailAddr.trim()) {
      toast('Nejdřív zadej emailovou adresu');
      return;
    }
    setEmailEnabled(next);
    await saveEmailSettings({ enabled: next });
  };

  const handleTestEmail = async () => {
    if (!emailAddr.trim()) {
      toast('Nejdřív zadej emailovou adresu');
      return;
    }
    setEmailBusy(true);
    try {
      await api.sendEmailTest(emailAddr.trim());
      toast('📧 Testovací email odeslán');
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const handleExport = (format) => {
    if (format === 'ical') window.location.href = '/api/export/ical';
    else window.location.href = `/api/export?format=${format}`;
  };

  const handleResetApp = () => {
    if (!window.confirm(
      'Resetovat aplikaci? Vymaže místní nastavení (téma, jméno, onboarding) na tomto ' +
      'zařízení. Tvoje zahrady, rostliny a úkoly zůstanou nedotčené.',
    )) return;
    ['gardenpin.theme', 'gardenpin.userName', 'gp_onboarded', 'notifReminderDays'].forEach(
      (k) => localStorage.removeItem(k),
    );
    toast('Aplikace resetována');
    setTimeout(() => window.location.reload(), 700);
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm(
      'Opravdu smazat VŠECHNA data? Nevratně se smažou všechny zahrady, rostliny, úkoly, ' +
      'fotky i historie péče. Tuto akci nelze vrátit zpět.',
    )) return;
    const typed = window.prompt('Pro potvrzení napiš velkými písmeny: SMAZAT');
    if (typed !== 'SMAZAT') {
      toast('Zrušeno');
      return;
    }
    setWiping(true);
    try {
      const r = await api.deleteAllData();
      toast(`Smazáno ${r.gardensDeleted ?? 0} zahrad a vše s nimi`);
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast('Chyba: ' + e.message);
      setWiping(false);
    }
  };

  const isDark = theme === 'dark';
  const pushOn = pushSupported ? pushSubscribed : notifStatus === 'granted';
  const displayName = userName.trim() || 'Zahradník';
  const accountSub = premium?.is_premium
    ? 'GardenPin Premium'
    : emailAddr.trim() || 'Bezplatná verze';
  const reminderOpts = [
    { days: 0, label: 'Jen dnes' },
    { days: 1, label: '1 den' },
    { days: 2, label: '2 dny' },
    { days: 3, label: '3 dny' },
  ];
  const icalUrl = globalIcalToken
    ? `${window.location.origin}/api/calendar.ics?token=${globalIcalToken}`
    : '';

  return (
    <div className="settings-page">
      <h1 className="ios-large-title">Nastavení</h1>

      {/* ── Účet hero ── */}
      <div className="settings-account">
        <div className="settings-account-avatar">🌿</div>
        <div className="settings-account-info">
          <div className="settings-account-name">{displayName}</div>
          <div className="settings-account-sub">{accountSub}</div>
        </div>
        {premium?.is_premium && <span className="settings-premium-pill">PREMIUM</span>}
      </div>

      {/* ── ÚČET ── */}
      <div className="settings-group">
        <div className="settings-group-label">Účet</div>
        <div className="settings-group-card">
          <div className="settings-row">
            <RowIcon color="#5F8C6E">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
            </RowIcon>
            <span className="settings-row-label">Tvoje jméno</span>
          </div>
          <div className="settings-subrow">
            <input
              type="text"
              value={userName}
              onChange={(e) => handleName(e.target.value)}
              placeholder="Jak ti máme říkat?"
              maxLength={40}
            />
          </div>

          <div className="settings-sep" />

          {premium === null ? (
            <div className="settings-row">
              <RowIcon color="#FF9500">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.5 7 .6-5.3 4.6 1.6 6.9L12 17l-6.9 3.6 1.6-6.9L1.4 9.1l7-.6L12 2z" /></svg>
              </RowIcon>
              <span className="settings-row-label">Premium</span>
              <span className="settings-row-value">Načítám…</span>
            </div>
          ) : premium.is_premium ? (
            <div className="settings-row">
              <RowIcon color="#34C759">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.5 7 .6-5.3 4.6 1.6 6.9L12 17l-6.9 3.6 1.6-6.9L1.4 9.1l7-.6L12 2z" /></svg>
              </RowIcon>
              <span className="settings-row-label">GardenPin Premium</span>
              <span className="settings-row-value" style={{ color: 'var(--ios-green)', fontWeight: 600 }}>Aktivní ✓</span>
            </div>
          ) : (
            <button
              className="settings-row"
              onClick={handleUpgrade}
              disabled={premiumBusy || !premium.configured}
            >
              <RowIcon color="#FF9500">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.5 7 .6-5.3 4.6 1.6 6.9L12 17l-6.9 3.6 1.6-6.9L1.4 9.1l7-.6L12 2z" /></svg>
              </RowIcon>
              <span className="settings-row-label">Upgrade na Premium</span>
              <span className="settings-row-value">{premium.configured ? '149 Kč/měs' : 'nedostupné'}</span>
              {premium.configured && <span className="settings-row-chevron">›</span>}
            </button>
          )}
        </div>
        <div className="settings-group-foot">
          Jméno se objeví v pozdravu na úvodní obrazovce. Uloží se jen v tomto zařízení.
        </div>
      </div>

      {/* ── VZHLED ── */}
      <div className="settings-group">
        <div className="settings-group-label">Vzhled</div>
        <div className="settings-group-card">
          <div className="settings-row">
            <RowIcon color="#5E5CE6">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
            </RowIcon>
            <span className="settings-row-label">Tmavý režim</span>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label="Přepnout tmavý režim"
              className={`ios-switch ${isDark ? 'on' : ''}`}
              onClick={toggleTheme}
            >
              <span className="ios-switch-knob" />
            </button>
          </div>
        </div>
        <div className="settings-group-foot">Přepni světlý a tmavý motiv aplikace.</div>
      </div>

      {/* ── NOTIFIKACE ── */}
      <div className="settings-group">
        <div className="settings-group-label">Notifikace</div>
        <div className="settings-group-card">
          {/* Push */}
          <div className="settings-row">
            <RowIcon color="#FF3B30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
            </RowIcon>
            <span className="settings-row-label">Push notifikace</span>
            {typeof Notification === 'undefined' ? (
              <span className="settings-row-value">Nepodporováno</span>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={pushOn}
                aria-label="Přepnout push notifikace"
                className={`ios-switch ${pushOn ? 'on' : ''}`}
                onClick={togglePush}
                disabled={pushBusy}
              >
                <span className="ios-switch-knob" />
              </button>
            )}
          </div>
          {pushSupported && pushSubscribed && (
            <div className="settings-subrow">
              <div className="settings-chip-row">
                <button className="settings-chip" onClick={sendTestPush}>📲 Poslat testovací push</button>
              </div>
            </div>
          )}

          <div className="settings-sep" />

          {/* Lead time */}
          <div className="settings-row">
            <RowIcon color="#FF9500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
            </RowIcon>
            <span className="settings-row-label">Upozornit předem</span>
          </div>
          <div className="settings-subrow">
            <div className="settings-chip-row">
              {reminderOpts.map(({ days, label }) => (
                <button
                  key={days}
                  className={`settings-chip ${reminderDays === days ? 'active' : ''}`}
                  onClick={() => handleReminderDays(days)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-sep" />

          {/* Email digest */}
          <div className="settings-row">
            <RowIcon color="#34C759">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </RowIcon>
            <span className="settings-row-label">Týdenní email digest</span>
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Přepnout týdenní email"
              className={`ios-switch ${emailEnabled ? 'on' : ''}`}
              onClick={toggleEmailEnabled}
              disabled={emailBusy}
            >
              <span className="ios-switch-knob" />
            </button>
          </div>
          <div className="settings-subrow">
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              value={emailAddr}
              onChange={(e) => { setEmailAddr(e.target.value); setEmailDirty(true); }}
              placeholder="ty@example.cz"
            />
            {!emailConfigured && (
              <div className="settings-group-foot" style={{ padding: '8px 0 0' }}>
                ⚠️ SMTP zatím nemá přihlašovací údaje (<code>GMAIL_FROM</code> / <code>GMAIL_APP_PASSWORD</code>).
                Adresu lze uložit, emaily se zatím neodešlou.
              </div>
            )}
            <div className="settings-mini-actions">
              {emailDirty && (
                <button className="settings-chip active" onClick={() => saveEmailSettings()} disabled={emailBusy}>
                  {emailBusy ? '…' : 'Uložit email'}
                </button>
              )}
              <button className="settings-chip" onClick={handleTestEmail} disabled={emailBusy || !emailAddr.trim()}>
                {emailBusy ? '…' : '📨 Testovací email'}
              </button>
            </div>
          </div>
        </div>
        <div className="settings-group-foot">
          Souhrn úkolů. Push dorazí i bez otevřené aplikace, email každé pondělí v 8:00.
        </div>
      </div>

      {/* ── KALENDÁŘ ── */}
      <div className="settings-group">
        <div className="settings-group-label">Kalendář</div>
        <div className="settings-group-card">
          {globalIcalToken ? (
            <>
              <a className="settings-row" href={`webcal://${window.location.host}/api/calendar.ics?token=${globalIcalToken}`}>
                <RowIcon color="#0A84FF">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
                </RowIcon>
                <span className="settings-row-label">Přidat do iOS Kalendáře</span>
                <span className="settings-row-chevron">›</span>
              </a>
              <div className="settings-sep" />
              <a className="settings-row" href={`/api/calendar.ics?token=${globalIcalToken}&download=1`}>
                <RowIcon color="#5856D6">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
                </RowIcon>
                <span className="settings-row-label">Stáhnout .ics soubor</span>
                <span className="settings-row-chevron">›</span>
              </a>
              <div className="settings-sep" />
              <div className="settings-subrow" style={{ paddingTop: 12 }}>
                <div className="settings-group-foot" style={{ padding: '0 0 6px' }}>URL pro Google Kalendář</div>
                <input
                  type="text"
                  value={icalUrl}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  style={{ fontSize: '0.78rem' }}
                />
              </div>
            </>
          ) : (
            <div className="settings-row"><span className="settings-row-value">Načítám token…</span></div>
          )}
        </div>
        <div className="settings-group-foot">
          Živý odběr sezónních úkonů, výsadby, řezu a sklizně ze všech zahrad (refresh 1×/den).
        </div>
      </div>

      {/* ── DATA & ZÁLOHY ── */}
      <div className="settings-group">
        <div className="settings-group-label">Data &amp; zálohy</div>
        <div className="settings-group-card">
          <div className="settings-row">
            <RowIcon color="#0A84FF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
            </RowIcon>
            <span className="settings-row-label">Export dat</span>
          </div>
          <div className="settings-subrow">
            <div className="settings-chip-row">
              <button className="settings-chip" onClick={() => handleExport('json')}>📦 JSON</button>
              <button className="settings-chip" onClick={() => handleExport('csv')}>📊 CSV</button>
              <button className="settings-chip" onClick={() => handleExport('ical')}>📅 iCal</button>
            </div>
          </div>

          <div className="settings-sep" />

          <button
            className="settings-row"
            onClick={() => { resetOnboardingFlow(); setShowOnboarding(true); }}
          >
            <RowIcon color="#AF52DE">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0-8-8" /><path d="m4 12-2 2m2-2 2 2" /></svg>
            </RowIcon>
            <span className="settings-row-label">Spustit průvodce znovu</span>
            <span className="settings-row-chevron">›</span>
          </button>
        </div>
      </div>

      {/* ── NEBEZPEČNÁ ZÓNA ── */}
      <div className="settings-group">
        <div className="settings-group-label danger">Nebezpečná zóna</div>
        <div className="settings-group-card">
          <button className="settings-row" onClick={handleResetApp}>
            <RowIcon color="#FF9500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 1 3 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
            </RowIcon>
            <span className="settings-row-label danger">Resetovat aplikaci</span>
          </button>
          <div className="settings-sep" />
          <button className="settings-row" onClick={handleDeleteAllData} disabled={wiping}>
            <RowIcon color="#FF3B30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            </RowIcon>
            <span className="settings-row-label danger">{wiping ? 'Mažu…' : 'Smazat všechna data'}</span>
          </button>
        </div>
        <div className="settings-group-foot">
          Reset vyčistí jen místní nastavení. Smazání dat je nevratné — nejdřív si zazálohuj přes Export.
        </div>
      </div>

      {/* ── Patička ── */}
      <div className="settings-foot-brand">
        <div className="name">📍 GardenPin</div>
        <div className="claim">Správa zahrady v kapse · verze 1.0</div>
      </div>

      {showOnboarding && <OnboardingFlow onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}
