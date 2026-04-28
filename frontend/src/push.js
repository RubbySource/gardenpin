// Service worker registration + Web Push subscription helper
import { api } from './api.js';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  // Pouze pokud uživatel již povolil notifikace (nebudeme spamovat permission promptem)
  if (Notification.permission !== 'granted') return null;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration('/sw.js')) ||
      (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;

    const { key: vapidKey } = await api.pushVapidKey();
    if (!vapidKey) return null;

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    await api.pushSubscribe(sub.toJSON ? sub.toJSON() : sub);
    return sub;
  } catch (e) {
    console.warn('Push registrace selhala', e);
    return null;
  }
}
