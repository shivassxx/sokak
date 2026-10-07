import { dayPhase, dayTime, formatDayTime } from '@sokak/shared';

/**
 * The game hour as this client shows it: the shared world clock (`dayTime` at server time),
 * unless a dev override pins it. No three.js here: the HUD clock chip uses it too.
 *
 * Dev override: `?saat=21.5` in the URL (dev builds only) or `__game.pinHour(21.5)`
 * from the console (null unpins). Purely cosmetic, so a pinned hour cannot cheat anything.
 */
let pinned: number | null = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const s = new URLSearchParams(location.search).get('saat');
  const h = s === null ? NaN : Number(s);
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : null;
})();

export function pinHour(h: number | null): void {
  pinned = h === null || !Number.isFinite(h) ? null : ((h % 24) + 24) % 24;
}

export function worldHour(serverNowMs: number): number {
  return pinned ?? dayTime(serverNowMs);
}

const ICON = { dawn: '🌅', day: '☀️', golden: '🌇', dusk: '🌆', night: '🌙' } as const;

/** "🌙 23:40" for the HUD chip */
export function clockLabel(hour: number): string {
  return `${ICON[dayPhase(hour)]} ${formatDayTime(hour)}`;
}
