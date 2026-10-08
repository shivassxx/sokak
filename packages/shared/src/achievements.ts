/**
 * Başarımlar: persistent per-device achievements, kept in the play-money wallet
 * (anonymous device token, no personal data). The server counts events into
 * named counters; an achievement unlocks once when its counter reaches the goal
 * and pays its small play-money reward exactly once.
 */

/** Things the server counts per device. */
export type AchCounter =
  | 'okeyPlayed'
  | 'okeyWon'
  | 'okeyFinish'
  | 'cifteFinish'
  | 'eldenFinish'
  | 'caught'
  | 'esliWon'
  | 'longMatch'
  | 'tourWon'
  | 'tavlaPlayed'
  | 'tavlaMars'
  | 'tavlaWon'
  | 'tea'
  | 'gulls'
  | 'fish'
  | 'vapur'
  | 'ledge'
  | 'tvGoal'
  | 'market'
  | 'friend'
  | 'chat';

export type AchGroup = 'okey' | 'tavla' | 'kahve' | 'social';

export interface AchievementDef {
  id: string;
  group: AchGroup;
  emoji: string;
  title: string;
  desc: string;
  counter: AchCounter;
  /** counter value needed (1 = a one-off; > 1 shows a progress bar) */
  goal: number;
  /** play money paid once on unlock */
  reward: number;
}

export const ACH_GROUPS: readonly { id: AchGroup; title: string }[] = [
  { id: 'okey', title: 'Okey' },
  { id: 'tavla', title: 'Tavla' },
  { id: 'kahve', title: 'Kahvehane hayatı' },
  { id: 'social', title: 'Ahbaplık' },
];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'firstMatch', group: 'okey', emoji: '🀄', title: 'İlk maç', desc: 'Bir 101 okey maçını sonuna kadar oyna.', counter: 'okeyPlayed', goal: 1, reward: 100 },
  { id: 'win10', group: 'okey', emoji: '🏆', title: 'Masanın kurdu', desc: '10 okey maçı kazan.', counter: 'okeyWon', goal: 10, reward: 300 },
  { id: 'win50', group: 'okey', emoji: '👑', title: 'Kıraathane efsanesi', desc: '50 okey maçı kazan.', counter: 'okeyWon', goal: 50, reward: 1000 },
  { id: 'okeyFinish', group: 'okey', emoji: '🃏', title: 'Okeyle bitir', desc: 'Son taş olarak okeyi atıp eli bitir.', counter: 'okeyFinish', goal: 1, reward: 200 },
  { id: 'cifte', group: 'okey', emoji: '👯', title: 'Çifte gidip bitir', desc: 'Çiftle açıp eli bitir.', counter: 'cifteFinish', goal: 1, reward: 200 },
  { id: 'elden', group: 'okey', emoji: '✋', title: 'Elden bitir', desc: 'Açtığın turda eli bitir.', counter: 'eldenFinish', goal: 1, reward: 250 },
  { id: 'caught', group: 'okey', emoji: '🕵️', title: 'Hile yakala', desc: 'Taş çalanı suçüstü yakala.', counter: 'caught', goal: 1, reward: 150 },
  { id: 'esli', group: 'okey', emoji: '🤝', title: 'Eşli zafer', desc: 'Eşli 101 maçını ortağınla kazan.', counter: 'esliWon', goal: 1, reward: 200 },
  { id: 'longMatch', group: 'okey', emoji: '⏳', title: 'Uzun soluklu', desc: 'En az 7 elli bir maçı bitir.', counter: 'longMatch', goal: 1, reward: 200 },
  { id: 'tourChamp', group: 'okey', emoji: '🏆', title: 'Turnuva şampiyonu', desc: 'Bir okey turnuvasını kazan.', counter: 'tourWon', goal: 1, reward: 300 },
  { id: 'tavlaFirst', group: 'tavla', emoji: '🎲', title: 'İlk tavla', desc: 'Bir tavla maçını bitir.', counter: 'tavlaPlayed', goal: 1, reward: 100 },
  { id: 'tavlaMars', group: 'tavla', emoji: '💥', title: 'Mars!', desc: 'Rakibini mars ederek bir oyun kazan.', counter: 'tavlaMars', goal: 1, reward: 200 },
  { id: 'tavlaWin10', group: 'tavla', emoji: '🥇', title: 'Zar ustası', desc: '10 tavla maçı kazan.', counter: 'tavlaWon', goal: 10, reward: 300 },
  { id: 'tea20', group: 'kahve', emoji: '🍵', title: 'Çay tiryakisi', desc: '20 çay iç.', counter: 'tea', goal: 20, reward: 100 },
  { id: 'gulls10', group: 'kahve', emoji: '🕊️', title: 'Martıların dostu', desc: 'Martılara 10 kez simit at.', counter: 'gulls', goal: 10, reward: 100 },
  { id: 'fish5', group: 'kahve', emoji: '🎣', title: 'Sahil balıkçısı', desc: '5 balık tut (ayakkabı sayılmaz).', counter: 'fish', goal: 5, reward: 150 },
  { id: 'vapur', group: 'kahve', emoji: '⛴️', title: 'Vapur sefası', desc: 'İskeleden vapura bin.', counter: 'vapur', goal: 1, reward: 50 },
  { id: 'ledge', group: 'kahve', emoji: '🌅', title: 'Kız Kulesi manzarası', desc: 'Sahil duvarına oturup manzarayı izle.', counter: 'ledge', goal: 1, reward: 50 },
  { id: 'tvGoal', group: 'kahve', emoji: '⚽', title: 'Gooool!', desc: 'Salondaki televizyonda bir derbi golü gör.', counter: 'tvGoal', goal: 1, reward: 50 },
  { id: 'market', group: 'kahve', emoji: '🛒', title: 'Bakkal müşterisi', desc: 'Köşedeki marketten bir şey al.', counter: 'market', goal: 1, reward: 50 },
  { id: 'friend', group: 'social', emoji: '🔗', title: 'Ahbap masası', desc: 'Davet linkiyle gelen bir arkadaşla aynı masada maç bitir.', counter: 'friend', goal: 1, reward: 150 },
  { id: 'chat50', group: 'social', emoji: '💬', title: 'Lafı gediğinde', desc: '50 hazır mesaj gönder.', counter: 'chat', goal: 50, reward: 100 },
];

export const achievementById = (id: string): AchievementDef | undefined => ACHIEVEMENTS.find((a) => a.id === id);

/** A device's achievement record (stored in the wallet, returned by GET /api/achievements). */
export interface AchState {
  /** counter values */
  c: Partial<Record<AchCounter, number>>;
  /** unlocked achievement ids, in unlock order */
  got: string[];
  /** GET /api/achievements adds how many exist (so the lobby need not ship the list) */
  total?: number;
}

/** room message name of AchUnlockMsg */
export const ACH_MSG = 'ach';

/** server → the player: an achievement just unlocked (and its reward was paid) */
export interface AchUnlockMsg {
  id: string;
  reward: number;
}

const MAX_COUNT = 1_000_000;

/**
 * Pure counter/unlock step: add `n` to `counter` and return the new state plus the
 * achievements that unlocked just now. An id already in `got` never unlocks again,
 * so calling this from several tabs of one device pays each reward only once.
 */
export function bumpAchievement(state: AchState | undefined, counter: AchCounter, n = 1): { state: AchState; unlocked: AchievementDef[] } {
  const got = Array.isArray(state?.got) ? state.got.filter((x) => typeof x === 'string') : [];
  const c: AchState['c'] = { ...(state?.c ?? {}) };
  const before = Number.isFinite(c[counter]) ? c[counter]! : 0;
  const add = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  c[counter] = Math.min(MAX_COUNT, before + add);
  const unlocked = ACHIEVEMENTS.filter((a) => a.counter === counter && !got.includes(a.id) && c[counter]! >= a.goal);
  return { state: { c, got: [...got, ...unlocked.map((a) => a.id)] }, unlocked };
}

/** Progress of one achievement in a state (0…goal) and whether it is earned. */
export function achProgress(state: AchState | null | undefined, a: AchievementDef): { n: number; done: boolean } {
  const done = !!state?.got?.includes(a.id);
  const n = Math.min(a.goal, Math.max(0, state?.c?.[a.counter] ?? 0));
  return { n: done ? a.goal : n, done };
}
