// Klient pro Web Push subscription — registrace SW, subscribe, unsubscribe
import { api } from './api.js';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush() {
  if (!isPushSupported()) throw new Error('Push není v tomto prohlížeči podporován');

  // 1) Notification permission
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifikace zamítnuty');

  // 2) Service worker
  const reg =
    (await navigator.serviceWorker.getRegistration('/sw.js')) ||
    (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;

  // 3) Existující subscription? Pokud ano, vrať.
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api.pushVapidKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // 4) Pošli na backend
  await api.pushSubscribe(sub.toJSON());
  return sub;
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  try {
    await api.pushUnsubscribe(sub.endpoint);
  } catch {}
  await sub.unsubscribe();
}
