import { COLLIDERS, MAP_HALF, PLAYER_HEIGHT, PLAYER_RADIUS, STEP_HEIGHT, type Vec2 } from '@sokak/shared';

/** Ground-level walkability grid + A* for bots. */
export const CELL = 0.5;
const ORIGIN = -MAP_HALF;
export const N = Math.round((MAP_HALF * 2) / CELL);

const blocked = new Uint8Array(N * N);
{
  const r = PLAYER_RADIUS + 0.05;
  for (const c of COLLIDERS) {
    if (!c.solid || c.maxY <= STEP_HEIGHT || c.minY >= PLAYER_HEIGHT) continue;
    const i0 = Math.max(0, Math.floor((c.minX - r - ORIGIN) / CELL));
    const i1 = Math.min(N - 1, Math.floor((c.maxX + r - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((c.minZ - r - ORIGIN) / CELL));
    const j1 = Math.min(N - 1, Math.floor((c.maxZ + r - ORIGIN) / CELL));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        // test the cell center with the player footprint
        const cx = ORIGIN + (i + 0.5) * CELL;
        const cz = ORIGIN + (j + 0.5) * CELL;
        if (cx + r > c.minX && cx - r < c.maxX && cz + r > c.minZ && cz - r < c.maxZ) blocked[j * N + i] = 1;
      }
    }
  }
  for (let k = 0; k < N; k++) {
    blocked[k] = blocked[(N - 1) * N + k] = blocked[k * N] = blocked[k * N + N - 1] = 1;
  }
}

export const toCell = (v: number) => Math.max(0, Math.min(N - 1, Math.floor((v - ORIGIN) / CELL)));
export const cellCenter = (i: number) => ORIGIN + (i + 0.5) * CELL;

export function isWalkable(x: number, z: number): boolean {
  return blocked[toCell(z) * N + toCell(x)] === 0;
}

/** Nearest walkable cell center to a point (spiral search). */
export function nearestWalkable(p: Vec2): Vec2 {
  const ci = toCell(p.x);
  const cj = toCell(p.z);
  for (let rad = 0; rad < 20; rad++) {
    for (let di = -rad; di <= rad; di++) {
      for (let dj = -rad; dj <= rad; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        if (!blocked[j * N + i]) return { x: cellCenter(i), z: cellCenter(j) };
      }
    }
  }
  return p;
}

/** Straight walkable line on the grid (sampled). */
export function clearLine(a: Vec2, b: Vec2): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.ceil(d / (CELL * 0.5));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (!isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

// binary heap A*
const g = new Float32Array(N * N);
const came = new Int32Array(N * N);
const stamp = new Uint32Array(N * N);
const closed = new Uint32Array(N * N);
let gen = 0;

export function findPath(from: Vec2, to: Vec2, maxNodes = 40000): Vec2[] | null {
  const s = nearestWalkable(from);
  const t = nearestWalkable(to);
  const si = toCell(s.x);
  const sj = toCell(s.z);
  const ti = toCell(t.x);
  const tj = toCell(t.z);
  const start = sj * N + si;
  const goal = tj * N + ti;
  gen++;
  const heap: number[] = [];
  const fScore: number[] = [];
  const push = (node: number, f: number) => {
    heap.push(node);
    fScore.push(f);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fScore[p]! <= fScore[k]!) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      [fScore[p], fScore[k]] = [fScore[k]!, fScore[p]!];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const lastN = heap.pop()!;
    const lastF = fScore.pop()!;
    if (heap.length) {
      heap[0] = lastN;
      fScore[0] = lastF;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && fScore[l]! < fScore[m]!) m = l;
        if (r < heap.length && fScore[r]! < fScore[m]!) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        [fScore[m], fScore[k]] = [fScore[k]!, fScore[m]!];
        k = m;
      }
    }
    return top;
  };
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - ti);
    const dz = Math.abs(j - tj);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  stamp[start] = gen;
  g[start] = 0;
  came[start] = -1;
  push(start, h(si, sj));
  let expanded = 0;
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (++expanded > maxNodes) return null;
    const ci = cur % N;
    const cj = (cur / N) | 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nb = nj * N + ni;
        if (blocked[nb]) continue;
        if (di && dj && (blocked[cj * N + ni] || blocked[nj * N + ci])) continue;
        const ng = g[cur]! + (di && dj ? Math.SQRT2 : 1);
        if (stamp[nb] !== gen || ng < g[nb]!) {
          stamp[nb] = gen;
          g[nb] = ng;
          came[nb] = cur;
          push(nb, ng + h(ni, nj));
        }
      }
    }
  }
  if (stamp[goal] !== gen) return null;
  const cells: number[] = [];
  for (let c = goal; c !== -1; c = came[c]!) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => ({ x: cellCenter(c % N), z: cellCenter((c / N) | 0) }));
  // string pulling
  const out: Vec2[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 24);
    while (j > i + 1 && !clearLine(pts[i]!, pts[j]!)) j--;
    out.push(pts[j]!);
    i = j;
  }
  if (out.length === 0) out.push(t);
  return out;
}
