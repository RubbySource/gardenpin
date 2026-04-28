// PWA install prompt — Android/Chrome via beforeinstallprompt + iOS Safari instruction
import React, { useEffect, useState } from 'react';

const DISMISS_KEY = 'gp_installPromptDismissed';
const IOS_INSTRUCT_KEY = 'gp_iosInstallShown';

function isIosSafari() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isStandalone = window.navigator.standalone === true;
  // Exclude in-app browsers (FB, Insta, etc.) — only Safari has the "Add to Home Screen" share action
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|edgios/i.test(ua);
  return isIos && isSafari && !isStandalone;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    // Already installed (Android/desktop PWA) — silent
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;

    // Android / Chrome path
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari path — beforeinstallprompt never fires
    if (isIosSafari() && localStorage.getItem(IOS_INSTRUCT_KEY) !== '1') {
      // Small delay so banner doesn't slam in on first paint
      const t = setTimeout(() => setShowIos(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    if (showIos) localStorage.setItem(IOS_INSTRUCT_KEY, '1');
    setShowAndroid(false);
    setShowIos(false);
    setDeferredPrompt(null);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
    setDeferredPrompt(null);
    setShowAndroid(false);
  };

  if (!showAndroid && !showIos) return null;

  if (showIos) {
    return (
      <div className="install-prompt" role="dialog" aria-label="Přidat na plochu">
        <div className="install-prompt-text">
          <div className="install-prompt-title">📲 Přidat GardenPin na plochu</div>
          <div className="install-prompt-sub">
            Klepni na <span className="ios-share-icon" aria-hidden="true">⬆️</span> a&nbsp;zvol <strong>„Přidat na plochu"</strong>
          </div>
        </div>
        <button className="install-prompt-dismiss" onClick={dismiss} aria-label="Zavřít">✕</button>
      </div>
    );
  }

  return (
    <div className="install-prompt" role="dialog" aria-label="Instalovat aplikaci">
      <div className="install-prompt-text">
        <div className="install-prompt-title">🌿 Přidat GardenPin na plochu</div>
        <div className="install-prompt-sub">Rychlejší přístup, funguje i offline</div>
      </div>
      <div className="install-prompt-actions">
        <button className="install-prompt-install" onClick={install}>Instalovat</button>
        <button className="install-prompt-dismiss" onClick={dismiss} aria-label="Zavřít">✕</button>
      </div>
    </div>
  );
}
