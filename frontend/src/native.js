// Capacitor native bootstrap — spustí se jen v nativní iOS/Android appce.
// Na webu/PWA je vše no-op (Capacitor.isNativePlatform() === false), takže
// import je bezpečný i v prohlížeči. Volá se jednou z main.jsx.
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativePush, nativePushGranted, enableNativePush } from './native/push.js';

// Tmavé téma → světlý text ve status baru; světlé téma → tmavý text.
function statusBarStyleForTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? Style.Light
    : Style.Dark;
}

async function applyStatusBar() {
  try {
    await StatusBar.setStyle({ style: statusBarStyleForTheme() });
  } catch {
    // status bar plugin nemusí být na dané platformě (např. iPad bez baru)
  }
}

export function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('is-native', `is-${Capacitor.getPlatform()}`);

  // Status bar barvu/styl sladíme s aktuálním tématem a reagujeme na přepnutí.
  applyStatusBar();
  const themeObserver = new MutationObserver(applyStatusBar);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Splash necháme zmizet až je React vykreslený (launchAutoHide=false v configu).
  const hideSplash = () => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
  if (document.readyState === 'complete') {
    setTimeout(hideSplash, 300);
  } else {
    window.addEventListener('load', () => setTimeout(hideSplash, 300), { once: true });
  }

  // Hardware/gesto zpět (hlavně Android; na iOS je edge-swipe nativní):
  // pokud je kam v historii, vrať se, jinak app uspat.
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });

  // Pokud už uživatel push povolil v dřívější session, znovu se zaregistruj —
  // obnoví token (může rotovat) a naváže tap → in-app navigaci.
  if (isNativePush()) {
    nativePushGranted()
      .then((granted) => {
        if (granted) enableNativePush().catch(() => {});
      })
      .catch(() => {});
  }
}
