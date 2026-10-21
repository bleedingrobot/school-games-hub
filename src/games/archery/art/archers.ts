/**
 * The archers and their arrows, drawn in parts (body, head, bow arm, string) so they can draw the bow,
 * hold, release with a twang, wobble when hit, cheer and pop (docs/ARCHERY-PLAN.md, section 10).
 * Player 0 is the pupil's green-hooded hero; player 1 is Bolt the robot. From the approved mock-up.
 *
 * Drawn in "units" (an archer is about 120 units tall, feet at 0); the caller scales them to the field.
 */
import type { ArrowId } from '../../../../shared/archery/types';
import { D2R, OL, TAU, drawStar, rr } from './util';

export type ArrowLook = 'arrow' | 'bot' | 'steel' | 'giant' | 'rain' | 'digger' | 'roll' | 'goo' | 'skip' | 'shaker' | 'bolt' | 'owl' | 'dumper' | 'firework' | 'glass';

interface ArrowStyle { len: number; f: number; fl: string; fl2: string; head: string; shaft: string; trail: string; drill?: boolean; log?: boolean; sack?: boolean; glass?: boolean }

export const ARROW_STYLES: Record<ArrowLook, ArrowStyle> = {
  arrow: { len: 66, f: 1, fl: '#e8453c', fl2: '#ffffff', head: '#d8e2ee', shaft: '#e0b070', trail: '255,255,255' },
  bot: { len: 66, f: 1, fl: '#ff9f43', fl2: '#ffe1b8', head: '#9ff3ff', shaft: '#c7d3e6', trail: '200,250,255' },
  steel: { len: 70, f: 1.08, fl: '#3d6fd8', fl2: '#dfe8ff', head: '#cfd8e6', shaft: '#9aa6b8', trail: '220,235,255' },
  giant: { len: 118, f: 1.7, fl: '#ffcf3f', fl2: '#ff7a1f', head: '#ffd23f', shaft: '#c98b4a', trail: '255,215,90' },
  rain: { len: 66, f: 1, fl: '#3d8bff', fl2: '#bfe0ff', head: '#d8e2ee', shaft: '#e0b070', trail: '190,225,255' },
  digger: { len: 70, f: 1, fl: '#8a5a34', fl2: '#d9a46a', head: '#9aa6b8', shaft: '#e0b070', trail: '255,240,220', drill: true },
  roll: { len: 66, f: 1, fl: '#2fb36a', fl2: '#b9f0c8', head: '#d8e2ee', shaft: '#e0b070', trail: '235,220,190', log: true },
  goo: { len: 66, f: 1, fl: '#5fd35a', fl2: '#d6ffc8', head: '#7ee06a', shaft: '#e0b070', trail: '200,255,190' },
  skip: { len: 64, f: 1, fl: '#36c2e0', fl2: '#d8f7ff', head: '#d8e2ee', shaft: '#e0b070', trail: '210,245,255' },
  shaker: { len: 68, f: 1.05, fl: '#ff7a1f', fl2: '#ffe1b8', head: '#8a5a34', shaft: '#c98b4a', trail: '255,220,180' },
  bolt: { len: 48, f: 1.15, fl: '#3a3a48', fl2: '#9aa6b8', head: '#cfd8e6', shaft: '#6b4428', trail: '255,255,255' },
  owl: { len: 66, f: 1, fl: '#8a5a34', fl2: '#f1d29a', head: '#d8e2ee', shaft: '#e0b070', trail: '255,240,210' },
  dumper: { len: 70, f: 1.1, fl: '#8a5a34', fl2: '#f1d29a', head: '#a2683a', shaft: '#d9a86c', trail: '240,220,190', sack: true },
  firework: { len: 66, f: 1, fl: '#ff4fa3', fl2: '#ffd23f', head: '#ff7a1f', shaft: '#9a4bd8', trail: '255,170,220' },
  glass: { len: 70, f: 1.05, fl: '#9fe8ff', fl2: '#ffffff', head: '#e8fbff', shaft: '#bfefff', trail: '200,245,255', glass: true },
};

/** How an arrow looks, from its id and who shot it. */
export function arrowLook(id: ArrowId, player: number): ArrowLook {
  switch (id) {
    case 'plain': return player === 1 ? 'bot' : 'arrow';
    case 'steel': return 'steel';
    case 'log': return 'roll';
    case 'mole': case 'sneaky': return 'digger';
    case 'mud': return 'dumper';
    case 'rain': return 'rain';
    case 'skip': return 'skip';
    case 'goo': return 'goo';
    case 'shaker': return 'shaker';
    case 'owl': return 'owl';
    case 'firework': return 'firework';
    case 'bolt': return 'bolt';
    case 'giant': return 'giant';
    case 'glass': return 'glass';
    default: return 'arrow';
  }
}

/** An arrow pointing right, its tail at x0 (units). */
export function arrowShape(g: CanvasRenderingContext2D, x0: number, look: ArrowLook) {
  const A = ARROW_STYLES[look] ?? ARROW_STYLES.arrow, f = A.f, x1 = x0 + A.len, hd = 13 * f;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(x0 - 2 * f, s * 8 * f);
    g.lineTo(x0 + 9 * f, s * 8 * f);
    g.lineTo(x0 + 19 * f, s * 1.2);
    g.lineTo(x0 + 5 * f, s * 1.2);
    g.closePath();
    g.fillStyle = s < 0 ? A.fl : A.fl2;
    g.fill();
    g.lineWidth = 1.6 * f;
    g.strokeStyle = OL;
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x0, 0);
  g.lineTo(x1 - hd * 0.6, 0);
  g.strokeStyle = OL;
  g.lineWidth = 5.6 * f;
  g.stroke();
  g.strokeStyle = A.shaft;
  g.lineWidth = 3 * f;
  g.stroke();
  if (A.sack) {
    g.fillStyle = '#b98a52';
    g.beginPath();
    g.ellipse(x1 - hd * 1.4, 0, 9 * f, 7 * f, 0, 0, TAU);
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = OL;
    g.stroke();
  }
  if (A.log) {
    const lx = x1 - 18 * f;
    rr(g, lx - 16 * f, -7.5 * f, 30 * f, 15 * f, 6 * f);
    g.fillStyle = '#9a6234';
    g.fill();
    g.lineWidth = 1.8;
    g.strokeStyle = OL;
    g.stroke();
    g.beginPath();
    g.ellipse(lx + 14 * f, 0, 4.5 * f, 7.5 * f, 0, 0, TAU);
    g.fillStyle = '#e8bd84';
    g.fill();
    g.stroke();
    return;
  }
  g.beginPath();
  g.moveTo(x1, 0);
  g.lineTo(x1 - hd, -hd * 0.5);
  g.lineTo(x1 - hd * 0.7, 0);
  g.lineTo(x1 - hd, hd * 0.5);
  g.closePath();
  g.fillStyle = A.head;
  g.fill();
  g.lineWidth = 1.8 * f;
  g.strokeStyle = A.glass ? '#3f8fb8' : OL;
  g.stroke();
  if (A.drill) {
    g.strokeStyle = '#5d6878';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x1 - hd * 0.8, -hd * 0.35);
    g.lineTo(x1 - hd * 0.45, hd * 0.2);
    g.stroke();
  } else {
    g.strokeStyle = 'rgba(255,255,255,.75)';
    g.lineWidth = 1.4 * f;
    g.beginPath();
    g.moveTo(x1 - hd * 0.85, -hd * 0.3);
    g.lineTo(x1 - hd * 0.15, -hd * 0.05);
    g.stroke();
  }
}

export function arrowLength(look: ArrowLook): number {
  return (ARROW_STYLES[look] ?? ARROW_STYLES.arrow).len;
}

// ——— Archers ———

const STYLE = {
  hero: { sleeve: '#3f9f55', hand: '#f8cfa4', bow: '#a8612a', bowHi: '#e9a866', tip: '#ffd23f', string: '#fbf4e4', grip: '#6b3a1c' },
  bot: { sleeve: '#7d92b5', hand: '#cad8ee', bow: '#33415e', bowHi: '#7ff0ff', tip: '#7ff0ff', string: '#c8fbff', grip: '#ff9f43' },
};

/** Everything that changes how an archer looks from moment to moment. */
export interface Figure {
  kind: 'hero' | 'bot';
  /** 1 facing right, −1 facing left. */
  dir: number;
  /** Bow elevation in degrees, measured from the way they face (0 straight ahead, 90 up). */
  aim: number;
  /** String pulled, 0–1. */
  draw: number;
  hasArrow: boolean;
  arrowLook: ArrowLook;
  hitT: number;
  squash: number;
  stringWob: number;
  blinkFor: number;
  dizzy: number;
  /** ≥ 0 while popping. */
  koT: number;
  /** > 0 while cheering. */
  cheer: number;
}

/** Hands sit this many units above the feet (the arrow leaves from there). */
export const HANDS_UNITS = 55;

function armsBow(g: CanvasRenderingContext2D, a: Figure, t: number, br: number, o: typeof STYLE.hero) {
  g.save();
  g.translate(2, -HANDS_UNITS + br);
  g.rotate(-a.aim * D2R);
  const nock = 26 - a.draw * 26;
  const wob = a.stringWob > 0 ? Math.sin(t * 95) * a.stringWob * 7 : 0;
  const pulled = a.draw > 0.03;
  const hx = pulled ? nock : 18, hy = pulled ? 0 : 4;
  g.beginPath();
  g.moveTo(0, 1);
  g.quadraticCurveTo(hx * 0.5 - 7, 11, hx, hy);
  g.strokeStyle = OL;
  g.lineWidth = 11;
  g.stroke();
  g.strokeStyle = o.sleeve;
  g.lineWidth = 7;
  g.stroke();
  const bend = 51 + a.draw * 6;
  g.beginPath();
  g.moveTo(26, -43);
  g.quadraticCurveTo(bend, 0, 26, 43);
  g.strokeStyle = OL;
  g.lineWidth = 9;
  g.stroke();
  g.strokeStyle = o.bow;
  g.lineWidth = 5.6;
  g.stroke();
  g.beginPath();
  g.moveTo(27.5, -36);
  g.quadraticCurveTo(bend - 3.5, 0, 27.5, 36);
  g.strokeStyle = o.bowHi;
  g.lineWidth = 1.8;
  g.stroke();
  for (const y of [-43, 43]) {
    g.beginPath();
    g.arc(26, y, 3.4, 0, TAU);
    g.fillStyle = o.tip;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = OL;
    g.stroke();
  }
  const mid = pulled ? nock : 26 + wob;
  g.beginPath();
  g.moveTo(26, -43);
  g.lineTo(mid, 0);
  g.lineTo(26, 43);
  g.strokeStyle = o.string;
  g.lineWidth = 2.2;
  g.stroke();
  if (a.hasArrow) {
    g.save();
    arrowShape(g, pulled ? nock - 2 : 20, a.arrowLook);
    g.restore();
  }
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(37, 0);
  g.strokeStyle = OL;
  g.lineWidth = 11;
  g.stroke();
  g.strokeStyle = o.sleeve;
  g.lineWidth = 7;
  g.stroke();
  rr(g, 33, -8, 8, 16, 3);
  g.fillStyle = o.grip;
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = OL;
  g.stroke();
  g.beginPath();
  g.arc(37, 0, 5.6, 0, TAU);
  g.fillStyle = o.hand;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = OL;
  g.stroke();
  g.beginPath();
  g.arc(hx, hy, 5.2, 0, TAU);
  g.fillStyle = o.hand;
  g.fill();
  g.stroke();
  g.restore();
}

function heroBody(g: CanvasRenderingContext2D, a: Figure, t: number, br: number, simple: boolean) {
  // Quiver.
  g.save();
  g.translate(-13, -50 + br * 0.5);
  g.rotate(-0.38);
  for (const [i, c] of [[-5, '#e8453c'], [0, '#ffffff'], [5, '#e8453c']] as const) {
    g.strokeStyle = '#d8b07a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(i, -6);
    g.lineTo(i, -24);
    g.stroke();
    g.beginPath();
    g.moveTo(i, -33);
    g.lineTo(i - 3.6, -22);
    g.lineTo(i, -24.5);
    g.lineTo(i + 3.6, -22);
    g.closePath();
    g.fillStyle = c;
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = OL;
    g.stroke();
  }
  rr(g, -8, -10, 16, 34, 5);
  g.fillStyle = '#8b4a22';
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  g.fillStyle = '#c98a3c';
  g.fillRect(-7, -3, 14, 4);
  g.restore();
  // Legs and boots.
  for (const lx of [-8, 5]) {
    rr(g, lx - 4.5, -27, 9, 22, 4);
    g.fillStyle = '#4b3a2c';
    g.fill();
    g.lineWidth = 2.3;
    g.strokeStyle = OL;
    g.stroke();
    rr(g, lx - 5.5, -9, 13, 10, 4.5);
    g.fillStyle = '#7a4524';
    g.fill();
    g.stroke();
  }
  // Tunic.
  g.beginPath();
  g.moveTo(-14, -22);
  g.quadraticCurveTo(-17, -42, -11, -58 + br);
  g.lineTo(11, -58 + br);
  g.quadraticCurveTo(17, -42, 14, -22);
  g.lineTo(9, -17);
  g.lineTo(4, -22);
  g.lineTo(-1, -17);
  g.lineTo(-6, -22);
  g.lineTo(-10, -17);
  g.closePath();
  if (simple) g.fillStyle = '#41a157';
  else {
    const tg = g.createLinearGradient(-14, 0, 14, 0);
    tg.addColorStop(0, '#55bd69');
    tg.addColorStop(1, '#2e8646');
    g.fillStyle = tg;
  }
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  g.fillStyle = '#6b3a1c';
  g.fillRect(-14.5, -34, 29, 5);
  rr(g, -3, -35.5, 7, 8, 1.5);
  g.fillStyle = '#ffcf3f';
  g.fill();
  g.lineWidth = 1.5;
  g.stroke();
  // Head.
  const hy = -81 + br;
  g.beginPath();
  g.arc(3, hy, 21, 0, TAU);
  g.fillStyle = '#f8cfa4';
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  g.beginPath();
  g.arc(-15, hy + 2, 5, 0, TAU);
  g.fillStyle = '#f3bf91';
  g.fill();
  g.stroke();
  g.fillStyle = '#7a4a24';
  g.beginPath();
  g.moveTo(-18, hy - 2);
  g.quadraticCurveTo(-16, hy - 20, 4, hy - 21);
  g.quadraticCurveTo(20, hy - 20, 24, hy - 9);
  g.quadraticCurveTo(14, hy - 12, 6, hy - 9);
  g.quadraticCurveTo(-4, hy - 12, -10, hy - 4);
  g.closePath();
  g.fill();
  // Hood-hat with a red feather.
  g.beginPath();
  g.moveTo(-23, hy - 5);
  g.quadraticCurveTo(-8, hy - 38, 24, hy - 18);
  g.quadraticCurveTo(31, hy - 12, 23, hy - 10);
  g.quadraticCurveTo(0, hy - 19, -23, hy - 5);
  g.closePath();
  if (simple) g.fillStyle = '#3d9e55';
  else {
    const hg = g.createLinearGradient(0, hy - 38, 0, hy - 5);
    hg.addColorStop(0, '#4fb565');
    hg.addColorStop(1, '#2e8646');
    g.fillStyle = hg;
  }
  g.fill();
  g.lineWidth = 2.5;
  g.stroke();
  g.save();
  g.translate(-9, hy - 21);
  g.rotate(-1.05 + Math.sin(t * 3) * 0.05);
  g.beginPath();
  g.ellipse(0, -13, 4.8, 15, 0, 0, TAU);
  g.fillStyle = '#e8453c';
  g.fill();
  g.lineWidth = 1.8;
  g.stroke();
  g.restore();
  // Face.
  const bl = a.blinkFor > 0 ? 0.12 : 1;
  if (a.koT >= 0 || a.dizzy > 0.5) {
    g.strokeStyle = OL;
    g.lineWidth = 2;
    for (const ex of [10, 19]) {
      g.beginPath();
      g.arc(ex, hy - 1, 3.2, 0, 4.5);
      g.stroke();
    }
  } else {
    for (const ex of [10, 19]) {
      g.beginPath();
      g.ellipse(ex, hy - 1, 2.9, 4.2 * bl, 0, 0, TAU);
      g.fillStyle = OL;
      g.fill();
      if (bl > 0.5) {
        g.beginPath();
        g.arc(ex + 1, hy - 2.6, 1.1, 0, TAU);
        g.fillStyle = '#fff';
        g.fill();
      }
    }
  }
  if (a.draw > 0.3 && a.cheer <= 0) {
    g.strokeStyle = OL;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(7, hy - 8);
    g.lineTo(12, hy - 6.5);
    g.moveTo(17, hy - 6.5);
    g.lineTo(22, hy - 8.5);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,130,120,.5)';
  g.beginPath();
  g.arc(16, hy + 7, 4.2, 0, TAU);
  g.fill();
  g.strokeStyle = OL;
  g.lineWidth = 2;
  g.beginPath();
  if (a.cheer > 0) {
    g.arc(14, hy + 6, 5, 0.05 * Math.PI, 0.95 * Math.PI);
    g.closePath();
    g.fillStyle = '#8a2a2a';
    g.fill();
  } else if (a.draw > 0.3) {
    g.moveTo(11, hy + 10);
    g.lineTo(17, hy + 9.5);
  } else g.arc(14, hy + 7, 4.3, 0.2 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  armsBow(g, a, t, br, STYLE.hero);
}

function botBody(g: CanvasRenderingContext2D, a: Figure, t: number, br: number, simple: boolean) {
  for (const lx of [-8, 5]) {
    rr(g, lx - 4, -25, 8, 20, 3);
    g.fillStyle = '#5d6f8c';
    g.fill();
    g.lineWidth = 2.3;
    g.strokeStyle = OL;
    g.stroke();
    rr(g, lx - 6.5, -8, 14, 9, 4.5);
    g.fillStyle = '#3b4a63';
    g.fill();
    g.stroke();
  }
  rr(g, -16, -59 + br, 32, 37, 10);
  if (simple) g.fillStyle = '#93a7c6';
  else {
    const bg = g.createLinearGradient(-16, 0, 16, 0);
    bg.addColorStop(0, '#b7cae3');
    bg.addColorStop(1, '#6b80a4');
    g.fillStyle = bg;
  }
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  g.beginPath();
  g.arc(0, -42 + br, 8 * pulse + 2, 0, TAU);
  g.fillStyle = 'rgba(255,176,46,.3)';
  g.fill();
  g.beginPath();
  g.arc(0, -42 + br, 5, 0, TAU);
  g.fillStyle = '#ffb02e';
  g.fill();
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = '#4a5b7a';
  for (const [bx, by] of [[-11, -54], [11, -54], [-11, -27], [11, -27]]) {
    g.beginPath();
    g.arc(bx, by + br, 1.6, 0, TAU);
    g.fill();
  }
  const hy = -85 + br;
  g.strokeStyle = OL;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(1, hy - 18);
  g.lineTo(1, hy - 31);
  g.stroke();
  const on = Math.sin(t * 5) > 0;
  g.beginPath();
  g.arc(1, hy - 33, 4.8, 0, TAU);
  g.fillStyle = on ? '#ff6b6b' : '#b33a3a';
  g.fill();
  g.stroke();
  if (on) {
    g.beginPath();
    g.arc(1, hy - 33, 9, 0, TAU);
    g.fillStyle = 'rgba(255,107,107,.25)';
    g.fill();
  }
  for (const ex of [-20, 22]) {
    g.beginPath();
    g.arc(ex, hy, 5, 0, TAU);
    g.fillStyle = '#ff9f43';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = OL;
    g.stroke();
  }
  rr(g, -20, hy - 18, 42, 36, 13);
  if (simple) g.fillStyle = '#a5b6d0';
  else {
    const hg = g.createLinearGradient(-20, 0, 22, 0);
    hg.addColorStop(0, '#cbdaee');
    hg.addColorStop(1, '#7d92b5');
    g.fillStyle = hg;
  }
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.45)';
  rr(g, -15, hy - 15, 14, 4, 2);
  g.fill();
  rr(g, -11, hy - 10, 30, 22, 8);
  g.fillStyle = '#16213a';
  g.fill();
  g.fillStyle = '#6ff3ff';
  g.strokeStyle = '#6ff3ff';
  if (a.koT >= 0 || a.dizzy > 0.5) {
    g.lineWidth = 1.8;
    for (const ex of [-1, 11]) {
      g.beginPath();
      for (let k = 0; k < 14; k++) {
        const an = k * 0.9 + t * 8, rad = k * 0.28;
        g.lineTo(ex + 3 + Math.cos(an) * rad, hy + Math.sin(an) * rad);
      }
      g.stroke();
    }
  } else {
    const bl = a.blinkFor > 0 ? 0.15 : 1;
    const eh = a.cheer > 0 ? 0.45 : 1;
    rr(g, 0, hy - 5 * bl * eh, 5, 10 * bl * eh, 2.5);
    g.fill();
    rr(g, 11, hy - 5 * bl * eh, 5, 10 * bl * eh, 2.5);
    g.fill();
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(8, hy + 4, a.cheer > 0 ? 5 : 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  }
  armsBow(g, a, t, br, STYLE.bot);
}

/**
 * Draws an archer with their feet at (0, 0) of the current transform, `K` field px per unit.
 * `t` is the time in seconds (breathing, blinking lights).
 */
export function drawFigure(g: CanvasRenderingContext2D, a: Figure, t: number, K: number, simple: boolean, phase: number) {
  g.save();
  g.fillStyle = 'rgba(20,10,0,.24)';
  g.beginPath();
  g.ellipse(0, 1 * K, 26 * K, 6 * K, 0, 0, TAU);
  g.fill();
  let rot = 0;
  if (a.hitT > 0) rot += Math.sin(a.hitT * 26) * 0.16 * a.hitT;
  if (a.koT >= 0) rot += Math.sin(a.koT * 14) * 0.22;
  g.rotate(rot * a.dir);
  const sq = a.squash * 0.2;
  g.scale(K * a.dir * (1 + sq), K * (1 - sq));
  const br = Math.sin(t * 2.4 + phase) * 1.2;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (a.kind === 'hero') heroBody(g, a, t, br, simple);
  else botBody(g, a, t, br, simple);
  g.restore();
  if (a.dizzy > 0 || a.koT >= 0) {
    const cy = -128 * K, al = a.koT >= 0 ? 1 : Math.min(1, a.dizzy);
    for (let i = 0; i < 3; i++) {
      const an = t * 5 + (i * TAU) / 3;
      drawStar(g, Math.cos(an) * 22 * K, cy + Math.sin(an) * 6 * K, 6.5 * K, t * 3, al);
    }
  }
}
