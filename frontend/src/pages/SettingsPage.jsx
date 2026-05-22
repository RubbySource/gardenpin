// Settings: notifications permission, export, about
import React, { useEffect, useState } from 'react';
import { toast } from '../App.jsx';
import { requestNotificationPermission, showNotification } from '../utils.js';
import { api } from '../api.js';
import {
  isPushSupported,
  subscribePush,
  unsubscribePush,
  getCurrentSubscription,
} from '../push.js';
import PremiumBadge from '../components/PremiumBadge.jsx';

export default function SettingsPage() {
  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [reminderDays, setReminderDays] = useState(
    parseInt(localStorage.getItem('notifReminderDays') ?? '1', 10),
  );
  const [stats, setStats] = useState(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    if (pushSupported) {
      getCurrentSubscription().then((s) => setPushSubscribed(!!s)).catch(() => {});
    }
  }, [pushSupported]);

  const enablePush = async () => {
    setPushBusy(true);
    try {
      await subscribePush();
      setPushSubscribed(true);
      setNotifStatus('granted');
      toast('✅ Push notifikace aktivní');
    } catch (e) {
      toast('Chyba: ' + e.message);
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      await unsubscribePush();
      setPushSubscribed(false);
      toast('Push notifikace vypnuté');
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

  const enableNotifications = async () => {
    const r = await requestNotificationPermission();
    setNotifStatus(r);
    if (r === 'granted') {
      showNotification('🌿 Zahradní tracker', 'Notifikace jsou aktivní. Budeme vás informovat o nadcházejících úkolech.');
      toast('✅ Notifikace povoleny');
    } else if (r === 'denied') {
      toast('Notifikace zamítnuty. Povolte je v nastavení prohlížeče.');
    }
  };

  const handleReminderDays = (days) => {
    setReminderDays(days);
    localStorage.setItem('notifReminderDays', String(days));
    toast('✅ Nastavení uloženo');
  };

  const handleExport = (format) => {
    if (format === 'ical') {
      window.location.href = '/api/export/ical';
      return;
    }
    window.location.href = `/api/export?format=${format}`;
  };

  return (
    <>
      <h2 className="section-title">⚙️ Nastavení</h2>

      <PremiumBadge />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🔔 Notifikace</h3>
        <p className="small muted">
          Aplikace vás upozorní na nadcházející úkoly péče o rostliny. Notifikace se zobrazí
          jednou denně při otevření aplikace.
        </p>
        <div style={{ marginBottom: 12 }}>
          Stav:{' '}
          <span className={`badge ${notifStatus === 'granted' ? 'done' : ''}`}>
            {notifStatus === 'granted'
              ? '✅ Povoleno'
              : notifStatus === 'denied'
                ? '❌ Zamítnuto'
                : notifStatus === 'unsupported'
                  ? 'Nepodporováno'
                  : '⏸️ Nenastaveno'}
          </span>
        </div>
        {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
          <button className="btn" style={{ marginBottom: 16 }} onClick={enableNotifications}>
            Povolit notifikace
          </button>
        )}
        {notifStatus === 'granted' && (
          <div>
            <div className="small" style={{ marginBottom: 8, fontWeight: 600 }}>
              Upozornit předem:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { days: 0, label: 'Jen dnes' },
                { days: 1, label: '1 den před' },
                { days: 2, label: '2 dny před' },
                { days: 3, label: '3 dny před' },
              ].map(({ days, label }) => (
                <button
                  key={days}
                  className={`btn${reminderDays === days ? '' : ' secondary'}`}
                  style={{ fontSize: 13 }}
                  onClick={() => handleReminderDays(days)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              {reminderDays === 0
                ? 'Upozornění jen v den termínu úkolu.'
                : reminderDays === 1
                  ? 'Upozornění den před termínem i v den termínu.'
                  : `Upozornění až ${reminderDays} dny před termínem.`}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>📲 Push notifikace</h3>
        <p className="small muted">
          Push notifikace fungují i když je aplikace zavřená. Server pošle souhrn úkolů
          každý den v 8:00 ráno (pokud máte úkoly na dnes nebo zítra).
        </p>
        {!pushSupported ? (
          <div className="small muted">⚠️ Tento prohlížeč nepodporuje Web Push.</div>
        ) : pushSubscribed ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              Stav: <span className="badge done">✅ Přihlášeno</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={sendTestPush}>
                Poslat testovací push
              </button>
              <button className="btn secondary" onClick={disablePush} disabled={pushBusy}>
                {pushBusy ? '…' : 'Odhlásit push'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn" onClick={enablePush} disabled={pushBusy}>
            {pushBusy ? '…' : '📲 Přihlásit push notifikace'}
          </button>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>📤 Export dat</h3>
        <p className="small muted">
          Zálohujte si zahrady, rostliny a úkoly. JSON obsahuje úplná data včetně
          URL fotek, CSV je tabulka rostlin a úkonů pro Excel. iCal otevřete v
          kalendáři (iOS / Google).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={() => handleExport('json')}>
            📦 Záloha (JSON)
          </button>
          <button className="btn secondary" onClick={() => handleExport('csv')}>
            📊 Tabulka (CSV)
          </button>
          <button className="btn secondary" onClick={() => handleExport('ical')}>
            📅 Kalendář (iCal)
          </button>
        </div>
      </div>

      {stats && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>📊 Statistiky</h3>
          <div className="gp-stat-row">
            <div className="gp-stat">
              <span className="gp-stat-value">{stats.total ?? 0}</span>
              <span className="gp-stat-label">Úkolů celkem</span>
            </div>
            <div className="gp-stat">
              <span className="gp-stat-value">{stats.dueToday ?? 0}</span>
              <span className="gp-stat-label">Dnes</span>
            </div>
            <div className="gp-stat">
              <span className="gp-stat-value">{stats.overdue ?? 0}</span>
              <span className="gp-stat-label">Po termínu</span>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
        <div className="small" style={{ fontWeight: 600 }}>GardenPin</div>
        <div className="small">Správa zahrady v kapse</div>
      </div>
    </>
  );
}
