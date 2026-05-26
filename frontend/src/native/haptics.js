// Haptická odezva — na nativní platformě @capacitor/haptics, na webu fallback
// na navigator.vibrate (funguje na Android Chrome, iOS Safari ho ignoruje).
// Všechna volání jsou fire-and-forget a nikdy nevyhodí výjimku — haptika je
// jen "polish", nesmí rozbít interakci.
import { Capacitor } from '@capacitor/core';

const native = () => Capacitor.isNativePlatform();

// Plugin načítáme líně (jen na nativu), aby se na web nikdy nedostal.
let _mod;
const loadPlugin = () => (_mod ||= import('@capacitor/haptics'));

function webVibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibrate není podporováno → tiše ignoruj */
  }
}

// Krátký "ťuk" při překročení swipe prahu, drag-snapu apod.
export async function hapticImpact(style = 'medium') {
  if (native()) {
    try {
      const { Haptics, ImpactStyle } = await loadPlugin();
      const map = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: map[style] || ImpactStyle.Medium });
    } catch {
      /* plugin nedostupný → ignoruj */
    }
    return;
  }
  webVibrate(style === 'heavy' ? 30 : style === 'light' ? 8 : 15);
}

// Sémantická notifikace (úspěch / varování / chyba) — např. splnění úkolu.
export async function hapticNotification(type = 'success') {
  if (native()) {
    try {
      const { Haptics, NotificationType } = await loadPlugin();
      const map = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      await Haptics.notification({ type: map[type] || NotificationType.Success });
    } catch {
      /* ignoruj */
    }
    return;
  }
  webVibrate(type === 'success' ? [10, 40, 10] : type === 'error' ? [30, 50, 30] : 20);
}

// Jemný výběrový tik (segmented control, otevření swipe drawer).
export function hapticSelection() {
  // Záměrně nečekáme na výsledek — výběr má být okamžitý.
  hapticImpact('light');
}
