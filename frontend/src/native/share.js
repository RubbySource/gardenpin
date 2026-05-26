// Sdílení odkazu — na nativní platformě nativní share sheet (@capacitor/share),
// na webu zachováváme stávající chování (kopie do schránky), aby se desktop
// nezačal chovat jinak. Vrací krátký status pro správný toast:
//   'shared'  — otevřen nativní share sheet (nebo uživatel sdílení potvrdil/zrušil)
//   'copied'  — odkaz zkopírován do schránky
//   'shown'   — schránka nedostupná, vrácen jen text (caller ukáže URL)
import { Capacitor } from '@capacitor/core';

const native = () => Capacitor.isNativePlatform();

// Pro UI: zobrazit „Sdílet" (nativní sheet) vs „Zkopírovat" (web schránka).
export const isNativeShare = () => native();

async function copyToClipboard(url) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  return 'shown';
}

export async function shareLink({ url, title = '', text = '' }) {
  if (native()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title || 'Sdílet' });
      return 'shared';
    } catch (e) {
      // Uživatel share sheet zavřel → ber jako hotovo, nepadej na schránku.
      if (/cancel/i.test(e?.message || '')) return 'shared';
      // Jiná chyba pluginu → zkus aspoň schránku.
    }
  }
  return copyToClipboard(url);
}
