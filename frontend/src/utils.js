// Utility helpers
import i18n, { localeCode } from './i18n.js';

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(localeCode(), { day: 'numeric', month: 'long', year: 'numeric' });
}

// Den + měsíc bez roku — pro kompaktní badge („18. srpna"), kde rok plyne z kontextu.
export function formatDayMonth(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(localeCode(), { day: 'numeric', month: 'long' });
}

// Den v týdnu („čtvrtek" / „Donnerstag") — pro badge „ideální den v okně" (idealDay.js).
// Skládá datum z lokálních složek, ať timezone neposune den v týdnu (cíl = střední Evropa).
export function formatWeekday(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(localeCode(), { weekday: 'long' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString(localeCode(), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Jednotné názvy měsíců přes Intl + aktivní jazyk (nahrazuje 5 natvrdo zadaných
// MONTH_NAMES_CZ polí). idx 0–11. `monthName` = celý název (kapitalizovaný),
// `monthNameShort` = krátký (3 písmena), `monthNames()` = pole 12 celých názvů.
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function monthName(idx) {
  if (idx == null || idx < 0 || idx > 11) return '';
  return capFirst(new Date(2021, idx, 1).toLocaleDateString(localeCode(), { month: 'long' }));
}

export function monthNameShort(idx) {
  if (idx == null || idx < 0 || idx > 11) return '';
  return capFirst(new Date(2021, idx, 1).toLocaleDateString(localeCode(), { month: 'short' }));
}

// Jednopísmenný label měsíce pro kompaktní grafy (nahrazuje MONTH_SHORT ['L','Ú',…]).
export function monthNameNarrow(idx) {
  if (idx == null || idx < 0 || idx > 11) return '';
  return capFirst(new Date(2021, idx, 1).toLocaleDateString(localeCode(), { month: 'narrow' }));
}

export function monthNames() {
  return Array.from({ length: 12 }, (_, i) => monthName(i));
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
  if (diff < 0) return { cls: 'overdue', text: i18n.t('common.daysOverdue', { count: Math.abs(diff) }) };
  if (diff === 0) return { cls: 'today', text: i18n.t('common.today') };
  if (diff === 1) return { cls: 'week', text: i18n.t('common.tomorrow') };
  if (diff <= 7) return { cls: 'week', text: i18n.t('common.inDays', { count: diff }) };
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
