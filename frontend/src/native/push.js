// Nativní push — na iOS/Android nelze použít Web Push (service worker push
// nefunguje ve WKWebView), proto @capacitor/push-notifications: vyžádá
// oprávnění, zaregistruje se u APNs/FCM, token pošle na backend a tapnutí na
// notifikaci přesměruje do appky. Na webu jsou tyto funkce no-op (push.js
// drží web větev).
//
// POZN.: Reálné doručení vyžaduje APNs konfiguraci na backendu (Apple Push key
// .p8 + key id + team id) — viz docs/IOS_BUILD.md. Klient je hotový a tokeny se
// ukládají; jakmile budou APNs creds, doručování se zapne bez změny klienta.
import { Capacitor } from '@capacitor/core';
import { api } from '../api.js';

const native = () => Capacitor.isNativePlatform();

export function isNativePush() {
  return native() && Capacitor.isPluginAvailable('PushNotifications');
}

let listenersWired = false;

async function plugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

// Vrátí true, pokud má uživatel udělené oprávnění (pro počáteční stav přepínače).
export async function nativePushGranted() {
  if (!isNativePush()) return false;
  try {
    const PushNotifications = await plugin();
    const perm = await PushNotifications.checkPermissions();
    return perm.receive === 'granted';
  } catch {
    return false;
  }
}

// Vyžádá oprávnění, zaregistruje token a nasměruje tap → in-app navigaci.
// Vrací true při úspěšném povolení, jinak vyhodí/false (caller ukáže toast).
export async function enableNativePush() {
  if (!isNativePush()) return false;
  const PushNotifications = await plugin();

  let status = (await PushNotifications.checkPermissions()).receive;
  if (status === 'prompt' || status === 'prompt-with-rationale') {
    status = (await PushNotifications.requestPermissions()).receive;
  }
  if (status !== 'granted') return false;

  if (!listenersWired) {
    listenersWired = true;
    await PushNotifications.addListener('registration', (token) => {
      api
        .nativePushRegister({ token: token.value, platform: Capacitor.getPlatform() })
        .catch(() => {});
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] native registration error', err);
    });
    // Tap na notifikaci → otevři odpovídající obrazovku (data.url z payloadu).
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action?.notification?.data?.url;
      if (url) window.location.assign(url);
    });
  }

  await PushNotifications.register();
  return true;
}

// Vypnutí — odhlásíme listenery; neplatné tokeny backend pročistí při dalším
// pokusu o doručení (stejně jako u web push 410/404).
export async function disableNativePush() {
  if (!isNativePush()) return;
  try {
    const PushNotifications = await plugin();
    await PushNotifications.removeAllListeners();
  } catch {
    /* ignoruj */
  }
  listenersWired = false;
}
