// Fotky — na nativní platformě @capacitor/camera (akční sheet Vyfotit / Z knihovny
// a multi-výběr z knihovny), na webu vrací null → caller spadne zpět na
// <input type="file">. Vrací vždy standardní File objekty, takže navazující
// FormData upload kód zůstává beze změny.
import { Capacitor } from '@capacitor/core';

const native = () => Capacitor.isNativePlatform();

// Použij nativní fotoaparát? (komponenty podle toho přepínají UI / handler.)
export function useNativeCamera() {
  return native();
}

// webPath z Camera pluginu je blob/capacitor URL dostupné přes fetch ve WKWebView.
async function pathToFile(webPath, name) {
  const res = await fetch(webPath);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

// Jedna fotka — na nativu akční sheet (fotoaparát / knihovna), vrátí File.
// Na webu vrací null (caller použije fallback input).
export async function takePhoto() {
  if (!native()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
    promptLabelHeader: 'Fotka rostliny',
    promptLabelCancel: 'Zrušit',
    promptLabelPhoto: 'Z knihovny',
    promptLabelPicture: 'Vyfotit',
    correctOrientation: true,
  });
  return pathToFile(photo.webPath, `gp-photo-${Date.now()}.jpg`);
}

// Více fotek z knihovny — na nativu vrátí File[]. Na webu vrací null.
export async function pickPhotos({ limit = 0 } = {}) {
  if (!native()) return null;
  const { Camera } = await import('@capacitor/camera');
  const result = await Camera.pickImages({
    quality: 85,
    ...(limit ? { limit } : {}),
  });
  const photos = result?.photos || [];
  return Promise.all(photos.map((p, i) => pathToFile(p.webPath, `gp-photo-${Date.now()}-${i}.jpg`)));
}

// Jednotný "otevři výběr fotky" pro existující .file-input-wrap komponenty:
// na nativu spustí Camera plugin a předá File[] do onFiles; na webu klikne na
// skrytý <input type="file">, který si zpracování řeší přes svůj onChange.
export async function openPhotoPicker({ multiple = false, inputRef, onFiles }) {
  if (native()) {
    try {
      const files = multiple ? await pickPhotos() : [await takePhoto()];
      const valid = (files || []).filter(Boolean);
      if (valid.length) await onFiles?.(valid);
    } catch (e) {
      // Uživatel výběr zrušil → tiše ignoruj; jinak zaloguj.
      if (!/cancel/i.test(e?.message || '')) console.warn('[camera]', e);
    }
    return;
  }
  inputRef?.current?.click();
}
