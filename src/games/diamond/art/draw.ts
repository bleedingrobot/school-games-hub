/**
 * Diamond Drop's drawn (code) art: every picture in the game, drawn on a canvas. It is the whole look until James's
 * paintings arrive (docs/DIAMOND-ART-PLAN.md), and the fallback for good after. Everything is drawn in field units
 * (shared/diamond/config.ts: 1000 × 700, y down) or in a small local box; the caller scales the canvas.
 *
 * Only looks live here. Nothing in this file is read by the rules, so a picture can never change a level.
 * Gems differ by shape as well as colour, so colour-blind pupils can tell them apart.
 */
import { FIELD_H, FIELD_W, GROUND_Y, PIVOT, type GemId } from '../../../../shared/diamond/config';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

/** Small seeded numbers for decoration only (never the rules' random). */
export function decoRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function poly(ctx: Ctx, pts: readonly Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

function star(ctx: Ctx, x: number, y: number, r: number, points = 5, inner = 0.45, turn = -Math.PI / 2) {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = turn + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  poly(ctx, pts);
}

function heart(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.8, y - r * 1.25, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.25, x + r * 1.6, y - r * 0.1, x, y + r);
  ctx.closePath();
}

// ————————————————————————————————————————— Gems —————————————————————————————————————————

export const GEM_LOOK: Record<GemId, { fill: string; dark: string; light: string; shape: string }> = {
  quartz: { fill: '#e9f3ff', dark: '#5c7699', light: '#ffffff', shape: 'a tall six-sided crystal' },
  jade: { fill: '#86dcb0', dark: '#2a6e4c', light: '#d6fbe6', shape: 'a smooth round pebble' },
  amethyst: { fill: '#a35be6', dark: '#4d1c80', light: '#e2c6ff', shape: 'three pointed crystals' },
  topaz: { fill: '#ffb22e', dark: '#8f4d00', light: '#ffe6a6', shape: 'a teardrop' },
  emerald: { fill: '#14a85e', dark: '#064a28', light: '#7ff0b3', shape: 'a rectangle with cut corners' },
  sapphire: { fill: '#3473ff', dark: '#122d78', light: '#a9c4ff', shape: 'a round sparkling cut' },
  ruby: { fill: '#e3263d', dark: '#6e0b18', light: '#ff9aa6', shape: 'a triangle' },
  fireOpal: { fill: '#ff6b2c', dark: '#7d2300', light: '#ffd27a', shape: 'an oval with flame flecks' },
  starSapphire: { fill: '#2a3fa8', dark: '#0b1440', light: '#ffffff', shape: 'a dome with a six-pointed star' },
  heartDiamond: { fill: '#ffeef6', dark: '#b4417a', light: '#ffffff', shape: 'a big sparkling heart' },
};

/**
 * One gem, centred on (x, y), about r across from the middle. `shadow` draws it as a dark unknown shape (the Gem Book's
 * pages for gems not found yet); `halo` adds a soft light behind it so dark gems show on dark rock.
 */
export function drawGem(ctx: Ctx, gem: GemId, x: number, y: number, r: number, opts: { shadow?: boolean; halo?: boolean; sparkle?: number } = {}) {
  const look = GEM_LOOK[gem];
  const fill = opts.shadow ? '#2b2b3a' : look.fill;
  const dark = opts.shadow ? '#11111a' : look.dark;
  const light = opts.shadow ? '#3a3a4c' : look.light;
  ctx.save();
  if (opts.halo && !opts.shadow) {
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.7);
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    circle(ctx, x, y, r * 1.7);
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = dark;
  ctx.fillStyle = fill;
  const facet = (pts: readonly Pt[], colour: string) => {
    poly(ctx, pts);
    ctx.fillStyle = colour;
    ctx.fill();
  };
  switch (gem) {
    case 'quartz': {
      const w = r * 0.62;
      const pts: Pt[] = [[x, y - r], [x + w, y - r * 0.55], [x + w, y + r * 0.6], [x, y + r], [x - w, y + r * 0.6], [x - w, y - r * 0.55]];
      poly(ctx, pts); ctx.fill(); ctx.stroke();
      facet([[x, y - r], [x + w, y - r * 0.55], [x, y - r * 0.1], [x - w, y - r * 0.55]], light);
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.1); ctx.lineTo(x, y + r); ctx.stroke();
      break;
    }
    case 'jade': {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.78, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light; ctx.globalAlpha *= 0.8;
      ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.28, r * 0.35, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'amethyst': {
      const spike = (cx: number, h: number, w: number) => {
        const pts: Pt[] = [[cx - w, y + r * 0.85], [cx - w, y + r * 0.85 - h * 0.6], [cx, y + r * 0.85 - h], [cx + w, y + r * 0.85 - h * 0.6], [cx + w, y + r * 0.85]];
        poly(ctx, pts); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
        facet([[cx, y + r * 0.85 - h], [cx + w, y + r * 0.85 - h * 0.6], [cx, y + r * 0.85 - h * 0.45]], light);
      };
      spike(x - r * 0.5, r * 1.2, r * 0.3);
      spike(x + r * 0.5, r * 1.3, r * 0.3);
      spike(x, r * 1.8, r * 0.38);
      break;
    }
    case 'topaz': {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.bezierCurveTo(x + r * 0.35, y - r * 0.5, x + r * 0.85, y, x + r * 0.8, y + r * 0.35);
      ctx.arc(x, y + r * 0.3, r * 0.8, 0.06, Math.PI - 0.06);
      ctx.bezierCurveTo(x - r * 0.85, y, x - r * 0.35, y - r * 0.5, x, y - r);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      facet([[x, y - r * 0.75], [x + r * 0.35, y + r * 0.2], [x, y + r * 0.75], [x - r * 0.35, y + r * 0.2]], light);
      break;
    }
    case 'emerald': {
      const w = r * 0.95, h = r * 0.7, c = r * 0.3;
      poly(ctx, [[x - w + c, y - h], [x + w - c, y - h], [x + w, y - h + c], [x + w, y + h - c], [x + w - c, y + h], [x - w + c, y + h], [x - w, y + h - c], [x - w, y - h + c]]);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = light; ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.strokeRect(x - w * 0.55, y - h * 0.45, w * 1.1, h * 0.9);
      break;
    }
    case 'sapphire': {
      circle(ctx, x, y, r * 0.95); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light;
      const pts: Pt[] = [];
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; pts.push([x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5]); }
      poly(ctx, pts); ctx.globalAlpha *= 0.75; ctx.fill();
      ctx.globalAlpha /= 0.75; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.06);
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); ctx.stroke(); }
      break;
    }
    case 'ruby': {
      const pts: Pt[] = [[x, y + r], [x - r * 0.98, y - r * 0.62], [x + r * 0.98, y - r * 0.62]];
      poly(ctx, pts); ctx.fill(); ctx.stroke();
      facet([[x, y - r * 0.62], [x - r * 0.45, y - r * 0.62], [x, y + r * 0.25], [x + r * 0.45, y - r * 0.62]], light);
      break;
    }
    case 'fireOpal': {
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const flecks: [number, number, string][] = [[-0.3, -0.4, '#ffe14d'], [0.25, -0.1, '#ff3d7f'], [-0.15, 0.35, '#ffe14d'], [0.3, 0.45, '#7ef0ff'], [0, -0.7, '#ff3d7f']];
      if (!opts.shadow) for (const [fx, fy, c] of flecks) { ctx.fillStyle = c; star(ctx, x + fx * r, y + fy * r, r * 0.18, 4, 0.4); ctx.fill(); }
      break;
    }
    case 'starSapphire': {
      ctx.beginPath(); ctx.arc(x, y + r * 0.25, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light;
      star(ctx, x, y - r * 0.15, r * 0.55, 6, 0.22);
      ctx.fill();
      break;
    }
    case 'heartDiamond': {
      heart(ctx, x, y + r * 0.05, r);
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, opts.shadow ? '#33334a' : '#ffffff');
      g.addColorStop(0.5, fill);
      g.addColorStop(1, opts.shadow ? '#1a1a26' : '#ffb3d4');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.1); ctx.stroke();
      ctx.strokeStyle = opts.shadow ? '#2a2a3a' : '#e98cb6'; ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.35); ctx.lineTo(x, y + r * 0.9); ctx.lineTo(x + r * 0.7, y - r * 0.35); ctx.moveTo(x, y - r * 0.4); ctx.lineTo(x, y + r * 0.9); ctx.stroke();
      break;
    }
  }
  if (opts.sparkle && !opts.shadow) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.max(0, Math.min(1, opts.sparkle));
    star(ctx, x + r * 0.55, y - r * 0.6, r * 0.32, 4, 0.25);
    ctx.fill();
  }
  ctx.restore();
}

// ——————————————————————————————————— Rocks, sacks, crabs ———————————————————————————————————

export function drawRock(ctx: Ctx, x: number, y: number, r: number, seed: number) {
  const rnd = decoRandom(seed * 7919 + 13);
  const pts: Pt[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.82 + rnd() * 0.22);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86]);
  }
  ctx.save();
  poly(ctx, pts);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#a7a39c');
  g.addColorStop(1, '#5d5953');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.08); ctx.strokeStyle = '#34312d'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,36,32,0.55)'; ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.2); ctx.lineTo(x + r * 0.05, y + r * 0.1); ctx.lineTo(x + r * 0.35, y + r * 0.05); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawSack(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.35, y - r * 0.6);
  ctx.bezierCurveTo(x - r * 1.1, y - r * 0.2, x - r * 1.0, y + r * 0.95, x, y + r * 0.95);
  ctx.bezierCurveTo(x + r * 1.0, y + r * 0.95, x + r * 1.1, y - r * 0.2, x + r * 0.35, y - r * 0.6);
  ctx.closePath();
  ctx.fillStyle = '#c4904f'; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.1); ctx.strokeStyle = '#5c3a14'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.35, y - r * 0.6); ctx.lineTo(x - r * 0.5, y - r); ctx.lineTo(x + r * 0.5, y - r); ctx.lineTo(x + r * 0.35, y - r * 0.6); ctx.closePath();
  ctx.fillStyle = '#b07a3c'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e8c53a'; ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath(); ctx.moveTo(x - r * 0.42, y - r * 0.62); ctx.lineTo(x + r * 0.42, y - r * 0.62); ctx.stroke();
  ctx.fillStyle = '#5c3a14';
  ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', x, y + r * 0.25);
  ctx.restore();
}

/** A cave crab, facing `dir` (1 right, −1 left). Its legs scuttle unless `still`. It carries its gem on its back. */
export function drawCrab(ctx: Ctx, x: number, y: number, r: number, time: number, still: boolean, gem?: GemId, dir: 1 | -1 = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const step = still ? 0 : Math.sin(time * 18) * 0.35;
  ctx.strokeStyle = '#7a1f0c'; ctx.lineWidth = Math.max(2, r * 0.12); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const s = (i % 2 ? step : -step) * r;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * r * 0.5, r * 0.1 + i * r * 0.15); ctx.lineTo(side * r * 1.05 + s, r * 0.55 + i * r * 0.12); ctx.stroke();
    }
  }
  ctx.fillStyle = '#e9542c'; ctx.strokeStyle = '#7a1f0c';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Claws
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * r * 0.6, -r * 0.3); ctx.lineTo(side * r * 1.05, -r * 0.75); ctx.stroke();
    ctx.beginPath(); ctx.arc(side * r * 1.15, -r * 0.85, r * 0.28, side > 0 ? -2.2 : -0.9, side > 0 ? 1.6 : 4.2); ctx.fillStyle = '#e9542c'; ctx.fill(); ctx.stroke();
  }
  // Eyes on stalks
  ctx.fillStyle = '#ffffff';
  for (const ex of [0.25, 0.55]) {
    ctx.beginPath(); ctx.moveTo(ex * r, -r * 0.45); ctx.lineTo(ex * r, -r * 0.8); ctx.stroke();
    circle(ctx, ex * r, -r * 0.85, r * 0.14); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  if (gem) drawGem(ctx, gem, x, y - r * 0.55, r * 0.55, { halo: false });
}

// ——————————————————————————————————— Level backgrounds ———————————————————————————————————

interface LevelLook {
  /** Sky for the shallow levels; null means a cave roof. */
  sky: [string, string] | null;
  bands: string[];
  surface: string;
}

const LOOKS: LevelLook[] = [
  { sky: ['#7cc8f5', '#c9ecff'], bands: ['#8b5a2b', '#7d4f25', '#6e4420', '#61391b'], surface: '#4cae4f' },
  { sky: ['#f6b26b', '#ffe3b3'], bands: ['#c8703f', '#b86236', '#a6552e', '#934827'], surface: '#7fa64a' },
  { sky: ['#9fd3f0', '#e2f4ff'], bands: ['#8d8473', '#7f7665', '#706857', '#625a4b'], surface: '#6ea35a' },
  { sky: null, bands: ['#2a3350', '#232b45', '#1d243b', '#181e32'], surface: '#3a4462' },
  { sky: null, bands: ['#3b2b57', '#33254c', '#2b1f41', '#241a37'], surface: '#4d3a6e' },
  { sky: null, bands: ['#1f3b55', '#1b344c', '#172d42', '#132638'], surface: '#2e5272' },
  { sky: null, bands: ['#8a7a63', '#7c6d57', '#6e604c', '#605341'], surface: '#9c8b70' },
  { sky: null, bands: ['#5c3a33', '#52332d', '#472c27', '#3d2521'], surface: '#6e4a40' },
  { sky: null, bands: ['#3b1a16', '#331512', '#2b110f', '#230d0b'], surface: '#4d241e' },
  { sky: null, bands: ['#2a1a45', '#24163d', '#1e1234', '#180f2b'], surface: '#3a2760' },
];

/** The level's still background (sky or cave roof, the layers of earth, and the decorations that stay put). */
export function drawBackground(ctx: Ctx, level: number) {
  const look = LOOKS[level - 1];
  const rnd = decoRandom(level * 104729);
  const W = FIELD_W, H = FIELD_H;
  ctx.save();
  // Sky or cave roof
  if (look.sky) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, look.sky[0]); g.addColorStop(1, look.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND_Y);
    // Far hills and clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) {
      const cx = 80 + i * 260 + rnd() * 60, cy = 30 + rnd() * 30;
      for (let j = 0; j < 3; j++) { circle(ctx, cx + j * 22, cy + (j === 1 ? -8 : 0), 16 + (j === 1 ? 6 : 0)); ctx.fill(); }
    }
    ctx.fillStyle = level === 2 ? '#d99a55' : '#8cc77a';
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y - 30);
    for (let x = 0; x <= W; x += 50) ctx.lineTo(x, GROUND_Y - 38 - Math.sin(x / 140 + level) * 14);
    ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.fill();
  } else {
    ctx.fillStyle = shade(look.bands[0], -0.35);
    ctx.fillRect(0, 0, W, GROUND_Y);
    // Hanging roof rock
    ctx.fillStyle = shade(look.bands[0], -0.15);
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 22 + rnd() * 26 + (x % 120 === 0 ? 20 : 0));
    ctx.lineTo(W, 0); ctx.fill();
  }
  // Layers of earth
  const top = GROUND_Y - 6;
  const bandH = (H - top) / look.bands.length;
  look.bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    const y0 = top + i * bandH;
    ctx.moveTo(0, y0 + (i ? Math.sin(i) * 8 : 0));
    for (let x = 0; x <= W; x += 25) ctx.lineTo(x, y0 + (i ? Math.sin(x / 90 + i * 2) * 9 : 0));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  });
  // The ledge or grass the winch stands on
  ctx.fillStyle = look.surface;
  ctx.beginPath(); ctx.moveTo(0, top);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, top - 4 + Math.sin(x / 33) * 3);
  ctx.lineTo(W, top + 14); ctx.lineTo(0, top + 14); ctx.fill();
  if (look.sky) {
    ctx.strokeStyle = shade(look.surface, 0.25); ctx.lineWidth = 2;
    for (let x = 6; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x - 3 + rnd() * 6, top - 8 - rnd() * 6); ctx.stroke(); }
  } else {
    // Planks for the winch platform
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(PIVOT.x - 120, top - 10, 240, 14);
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 2;
    for (let x = PIVOT.x - 120; x <= PIVOT.x + 120; x += 30) { ctx.beginPath(); ctx.moveTo(x, top - 10); ctx.lineTo(x, top + 4); ctx.stroke(); }
  }
  decorate(ctx, level, rnd);
  ctx.restore();
}

/** Each place's own still details, kept faint in the middle so gems read clearly on top. */
function decorate(ctx: Ctx, level: number, rnd: () => number) {
  const W = FIELD_W, H = FIELD_H, top = GROUND_Y + 10;
  const anyX = () => rnd() * W;
  const anyY = () => top + rnd() * (H - top);
  ctx.save();
  switch (level) {
    case 1: // roots and worms
      ctx.strokeStyle = 'rgba(60,35,15,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        let x = anyX(), y = top; ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += -20 + rnd() * 40; y += 14 + rnd() * 18; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = '#e48ea0'; ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) { const x = anyX(), y = anyY(); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 8, x + 20, y); ctx.quadraticCurveTo(x + 30, y + 8, x + 40, y); ctx.stroke(); }
      pebbles(ctx, rnd, 40, ['rgba(160,120,80,0.6)', 'rgba(90,60,30,0.6)'], 3, 8);
      break;
    case 2: // smooth clay and old pottery bits
      ctx.strokeStyle = 'rgba(255,220,190,0.18)'; ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) { const y = anyY(); ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W / 3, y - 12, (2 * W) / 3, y + 12, W, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(240,200,150,0.35)';
      for (let i = 0; i < 8; i++) { const x = anyX(), y = anyY(); ctx.beginPath(); ctx.ellipse(x, y, 14, 6, rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 3: // river pebbles and a dry stream bed
      pebbles(ctx, rnd, 160, ['rgba(200,195,180,0.55)', 'rgba(120,115,105,0.6)', 'rgba(165,150,120,0.55)'], 3, 9);
      ctx.strokeStyle = 'rgba(140,190,220,0.25)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(0, 520); ctx.bezierCurveTo(300, 470, 650, 600, W, 540); ctx.stroke();
      break;
    case 4: // glow-worm threads from the roof (the glows themselves twinkle in drawAmbient)
      ctx.strokeStyle = 'rgba(160,255,230,0.25)'; ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const x = anyX(); ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 50 + rnd() * 60); ctx.stroke(); }
      break;
    case 5: // crystal clusters round the edges
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? W - rnd() * 140 : rnd() * 140;
        crystalCluster(ctx, side, anyY(), 14 + rnd() * 22, rnd, ['#c48bff', '#ff9ad5', '#8fd8ff'][i % 3]);
      }
      break;
    case 6: { // the underground lake at the bottom corners
      ctx.fillStyle = 'rgba(60,150,210,0.45)';
      ctx.beginPath(); ctx.moveTo(0, H - 60); ctx.quadraticCurveTo(160, H - 80, 280, H); ctx.lineTo(0, H); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W, H - 70); ctx.quadraticCurveTo(W - 180, H - 90, W - 300, H); ctx.lineTo(W, H); ctx.fill();
      ctx.fillStyle = 'rgba(180,220,255,0.15)';
      for (let i = 0; i < 18; i++) { const x = anyX(); ctx.fillRect(x, top + rnd() * 80, 3, 30 + rnd() * 50); }
      break;
    }
    case 7: // fossils: ammonite spirals and bones
      ctx.strokeStyle = 'rgba(235,222,190,0.55)'; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const x = anyX(), y = anyY();
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.2) { const rr = 2 + a * 2.6; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const x = anyX(), y = anyY(), a = rnd() * 3;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(235,222,190,0.5)'; ctx.fillRect(-22, -3, 44, 6);
        for (const e of [-22, 22]) { circle(ctx, e, -4, 5); ctx.fill(); circle(ctx, e, 4, 5); ctx.fill(); }
        ctx.restore();
      }
      break;
    case 8: // warm pools
      for (let i = 0; i < 5; i++) {
        const x = anyX(), y = top + 120 + rnd() * (H - top - 140);
        const g = ctx.createRadialGradient(x, y, 4, x, y, 60);
        g.addColorStop(0, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = g; circle(ctx, x, y, 60); ctx.fill();
      }
      break;
    case 9: // glowing cracks
      ctx.strokeStyle = 'rgba(255,100,40,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        let x = anyX(), y = anyY(); ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) { x += -30 + rnd() * 60; y += -10 + rnd() * 30; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      { const g = ctx.createLinearGradient(0, H - 90, 0, H); g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(1, 'rgba(255,80,20,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, H - 90, W, 90); }
      break;
    case 10: { // the heart of the earth: a pink-white glow and crystal facets
      const g = ctx.createRadialGradient(PIVOT.x, H, 20, PIVOT.x, H, 420);
      g.addColorStop(0, 'rgba(255,200,230,0.55)'); g.addColorStop(1, 'rgba(255,200,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
      for (let i = 0; i < 18; i++) {
        const side = i % 2 ? W - rnd() * 160 : rnd() * 160;
        crystalCluster(ctx, side, anyY(), 12 + rnd() * 20, rnd, ['#ffd1e8', '#d6c6ff', '#ffffff'][i % 3]);
      }
      break;
    }
  }
  ctx.restore();
}

function pebbles(ctx: Ctx, rnd: () => number, n: number, colours: string[], min: number, max: number) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colours[i % colours.length];
    ctx.beginPath(); ctx.ellipse(rnd() * FIELD_W, GROUND_Y + 14 + rnd() * (FIELD_H - GROUND_Y - 14), min + rnd() * (max - min), min + rnd() * (max - min) * 0.7, rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
}

function crystalCluster(ctx: Ctx, x: number, y: number, size: number, rnd: () => number, colour: string) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 3; i++) {
    const a = -0.6 + i * 0.6 + (rnd() - 0.5) * 0.3;
    const h = size * (1 + rnd() * 0.8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    poly(ctx, [[-size * 0.25, 0], [-size * 0.25, -h * 0.75], [0, -h], [size * 0.25, -h * 0.75], [size * 0.25, 0]]);
    ctx.fillStyle = colour; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** The moving bits of a place (glow-worms twinkling, steam, bubbles, magma pulsing). With less motion: drawn still. */
export function drawAmbient(ctx: Ctx, level: number, time: number, still: boolean) {
  const t = still ? 0 : time;
  const rnd = decoRandom(level * 31337);
  ctx.save();
  if (level === 4) {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * FIELD_W, y = 50 + rnd() * 70, ph = rnd() * 6;
      ctx.globalAlpha = still ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + ph));
      ctx.fillStyle = '#9dffe6'; circle(ctx, x, y + 6, 2.4); ctx.fill();
    }
  } else if (level === 6) {
    ctx.strokeStyle = 'rgba(200,235,255,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = (i < 3 ? 40 + i * 60 : FIELD_W - 60 - (i - 3) * 70) + Math.sin(t + i) * 6;
      ctx.beginPath(); ctx.moveTo(x - 14, FIELD_H - 30 + i * 3); ctx.quadraticCurveTo(x, FIELD_H - 36 + i * 3, x + 14, FIELD_H - 30 + i * 3); ctx.stroke();
    }
  } else if (level === 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 16; i++) {
      const x = rnd() * FIELD_W, speed = 12 + rnd() * 18, ph = rnd() * 400;
      const y = FIELD_H - ((ph + t * speed) % (FIELD_H - GROUND_Y));
      circle(ctx, x + Math.sin(t + i) * 5, y, 5 + rnd() * 6); ctx.fill();
    }
  } else if (level === 9) {
    ctx.globalAlpha = still ? 0.3 : 0.2 + 0.15 * Math.sin(t * 2);
    ctx.fillStyle = '#ff5a1f'; ctx.fillRect(0, FIELD_H - 24, FIELD_W, 24);
  } else if (level === 10) {
    ctx.globalAlpha = still ? 0.6 : 0.35 + 0.3 * Math.abs(Math.sin(t));
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i++) { star(ctx, rnd() * FIELD_W, GROUND_Y + 40 + rnd() * 520, 3 + rnd() * 3, 4, 0.3); ctx.fill(); }
  }
  ctx.restore();
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ——————————————————————————————————— Winch, rope and claw ———————————————————————————————————

/** The winch at the top, centred on the rope's start (x, y). `turn` spins the drum while reeling. */
export function drawWinch(ctx: Ctx, x: number, y: number, id: string | undefined, turn: number, time: number, still: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const legs = () => {
    ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-48, GROUND_Y - y - 8); ctx.moveTo(34, 6); ctx.lineTo(48, GROUND_Y - y - 8); ctx.stroke();
  };
  switch (id) {
    case 'steam-engine': {
      legs();
      ctx.fillStyle = '#3d6b4f'; ctx.strokeStyle = '#1b2f22'; ctx.lineWidth = 3;
      ctx.fillRect(-40, -22, 80, 30); ctx.strokeRect(-40, -22, 80, 30);
      ctx.fillStyle = '#222'; ctx.fillRect(18, -46, 12, 26);
      ctx.fillStyle = 'rgba(240,240,240,0.7)';
      for (let i = 0; i < 3; i++) { const p = still ? 0.3 * i : ((time * 0.8 + i / 3) % 1); circle(ctx, 24 + p * 14, -50 - p * 30, 5 + p * 7); ctx.fill(); }
      drum(ctx, -8, -6, 14, turn, '#c9a227');
      break;
    }
    case 'rocket-winch': {
      legs();
      ctx.fillStyle = '#e5e7eb'; ctx.strokeStyle = '#374151'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(24, -14); ctx.lineTo(40, 0); ctx.lineTo(24, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ef4444'; poly(ctx, [[-36, 0], [-30, -16], [-20, -4]]); ctx.fill(); poly(ctx, [[-36, 0], [-30, 16], [-20, 4]]); ctx.fill();
      ctx.fillStyle = '#60a5fa'; circle(ctx, 12, 0, 5); ctx.fill();
      const f = still ? 1 : 0.8 + Math.sin(time * 30) * 0.2;
      ctx.fillStyle = '#fbbf24'; poly(ctx, [[-36, -6], [-36 - 20 * f, 0], [-36, 6]]); ctx.fill();
      break;
    }
    case 'giant-snail': {
      ctx.fillStyle = '#a3d977'; ctx.strokeStyle = '#3f6b1f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 18, 50, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, 12); ctx.lineTo(54, -14); ctx.moveTo(44, 12); ctx.lineTo(62, -10); ctx.stroke();
      ctx.fillStyle = '#222'; circle(ctx, 54, -14, 3); ctx.fill(); circle(ctx, 62, -10, 3); ctx.fill();
      ctx.save(); ctx.rotate(turn); ctx.fillStyle = '#d98c3f'; ctx.strokeStyle = '#7a4314';
      circle(ctx, 0, 0, 24); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.2) { const rr = a * 1.5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke();
      ctx.restore();
      break;
    }
    case 'pirate-ship-wheel': {
      legs();
      ctx.save(); ctx.rotate(turn);
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 6;
      circle(ctx, 0, 0, 22); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke(); ctx.fillStyle = '#a8692e'; circle(ctx, Math.cos(a) * 36, Math.sin(a) * 36, 5); ctx.fill(); }
      ctx.fillStyle = '#c9a227'; circle(ctx, 0, 0, 7); ctx.fill();
      ctx.restore();
      break;
    }
    case 'hamster-wheel': {
      legs();
      ctx.save(); ctx.rotate(turn);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4; circle(ctx, 0, 0, 32); ctx.stroke();
      ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); ctx.stroke(); }
      ctx.restore();
      const hop = still ? 0 : Math.abs(Math.sin(time * 12)) * 3;
      ctx.fillStyle = '#e8b27a'; ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 18 - hop, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222'; circle(ctx, 8, 15 - hop, 2); ctx.fill();
      break;
    }
    default: {
      legs();
      ctx.fillStyle = '#8b5a2b'; ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 3;
      ctx.fillRect(-42, -8, 84, 10); ctx.strokeRect(-42, -8, 84, 10);
      drum(ctx, 0, -16, 16, turn, '#9ca3af');
      // crank handle
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(20, -16); ctx.lineTo(20 + Math.cos(turn) * 14, -16 + Math.sin(turn) * 14); ctx.stroke();
    }
  }
  ctx.restore();
}

function drum(ctx: Ctx, x: number, y: number, r: number, turn: number, colour: string) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = colour; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 3;
  circle(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
  ctx.rotate(turn); ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke(); }
  ctx.restore();
}

/** The rope (or chain, vine, laser …) from (x1, y1) to (x2, y2). */
export function drawRope(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, id: string | undefined, time: number, still: boolean) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux; // across the rope
  ctx.save();
  ctx.lineCap = 'round';
  const line = (w: number, c: string) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const along = (gap: number, fn: (x: number, y: number, i: number) => void) => { let i = 0; for (let d = gap / 2; d < len; d += gap) fn(x1 + ux * d, y1 + uy * d, i++); };
  switch (id) {
    case 'rainbow-rope': {
      const colours = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
      ctx.lineWidth = 6;
      let i = 0;
      for (let d = 0; d < len; d += 12, i++) { ctx.strokeStyle = colours[i % 6]; ctx.beginPath(); ctx.moveTo(x1 + ux * d, y1 + uy * d); ctx.lineTo(x1 + ux * Math.min(len, d + 12), y1 + uy * Math.min(len, d + 12)); ctx.stroke(); }
      break;
    }
    case 'jungle-vine':
      line(5, '#3f7d2a');
      along(26, (x, y, i) => { const s = i % 2 ? 1 : -1; ctx.fillStyle = '#5fb83e'; ctx.beginPath(); ctx.ellipse(x + px * 8 * s, y + py * 8 * s, 8, 4, Math.atan2(py, px), 0, Math.PI * 2); ctx.fill(); });
      break;
    case 'laser-beam': {
      const pulse = still ? 1 : 0.8 + 0.2 * Math.sin(time * 20);
      line(12 * pulse, 'rgba(255,40,80,0.3)'); line(5, '#ff2d55'); line(2, '#ffe4ea');
      break;
    }
    case 'sausage-chain':
      along(18, (x, y) => { ctx.fillStyle = '#b5523b'; ctx.strokeStyle = '#6b2a1c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, 8.5, 4.5, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      break;
    case 'spaghetti': {
      ctx.strokeStyle = '#f2d16b'; ctx.lineWidth = 3.5;
      for (const off of [-2, 2]) {
        ctx.beginPath();
        for (let d = 0; d <= len; d += 4) { const w = Math.sin(d / 9 + off) * 3.5; ctx.lineTo(x1 + ux * d + px * (w + off), y1 + uy * d + py * (w + off)); }
        ctx.stroke();
      }
      break;
    }
    case 'candy-cane': {
      line(7, '#ffffff');
      ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 7;
      for (let d = 0; d < len; d += 16) { ctx.beginPath(); ctx.moveTo(x1 + ux * d, y1 + uy * d); ctx.lineTo(x1 + ux * Math.min(len, d + 7), y1 + uy * Math.min(len, d + 7)); ctx.stroke(); }
      break;
    }
    case 'bike-chain':
      along(10, (x, y, i) => { ctx.strokeStyle = i % 2 ? '#374151' : '#6b7280'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, 6, 3.5, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.stroke(); });
      break;
    case 'star-rope':
      line(4, '#facc15');
      along(30, (x, y) => { ctx.fillStyle = '#fff7c2'; star(ctx, x, y, 7, 5, 0.45); ctx.fill(); });
      break;
    default:
      line(4, '#7a5a35');
      ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1.5;
      along(9, (x, y) => { ctx.beginPath(); ctx.moveTo(x - px * 2 - ux * 2, y - py * 2 - uy * 2); ctx.lineTo(x + px * 2 + ux * 2, y + py * 2 + uy * 2); ctx.stroke(); });
  }
  ctx.restore();
}

/**
 * The claw head at (x, y), pointing along `angle` (radians; 0 is straight down, positive swings to the right, as in
 * the rules). `closed` when it holds something. `size` is about its length in field units.
 */
export function drawClaw(ctx: Ctx, x: number, y: number, angle: number, closed: boolean, id: string | undefined, size = 30, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.scale(size / 30, size / 30);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const spread = closed ? 0.12 : 0.55;
  const prongs = (colour: string, dark: string, tip?: string) => {
    ctx.fillStyle = dark; circle(ctx, 0, 2, 7); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.save(); ctx.rotate(side * spread);
      ctx.strokeStyle = dark; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(side * 8, 18); ctx.lineTo(side * 2, 30); ctx.stroke();
      ctx.strokeStyle = colour; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(side * 8, 18); ctx.lineTo(side * 2, 30); ctx.stroke();
      if (tip) { ctx.fillStyle = tip; circle(ctx, side * 2, 30, 3); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = colour; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    circle(ctx, 0, 3, 6); ctx.fill(); ctx.stroke();
  };
  switch (id) {
    case 'golden-claw': prongs('#facc15', '#854d0e', '#fff7c2'); break;
    case 'diamond-claw': {
      prongs('#e0f2fe', '#0e7490', '#ffffff');
      drawGem(ctx, 'heartDiamond', 0, 4, 6);
      break;
    }
    case 'ice-crystal-claw': {
      for (const side of [-1, 0, 1]) {
        ctx.save(); ctx.rotate(side * (closed ? 0.1 : 0.45));
        poly(ctx, [[-4, 2], [4, 2], [2, 30], [0, 34], [-2, 30]]);
        ctx.fillStyle = 'rgba(186,230,253,0.9)'; ctx.fill(); ctx.strokeStyle = '#0369a1'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'dragon-talon': {
      for (const side of [-1, 0, 1]) {
        ctx.save(); ctx.rotate(side * (closed ? 0.12 : 0.5));
        ctx.fillStyle = '#7f1d1d'; ctx.strokeStyle = '#2b0a0a'; ctx.lineWidth = 2;
        poly(ctx, [[-5, 0], [5, 0], [4, 18], [-4, 18]]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.moveTo(-4, 18); ctx.quadraticCurveTo(8, 26, side >= 0 ? -2 : 2, 34); ctx.quadraticCurveTo(2, 26, 4, 18); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#b91c1c'; circle(ctx, 0, 0, 7); ctx.fill();
      break;
    }
    case 'dino-jaw': {
      const open = closed ? 0.05 : 0.45;
      for (const side of [-1, 1]) {
        ctx.save(); ctx.rotate(side * open);
        ctx.fillStyle = '#4ade80'; ctx.strokeStyle = '#14532d'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * 16, 10, side * 4, 32); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) { const ty = 8 + i * 6; poly(ctx, [[side * 1, ty], [side * 1, ty + 4], [-side * 3, ty + 2]]); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = '#111'; circle(ctx, 5, 4, 2); ctx.fill();
      break;
    }
    case 'robot-hand': {
      ctx.fillStyle = '#9ca3af'; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5;
      ctx.fillRect(-9, -2, 18, 14); ctx.strokeRect(-9, -2, 18, 14);
      ctx.fillStyle = '#38bdf8'; circle(ctx, 0, 5, 3); ctx.fill();
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(side * 6, 12); ctx.rotate(side * (closed ? -0.05 : 0.35));
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-3, 0, 6, 10); ctx.strokeRect(-3, 0, 6, 10);
        ctx.translate(0, 10); ctx.rotate(-side * (closed ? 0.6 : 0.2)); ctx.fillRect(-3, 0, 6, 9); ctx.strokeRect(-3, 0, 6, 9);
        ctx.restore();
      }
      break;
    }
    case 'crab-pincer': {
      for (const side of [-1, 1]) {
        ctx.save(); ctx.rotate(side * (closed ? 0.05 : 0.4));
        ctx.fillStyle = '#f97316'; ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.bezierCurveTo(side * 18, 8, side * 14, 28, side * 1, 32); ctx.quadraticCurveTo(side * 6, 18, 0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'octopus-arm': {
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 8;
      const curl = closed ? 1.4 : 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let i = 1; i <= 12; i++) { const t = i / 12; ctx.lineTo(Math.sin(t * curl * 3 + (closed ? 0 : Math.sin(time * 3) * 0.2)) * 10 * t, t * 30); }
      ctx.stroke();
      ctx.fillStyle = '#f5d0fe';
      for (let i = 2; i <= 11; i += 3) { const t = i / 12; circle(ctx, Math.sin(t * curl * 3) * 10 * t + 3, t * 30, 2); ctx.fill(); }
      break;
    }
    case 'giant-magnet': {
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 9;
      const w = closed ? 8 : 11;
      ctx.beginPath(); ctx.moveTo(-w, 26); ctx.lineTo(-w, 12); ctx.arc(0, 12, w, Math.PI, 0); ctx.lineTo(w, 26); ctx.stroke();
      ctx.strokeStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(-w, 26); ctx.lineTo(-w, 32); ctx.moveTo(w, 26); ctx.lineTo(w, 32); ctx.stroke();
      if (closed) { ctx.strokeStyle = 'rgba(250,204,21,0.8)'; ctx.lineWidth = 1.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 16, 30, 4, 0, Math.PI * 2); ctx.stroke(); } }
      break;
    }
    case 'rubber-chicken': {
      ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 18, 8, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      circle(ctx, 0, 4, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ef4444'; poly(ctx, [[-3, -2], [0, -6], [3, -2]]); ctx.fill();
      ctx.fillStyle = '#f97316'; poly(ctx, [[5, 4], [11, 6], [5, 7]]); ctx.fill();
      ctx.fillStyle = '#111'; circle(ctx, 2, 3, 1.3); ctx.fill();
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2;
      const k = closed ? 2 : 6;
      ctx.beginPath(); ctx.moveTo(-3, 30); ctx.lineTo(-k, 36); ctx.moveTo(3, 30); ctx.lineTo(k, 36); ctx.stroke();
      break;
    }
    case 'giant-fork': {
      ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 12); ctx.stroke();
      const w = closed ? 6 : 10;
      ctx.beginPath(); ctx.moveTo(-w, 12); ctx.lineTo(w, 12); ctx.stroke();
      for (let i = 0; i < 4; i++) { const tx = -w + (i * 2 * w) / 3; ctx.beginPath(); ctx.moveTo(tx, 12); ctx.lineTo(tx, 32); ctx.stroke(); }
      ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w, 13); ctx.lineTo(w, 13); ctx.stroke();
      break;
    }
    case 'grabby-glove': {
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5;
      ctx.fillRect(-7, -2, 14, 6); ctx.strokeRect(-7, -2, 14, 6);
      if (closed) { circle(ctx, 0, 16, 11); ctx.fill(); ctx.stroke(); }
      else {
        ctx.beginPath(); ctx.ellipse(0, 14, 10, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let i = -1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 5 - 2, 28, 2.6, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
      break;
    }
    default: prongs('#cbd5e1', '#334155');
  }
  ctx.restore();
}

// ——————————————————————————————————— Nugget the kiwi ———————————————————————————————————

export type Pose = 'stand' | 'wave' | 'point' | 'cheer' | 'oops';

/** Nugget the kiwi, standing on (x, y), `size` tall, in their hat (the yellow hard hat unless the pupil chose one). */
export function drawNugget(ctx: Ctx, x: number, y: number, size: number, hat: string | undefined, pose: Pose = 'stand', time = 0, still = false, facing: 1 | -1 = 1) {
  const s = size / 60;
  const bob = still ? 0 : pose === 'cheer' ? Math.abs(Math.sin(time * 10)) * 6 : Math.sin(time * 2) * 0.8;
  ctx.save();
  ctx.translate(x, y - bob * s);
  ctx.scale(s * facing, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = '#c2763b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-8, 0); ctx.lineTo(-13, 0); ctx.moveTo(6, -10); ctx.lineTo(5, 0); ctx.lineTo(10, 0); ctx.stroke();
  // body
  ctx.fillStyle = '#8a5a34'; ctx.strokeStyle = '#4b2e17'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, -24, 20, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(75,46,23,0.5)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 5, -30); ctx.lineTo(-16 + i * 5, -20); ctx.stroke(); }
  // head
  ctx.fillStyle = '#8a5a34'; ctx.strokeStyle = '#4b2e17'; ctx.lineWidth = 2.5;
  circle(ctx, 14, -40, 10); ctx.fill(); ctx.stroke();
  // long beak
  ctx.strokeStyle = '#e8c27a'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(22, -38); ctx.quadraticCurveTo(34, pose === 'oops' ? -30 : -34, 42, pose === 'oops' ? -24 : -30); ctx.stroke();
  // eye
  ctx.fillStyle = '#111'; circle(ctx, 17, -42, 2); ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, 17.6, -42.6, 0.7); ctx.fill();
  // little wing
  const wing = pose === 'wave' ? (still ? -1.2 : -1.2 + Math.sin(time * 8) * 0.5) : pose === 'point' ? -0.4 : pose === 'cheer' ? -1.8 : pose === 'oops' ? 0.9 : 0.3;
  ctx.save(); ctx.translate(-2, -28); ctx.rotate(wing);
  ctx.fillStyle = '#6e4526'; ctx.beginPath(); ctx.ellipse(10, 0, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawHat(ctx, 14, -48, hat, time, still);
  ctx.restore();
}

/** A hat sitting on a head whose top is at (x, y), in Nugget's own units. */
export function drawHat(ctx: Ctx, x: number, y: number, id: string | undefined, time = 0, still = false) {
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2;
  switch (id) {
    case 'pirate-hat':
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.moveTo(-16, 2); ctx.quadraticCurveTo(0, -24, 16, 2); ctx.quadraticCurveTo(0, -4, -16, 2); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, 0, -7, 3); ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#854d0e';
      poly(ctx, [[-11, 2], [-11, -10], [-6, -4], [0, -14], [6, -4], [11, -10], [11, 2]]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e11d48'; circle(ctx, 0, -3, 2.4); ctx.fill();
      break;
    case 'wizard-hat':
      ctx.fillStyle = '#4338ca';
      poly(ctx, [[-13, 2], [13, 2], [3, -30]]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fde047'; star(ctx, 0, -10, 4, 5); ctx.fill(); star(ctx, 5, -18, 2.4, 5); ctx.fill();
      break;
    case 'chefs-hat':
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-9, -8, 18, 9); ctx.strokeRect(-9, -8, 18, 9);
      circle(ctx, -6, -13, 7); ctx.fill(); ctx.stroke(); circle(ctx, 6, -13, 7); ctx.fill(); ctx.stroke(); circle(ctx, 0, -18, 8); ctx.fill(); ctx.stroke();
      break;
    case 'astronaut-helmet':
      ctx.fillStyle = 'rgba(219,234,254,0.55)'; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3;
      circle(ctx, 0, 8, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-6, 0, 4, 7, 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'top-hat':
      ctx.fillStyle = '#111827';
      ctx.fillRect(-14, -1, 28, 4); ctx.fillRect(-9, -20, 18, 20);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(-9, -6, 18, 4);
      break;
    case 'miner-lamp':
      hardHat(ctx);
      ctx.fillStyle = '#fef08a'; circle(ctx, 9, -6, 3.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = still ? 'rgba(254,240,138,0.35)' : `rgba(254,240,138,${0.25 + 0.1 * Math.sin(time * 4)})`;
      poly(ctx, [[11, -8], [36, -16], [36, 4], [11, -4]]); ctx.fill();
      break;
    default:
      hardHat(ctx);
  }
  ctx.restore();
}

function hardHat(ctx: Ctx) {
  ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#854d0e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(-15, -1, 30, 3.5); ctx.strokeRect(-15, -1, 30, 3.5);
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, -1); ctx.stroke();
}

// ——————————————————————————————————— Trails and catch effects ———————————————————————————————————

/** A little colour for each trail and catch effect, for the still glow and the Workshop's icons. */
export const EFFECT_COLOUR: Record<string, string> = {
  sparkles: '#fde047', bubbles: '#7dd3fc', flames: '#fb923c', confetti: '#f472b6', 'music-notes': '#c4b5fd',
  fireworks: '#f87171', 'disco-ball': '#e5e7eb', 'gem-rain': '#34d399', 'trumpet-fanfare': '#fbbf24', 'happy-dance': '#fda4af', 'gem-rain-deluxe': '#a78bfa',
};

/**
 * The trail behind the claw. `points` are where its tip was (newest last). With less motion it is one small still glow
 * at the tip instead.
 */
export function drawTrail(ctx: Ctx, points: readonly Pt[], id: string | undefined, time: number, still: boolean) {
  if (!id || points.length === 0) return;
  const colour = EFFECT_COLOUR[id] ?? '#ffffff';
  ctx.save();
  if (still) {
    const [x, y] = points[points.length - 1];
    const g = ctx.createRadialGradient(x, y, 2, x, y, 22);
    g.addColorStop(0, colour); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55; ctx.fillStyle = g; circle(ctx, x, y, 22); ctx.fill();
    ctx.restore();
    return;
  }
  const n = points.length;
  points.forEach(([x, y], i) => {
    if (i % 2) return;
    const age = 1 - i / n; // 0 newest … 1 oldest
    ctx.globalAlpha = Math.max(0, 1 - age);
    const wob = Math.sin(time * 9 + i) * 4;
    switch (id) {
      case 'sparkles': ctx.fillStyle = i % 4 ? '#fde047' : '#ffffff'; star(ctx, x + wob, y, 6 * (1 - age * 0.6), 4, 0.3, time * 3 + i); ctx.fill(); break;
      case 'bubbles': ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 1.8; circle(ctx, x + wob, y - age * 20, 3 + age * 6); ctx.stroke(); break;
      case 'flames': ctx.fillStyle = age < 0.4 ? '#fde047' : '#fb923c'; circle(ctx, x + wob * 0.5, y - age * 10, 7 * (1 - age)); ctx.fill(); break;
      case 'confetti': ctx.fillStyle = ['#f472b6', '#60a5fa', '#facc15', '#4ade80'][i % 4]; ctx.save(); ctx.translate(x + wob, y + age * 14); ctx.rotate(time * 6 + i); ctx.fillRect(-3, -2, 6, 4); ctx.restore(); break;
      case 'music-notes': if (i % 6 === 0) { musicNote(ctx, x + wob * 2, y - age * 16, 7, '#c4b5fd'); } break;
    }
  });
  ctx.restore();
}

function musicNote(ctx: Ctx, x: number, y: number, s: number, colour: string) {
  ctx.fillStyle = colour; ctx.strokeStyle = colour; ctx.lineWidth = s * 0.25;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.4, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.5, y - s * 1.6); ctx.lineTo(x + s * 1.1, y - s * 1.2); ctx.stroke();
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: string; kind: 'dot' | 'gem' | 'star' | 'note'; gem?: GemId; spin: number }

/** Catch effects: little bursts at the winch when a gem comes up. Kept by the play screen and drawn every frame. */
export class Effects {
  parts: Particle[] = [];
  /** Effects drawn as one shape for a while (disco ball, trumpet, the still glow), with when they end. */
  shows: { kind: string; x: number; y: number; until: number; start: number }[] = [];

  /** A gem came up at (x, y) with this catch effect worn (none: a small sparkle). */
  spawn(id: string | undefined, x: number, y: number, now: number, still: boolean, gem?: GemId) {
    if (still) { this.shows.push({ kind: 'glow', x, y, start: now, until: now + 0.7 }); return; }
    const rnd = decoRandom(Math.floor(now * 1000));
    const burst = (n: number, speed: number, colours: string[], kind: Particle['kind'] = 'dot', life = 0.9) => {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, v = speed * (0.4 + rnd() * 0.6);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, colour: colours[i % colours.length], kind, gem, spin: rnd() * 6 });
      }
    };
    const rain = (n: number, big: boolean) => {
      const kinds: GemId[] = ['quartz', 'jade', 'amethyst', 'topaz', 'emerald', 'sapphire', 'ruby', 'fireOpal'];
      for (let i = 0; i < n; i++) this.parts.push({ x: 60 + rnd() * (FIELD_W - 120), y: -20 - rnd() * 120, vx: 0, vy: 160 + rnd() * 120, life: 2.2, max: 2.2, colour: '#fff', kind: 'gem', gem: kinds[i % kinds.length], spin: big ? 14 : 9 });
    };
    switch (id) {
      case 'fireworks': burst(36, 260, ['#f87171', '#fde047', '#60a5fa', '#4ade80', '#f472b6'], 'dot', 1.1); break;
      case 'disco-ball': this.shows.push({ kind: 'disco', x, y: y - 60, start: now, until: now + 1.6 }); break;
      case 'gem-rain': rain(14, false); break;
      case 'gem-rain-deluxe': rain(26, true); burst(20, 180, ['#ffffff', '#c4b5fd'], 'star'); break;
      case 'trumpet-fanfare': this.shows.push({ kind: 'trumpet', x: x + 60, y: y - 10, start: now, until: now + 1.4 }); burst(6, 90, ['#fbbf24'], 'note', 1.3); break;
      case 'happy-dance': this.shows.push({ kind: 'dance', x, y, start: now, until: now + 1.5 }); burst(8, 110, ['#fb7185', '#fda4af'], 'dot', 1.2); break;
      default: burst(12, 140, ['#fde047', '#ffffff'], 'star', 0.7);
    }
  }

  /** Is Nugget's happy dance on now? */
  dancing(now: number) {
    return this.shows.some((s) => s.kind === 'dance' && now < s.until);
  }

  draw(ctx: Ctx, dt: number, now: number) {
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    this.shows = this.shows.filter((s) => now < s.until);
    ctx.save();
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind !== 'gem') p.vy += 220 * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      if (p.kind === 'gem' && p.gem) drawGem(ctx, p.gem, p.x, p.y, p.spin);
      else if (p.kind === 'star') { ctx.fillStyle = p.colour; star(ctx, p.x, p.y, 6, 4, 0.3, p.spin); ctx.fill(); }
      else if (p.kind === 'note') musicNote(ctx, p.x, p.y, 8, p.colour);
      else { ctx.fillStyle = p.colour; circle(ctx, p.x, p.y, 4); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const s of this.shows) {
      const k = (now - s.start) / (s.until - s.start);
      if (s.kind === 'glow') {
        const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 48);
        g.addColorStop(0, 'rgba(253,224,71,0.7)'); g.addColorStop(1, 'rgba(253,224,71,0)');
        ctx.fillStyle = g; circle(ctx, s.x, s.y, 48); ctx.fill();
      } else if (s.kind === 'disco') {
        ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, s.y - 18); ctx.stroke();
        ctx.fillStyle = '#d1d5db'; circle(ctx, s.x, s.y, 18); ctx.fill();
        for (let i = 0; i < 10; i++) {
          const a = k * 12 + i * 0.63;
          ctx.fillStyle = ['#f472b6', '#60a5fa', '#facc15', '#4ade80', '#a78bfa'][i % 5];
          ctx.globalAlpha = 0.6; circle(ctx, s.x + Math.cos(a) * 160, s.y + 80 + Math.sin(a) * 60, 10); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillRect(s.x + Math.cos(a) * 12 - 3, s.y + Math.sin(a) * 12 - 3, 6, 6);
        }
      } else if (s.kind === 'trumpet') {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(-0.4 + Math.sin(k * 20) * 0.08);
        ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
        ctx.fillRect(-26, -3, 30, 6); ctx.strokeRect(-26, -3, 30, 6);
        poly(ctx, [[4, -3], [22, -12], [22, 12], [4, 3]]); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

/** Where Nugget stands on the play screen (beside the winch, on the grass or the platform). */
export const NUGGET_SPOT = { x: PIVOT.x + 90, y: GROUND_Y - 6 };
