import { HAIRS, OUTFIT_COLORS, SKINS } from '@sokak/shared';

const randomLook = () => ({ hat: 0, hair: Math.floor(Math.random() * HAIRS.length), skin: Math.floor(Math.random() * SKINS.length) });

/** Nickname + outfit color, stored for this browser session only. */
export interface Prefs {
  name: string;
  color: string;
  hat: number;
  hair: number;
  skin: number;
}

export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(sessionStorage.getItem('sokak.prefs') ?? 'null') as Prefs | null;
    if (p && typeof p.name === 'string' && typeof p.color === 'string') return { ...randomLook(), ...p };
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
