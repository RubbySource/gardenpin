# 🌿 Zahradní tracker

Webová aplikace pro správu vaší zahrady — nahrávejte letecké fotografie, označujte místa (záhony) piny, veďte si evidenci rostlin a plánujte péči (zálivka, hnojení, stříhání, přesazení).

## ✨ Funkce

- **🗺️ Mapa zahrady** — nahrajte leteckou fotografii a klikáním přidávejte piny na konkrétní záhony nebo místa
- **📍 Detail místa** — název rostliny, datum výsadby, poznámky o péči, volitelná fotka, barevné rozlišení pinů
- **✅ Úkoly a připomínky** — zálivka, hnojení, stříhání, přesazení, plení, sklizeň, kontrola a jiné; opakované (každých N dní) i jednorázové úkoly
- **🏠 Přehled dne a týdne** — hlavní stránka ukazuje, co je dnes a co tento týden, včetně upozornění na úkoly po termínu
- **📜 Historie péče** — automaticky zaznamenává každý dokončený úkol pro danou rostlinu
- **🏘️ Více zahrad** — spravujte přední, zadní zahradu, skleník i balkón zvlášť
- **🔔 Notifikace v prohlížeči** — volitelné denní připomínky úkolů
- **💾 Export dat** — stáhněte si kompletní zálohu jako JSON
- **📱 Optimalizováno pro iPhone Safari** — responzivní design, dolní navigace, safe-area podpora, tap targety ≥44 px

## 🛠️ Technologie

- **Frontend:** React 18 + React Router + Vite
- **Backend:** Node.js Express
- **Databáze:** SQLite (vestavěná `node:sqlite` v Node 22+, žádné nativní závislosti)
- **Upload:** Multer

## 🚀 Spuštění

### Požadavky

- Node.js verze **22.5+** (aplikace používá vestavěný `node:sqlite` modul)
- npm

### Instalace a spuštění

```bash
cd zahradni-tracker

# 1) Instalace závislostí backendu
cd backend
npm install

# 2) Instalace závislostí frontendu
cd ../frontend
npm install

# 3) Sestavení frontendu (umístí se do backend/public)
npm run build

# 4) Spuštění serveru
cd ../backend
npm start
```

Aplikace poběží na **http://localhost:3000**.

### Rychlé spuštění (jeden příkaz ze složky projektu)

```bash
(cd backend && npm install) && (cd frontend && npm install && npm run build) && (cd backend && npm start)
```

### Vývojový režim (s hot-reloadem)

V jednom terminálu spusťte backend:

```bash
cd backend && npm start
```

V druhém terminálu frontend s Vite dev serverem (proxy na backend):

```bash
cd frontend && npm run dev
```

Dev frontend běží na http://localhost:5173, API na 3000.

## 📱 Použití na iPhonu

1. Zjistěte IP adresu počítače se serverem (např. `192.168.1.10`).
2. V Safari na iPhonu otevřete `http://192.168.1.10:3000`.
3. Volitelně přidejte na plochu přes **Sdílet → Přidat na plochu** — aplikace se pak chová jako nativní.

## 📁 Struktura projektu

```
zahradni-tracker/
├── backend/
│   ├── server.js          # Express server + REST API
│   ├── db.js              # SQLite schéma (node:sqlite)
│   ├── package.json
│   ├── data/              # SQLite databáze (vytvoří se automaticky)
│   ├── uploads/           # Nahrané fotografie
│   └── public/            # Build frontendu (vytvoří `npm run build`)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Hlavní komponenta + routing
│   │   ├── main.jsx
│   │   ├── api.js         # REST API klient
│   │   ├── utils.js       # Pomocné funkce
│   │   ├── styles.css     # Přírodní zelený design
│   │   ├── components/
│   │   │   ├── Modal.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── TaskItem.jsx
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── GardensPage.jsx
│   │       ├── GardenDetailPage.jsx
│   │       ├── PinDetail.jsx
│   │       ├── TasksPage.jsx
│   │       └── SettingsPage.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 🔌 REST API přehled

| Metoda | Cesta | Popis |
|--------|-------|-------|
| GET | `/api/gardens` | Seznam zahrad |
| POST | `/api/gardens` | Vytvořit zahradu (multipart: `name`, `image`) |
| PUT | `/api/gardens/:id` | Upravit zahradu |
| DELETE | `/api/gardens/:id` | Smazat zahradu (+piny+úkoly) |
| GET | `/api/gardens/:id/pins` | Piny v zahradě |
| GET | `/api/pins/:id` | Detail pinu včetně úkolů a historie |
| POST | `/api/pins` | Vytvořit pin |
| PUT | `/api/pins/:id` | Upravit pin |
| DELETE | `/api/pins/:id` | Smazat pin |
| GET | `/api/tasks` | Všechny úkoly |
| GET | `/api/tasks/today` | Úkoly na dnes + po termínu |
| GET | `/api/tasks/week` | Úkoly tento týden |
| POST | `/api/tasks` | Vytvořit úkol |
| PUT | `/api/tasks/:id` | Upravit úkol |
| DELETE | `/api/tasks/:id` | Smazat úkol |
| POST | `/api/tasks/:id/done` | Označit za hotový (+ záznam historie) |
| GET | `/api/history` | Historie péče |
| GET | `/api/stats` | Souhrnné statistiky |
| GET | `/api/export` | Export všech dat jako JSON |

## 💡 Tipy

- Klikněte kamkoli na mapu zahrady pro přidání nového pinu.
- Každý pin může mít vlastní barvu pro snadnější orientaci.
- Opakované úkoly se po dokončení automaticky přeplánují podle frekvence.
- Jednorázové úkoly se po dokončení smažou, ale zůstávají v historii.
- Export vytvoří úplnou zálohu — ukládejte si ji pravidelně.

## 🪴 Licence

Osobní použití — aplikace běží lokálně, vaše data nikam neodcházejí.
