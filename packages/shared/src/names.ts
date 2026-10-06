import { NAME_MAX, NAME_MIN, OUTFIT_COLORS } from './protocol';

const ADJ = ['Sevimli', 'Hızlı', 'Gizli', 'Neşeli', 'Cesur', 'Uykucu', 'Şakacı', 'Minik', 'Afacan', 'Sessiz'];
const NOUN = ['Kedi', 'Serçe', 'Kirpi', 'Tavşan', 'Sincap', 'Martı', 'Kaplumbağa', 'Kuzu', 'Tilki', 'Baykuş'];

export function randomNickname(rnd: () => number = Math.random): string {
  const a = ADJ[Math.floor(rnd() * ADJ.length)]!;
  const n = NOUN[Math.floor(rnd() * NOUN.length)]!;
  return `${a} ${n}`.slice(0, NAME_MAX);
}

/** Trim, collapse whitespace, strip anything but letters/digits/space/-/_ and limit length. */
export function cleanNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

export function isValidNicknameLength(name: string): boolean {
  return name.length >= NAME_MIN && name.length <= NAME_MAX;
}

export function sanitizeColor(raw: unknown): string {
  return typeof raw === 'string' && (OUTFIT_COLORS as readonly string[]).includes(raw) ? raw : OUTFIT_COLORS[0];
}
