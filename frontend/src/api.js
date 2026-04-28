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

  // Pins
  listPins: (gardenId) => jsonFetch(`/api/gardens/${gardenId}/pins`),
  getPin: (id) => jsonFetch(`/api/pins/${id}`),
  createPin: (formData) => fetch('/api/pins', { method: 'POST', body: formData }).then(handle),
  updatePin: (id, formData) =>
    fetch(`/api/pins/${id}`, { method: 'PUT', body: formData }).then(handle),
  deletePin: (id) => jsonFetch(`/api/pins/${id}`, { method: 'DELETE' }),
  uploadPinPhoto: (id, formData) =>
    fetch(`/api/pins/${id}/photo`, { method: 'POST', body: formData }).then(handle),

  // Tasks
  listTasks: () => jsonFetch('/api/tasks'),
  todayTasks: () => jsonFetch('/api/tasks/today'),
  weekTasks: () => jsonFetch('/api/tasks/week'),
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

  // History
  listHistory: () => jsonFetch('/api/history'),
  addHistory: (data) =>
    jsonFetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Stats
  stats: () => jsonFetch('/api/stats'),

  // Premium (Stripe Checkout)
  premiumStatus: () => jsonFetch('/api/premium/status'),
  // Vytvoří Stripe Checkout Session a přesměruje uživatele na hosted checkout.
  // Backend vrací { url } — tady jen redirectneme.
  checkoutPremium: async () => {
    const { url } = await jsonFetch('/api/premium/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!url) throw new Error('Stripe nevrátil checkout URL');
    window.location.href = url;
  },
  premiumCancel: () =>
    jsonFetch('/api/premium/cancel-subscription', { method: 'POST' }),

  // Push notifications
  pushVapidKey: () => jsonFetch('/api/push/vapid-public-key'),
  pushSubscribe: (subscription) =>
    jsonFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    }),
  pushUnsubscribe: (subscription) =>
    jsonFetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    }),

  // Sdílení
  shareGarden: (id) =>
    jsonFetch(`/api/gardens/${id}/share`, { method: 'POST' }),
  getSharedGarden: (token) => jsonFetch(`/api/share/${token}`),
};

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API chyba');
  }
  return res.json();
}
