// API helper functions
import { getActorMemberId } from './member.js';

const BASE = '';

async function jsonFetch(url, options = {}) {
  const res = await fetch(BASE + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API chyba');
  }
  return res.json();
}

export const api = {
  // Gardens
  listGardens: () => jsonFetch('/api/gardens'),
  createGarden: (formData) => fetch('/api/gardens', { method: 'POST', body: formData }).then(handle),
  updateGarden: (id, formData) =>
    fetch(`/api/gardens/${id}`, { method: 'PUT', body: formData }).then(handle),
  deleteGarden: (id) => jsonFetch(`/api/gardens/${id}`, { method: 'DELETE' }),
  // Nebezpečná zóna — smazat všechna zahradní data (zahrady + kaskáda)
  deleteAllData: () => jsonFetch('/api/all-data', { method: 'DELETE' }),

  // Sharing
  createShareToken: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/share`, { method: 'POST' }),
  revokeShareToken: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/share`, { method: 'DELETE' }),
  getSharedGarden: (token) => jsonFetch(`/api/share/${token}`),

  // Spolupráce — členové zahrady
  listMembers: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/members`),
  inviteMember: (gardenId, data) =>
    jsonFetch(`/api/gardens/${gardenId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateMember: (gardenId, memberId, data) =>
    jsonFetch(`/api/gardens/${gardenId}/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  removeMember: (gardenId, memberId) =>
    jsonFetch(`/api/gardens/${gardenId}/members/${memberId}`, { method: 'DELETE' }),
  getInvite: (token) => jsonFetch(`/api/invite/${token}`),
  acceptInvite: (token) => jsonFetch(`/api/invite/${token}/accept`, { method: 'POST' }),

  // Pins
  listPins: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/pins`),
  getPin: (id) => jsonFetch(`/api/pins/${id}`),
  createPin: (formData) => fetch('/api/pins', { method: 'POST', body: formData }).then(handle),
  updatePin: (id, formData) =>
    fetch(`/api/pins/${id}`, { method: 'PUT', body: formData }).then(handle),
  deletePin: (id) => jsonFetch(`/api/pins/${id}`, { method: 'DELETE' }),
  setPinPhoto: (id, dataUrl) =>
    jsonFetch(`/api/pins/${id}/photo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: dataUrl }),
    }),

  // iCal — živý kalendářní odkaz (webcal://) + jednorázový download
  gardenIcalToken: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/ical-token`),
  globalIcalToken: () => jsonFetch('/api/ical-token'),

  // Beds (záhony)
  listBeds: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/beds`),
  createBed: (data) =>
    jsonFetch('/api/beds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateBed: (id, data) =>
    jsonFetch(`/api/beds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteBed: (id) => jsonFetch(`/api/beds/${id}`, { method: 'DELETE' }),
  // BED-3: vlastní close-up fotka záhonu (volitelně)
  setBedPhoto: (id, formData) =>
    fetch(`/api/beds/${id}/photo`, { method: 'PUT', body: formData }).then(handle),
  deleteBedPhoto: (id) => jsonFetch(`/api/beds/${id}/photo`, { method: 'DELETE' }),

  // Bed plants — rostliny v záhonu (many-to-many)
  listBedPlants: (bedId) => jsonFetch(`/api/beds/${bedId}/plants`),
  addBedPlant: (bedId, data) =>
    jsonFetch(`/api/beds/${bedId}/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateBedPlant: (id, data) =>
    jsonFetch(`/api/bed-plants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  removeBedPlant: (id, { keepPin = false } = {}) =>
    jsonFetch(`/api/bed-plants/${id}?keep_pin=${keepPin ? 1 : 0}`, { method: 'DELETE' }),
  // BED-2: nastaví pozici v plánu záhonu (% v rámci bed obdélníku). null = grid.
  setBedPlantPosition: (id, { bed_x, bed_y } = {}) =>
    jsonFetch(`/api/bed-plants/${id}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bed_x, bed_y }),
    }),
  pinsInsideBed: (bedId) => jsonFetch(`/api/beds/${bedId}/pins-inside`),
  mergePinsIntoBed: (bedId, pinIds) =>
    jsonFetch(`/api/beds/${bedId}/merge-pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_ids: pinIds }),
    }),

  // Galerie fotek pinu
  listPinPhotos: (id) => jsonFetch(`/api/pins/${id}/photos`),
  uploadPinPhotos: (id, formData) =>
    fetch(`/api/pins/${id}/photos`, { method: 'POST', body: formData }).then(handle),
  deletePinPhoto: (pinId, photoId) =>
    jsonFetch(`/api/pins/${pinId}/photos/${photoId}`, { method: 'DELETE' }),
  recentPhotos: (limit = 4) => jsonFetch(`/api/photos/recent?limit=${limit}`),

  // Tasks
  listTasks: () => jsonFetch('/api/tasks'),
  todayTasks: () => jsonFetch('/api/tasks/today'),
  weekTasks: () => jsonFetch('/api/tasks/week'),
  overviewTasks: (days = 14) => jsonFetch(`/api/tasks/overview?days=${days}`),
  createTask: (data) =>
    jsonFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTask: (id, data) =>
    jsonFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTask: (id) => jsonFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
  completeTask: (id, notes) =>
    jsonFetch(`/api/tasks/${id}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, member_id: getActorMemberId() }),
    }),
  snoozeTask: (id, payload) =>
    jsonFetch(`/api/tasks/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // History (zápis vzniká serverstranně jako vedlejší efekt dokončení úkolu)
  listHistory: () => jsonFetch('/api/history'),
  // Agregovaná historie (per pin+akce → den v roce) pro adaptivní termíny (careHistory.js)
  careHistoryDoy: () => jsonFetch('/api/care-history/doy'),

  // FEAT-3: choroby/škůdci zalogované na pinu (reálný výskyt, ne katalog)
  listPinIssues: (pinId) => jsonFetch(`/api/pins/${pinId}/issues`),
  addPinIssue: (pinId, data) =>
    jsonFetch(`/api/pins/${pinId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updatePinIssue: (issueId, data) =>
    jsonFetch(`/api/pin-issues/${issueId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deletePinIssue: (issueId) =>
    jsonFetch(`/api/pin-issues/${issueId}`, { method: 'DELETE' }),

  // Harvests (sklizeň) — globální výpis se nepoužívá, UI čte per-pin
  listPinHarvests: (pinId) => jsonFetch(`/api/pins/${pinId}/harvests`),
  createHarvest: (data) =>
    jsonFetch('/api/harvests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteHarvest: (id) => jsonFetch(`/api/harvests/${id}`, { method: 'DELETE' }),

  // Search
  search: (q) => jsonFetch(`/api/search?q=${encodeURIComponent(q)}`),

  // Stats
  stats: () => jsonFetch('/api/stats'),
  streak: () => jsonFetch('/api/stats/streak'),
  seasonStats: (year) => jsonFetch(`/api/stats/season${year ? `?year=${year}` : ''}`),
  harvestStats: (year) => jsonFetch(`/api/stats/harvests${year ? `?year=${year}` : ''}`),
  yoyStats: ({ year, gardenId } = {}) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (gardenId) params.set('garden_id', gardenId);
    const qs = params.toString();
    return jsonFetch(`/api/stats/yoy${qs ? '?' + qs : ''}`);
  },

  // Weather — opts: { past_days, forecast_days } pro fenologickou teplotní anomálii (phenology.js)
  weather: (lat, lon, opts = {}) => {
    const p = new URLSearchParams({ lat, lon });
    if (opts.past_days) p.set('past_days', opts.past_days);
    if (opts.forecast_days) p.set('forecast_days', opts.forecast_days);
    return jsonFetch(`/api/weather?${p.toString()}`);
  },
  sensitivePins: () => jsonFetch('/api/pins/sensitive'),

  // Stripe
  stripeStatus: () => jsonFetch('/api/stripe/status'),
  stripeCreateCheckout: () => jsonFetch('/api/stripe/create-checkout', { method: 'POST' }),

  // Push notifications
  pushVapidKey: () => jsonFetch('/api/push/vapid-public-key'),
  pushSubscribe: (sub) =>
    jsonFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    }),
  pushUnsubscribe: (endpoint) =>
    jsonFetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }),
  // Nativní push (APNs/FCM device token z Capacitoru)
  nativePushRegister: ({ token, platform }) =>
    jsonFetch('/api/push/native-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    }),
  pushSendTest: () =>
    jsonFetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🌿 GardenPin',
        body: 'Testovací notifikace funguje 🎉',
        url: '/',
      }),
    }),

  // Email připomínky (týdenní digest)
  getEmailSettings: () => jsonFetch('/api/email-settings'),
  saveEmailSettings: (data) =>
    jsonFetch('/api/email-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  sendEmailTest: (addr) =>
    jsonFetch('/api/email-settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addr || undefined }),
    }),
  // Bez volání z UI — digest běžně spouští cron/PM2 serverstranně.
  // Wrapper ponechán pro manuální/ladící trigger (endpoint je legitimní).
  sendEmailDigest: (addr) =>
    jsonFetch('/api/email-settings/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addr || undefined }),
    }),
};

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API chyba');
  }
  return res.json();
}
