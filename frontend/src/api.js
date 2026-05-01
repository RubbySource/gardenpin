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

  // Weather
  weather: (lat, lon) => jsonFetch(`/api/weather?lat=${lat}&lon=${lon}`),

  // Push
  pushVapidKey: () => jsonFetch('/api/push/vapid-public-key'),
  pushSubscribe: (subscription) =>
    jsonFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
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
      body: JSON.stringify({ title: '🌿 Test notifikace', body: 'Funguje to!' }),
    }),
};

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API chyba');
  }
  return res.json();
}
