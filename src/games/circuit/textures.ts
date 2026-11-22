/**
 * Circuit Racer's tile pictures, drawn in code on small canvases (painted textures come in Stage 5). Each is a square that
 * covers one road cell, seen from above, the far end at the top.
 */
import * as THREE from 'three';

export type TileKind = 'trace' | 'overclock' | 'resistor' | 'short' | 'gel' | 'recharge' | 'tunnel';

const SIZE = 128;

function canvas(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Board green with gold traces and solder dots: the plain road. */
function board(g: CanvasRenderingContext2D, base: string, line: string) {
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = line;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(28, 0); g.lineTo(28, 50); g.lineTo(48, 70); g.lineTo(48, 128);
  g.moveTo(96, 0); g.lineTo(96, 128);
  g.stroke();
  g.fillStyle = line;
  for (const [x, y] of [[28, 50], [48, 70], [96, 34], [96, 98]]) {
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  // The lane's edges: a faint bright rim so lanes read apart.
  g.strokeStyle = 'rgba(160,255,220,0.35)';
  g.lineWidth = 3;
  g.strokeRect(1.5, -2, SIZE - 3, SIZE + 4);
}

/** Each world's plain trace: board colour and its traces (Stage 4). */
export const BOARDS = {
  motherboard: ['#0b3b2c', '#d8b24a'],
  graphics: ['#3a0f0a', '#ff8a3d'],
  memory: ['#0c2442', '#c7d7ea'],
  cloud: ['#15385c', '#9ff3ff'],
  quantum: ['#26093f', '#f5c542'],
} as const;

export function tileTextures(world: keyof typeof BOARDS = 'motherboard'): Record<TileKind, THREE.CanvasTexture> {
  return {
    trace: canvas((g) => board(g, BOARDS[world][0], BOARDS[world][1])),
    overclock: canvas((g) => {
      board(g, '#06402a', '#2bd36b');
      g.fillStyle = '#7dffa8';
      for (const y of [12, 58, 104]) {
        g.beginPath(); g.moveTo(64, y); g.lineTo(104, y + 30); g.lineTo(84, y + 30); g.lineTo(64, y + 15); g.lineTo(44, y + 30); g.lineTo(24, y + 30); g.closePath(); g.fill();
      }
    }),
    resistor: canvas((g) => {
      g.fillStyle = '#5a3a0a';
      g.fillRect(0, 0, SIZE, SIZE);
      const bands = ['#ffb21e', '#c76a00', '#ffd76a', '#8a4a00'];
      bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 10 + i * 30, SIZE, 14); });
    }),
    short: canvas((g) => {
      g.fillStyle = '#3a0508';
      g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#ff3b3b';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(10, 20); g.lineTo(50, 50); g.lineTo(30, 70); g.lineTo(80, 110); g.lineTo(70, 80); g.lineTo(118, 60);
      g.moveTo(90, 10); g.lineTo(70, 40); g.lineTo(100, 45);
      g.stroke();
      g.fillStyle = '#ffb3b3';
      g.font = 'bold 40px system-ui';
      g.textAlign = 'center';
      g.fillText('⚡', 64, 78);
    }),
    gel: canvas((g) => {
      const grad = g.createLinearGradient(0, 0, SIZE, SIZE);
      grad.addColorStop(0, '#9ff3ff'); grad.addColorStop(0.5, '#3fb6e0'); grad.addColorStop(1, '#bff8ff');
      g.fillStyle = grad;
      g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      for (let i = -SIZE; i < SIZE; i += 32) { g.beginPath(); g.moveTo(i, SIZE); g.lineTo(i + SIZE, 0); g.stroke(); }
    }),
    recharge: canvas((g) => {
      g.fillStyle = '#061a3a';
      g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#38bdf8';
      g.lineWidth = 10;
      g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#bae6fd';
      g.fillRect(52, 40, 8, 22); g.fillRect(68, 40, 8, 22);
      g.fillRect(44, 60, 40, 20);
    }),
    tunnel: canvas((g) => board(g, '#14213d', '#5eead4')),
  };
}

/** The top of a chip: dark with a little bright logo and pins along the sides. */
export function chipTexture(colour: string): THREE.CanvasTexture {
  return canvas((g) => {
    g.fillStyle = '#10131c';
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = colour;
    g.lineWidth = 6;
    g.strokeRect(10, 10, SIZE - 20, SIZE - 20);
    g.fillStyle = colour;
    g.beginPath(); g.arc(64, 64, 16, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) {
      g.fillRect(16 + i * 18, 0, 8, 8);
      g.fillRect(16 + i * 18, SIZE - 8, 8, 8);
    }
  });
}
