import type { CapacitorConfig } from '@capacitor/cli';

/**
 * GardenPin — Capacitor konfigurace (Fáze 3: iOS shell)
 *
 * appId: reverse-DNS identifikátor. `cz.gardenpin.app` je placeholder —
 *   před odesláním do App Store ho změň na bundle ID registrované v
 *   Apple Developer účtu (Identifiers → App IDs).
 * webDir: výstup `cd frontend && npm run build` (Vite outDir = ../backend/public).
 *   Před každým `npx cap sync` musí být frontend sestavený.
 *
 * server.url (shell přístup):
 *   Nativní app je v této fázi tenký obal nad živou PWA — načítá deploynutý
 *   web, takže relativní /api a /uploads volání fungují same-origin bez úprav.
 *   Navazující backlog úkol "Native API migration" tohle nahradí: bundled
 *   assets (webDir) + absolutní API base (Capacitor.isNativePlatform()) +
 *   native pluginy (@capacitor/camera, haptics, push). Teprve pak je app
 *   offline-capable a splní Apple guideline 4.2 (ne pouhý web wrapper).
 *   Pro lokální test bundled verze server.url zakomentuj.
 */
const config: CapacitorConfig = {
  appId: 'cz.gardenpin.app',
  appName: 'GardenPin',
  webDir: 'backend/public',
  ios: {
    // Bílý/cream podklad pod webview (ladí s --cream #FAF7F2) než se web načte.
    backgroundColor: '#FAF7F2',
    // Zamez auto-zoom WKWebView při fokusu inputu (web už má maximum-scale=1).
    limitsNavigationsToAppBoundDomains: false,
    contentInset: 'never',
  },
  server: {
    url: 'https://gardenpin.tailcec1ab.ts.net',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      // Splash skrýváme ručně z JS (native.js) až je web připravený, aby nebyl
      // bílý záblesk. launchAutoHide:true je pojistka — kdyby deploy neobsahoval
      // native.js (a hide() se nezavolal), splash i tak po 2,5 s zmizí.
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#7BA889', // sage brand
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Web kreslí pod status bar (translucent), barvu řídí native.js dle tématu.
      overlaysWebView: true,
      style: 'DEFAULT',
      backgroundColor: '#7BA889',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
