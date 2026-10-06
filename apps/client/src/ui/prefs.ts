import { OUTFIT_COLORS } from '@sokak/shared';

/** Nickname + outfit color, stored for this browser session only. */
export interface Prefs {
  name: string;
  color: string;
}

export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(sessionStorage.getItem('sokak.prefs') ?? 'null') as Prefs | null;
    if (p && typeof p.name === 'string' && typeof p.color === 'string') return p;
  } catch {
    /* ignore */
  }
  return { name: '', color: OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)]! };
}

export function savePrefs(p: Prefs): void {
  try {
    sessionStorage.setItem('sokak.prefs', JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
