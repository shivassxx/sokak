import { AVATARS, HAIRS, OUTFIT_COLORS, SKINS } from '@sokak/shared';

const randomLook = () => ({
  hat: 0,
  hair: Math.floor(Math.random() * HAIRS.length),
  skin: Math.floor(Math.random() * SKINS.length),
  avatar: Math.floor(Math.random() * AVATARS.length),
});

/** Nickname + chosen character, stored for this browser session only. */
export interface Prefs {
  name: string;
  color: string;
  hat: number;
  hair: number;
  skin: number;
  /** index into AVATARS */
  avatar: number;
}

export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(sessionStorage.getItem('sokak.prefs') ?? 'null') as Prefs | null;
    if (p && typeof p.name === 'string' && typeof p.color === 'string') {
      const merged = { ...randomLook(), ...p };
      if (!(merged.avatar >= 0 && merged.avatar < AVATARS.length)) merged.avatar = 0;
      return merged;
    }
  } catch {
    /* ignore */
  }
  return { name: '', color: OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)]!, ...randomLook() };
}

export function savePrefs(p: Prefs): void {
  try {
    sessionStorage.setItem('sokak.prefs', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
