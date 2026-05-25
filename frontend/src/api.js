// API helper functions
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
      body: JSON.stringify({ notes }),
    }),
  snoozeTask: (id, payload) =>
    jsonFetch(`/api/tasks/${id}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // History (zápis vzniká serverstranně jako vedlejší efekt dokončení úkolu)
  listHistory: () => jsonFetch('/api/history'),

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

  // Weather
  weather: (lat, lon) => jsonFetch(`/api/weather?lat=${lat}&lon=${lon}`),
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
