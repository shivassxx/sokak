import * as THREE from 'three';

/**
 * Paints the character's texture atlas on a canvas: face, hairline, shirt,
 * trousers and shoes. The layout follows the UV map of the Kenney
 * "characterMedium" mesh (coordinates below are in a 1024² atlas):
 *   head        0…640 × 0…490   (face front centred at x 320, eyes at y ≈ 215)
 *   shoes     640…820 × 0…520   (soles on top, uppers below)
 *   skin bits 820…1024 × 130…520 and 640…1024 × 520…765 (hands)
 *   shirt       0…640 × 490…1024 (cross: back torso up, front torso down, sleeves sideways)
 *   trousers  630…1024 × 770…1024
 */
export interface Outfit {
  skin: string;
  hair: string;
  hairStyle: number;
  shirt: string;
  /** 0 plain tee · 1 striped · 2 polo with collar · 3 shirt with buttons */
  shirtStyle: number;
  pants: string;
  shoes: string;
  kid: boolean;
  moustache: boolean;
  bald: boolean;
  /** waistcoat colour (çaycı, amcalar) */
  vest: string | null;
  apron: boolean;
  glasses?: boolean;
  tespih?: boolean;
  grey?: boolean;
}

const SIZE = 512;
const cache = new Map<string, THREE.CanvasTexture>();

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f);
  else c.lerp(new THREE.Color(1, 1, 1), f - 1);
  return `#${c.getHexString()}`;
}

/** Cached texture per outfit (identical looks share one GPU texture). */
export function paintSkin(o: Outfit): THREE.CanvasTexture {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.scale(SIZE / 1024, SIZE / 1024);
  paint(ctx, o);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // glTF UV convention
  tex.anisotropy = 4;
  if (cache.size > 80) {
    const first = cache.keys().next().value as string;
    cache.get(first)?.dispose();
    cache.delete(first);
  }
  cache.set(key, tex);
  return tex;
}

function paint(ctx: CanvasRenderingContext2D, o: Outfit): void {
  const skin = o.skin;
  const hair = o.grey ? '#b9b4ab' : o.hair;
  // base: skin everywhere (hands, neck, unused areas)
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, 1024, 1024);

  paintHead(ctx, o, skin, hair);
  paintShoes(ctx, o);
  paintShirt(ctx, o, skin);
  paintPants(ctx, o);
}

// ------------------------------------------------------------------ head
function paintHead(ctx: CanvasRenderingContext2D, o: Outfit, skin: string, hair: string): void {
  // soft shading towards the jaw / neck
  const g = ctx.createLinearGradient(0, 260, 0, 490);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(120,50,30,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 260, 640, 230);

  // hair
  ctx.fillStyle = hair;
  if (o.bald) {
    // horseshoe around the back and sides
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.bezierCurveTo(80, 140, 150, 170, 175, 205);
    ctx.lineTo(172, 255);
    ctx.bezierCurveTo(120, 270, 60, 300, 0, 320);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(640, 150);
    ctx.bezierCurveTo(560, 140, 490, 170, 465, 205);
    ctx.lineTo(468, 255);
    ctx.bezierCurveTo(520, 270, 580, 300, 640, 320);
    ctx.closePath();
    ctx.fill();
  } else {
    const style = o.hairStyle;
    const longSides = style === 3 || style === 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(640, 0);
    ctx.lineTo(640, longSides ? 345 : 320);
    // right side of head down to the ear
    ctx.bezierCurveTo(580, 300, 520, 270, 478, 248);
    ctx.lineTo(470, 205);
    // right temple → over the face → left temple
    if (style === 2) {
      // pulled back: high smooth hairline
      ctx.bezierCurveTo(440, 170, 420, 130, 400, 125);
      ctx.bezierCurveTo(360, 110, 280, 110, 240, 125);
      ctx.bezierCurveTo(220, 130, 200, 170, 170, 205);
    } else if (style === 3) {
      // middle parting
      ctx.bezierCurveTo(440, 230, 420, 150, 395, 145);
      ctx.bezierCurveTo(360, 135, 335, 140, 320, 120);
      ctx.bezierCurveTo(305, 140, 280, 135, 245, 145);
      ctx.bezierCurveTo(220, 150, 200, 230, 170, 205);
    } else if (style === 4) {
      // spiky fringe
      ctx.lineTo(405, 175);
      for (let i = 0; i < 7; i++) {
        const x = 400 - i * 25;
        ctx.lineTo(x - 12, 168 + (i % 2) * 6);
        ctx.lineTo(x - 25, 140);
      }
      ctx.lineTo(170, 205);
    } else {
      // side-swept fringe (short / curly)
      ctx.bezierCurveTo(430, 200, 410, 160, 400, 150);
      ctx.bezierCurveTo(380, 150, 360, 175, 330, 168);
      ctx.bezierCurveTo(300, 160, 280, 140, 245, 150);
      ctx.bezierCurveTo(230, 160, 205, 200, 170, 205);
    }
    ctx.lineTo(162, 248);
    ctx.bezierCurveTo(120, 270, 60, 300, 0, longSides ? 345 : 320);
    ctx.closePath();
    ctx.fill();
    if (style === 1) {
      // curly edge
      for (let i = 0; i < 26; i++) {
        const x = (i / 25) * 640;
        const y = 300 - Math.sin((i / 25) * Math.PI) * 120 + (i % 2) * 8;
        if (x > 230 && x < 410) continue;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // a few strands of shine
    ctx.strokeStyle = shade(hair, 1.25);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(150 + i * 60, 40);
      ctx.quadraticCurveTo(170 + i * 60, 80, 160 + i * 60, 110);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ears (on top of the hair)
  for (const x of [185, 455]) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(x, 232, 22, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,90,80,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + (x < 320 ? 3 : -3), 234, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  paintFace(ctx, o, skin, hair);
}

function paintFace(ctx: CanvasRenderingContext2D, o: Outfit, skin: string, hair: string): void {
  const cx = 321;
  const ey = o.kid ? 214 : 212;
  const dx = o.kid ? 37 : 34;
  // cheeks
  if (o.kid) {
    ctx.fillStyle = 'rgba(255,110,110,0.28)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 60, 252, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // eyes
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    if (o.kid) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, ey, 15, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2e1c';
      ctx.beginPath();
      ctx.ellipse(x + s * 1, ey + 2, 11, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#140d08';
      ctx.beginPath();
      ctx.ellipse(x + s * 1, ey + 3, 6.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 4, ey - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 4, ey + 7, 2, 0, Math.PI * 2);
      ctx.fill();
      // upper lid line
      ctx.strokeStyle = '#2b1a10';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(x, ey, 15, 18, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1d140e';
      ctx.beginPath();
      ctx.ellipse(x, ey + 2, 8.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 3, ey - 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // brows
  const browCol = o.bald || o.grey ? '#8a8378' : shade(hair, 0.85);
  ctx.strokeStyle = browCol;
  ctx.lineCap = 'round';
  ctx.lineWidth = o.kid ? 6 : 9;
  for (const s of [-1, 1]) {
    const x = cx + s * dx;
    ctx.beginPath();
    ctx.moveTo(x - s * 14, ey - (o.kid ? 27 : 22));
    ctx.quadraticCurveTo(x, ey - (o.kid ? 33 : 26), x + s * 15, ey - (o.kid ? 26 : 19));
    ctx.stroke();
  }
  // nose
  ctx.fillStyle = shade(skin, 0.88);
  ctx.beginPath();
  ctx.ellipse(cx, 243, o.kid ? 7 : 9, o.kid ? 5 : 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // mouth
  if (o.moustache) {
    ctx.fillStyle = o.grey ? '#9d978d' : shade(hair, 0.9);
    ctx.beginPath();
    ctx.moveTo(cx, 255);
    ctx.bezierCurveTo(cx + 20, 248, cx + 38, 254, cx + 40, 272);
    ctx.bezierCurveTo(cx + 26, 266, cx + 14, 266, cx, 268);
    ctx.bezierCurveTo(cx - 14, 266, cx - 26, 266, cx - 40, 272);
    ctx.bezierCurveTo(cx - 38, 254, cx - 20, 248, cx, 255);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#7a2f26';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx - 13, 264);
    ctx.quadraticCurveTo(cx, 275, cx + 13, 264);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ shoes
function paintShoes(ctx: CanvasRenderingContext2D, o: Outfit): void {
  ctx.fillStyle = o.shoes;
  ctx.fillRect(640, 0, 182, 522);
  // soles (top ovals) and a white rim
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(640, 0, 182, 135);
  ctx.fillStyle = shade(o.shoes, 0.75);
  for (const y of [150, 330]) {
    ctx.fillRect(650, y, 165, 22); // ankle opening
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(650, y + 150, 165, 14); // sole edge
    ctx.fillStyle = shade(o.shoes, 0.75);
  }
  // laces
  ctx.strokeStyle = '#f7f3ea';
  ctx.lineWidth = 5;
  for (const y0 of [190, 370]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(715, y0 + i * 18);
      ctx.lineTo(748, y0 + i * 18);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ shirt
function paintShirt(ctx: CanvasRenderingContext2D, o: Outfit, skin: string): void {
  const base = o.shirt;
  ctx.fillStyle = base;
  ctx.fillRect(0, 490, 640, 534);
  // body shading: darker under the arms and at the hem
  let g = ctx.createLinearGradient(0, 1024, 0, 840);
  g.addColorStop(0, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 840, 640, 184);
  g = ctx.createLinearGradient(0, 490, 0, 640);
  g.addColorStop(0, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 490, 640, 150);

  if (o.shirtStyle === 1 && !o.vest) {
    // horizontal stripes on the torso (front and back)
    ctx.fillStyle = shade(base, 1.55);
    for (let y = 510; y < 1010; y += 44) {
      if (y > 700 && y < 830) continue; // keep the shoulders plain
      ctx.fillRect(205, y, 290, 18);
    }
  }
  // sleeve cuffs and hem
  ctx.fillStyle = shade(base, 0.78);
  ctx.fillRect(28, 655, 26, 165);
  ctx.fillRect(588, 655, 26, 165);
  ctx.fillRect(200, 990, 300, 34);
  ctx.fillRect(200, 490, 300, 22);

  // neckline at the front (centre of the cross is the neck hole)
  const nx = 320;
  const ny = 752;
  if (o.shirtStyle === 2 || o.shirtStyle === 3) {
    // collar + placket
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(nx - 32, ny);
    ctx.lineTo(nx, ny + 70);
    ctx.lineTo(nx + 32, ny);
    ctx.fill();
    ctx.fillStyle = o.shirtStyle === 2 ? shade(base, 0.82) : shade(base, 1.2);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx + s * 34, ny - 6);
      ctx.lineTo(nx + s * 70, ny + 28);
      ctx.lineTo(nx + s * 12, ny + 60);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const buttons = o.shirtStyle === 3 ? 5 : 2;
    for (let i = 0; i < buttons; i++) {
      ctx.beginPath();
      ctx.arc(nx, ny + 82 + i * 30, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (o.shirtStyle === 3) {
      ctx.strokeStyle = shade(base, 0.8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(nx + 8, ny + 70);
      ctx.lineTo(nx + 8, 1000);
      ctx.stroke();
      // chest pocket
      ctx.strokeRect(nx + 45, ny + 95, 50, 50);
    }
  } else {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(nx, ny + 6, 40, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(base, 0.75);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(nx, ny + 6, 44, 28, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  if (o.vest) {
    // waistcoat over the shirt: front panels and full back
    ctx.fillStyle = o.vest;
    ctx.fillRect(205, 495, 290, 230); // back
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx + s * 40, ny + 20);
      ctx.lineTo(nx + s * 14, 1005);
      ctx.lineTo(nx + s * 150, 1005);
      ctx.lineTo(nx + s * 150, ny - 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#e8d9a8';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(nx + 24, ny + 110 + i * 45, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (o.apron) {
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(235, 880, 170, 125);
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 4;
    ctx.strokeRect(235, 880, 170, 125);
  }
}

// ------------------------------------------------------------------ trousers
function paintPants(ctx: CanvasRenderingContext2D, o: Outfit): void {
  const p = o.pants;
  ctx.fillStyle = p;
  ctx.fillRect(628, 766, 396, 258);
  // waistband / belt
  ctx.fillStyle = o.kid ? shade(p, 0.8) : '#3a2a20';
  ctx.fillRect(628, 778, 396, 24);
  if (!o.kid) {
    ctx.fillStyle = '#c9a65a';
    ctx.fillRect(716, 780, 18, 20);
  }
  // seams and hems
  ctx.strokeStyle = shade(p, 0.8);
  ctx.lineWidth = 4;
  for (const x of [680, 770, 870, 960]) {
    ctx.beginPath();
    ctx.moveTo(x, 805);
    ctx.lineTo(x, 1020);
    ctx.stroke();
  }
  ctx.fillStyle = shade(p, 0.82);
  ctx.fillRect(628, 1004, 396, 20);
  // pockets
  ctx.strokeStyle = shade(p, 1.2);
  ctx.lineWidth = 3;
  for (const x of [650, 850]) {
    ctx.beginPath();
    ctx.moveTo(x, 805);
    ctx.quadraticCurveTo(x + 15, 840, x + 45, 845);
    ctx.stroke();
  }
}
