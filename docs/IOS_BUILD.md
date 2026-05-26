# GardenPin — iOS build (Capacitor)

Návod jak z GardenPin webu postavit nativní iOS aplikaci. **Build a upload do
TestFlight/App Store musí proběhnout na macOS** (Xcode + CocoaPods). Tento repo
obsahuje hotový Capacitor shell — na Macu stačí naistalovat, sync, otevřít Xcode.

## Co už je hotové (Fáze 3 — iOS shell)

- `capacitor.config.ts` — appId `cz.gardenpin.app`, appName `GardenPin`, webDir
  `backend/public`, splash/status bar/keyboard pluginy.
- `ios/` — vygenerovaný Xcode projekt (`npx cap add ios`), commitnutý.
- App icon + splash — vygenerované do `ios/App/App/Assets.xcassets`
  (zdroje v `assets/`, generátor `scripts/gen-app-icons.cjs`).
- `Info.plist` — usage stringy pro kameru a fotogalerii (CZ).
- `frontend/src/native.js` — nativní bootstrap (status bar dle tématu, skrytí
  splash, hardware back), no-op na webu.

### Native API migration (hotovo)

Nativní pluginy jsou integrované přes `frontend/src/native/*` helpery, všechny
gated na `Capacitor.isNativePlatform()` (na webu zůstává původní chování):

- **`@capacitor/camera`** (`native/camera.js`) — `openPhotoPicker()` nahrazuje
  `<input type="file" capture>`: na nativu akční sheet Vyfotit / Z knihovny,
  multi-výběr z knihovny; vrací `File[]`, takže navazující FormData upload kód
  zůstává beze změny. Web spadne zpět na skrytý `<input>`. Zapojeno v PinDetail
  (fotka rostliny + galerie) a GardenDetail (fotka mapy/zahrady).
- **`@capacitor/haptics`** (`native/haptics.js`) — `hapticImpact` (swipe práh),
  `hapticNotification('success')` (splnění úkolu), `hapticSelection` (tik).
  Web fallback `navigator.vibrate` (iOS Safari ho ignoruje, Android Chrome ne).
- **`@capacitor/share`** (`native/share.js`) — `shareLink()` otevře nativní
  share sheet; web zůstává na kopii do schránky. Zapojeno ve sdílení zahrady.
- **`@capacitor/push-notifications`** (`native/push.js`) — viz „Push notifikace"
  níže. SettingsPage toggle větví web ↔ nativ přes `push.js`.

### Shell přístup: `server.url`

V této fázi je nativní app **tenký obal nad živou PWA** — `capacitor.config.ts`
má `server.url = https://gardenpin.tailcec1ab.ts.net`, takže WKWebView načítá
deploynutý web a relativní `/api` i `/uploads` volání fungují same-origin bez
úprav. `native.js` je součástí deploynutého bundlu, takže běží i uvnitř nativního
webview (Capacitor bridge se injektuje automaticky).

> ⚠️ **Důležité pro App Store:** Apple guideline 4.2 odmítá pouhé web wrappery a
> `server.url` znamená závislost na internetu (ne offline-first). Native pluginy
> (camera/haptics/share/push) už integrované jsou (viz výše); zbývá přechod na
> **bundled assets** (webDir) + absolutní API base, aby byla app offline-capable.
> Teprve pak je vhodná k odeslání.
>
> Pro lokální test bundled verze zakomentuj `server.url` v `capacitor.config.ts`,
> sestav frontend a `npx cap sync ios`.

## Předpoklady (macOS)

- macOS s Xcode (poslední stabilní), Command Line Tools.
- [CocoaPods](https://cocoapods.org/): `sudo gem install cocoapods`.
- Node 22+ (stejně jako pro web).
- Pro odeslání: **Apple Developer účet ($99/rok)**, App Store Connect přístup.

## Build krok za krokem

```bash
# 1) Závislosti (root i frontend)
npm install
npm install --prefix frontend

# 2) Sestav web (Vite outDir = backend/public)
cd frontend && npm run build && cd ..

# 3) Zkopíruj web + nainstaluj pody do iOS projektu
npx cap sync ios

# 4) Otevři ve Xcode
npx cap open ios
```

Ve Xcode:

1. Vyber target **App** → záložka **Signing & Capabilities**.
2. Nastav **Team** (tvůj Apple Developer účet) a změň **Bundle Identifier**
   z `cz.gardenpin.app` na vlastní (registruj v Apple Developer → Identifiers).
3. Capabilities:
   - **Push Notifications** — povinné pro `@capacitor/push-notifications`
     (jinak `register()` selže). Přidej přes **+ Capability**.
   - **Background Modes → Remote notifications** — pro doručení na pozadí.
4. Připoj iPhone / vyber simulátor → **Run** (▶).
   - Push **nefunguje na simulátoru** — vyžaduje fyzický iPhone.

## Push notifikace (APNs)

Klient je hotový: `native/push.js` vyžádá oprávnění, zaregistruje se u APNs,
device token pošle na backend (`POST /api/push/native-register` → tabulka
`native_push_tokens`) a tap na notifikaci přesměruje na `data.url`.

**Doručení zatím vyžaduje APNs konfiguraci na backendu** (Patrik, po založení
Apple Developer účtu):

1. Apple Developer → **Keys** → vytvoř **APNs Auth Key** (`.p8`), poznamenej si
   **Key ID** a **Team ID**.
2. Na produkci nastav env proměnné (backend `sendToNative` se aktivuje, jakmile
   jsou všechny čtyři):
   - `APNS_KEY_PATH` — cesta k `.p8` souboru
   - `APNS_KEY_ID`
   - `APNS_TEAM_ID`
   - `APNS_BUNDLE_ID` — bundle ID appky (`cz.gardenpin.app` / vlastní)
3. Dokud creds nejsou, backend nativní tokeny jen ukládá a při odeslání je
   přeskočí (log + `native.skipped` ve výsledku). Web push běží beze změny.

> Implementace samotného APNs HTTP/2 odeslání (JWT z `.p8`) je v `backend/push.js`
> ve funkci `sendToNative` označená `TODO(apns)` — napojí se až budou creds, bez
> dotyku klienta.

## App Store / TestFlight

1. Ve Xcode nastav scheme na **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. V Organizeru **Distribute App → App Store Connect → Upload**.
4. V [App Store Connect](https://appstoreconnect.apple.com) přiřaď build do
   TestFlightu (interní/externí testeři) nebo k App Store submission.

### Bez Macu

Cloud build služby umí archivovat iOS bez vlastního Macu:
[Codemagic](https://codemagic.io), [Bitrise](https://bitrise.io),
[Ionic Appflow](https://ionic.io/appflow). Vyžadují nahrání signing certifikátů.

## Změna ikony / splash

```bash
# 1) Uprav motiv v generátoru a přegeneruj zdroje do assets/
NODE_PATH=backend/node_modules node scripts/gen-app-icons.cjs
# 2) Přegeneruj iOS asset catalog ze zdrojů
npx capacitor-assets generate --ios
```

Zdroje: `assets/icon-only.png` (1024×1024), `assets/splash.png` +
`assets/splash-dark.png` (2732×2732).

## Struktura závislostí

- **root `package.json`** — `@capacitor/cli` + `@capacitor/ios` +
  `@capacitor/assets` (tooling/platforma) a runtime pluginy (`core`, `app`,
  `status-bar`, `splash-screen`, `keyboard`, `camera`, `haptics`, `share`,
  `push-notifications`), aby je CLI našel pro registraci podů (`Podfile`
  odkazuje na root `node_modules`).
- **`frontend/package.json`** — stejné runtime pluginy, aby je Vite vyřešil při
  `cd frontend && npm run build` a zabundloval do webu (plugin web implementace
  se code-splitují do samostatných lazy chunků).

`ios/.gitignore` schválně necommituje `App/Pods`, `App/build`, kopii webu
`App/App/public` ani generovaný `capacitor.config.json` — vznikají při
`npx cap sync` na Macu.
