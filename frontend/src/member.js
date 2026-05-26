// Identita spolupracovníka (per-prohlížeč).
//
// GardenPin běží v single-user režimu bez plné autentizace — jedna instance
// (typicky veřejná přes Tailscale Funnel) je sdílená rodinou. Tento modul drží
// "kdo jsem v tomto prohlížeči": vlastník (default) nebo přijatý člen zahrady.
// Identita slouží k atribuci splněných úkonů a přiřazování úkolů konkrétní osobě.

const MEMBER_KEY = 'gardenpin.member';
const OWNER_NAME_KEY = 'gardenpin.userName'; // existující klíč (Home pozdrav / Settings)

// Vrátí aktuálního člena { id, name, role, gardenId, color } nebo null (= vlastník).
export function getCurrentMember() {
  try {
    const raw = localStorage.getItem(MEMBER_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m && m.id ? m : null;
  } catch {
    return null;
  }
}

// Uloží přijatého člena jako aktuální identitu tohoto prohlížeče.
export function setCurrentMember(m) {
  try {
    localStorage.setItem(
      MEMBER_KEY,
      JSON.stringify({
        id: m.id,
        name: m.name,
        role: m.role || 'editor',
        gardenId: m.garden_id ?? m.gardenId ?? null,
        color: m.color || null,
      }),
    );
    window.dispatchEvent(new Event('gp-member-change'));
  } catch {}
}

// Vrátí se zpět do role vlastníka (smaže uloženou identitu člena).
export function clearMember() {
  try {
    localStorage.removeItem(MEMBER_KEY);
    window.dispatchEvent(new Event('gp-member-change'));
  } catch {}
}

// ID člena pro odeslání na backend (atribuce splnění). null = vlastník.
export function getActorMemberId() {
  return getCurrentMember()?.id ?? null;
}

// Jméno vlastníka (z onboardingu / Settings), fallback na obecné.
export function getOwnerName() {
  try {
    return (localStorage.getItem(OWNER_NAME_KEY) || '').trim() || null;
  } catch {
    return null;
  }
}

// Jméno aktuálního aktéra pro zobrazení (člen nebo vlastník).
export function getActorName(fallback = 'Já') {
  return getCurrentMember()?.name || getOwnerName() || fallback;
}
