import type { Aabb } from '@sokak/shared';

export interface P2 {
  x: number;
  z: number;
}

/**
 * Walkability grid over a collider set, for NPCs that need to cross the whole map
 * (the çaycı delivering to the terrace, the street, the market or the sahil).
 * A* on an 8-connected grid, then string-pulled into a few straight legs.
 */
export class NavGrid {
  private readonly n: number;
  private readonly blocked: Uint8Array;

  constructor(
    colliders: readonly Aabb[],
    private readonly half: number,
    private readonly cell = 0.5,
    radius = 0.3,
  ) {
    this.n = Math.ceil((half * 2) / cell);
    this.blocked = new Uint8Array(this.n * this.n);
    for (const c of colliders) {
      // only what stands in a walker's way: solid and reaching the body
      if (!c.solid || c.minY > 1.6 || c.maxY < 0.1) continue;
      const i0 = this.idx(c.minX - radius);
      const i1 = this.idx(c.maxX + radius);
      const j0 = this.idx(c.minZ - radius);
      const j1 = this.idx(c.maxZ + radius);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.blocked[j * this.n + i] = 1;
    }
  }

  private idx(v: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.floor((v + this.half) / this.cell)));
  }

  private center(k: number): P2 {
    return { x: ((k % this.n) + 0.5) * this.cell - this.half, z: (Math.floor(k / this.n) + 0.5) * this.cell - this.half };
  }

  isFree(x: number, z: number): boolean {
    return !this.blocked[this.idx(z) * this.n + this.idx(x)];
  }

  /** nearest walkable cell to a point (search in growing rings) */
  private nearestFree(p: P2): number {
    const ci = this.idx(p.x);
    const cj = this.idx(p.z);
    for (let r = 0; r < 12; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          if (!this.blocked[j * this.n + i]) return j * this.n + i;
        }
    return -1;
  }

  /** straight walk between two points stays on free cells */
  clear(a: P2, b: P2): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      if (!this.isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /** waypoints from `from` to `to` (excluding `from`); empty when unreachable */
  path(from: P2, to: P2): P2[] {
    const s = this.nearestFree(from);
    const g = this.nearestFree(to);
    if (s < 0 || g < 0) return [];
    const N = this.n * this.n;
    const cost = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const gx = g % this.n;
    const gz = Math.floor(g / this.n);
    const h = (k: number) => {
      const dx = Math.abs((k % this.n) - gx);
      const dz = Math.abs(Math.floor(k / this.n) - gz);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    };
    // binary heap of [f, k]
    const heapF: number[] = [];
    const heapK: number[] = [];
    const push = (f: number, k: number) => {
      let i = heapF.length;
      heapF.push(f);
      heapK.push(k);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p]! <= f) break;
        heapF[i] = heapF[p]!;
        heapK[i] = heapK[p]!;
        i = p;
      }
      heapF[i] = f;
      heapK[i] = k;
    };
    const pop = (): number => {
      const top = heapK[0]!;
      const lf = heapF.pop()!;
      const lk = heapK.pop()!;
      if (heapF.length) {
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          if (l >= heapF.length) break;
          const r = l + 1;
          const c = r < heapF.length && heapF[r]! < heapF[l]! ? r : l;
          if (heapF[c]! >= lf) break;
          heapF[i] = heapF[c]!;
          heapK[i] = heapK[c]!;
          i = c;
        }
        heapF[i] = lf;
        heapK[i] = lk;
      }
      return top;
    };
    cost[s] = 0;
    push(h(s), s);
    while (heapF.length) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === g) break;
      const ki = k % this.n;
      const kj = Math.floor(k / this.n);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ki + di;
          const j = kj + dj;
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          const nk = j * this.n + i;
          if (this.blocked[nk] || closed[nk]) continue;
          // no corner cutting
          if (di && dj && (this.blocked[kj * this.n + i] || this.blocked[j * this.n + ki])) continue;
          const c = cost[k]! + (di && dj ? 1.4142 : 1);
          if (c < cost[nk]!) {
            cost[nk] = c;
            prev[nk] = k;
            push(c + h(nk), nk);
          }
        }
    }
    if (prev[g] === -1 && g !== s) return [];
    const cells: P2[] = [];
    for (let k = g; k !== -1; k = prev[k]!) cells.push(this.center(k));
    cells.reverse();
    cells[0] = { x: from.x, z: from.z };
    if (this.isFree(to.x, to.z)) cells.push({ x: to.x, z: to.z });
    // string pulling: keep only the corners
    const out: P2[] = [];
    let a = cells[0]!;
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.clear(a, cells[j]!)) j--;
      out.push(cells[j]!);
      a = cells[j]!;
      i = j;
    }
    return out;
  }
}
