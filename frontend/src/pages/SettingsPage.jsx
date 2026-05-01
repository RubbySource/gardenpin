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

  const handleExport = () => {
    window.location.href = '/api/export';
  };

  return (
    <>
      <h2 className="section-title">⚙️ Nastavení</h2>

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
            {pushBusy ? 'Přihlašuji…' : 'Povolit push notifikace'}
          </button>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>💾 Export dat</h3>
        <p className="small muted">
          Stáhnout zálohu všech zahrad, míst, úkolů a historie ve formátu JSON.
        </p>
        <button className="btn secondary" onClick={handleExport}>
          📥 Stáhnout zálohu (JSON)
        </button>
        <div style={{ marginTop: 14 }}>
          <p className="small muted" style={{ marginBottom: 8 }}>
            Exportovat všechny naplánované úkoly jako kalendářní soubor (.ics) pro import do iOS
            Kalendáře, Google Kalendáře nebo Outlooku. Každý úkol je naplánován na 8:00.
          </p>
          <button className="btn secondary" onClick={() => { window.location.href = '/api/export/ical'; }}>
            📅 Exportovat do kalendáře (.ics)
          </button>
        </div>
      </div>

      {stats && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>📊 Statistiky</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="value">{stats.gardens}</div>
              <div className="label">Zahrady</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.pins}</div>
              <div className="label">Místa</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.tasks}</div>
              <div className="label">Aktivní úkoly</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.historyCount}</div>
              <div className="label">Zápisů péče</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🌿 O aplikaci</h3>
        <p className="small">
          <strong>Zahradní tracker</strong> — jednoduchá aplikace pro zaznamenávání vaší zahrady,
          rostlin a péče o ně. Nahrajte si leteckou fotografii zahrady, přidejte piny k
          jednotlivým záhonům a sledujte, kdy co zalít, hnojit nebo sklidit.
        </p>
        <p className="small muted">Verze 1.0 · Běží lokálně · Vaše data zůstávají u vás</p>
      </div>
    </>
  );
}
