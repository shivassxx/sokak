/**
 * Nickname profanity filter (Turkish + English). Deliberately simple and
 * conservative: an offensive nickname is replaced by a random friendly one.
 */

/** Roots blocked anywhere in the name, even across spaces/dots ("o.r.o.s.p.u"). */
const STRONG = [
  'orospu', 'orosbu', 'yarrak', 'yarak', 'amcik', 'amcuk', 'siktir', 'sikis', 'sikik', 'sikerim', 'pezevenk', 'kahpe',
  'yavsak', 'serefsiz', 'gavat', 'kaltak', 'surtuk', 'fahise', 'gerizekali', 'dangalak', 'amina', 'aminako', 'anani',
  'fuck', 'bitch', 'cunt', 'nigger', 'nigga', 'whore', 'porn', 'hitler', 'nazi', 'pussy', 'penis', 'vagina', 'rape',
];

/** Short words blocked only as a whole word (avoids "Kemal", "Işık", "Samet"). */
const WORDS = new Set([
  'am', 'amk', 'amq', 'aq', 'sik', 'sikim', 'got', 'gotveren', 'ibne', 'pic', 'pust', 'salak', 'aptal', 'mal', 'oc',
  'sex', 'seks', 'ass', 'dick', 'shit', 'fag', 'slut', 'kill', 'olum', 'ebeninami',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const TR: Record<string, string> = { ı: 'i', i̇: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

export function normalizeForFilter(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .split('')
    .map((ch) => LEET[ch] ?? TR[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(.)\1+/g, '$1');
}

export function isOffensive(name: string): boolean {
  const norm = normalizeForFilter(name);
  const squashed = norm.replace(/[^a-z]/g, '');
  if (STRONG.some((r) => squashed.includes(r))) return true;
  const tokens = norm.split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => WORDS.has(t));
}
