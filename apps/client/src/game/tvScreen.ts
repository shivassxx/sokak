import * as THREE from 'three';
import { tvMatchAt, tvTeam, type TvBroadcast, type TvMatchState, type TvTeam } from '@sokak/shared';

/**
 * The kıraathane TVs' picture: one 512×288 canvas texture shared by every TV in the hall.
 * With no broadcast it shows the normal programme (an old match replay); during a
 * staff-started derby it draws the simulated match from `tvMatchAt` at server time:
 * a broadcast-camera pitch, both teams, the ball, the score bug, a "CANLI · DERBİ" badge,
 * the commentary line, the "GOOOL!" overlay and the half/full-time stats cards.
 * It redraws at about 15 fps (slower when nobody can see it), never every frame.
 */
const W = 512;
const H = 288;
const FPS = 15;

interface Dot {
  x: number;
  y: number;
}

// 4-4-2, attacker-relative: a = 0 own goal line … 1 the goal attacked, y across
const FORMATION: readonly Dot[] = [
  { x: 0.04, y: 0.5 },
  { x: 0.2, y: 0.15 },
  { x: 0.18, y: 0.38 },
  { x: 0.18, y: 0.62 },
  { x: 0.2, y: 0.85 },
  { x: 0.42, y: 0.12 },
  { x: 0.4, y: 0.38 },
  { x: 0.4, y: 0.62 },
  { x: 0.42, y: 0.88 },
  { x: 0.62, y: 0.4 },
  { x: 0.64, y: 0.6 },
];

export class TvScreen {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private broadcast: TvBroadcast | null = null;
  private teams: [TvTeam, TvTeam] | null = null;
  private acc = 1;
  private t = 0;
  /** eased player positions (pitch coords) for both teams */
  private men: Dot[][] = [FORMATION.map((p) => ({ ...p })), FORMATION.map((p) => ({ ...p }))];
  private camX = 0.5;
  private cheer = 0;
  private nowMs = 0;
  // normal programme: a replay of some old match
  private replay = { ball: { x: 0.5, y: 0.5, vx: 0.12, vy: 0.08 } };

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
  }

  setBroadcast(b: TvBroadcast | null): void {
    if (b?.id === this.broadcast?.id) return;
    this.broadcast = b;
    const home = b ? tvTeam(b.home) : undefined;
    const away = b ? tvTeam(b.away) : undefined;
    this.teams = home && away ? [home, away] : null;
    this.acc = 1;
  }

  /** `visible` false (the viewer is out on the street or the sahil) drops the rate to 2 fps */
  update(dt: number, nowMs: number, visible: boolean): void {
    this.t += dt;
    this.acc += dt;
    const step = visible ? 1 / FPS : 0.5;
    if (this.acc < step) return;
    const elapsed = this.acc;
    this.acc = 0;
    this.nowMs = nowMs;
    const s = this.broadcast && this.teams ? tvMatchAt(this.broadcast, nowMs) : null;
    if (s && !s.done) this.drawMatch(s, this.teams!, Math.min(0.5, elapsed));
    else this.drawReplay(Math.min(0.5, elapsed));
    this.texture.needsUpdate = true;
  }

  // ------------------------------------------------------------------ pitch & camera
  /** broadcast camera: a low perspective from the near touchline, panning with the ball */
  private proj(x: number, y: number): { sx: number; sy: number; k: number } {
    const top = 46;
    const bot = 300;
    const depth = 0.55 + 0.45 * y; // far side smaller
    const span = 0.62; // part of the pitch length in view
    return { sx: W / 2 + ((x - this.camX) / span) * W * 0.78 * depth, sy: top + (bot - top) * (0.08 + y * 0.86), k: depth };
  }

  private drawPitch(crowd: [[string, string], [string, string]] | null): void {
    const c = this.ctx;
    c.fillStyle = '#0c1a10';
    c.fillRect(0, 0, W, H);
    // mown stripes across the length
    for (let i = 0; i < 16; i++) {
      const a = this.proj(i / 16, 0);
      const b = this.proj((i + 1) / 16, 0);
      const d = this.proj((i + 1) / 16, 1.12);
      const e = this.proj(i / 16, 1.12);
      c.fillStyle = i % 2 ? '#2f8a3c' : '#369644';
      c.beginPath();
      c.moveTo(a.sx, a.sy - 30);
      c.lineTo(b.sx, b.sy - 30);
      c.lineTo(d.sx, d.sy);
      c.lineTo(e.sx, e.sy);
      c.fill();
    }
    // stands behind the far touchline
    const standH = this.proj(0, 0).sy - 6;
    c.fillStyle = '#1c1f27';
    c.fillRect(0, 0, W, standH);
    // the crowd: each end in its team's colours (grey fans for the replay), bouncing after a goal
    const pan = -this.camX * 700;
    for (let i = 0; i < 260; i++) {
      const u = (i * 0.618034) % 1;
      const x = ((u * (W + 300) + pan) % (W + 300) + W + 300) % (W + 300) - 150;
      const row = i % 5;
      const fans = crowd ? crowd[u < 0.5 ? 0 : 1] : null;
      c.fillStyle = fans ? fans[i % 3 === 0 ? 1 : 0] : i % 3 ? '#5b6170' : '#8a8f9c';
      const jump = this.cheer > 0 ? Math.abs(Math.sin(this.t * 10 + i)) * 3 : 0;
      c.fillRect(x, 6 + row * ((standH - 12) / 5) - jump, 4, 4);
    }
    // ad boards
    const ab = this.proj(0, 0).sy - 8;
    c.fillStyle = '#d9d4c4';
    c.fillRect(0, ab, W, 6);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.5;
    const line = (pts: [number, number][]) => {
      c.beginPath();
      pts.forEach(([x, y], i) => {
        const p = this.proj(x, y);
        if (i) c.lineTo(p.sx, p.sy);
        else c.moveTo(p.sx, p.sy);
      });
      c.stroke();
    };
    line([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    line([[0.5, 0], [0.5, 1]]);
    for (const g of [0, 1]) {
      const d = g ? -1 : 1;
      line([[g, 0.2], [g + d * 0.16, 0.2], [g + d * 0.16, 0.8], [g, 0.8]]);
      line([[g, 0.37], [g + d * 0.055, 0.37], [g + d * 0.055, 0.63], [g, 0.63]]);
    }
    // centre circle (an ellipse on this camera)
    const cc = this.proj(0.5, 0.5);
    c.beginPath();
    c.ellipse(cc.sx, cc.sy, ((0.087 / 0.62) * W * 0.78 * cc.k), 0.135 * 254 * 0.86, 0, 0, Math.PI * 2);
    c.stroke();
  }

  private drawGoals(): void {
    const c = this.ctx;
    for (const g of [0, 1]) {
      const a = this.proj(g, 0.45);
      const b = this.proj(g, 0.55);
      const h = 16 * a.k;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(a.sx, a.sy);
      c.lineTo(a.sx, a.sy - h);
      c.lineTo(b.sx, b.sy - h);
      c.lineTo(b.sx, b.sy);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(Math.min(a.sx, b.sx) - (g ? 0 : 6), a.sy - h, 6, b.sy - a.sy + h);
    }
  }

  private drawMan(x: number, y: number, kit: [string, string], gk: boolean): void {
    const c = this.ctx;
    const p = this.proj(x, y);
    if (p.sx < -10 || p.sx > W + 10) return;
    const s = 1.6 * p.k + 0.45;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(p.sx + 2 * s, p.sy, 5 * s, 1.8 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1b1b1b';
    c.fillRect(p.sx - 2.6 * s, p.sy - 6 * s, 2 * s, 6 * s);
    c.fillRect(p.sx + 0.6 * s, p.sy - 6 * s, 2 * s, 6 * s);
    c.fillStyle = gk ? '#e4e049' : kit[1];
    c.fillRect(p.sx - 3 * s, p.sy - 8.5 * s, 6 * s, 3 * s);
    c.fillStyle = gk ? '#3b3b3b' : kit[0];
    c.fillRect(p.sx - 3.4 * s, p.sy - 15 * s, 6.8 * s, 7 * s);
    if (!gk) {
      c.fillStyle = kit[1];
      c.fillRect(p.sx - 0.8 * s, p.sy - 15 * s, 1.6 * s, 7 * s);
    }
    c.fillStyle = '#d6a77a';
    c.beginPath();
    c.arc(p.sx, p.sy - 17.4 * s, 2.3 * s, 0, Math.PI * 2);
    c.fill();
  }

  // ------------------------------------------------------------------ the derby
  private moveMen(s: TvMatchState, dt: number): void {
    const ease = Math.min(1, dt * 3.2);
    const ball = s.ball;
    const live = s.phase === 'first' || s.phase === 'second';
    for (const team of [0, 1] as const) {
      const dir = team === 0 ? s.homeDir : -s.homeDir;
      const toAbs = (a: number) => (dir > 0 ? a : 1 - a);
      const ballA = dir > 0 ? ball.x : 1 - ball.x;
      const has = s.attack?.team === team;
      // the side with the ball pushes up, the other drops and squeezes towards the ball
      const shift = live ? (ballA - 0.5) * 0.45 + (has ? 0.07 : -0.06) : 0;
      let nearest = -1;
      let nd = Infinity;
      const targets = FORMATION.map((f, i) => {
        const a = i === 0 ? f.x + Math.max(0, (ballA - 0.75) * 0.1) : f.x + shift;
        const y = i === 0 ? 0.5 + (ball.y - 0.5) * 0.25 : f.y + (ball.y - f.y) * (live ? 0.28 : 0);
        const p = { x: toAbs(a), y };
        const d = Math.hypot(p.x - ball.x, p.y - ball.y);
        if (i > 0 && d < nd) (nd = d), (nearest = i);
        return p;
      });
      // the man on the ball (attackers), the one pressing him (defenders)
      if (live && nearest > 0 && s.attack) {
        const t = targets[nearest]!;
        t.x = ball.x - (has ? dir * 0.012 : -dir * 0.03);
        t.y = ball.y + (has ? 0.01 : 0.03);
      }
      const men = this.men[team]!;
      targets.forEach((tg, i) => {
        const m = men[i]!;
        const k = i === nearest ? Math.min(1, dt * 6) : ease;
        m.x += (tg.x + Math.sin(this.t * 1.3 + i * 2.1) * 0.006 - m.x) * k;
        m.y += (tg.y + Math.cos(this.t * 1.1 + i * 1.7) * 0.008 - m.y) * k;
      });
    }
  }

  private drawMatch(s: TvMatchState, teams: [TvTeam, TvTeam], dt: number): void {
    const c = this.ctx;
    this.moveMen(s, dt);
    this.camX += (Math.min(0.69, Math.max(0.31, s.ball.x)) - this.camX) * Math.min(1, dt * 2.5);
    this.cheer = s.goal ? 1 : 0;
    this.drawPitch([teams[0].colors, teams[1].colors]);
    this.drawGoals();
    // far side first so the near men overlap them
    const all: { x: number; y: number; team: 0 | 1; gk: boolean }[] = [];
    for (const team of [0, 1] as const) this.men[team]!.forEach((m, i) => all.push({ x: m.x, y: m.y, team, gk: i === 0 }));
    all.sort((a, b) => a.y - b.y);
    const ballP = this.proj(s.ball.x, s.ball.y);
    let ballDrawn = false;
    for (const m of all) {
      if (!ballDrawn && m.y > s.ball.y) (this.drawBall(ballP, s)), (ballDrawn = true);
      this.drawMan(m.x, m.y, teams[m.team].colors, m.gk);
    }
    if (!ballDrawn) this.drawBall(ballP, s);
    this.drawBug(s, teams);
    // the commentary line (fresh events only)
    const last = s.last;
    const age = last ? this.nowMs - this.broadcast!.startedAt - last.t : Infinity;
    if (last && age < 7000 && s.phase !== 'half' && s.phase !== 'full' && !s.goal) {
      c.fillStyle = 'rgba(8,12,24,0.78)';
      c.fillRect(0, H - 30, W, 30);
      c.fillStyle = last.kind === 'yellow' ? '#ffd23a' : last.kind === 'red' ? '#ff5a4a' : '#ffffff';
      c.font = '600 15px system-ui, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(`${last.minute ? `${Math.min(last.minute, 90)}'  ` : ''}${last.text}`, 12, H - 15, W - 24);
    }
    if (s.goal) this.drawGoal(s, teams);
    else if (s.phase === 'half' || s.phase === 'full') this.drawStats(s, teams);
    else if (s.phase === 'pre') this.drawCard('BİRAZDAN', `${teams[0].name} – ${teams[1].name}`, 'Derbi heyecanı başlamak üzere!');
  }

  private drawBall(p: { sx: number; sy: number; k: number }, s: TvMatchState): void {
    const c = this.ctx;
    // a little hop while the ball travels
    const hop = s.attack ? Math.abs(Math.sin(this.t * 5)) * 3 * p.k : 0;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(p.sx + 1, p.sy, 3 * p.k + 1, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#222';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(p.sx, p.sy - 2.5 * p.k - hop, 2.8 * p.k + 1.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  private chip(x: number, y: number, team: TvTeam): void {
    const c = this.ctx;
    c.fillStyle = team.colors[0];
    c.fillRect(x, y, 6, 22);
    c.fillStyle = team.colors[1];
    c.fillRect(x + 6, y, 4, 22);
  }

  /** the score bug (top left) and the live badge (top right) */
  private drawBug(s: TvMatchState, teams: [TvTeam, TvTeam]): void {
    const c = this.ctx;
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(10,14,28,0.88)';
    c.fillRect(10, 10, 226, 26);
    this.chip(12, 12, teams[0]);
    c.font = '800 15px system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.fillText(teams[0].short, 27, 24);
    c.fillStyle = '#f2f2f2';
    c.fillRect(70, 12, 52, 22);
    c.fillStyle = '#111111';
    c.textAlign = 'center';
    c.fillText(`${s.score[0]} - ${s.score[1]}`, 96, 24);
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.fillText(teams[1].short, 128, 24);
    this.chip(170, 12, teams[1]);
    c.fillStyle = '#ffd23a';
    c.textAlign = 'center';
    c.fillText(s.clock, 206, 24);
    // CANLI · DERBİ
    const blink = Math.sin(this.t * 5) > -0.3;
    c.fillStyle = '#c8102e';
    c.fillRect(W - 128, 10, 118, 26);
    c.fillStyle = blink ? '#ffffff' : 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.arc(W - 116, 23, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.font = '800 13px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('CANLI · DERBİ', W - 106, 24);
  }

  private drawGoal(s: TvMatchState, teams: [TvTeam, TvTeam]): void {
    const c = this.ctx;
    const g = s.goal!;
    const team = teams[g.team];
    const k = Math.min(1, g.ago / 350);
    const pop = 1 + (1 - k) * 0.6 + Math.sin(this.t * 9) * 0.03;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, 0, W, H);
    // a band in the scoring side's colours
    c.fillStyle = team.colors[0];
    c.fillRect(0, 92, W, 104);
    c.fillStyle = team.colors[1];
    c.fillRect(0, 92, W, 6);
    c.fillRect(0, 190, W, 6);
    c.save();
    c.translate(W / 2, 136);
    c.scale(pop, pop);
    c.font = 'italic 900 66px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 6;
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.strokeText('GOOOL!', 0, 0);
    c.fillStyle = '#ffffff';
    c.fillText('GOOOL!', 0, 0);
    c.restore();
    c.font = '700 18px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.fillText(`⚽ ${g.player}  ${Math.min(g.minute, 90)}${g.minute > 90 ? '+' : ''}'  ·  ${team.name}`, W / 2, 178);
    c.fillStyle = 'rgba(10,14,28,0.9)';
    c.fillRect(W / 2 - 110, 210, 220, 34);
    c.fillStyle = '#ffffff';
    c.font = '800 20px system-ui, sans-serif';
    c.fillText(`${teams[0].short}  ${s.score[0]} - ${s.score[1]}  ${teams[1].short}`, W / 2, 228);
  }

  private drawCard(title: string, line1: string, line2: string): void {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,12,24,0.82)';
    c.fillRect(56, 70, W - 112, 150);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffd23a';
    c.font = '800 22px system-ui, sans-serif';
    c.fillText(title, W / 2, 104);
    c.fillStyle = '#ffffff';
    c.font = '700 18px system-ui, sans-serif';
    c.fillText(line1, W / 2, 144, W - 140);
    c.font = '500 15px system-ui, sans-serif';
    c.fillText(line2, W / 2, 178, W - 140);
  }

  private drawStats(s: TvMatchState, teams: [TvTeam, TvTeam]): void {
    const c = this.ctx;
    const x0 = 70;
    const x1 = W - 70;
    c.fillStyle = 'rgba(8,12,24,0.9)';
    c.fillRect(x0, 46, x1 - x0, 228);
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillStyle = '#ffd23a';
    c.font = '800 17px system-ui, sans-serif';
    c.fillText(s.phase === 'half' ? 'DEVRE ARASI' : 'MAÇ SONUCU', W / 2, 64);
    this.chip(x0 + 10, 80, teams[0]);
    this.chip(x1 - 20, 80, teams[1]);
    c.fillStyle = '#ffffff';
    c.font = '800 20px system-ui, sans-serif';
    c.fillText(`${teams[0].short}   ${s.score[0]} - ${s.score[1]}   ${teams[1].short}`, W / 2, 92);
    // scorers under each side
    c.font = '500 11px system-ui, sans-serif';
    c.fillStyle = '#c9d3e6';
    for (const team of [0, 1] as const) {
      const goals = s.events.filter((e) => e.kind === 'goal' && e.team === team).map((e) => `${e.player} ${Math.min(e.minute, 90)}'`);
      c.textAlign = team ? 'right' : 'left';
      c.fillText(goals.slice(0, 3).join(', '), team ? x1 - 10 : x0 + 10, 116, (x1 - x0) / 2 - 16);
    }
    const rows: [string, number, number, string?][] = [
      ['Topla oynama', s.stats.possession[0], s.stats.possession[1], '%'],
      ['Şut', s.stats.shots[0], s.stats.shots[1]],
      ['İsabetli şut', s.stats.onTarget[0], s.stats.onTarget[1]],
      ['Sarı kart', s.stats.yellow[0], s.stats.yellow[1]],
      ['Kırmızı kart', s.stats.red[0], s.stats.red[1]],
    ];
    rows.forEach(([label, a, b, unit], i) => {
      const y = 140 + i * 26;
      c.font = '700 14px system-ui, sans-serif';
      c.fillStyle = '#ffffff';
      c.textAlign = 'left';
      c.fillText(`${unit ?? ''}${a}`, x0 + 14, y);
      c.textAlign = 'right';
      c.fillText(`${unit ?? ''}${b}`, x1 - 14, y);
      c.textAlign = 'center';
      c.font = '500 13px system-ui, sans-serif';
      c.fillStyle = '#c9d3e6';
      c.fillText(label, W / 2, y - 5);
      // bar
      const tot = a + b || 1;
      const bw = 200;
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(W / 2 - bw / 2, y + 6, bw, 4);
      c.fillStyle = teams[0].colors[0] === '#111111' ? '#dddddd' : teams[0].colors[0];
      c.fillRect(W / 2 - bw / 2, y + 6, (bw * a) / tot, 4);
    });
  }

  // ------------------------------------------------------------------ normal programme
  private drawReplay(dt: number): void {
    const c = this.ctx;
    const b = this.replay.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 0.06 || b.x > 0.94) b.vx *= -1;
    if (b.y < 0.08 || b.y > 0.92) b.vy *= -1;
    if (Math.random() < 0.02) (b.vx = (Math.random() - 0.5) * 0.3), (b.vy = (Math.random() - 0.5) * 0.25);
    this.camX += (Math.min(0.69, Math.max(0.31, b.x)) - this.camX) * Math.min(1, dt * 2);
    // muted, slightly faded colours: an old recording
    this.cheer = 0;
    this.drawPitch(null);
    this.drawGoals();
    const kits: [string, string][] = [
      ['#d8473b', '#ffffff'],
      ['#f4f4f4', '#2a2a2a'],
    ];
    for (const team of [0, 1] as const) {
      const men = this.men[team]!;
      FORMATION.forEach((f, i) => {
        const m = men[i]!;
        const tx = team ? 1 - f.x - (b.x - 0.5) * 0.3 : f.x + (b.x - 0.5) * 0.3;
        const ty = f.y + (b.y - f.y) * 0.25;
        m.x += (tx + Math.sin(this.t + i) * 0.01 - m.x) * Math.min(1, dt * 2);
        m.y += (ty - m.y) * Math.min(1, dt * 2);
        this.drawMan(m.x, m.y, kits[team]!, i === 0);
      });
    }
    const p = this.proj(b.x, b.y);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(p.sx, p.sy - 2.5 * p.k, 2.4 * p.k + 1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(40,30,10,0.18)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,14,28,0.8)';
    c.fillRect(10, 10, 210, 26);
    c.fillStyle = '#ffffff';
    c.font = '700 14px system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`ÜSKÜDAR 2 - 1 KADIKÖY  ${60 + (Math.floor(this.t / 4) % 30)}'`, 18, 24);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = '800 13px system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText('TEKRAR', W - 14, 24);
  }
}
