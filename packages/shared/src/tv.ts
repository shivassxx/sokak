/**
 * The kıraathane TV: staff (owner/admins) put a derby on and every salon watches the same
 * simulated match. Team names are colour nicknames only — no real club names or logos.
 */
export interface TvTeam {
  id: string;
  /** shown on the scoreboard (Turkish) */
  name: string;
  /** 3-letter scoreboard code */
  short: string;
  /** shirt colours [main, second] as #rrggbb */
  colors: [string, string];
}

export const TV_TEAMS: readonly TvTeam[] = [
  { id: 'sarikirmizi', name: 'Sarı-Kırmızılar', short: 'SKR', colors: ['#a90432', '#fdb912'] },
  { id: 'sarilacivert', name: 'Sarı-Lacivertliler', short: 'SLC', colors: ['#002d72', '#ffed00'] },
  { id: 'siyahbeyaz', name: 'Siyah-Beyazlılar', short: 'SYB', colors: ['#111111', '#ffffff'] },
  { id: 'bordomavi', name: 'Bordo-Mavililer', short: 'BRM', colors: ['#7b1c2e', '#5fa8dd'] },
  { id: 'yesilbeyaz', name: 'Yeşil-Beyazlılar', short: 'YŞB', colors: ['#00843d', '#ffffff'] },
];

export const tvTeam = (id: string): TvTeam | undefined => TV_TEAMS.find((t) => t.id === id);

/** What the server broadcasts to every salon: the match is deterministic from `seed` and `startedAt`. */
export interface TvBroadcast {
  /** unique per broadcast */
  id: string;
  home: string;
  away: string;
  /** epoch ms (server clock) of the kick-off */
  startedAt: number;
  seed: number;
  /** staff username that started it (shown in the admin panel only) */
  by: string;
}

// ------------------------------------------------------------------ the simulated match
/**
 * The 90 minutes run in compressed time: two 5-minute halves (each 45 minutes plus a little
 * stoppage time), a 1-minute half-time break, then the final score stays on screen for a
 * minute before the TV goes back to its normal programme. 12 real minutes in all.
 */
export const TV_HALF_MS = 5 * 60_000;
export const TV_BREAK_MS = 60_000;
export const TV_FULL_SHOW_MS = 60_000;
export const TV_TOTAL_MS = 2 * TV_HALF_MS + TV_BREAK_MS + TV_FULL_SHOW_MS;
/** how long the "GOOOL!" overlay stays up after a goal */
export const TV_GOAL_SHOW_MS = 6_000;
/** the pause between a goal and the restart from the centre spot */
const CELEBRATE_MS = 5_000;

export type TvPhase = 'pre' | 'first' | 'half' | 'second' | 'full';
export type TvEventKind = 'kickoff' | 'goal' | 'chance' | 'save' | 'yellow' | 'red' | 'half' | 'full';

export interface TvEvent {
  kind: TvEventKind;
  /** real ms since kick-off */
  t: number;
  /** match minute (1…90+; stoppage time counts on: 47 in the first half means 45+2) */
  minute: number;
  /** 0 = home, 1 = away (the team the event is about) */
  team: 0 | 1;
  /** player surname ('' for whistles) */
  player: string;
  /** one-line Turkish commentary */
  text: string;
}

export interface TvStats {
  /** possession in percent, sums to 100 */
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  yellow: [number, number];
  red: [number, number];
}

export interface TvMatchState {
  phase: TvPhase;
  /** the full-time screen is over: the TV is back to its normal programme */
  done: boolean;
  /** match minute (0 before kick-off; 45/90 + stoppage at the whistles) */
  minute: number;
  /** scoreboard clock: "34'", "45+2'", "İY", "MS" */
  clock: string;
  score: [number, number];
  /** events up to now, oldest first */
  events: TvEvent[];
  /** the latest event, for the commentary line */
  last: TvEvent | null;
  /** a goal scored within TV_GOAL_SHOW_MS (for the overlay), with how long ago */
  goal: (TvEvent & { ago: number }) | null;
  /** ball on the pitch: x 0 = left goal line … 1 = right goal line, y 0 = top touchline … 1 = bottom */
  ball: { x: number; y: number };
  /** who has the ball and which way they play (+1 = towards x 1); null when the ball is dead */
  attack: { team: 0 | 1; dir: 1 | -1; progress: number } | null;
  /** home plays towards x 1 in the first half, towards x 0 in the second */
  homeDir: 1 | -1;
  stats: TvStats;
  /** both line-ups (11 surnames each, goalkeeper first) */
  lineups: [string[], string[]];
}

const SURNAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt',
  'Özdemir', 'Şimşek', 'Polat', 'Korkmaz', 'Karataş', 'Erdem', 'Güneş', 'Akın', 'Tekin', 'Bulut', 'Keskin', 'Ateş', 'Uçar', 'Duman', 'Aksoy', 'Yavuz',
  'Tunç', 'Bozkurt', 'Ekinci', 'Sönmez', 'Coşkun', 'Toprak', 'Altun', 'Kalkan', 'Turan', 'Avcı', 'Uysal', 'Karakaya', 'Özkan', 'Bayram', 'Işık', 'Ergün',
] as const;

/** mulberry32: small, fast, good enough for a TV match */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Outcome = 'none' | 'goal' | 'chance' | 'save' | 'yellow' | 'red' | 'restart';
interface Play {
  /** real ms since kick-off */
  t0: number;
  t1: number;
  team: 0 | 1;
  outcome: Outcome;
  /** attacker-relative keypoints: a = 0 own goal line … 1 the goal they attack, y 0…1 */
  path: { a: number; y: number }[];
}

interface Timeline {
  key: string;
  plays: Play[];
  events: TvEvent[];
  /** stoppage minutes per half */
  stoppage: [number, number];
  lineups: [string[], string[]];
}

const halfStart = (h: 0 | 1) => (h === 0 ? 0 : TV_HALF_MS + TV_BREAK_MS);

function minuteAt(t: number, stoppage: [number, number]): number {
  if (t < 0) return 0;
  if (t < TV_HALF_MS) return Math.min(45 + stoppage[0], Math.floor((t / TV_HALF_MS) * (45 + stoppage[0])) + 1);
  if (t < TV_HALF_MS + TV_BREAK_MS) return 45 + stoppage[0];
  const s = t - halfStart(1);
  if (s < TV_HALF_MS) return 45 + Math.min(45 + stoppage[1], Math.floor((s / TV_HALF_MS) * (45 + stoppage[1])) + 1);
  return 90 + stoppage[1];
}

/** "34'", or "45+2'" / "90+3'" in stoppage time (for a minute of the given half) */
export function tvMinuteLabel(minute: number, half: 0 | 1): string {
  const cap = half === 0 ? 45 : 90;
  return minute > cap ? `${cap}+${minute - cap}'` : `${minute}'`;
}

function line(kind: Outcome, who: string, r: () => number): string {
  const pick = (a: string[]) => a[Math.floor(r() * a.length)]!;
  switch (kind) {
    case 'goal':
      return pick([`GOOOL! ${who} ağları sarstı!`, `GOOOL! ${who} topu köşeye bıraktı!`, `GOOOL! ${who} kafayla vurdu, gol!`, `GOOOL! ${who} kaleciyi avlattı!`]);
    case 'chance':
      return pick([`${who} vurdu… direkten döndü!`, `${who} vurdu, top az farkla dışarıda!`, `Büyük fırsat! ${who} kaleciyle karşı karşıya, olmadı!`, `${who} vurdu, top üstten auta gitti.`]);
    case 'save':
      return pick([`${who} şut çekti, kaleci çeldi!`, `Kaleci uçtu! ${who} gol sevinci yaşayamadı.`, `${who} vurdu, kaleci topu kontrol etti.`]);
    case 'yellow':
      return pick([`Sert faul! Hakem ${who} için sarı kartı gösterdi.`, `Sarı kart: ${who}.`]);
    case 'red':
      return `KIRMIZI KART! ${who} oyundan atıldı!`;
    default:
      return '';
  }
}

let cached: Timeline | null = null;

function timeline(b: TvBroadcast): Timeline {
  const key = `${b.id}:${b.seed}:${b.home}:${b.away}`;
  if (cached?.key === key) return cached;
  const r = seededRng(b.seed);
  const pool: string[] = [...SURNAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const lineups: [string[], string[]] = [pool.slice(0, 11), pool.slice(11, 22)];
  const names = [tvTeam(b.home)?.name ?? 'Ev sahibi', tvTeam(b.away)?.name ?? 'Deplasman'];
  const stoppage: [number, number] = [1 + Math.floor(r() * 3), 2 + Math.floor(r() * 4)];
  // a little home advantage
  const strength: [number, number] = [0.58 + r() * 0.5, 0.5 + r() * 0.5];
  const plays: Play[] = [];
  const events: TvEvent[] = [];
  const sent = [new Set<string>(), new Set<string>()];
  const yellows = [new Map<string, number>(), new Map<string, number>()];
  const ev = (kind: TvEventKind, t: number, team: 0 | 1, player: string, text: string) => events.push({ kind, t, minute: minuteAt(t, stoppage), team, player, text });
  // forwards (9, 10) and midfielders (6–8) score most, a defender now and then; never someone sent off
  const shooter = (team: 0 | 1) => {
    for (let k = 0; k < 6; k++) {
      const x = r();
      const i = x < 0.55 ? 9 + Math.floor(r() * 2) : x < 0.9 ? 6 + Math.floor(r() * 3) : 2 + Math.floor(r() * 4);
      const n = lineups[team][i]!;
      if (!sent[team]!.has(n)) return n;
    }
    return lineups[team][10]!;
  };
  const outfield = (team: 0 | 1) => {
    for (let k = 0; k < 6; k++) {
      const n = lineups[team][1 + Math.floor(r() * 10)]!;
      if (!sent[team]!.has(n)) return n;
    }
    return lineups[team][5]!;
  };
  for (const h of [0, 1] as const) {
    const t0 = halfStart(h);
    const end = t0 + TV_HALF_MS;
    ev('kickoff', t0, h, '', h === 0 ? `Hakemin düdüğüyle maç başladı: ${names[0]} – ${names[1]}!` : 'İkinci yarı başladı!');
    // the home team kicks off the first half, the away team the second
    let team: 0 | 1 = h;
    let start = { a: 0.5, y: 0.5 };
    let t = t0;
    while (t < end - 2500) {
      const s = strength[team] / (strength[0] + strength[1]);
      // the stronger side keeps the ball longer
      const t1 = t + Math.min(end - t, (4500 + r() * 6500) * (0.4 + 1.2 * s));
      const x = r();
      // ≈ 2.7 goals a match over ≈ 70 plays
      let outcome: Outcome = x < 0.038 * (0.5 + s) ? 'goal' : x < 0.13 ? 'chance' : x < 0.23 ? 'save' : x < 0.27 ? 'yellow' : x < 0.2715 ? 'red' : 'none';
      const mid = { a: Math.min(0.85, Math.max(start.a + 0.15, 0.45 + r() * 0.3)), y: 0.2 + r() * 0.6 };
      const endPt =
        outcome === 'goal' ? { a: 1.0, y: 0.45 + r() * 0.1 }
        : outcome === 'save' ? { a: 0.97, y: 0.46 + r() * 0.08 }
        : outcome === 'chance' ? { a: 1.02, y: r() < 0.5 ? 0.38 : 0.62 }
        : { a: 0.55 + r() * 0.3, y: 0.15 + r() * 0.7 };
      plays.push({ t0: t, t1, team, outcome, path: [start, mid, endPt] });
      if (outcome === 'goal' || outcome === 'save' || outcome === 'chance') {
        const who = shooter(team);
        ev(outcome, t1, team, who, line(outcome, who, r));
      } else if (outcome === 'yellow' || outcome === 'red') {
        // the defending side fouls; a second yellow is a red
        const def = (1 - team) as 0 | 1;
        const who = outfield(def);
        const n = (yellows[def]!.get(who) ?? 0) + 1;
        yellows[def]!.set(who, n);
        if (outcome === 'yellow' && n >= 2) outcome = 'red';
        if (outcome === 'red') sent[def]!.add(who);
        ev(outcome, t1, def, who, line(outcome, who, r));
      }
      t = t1;
      if (outcome === 'goal') {
        // celebration, then the conceding side kicks off from the centre spot
        const until = Math.min(end, t + CELEBRATE_MS);
        plays.push({ t0: t, t1: until, team, outcome: 'restart', path: [endPt, { a: 0.5, y: 0.5 }] });
        t = until;
        team = (1 - team) as 0 | 1;
        start = { a: 0.5, y: 0.5 };
      } else if (outcome === 'save' || outcome === 'chance') {
        // the keeper's throw / goal kick: the other side starts from its own box
        team = (1 - team) as 0 | 1;
        start = { a: 0.08, y: 0.5 };
      } else if (outcome === 'none') {
        // lost the ball: the other side picks it up where it was (mirrored)
        team = (1 - team) as 0 | 1;
        start = { a: 1 - endPt.a, y: endPt.y };
      } else start = endPt; // free kick where the foul was
    }
    ev(h === 0 ? 'half' : 'full', end, 0, '', h === 0 ? 'İlk yarı sona erdi.' : 'Maç sona erdi!');
  }
  cached = { key, plays, events, stoppage, lineups };
  return cached;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Everything the TV shows at `nowMs` (server clock) for a broadcast; pure and deterministic. */
export function tvMatchAt(b: TvBroadcast, nowMs: number): TvMatchState {
  const tl = timeline(b);
  const t = nowMs - b.startedAt;
  const phase: TvPhase = t < 0 ? 'pre' : t < TV_HALF_MS ? 'first' : t < TV_HALF_MS + TV_BREAK_MS ? 'half' : t < 2 * TV_HALF_MS + TV_BREAK_MS ? 'second' : 'full';
  const events = tl.events.filter((e) => e.t <= t);
  const score: [number, number] = [0, 0];
  const stats: TvStats = { possession: [50, 50], shots: [0, 0], onTarget: [0, 0], yellow: [0, 0], red: [0, 0] };
  let goal: TvMatchState['goal'] = null;
  for (const e of events) {
    if (e.kind === 'goal') {
      score[e.team]++;
      if (t - e.t < TV_GOAL_SHOW_MS) goal = { ...e, ago: t - e.t };
    }
    if (e.kind === 'goal' || e.kind === 'save' || e.kind === 'chance') stats.shots[e.team]++;
    if (e.kind === 'goal' || e.kind === 'save') stats.onTarget[e.team]++;
    if (e.kind === 'yellow') stats.yellow[e.team]++;
    if (e.kind === 'red') stats.red[e.team]++;
  }
  const poss = [0, 0];
  let cur: Play | null = null;
  for (const p of tl.plays) {
    if (p.t0 > t) break;
    if (p.outcome !== 'restart') poss[p.team]! += Math.min(t, p.t1) - p.t0;
    if (t < p.t1) cur = p;
  }
  if (poss[0]! + poss[1]! > 0) {
    const h = Math.round((poss[0]! / (poss[0]! + poss[1]!)) * 100);
    stats.possession = [h, 100 - h];
  }
  const half: 0 | 1 = phase === 'second' || phase === 'full' ? 1 : 0;
  const homeDir: 1 | -1 = half ? -1 : 1;
  let ball = { x: 0.5, y: 0.5 };
  let attack: TvMatchState['attack'] = null;
  if (cur) {
    const dir: 1 | -1 = cur.team === 0 ? homeDir : homeDir === 1 ? -1 : 1;
    const k = (t - cur.t0) / (cur.t1 - cur.t0);
    const segs = cur.path.length - 1;
    const f = Math.min(segs - 1e-9, k * segs);
    const i = Math.floor(f);
    const u = smooth(f - i);
    const p0 = cur.path[i]!;
    const p1 = cur.path[i + 1]!;
    // a little dribbling wobble across the line of play
    const wob = cur.outcome === 'restart' ? 0 : Math.sin(k * 17 + cur.t0) * 0.03 * Math.sin(Math.PI * k);
    const a = p0.a + (p1.a - p0.a) * u;
    ball = { x: dir > 0 ? a : 1 - a, y: Math.min(0.98, Math.max(0.02, p0.y + (p1.y - p0.y) * u + wob)) };
    if (cur.outcome !== 'restart') attack = { team: cur.team, dir, progress: a };
  }
  const minute = minuteAt(t, tl.stoppage);
  const clock = phase === 'pre' ? "0'" : phase === 'half' ? 'İY' : phase === 'full' ? 'MS' : tvMinuteLabel(minute, half);
  return { phase, done: t >= TV_TOTAL_MS, minute, clock, score, events, last: events[events.length - 1] ?? null, goal, ball, attack, homeDir, stats, lineups: tl.lineups };
}

/** epoch ms when the TV goes back to its normal programme */
export const tvBroadcastEnd = (b: TvBroadcast): number => b.startedAt + TV_TOTAL_MS;
