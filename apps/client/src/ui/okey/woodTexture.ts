/**
 * A varnished walnut/oak texture painted once on a canvas (no download) and exposed
 * as the CSS variable --wood, for the on-screen ıstaka and its tiers. Grain lines are
 * long wavy strokes with fine noise; a few darker knots and growth-ring bands.
 */
let done = false;

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function paintWood(w = 768, h = 192, base: [number, number, number] = [150, 92, 48], seed = 7): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const r = rand(seed);
  // base tone with slow lengthwise variation
  const g = ctx.createLinearGradient(0, 0, w, 0);
  for (let k = 0; k <= 8; k++) {
    const v = 0.9 + r() * 0.2;
    g.addColorStop(k / 8, `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // growth bands: wide soft darker stripes along the board
  for (let k = 0; k < 9; k++) {
    const y = r() * h;
    const th = 4 + r() * 14;
    ctx.fillStyle = `rgba(60,30,10,${0.05 + r() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.01 + k) * 6 + Math.sin(x * 0.043 + k * 3) * 2);
    for (let x = w; x >= 0; x -= 16) ctx.lineTo(x, y + th + Math.sin(x * 0.012 + k) * 6);
    ctx.fill();
  }
  // fine grain lines
  for (let k = 0; k < 140; k++) {
    const y0 = r() * h;
    const dark = r() < 0.7;
    ctx.strokeStyle = dark ? `rgba(55,28,10,${0.08 + r() * 0.22})` : `rgba(255,220,170,${0.05 + r() * 0.1})`;
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    const ph = r() * 10;
    const amp = 1 + r() * 4;
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * 0.008 + ph) * amp + Math.sin(x * 0.05 + ph * 2) * 0.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a couple of knots with the grain flowing around them
  for (let k = 0; k < 2; k++) {
    const x = 80 + r() * (w - 160);
    const y = 30 + r() * (h - 60);
    for (let ring = 6; ring >= 1; ring--) {
      ctx.strokeStyle = `rgba(50,22,6,${0.12 + ring * 0.03})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, ring * 5.5, ring * 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(45,20,5,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // pores
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Put the wood textures into CSS variables (once). */
export function installWoodCss(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  try {
    const root = document.documentElement.style;
    root.setProperty('--wood', `url(${paintWood(768, 192, [168, 104, 54], 7).toDataURL('image/jpeg', 0.86)})`);
    root.setProperty('--wood-dark', `url(${paintWood(512, 64, [96, 54, 26], 11).toDataURL('image/jpeg', 0.86)})`);
  } catch {
    /* no canvas: the CSS gradients alone still work */
  }
}
