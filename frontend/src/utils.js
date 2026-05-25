// Utility helpers
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

export function dueBadge(dateStr) {
  const diff = daysFromToday(dateStr);
  if (diff === null) return null;
  if (diff < 0) return { cls: 'overdue', text: `${Math.abs(diff)} dní po termínu` };
  if (diff === 0) return { cls: 'today', text: 'Dnes' };
  if (diff === 1) return { cls: 'week', text: 'Zítra' };
  if (diff <= 7) return { cls: 'week', text: `Za ${diff} dní` };
  return { cls: 'done', text: formatDate(dateStr) };
}

// Taxonomie typů úkonů žije v jednom zdroji pravdy — data/taskTypes.js.
// Re-export zachovává zpětně kompatibilní importy `from './utils.js'`.
export { TASK_TYPES, taskIcon, taskLabel, taskIconName, taskTypeFromEmoji } from './data/taskTypes.js';

// Request browser notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

// Show a native browser notification
export function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/leaf.png', silent: false });
    } catch (e) {
      console.warn('Notifikace selhala', e);
    }
  }
}
