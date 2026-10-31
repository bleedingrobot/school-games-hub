/**
 * A little picture of an Armory item, drawn in code with the game's own art (the same arrows that fly in fights):
 * arrows on a diagonal, shields, bows, an apple and an umbrella. Decorative: the item's name is always next to it.
 */
import { useEffect, useRef } from 'react';
import { isArrowId } from '../../../shared/archery/arrows';
import type { ShopKind } from '../../../shared/archery/shop';
import { arrowLength, arrowLook, arrowShape } from './art/archers';
import { OL, TAU } from './art/util';

const BOW_COLOURS: Record<string, [string, string]> = {
  starter: ['#a8612a', '#e9a866'],
  long: ['#6b3a1c', '#c08a52'],
  recurve: ['#8a1f2b', '#ff8a7a'],
  hunter: ['#3d6b2f', '#a8d860'],
  golden: ['#d9a520', '#fff4b0'],
};

function drawItem(g: CanvasRenderingContext2D, kind: ShopKind, id: string) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (kind === 'gear' && isArrowId(id)) {
    const look = arrowLook(id, 0);
    const len = arrowLength(look);
    const k = 44 / (len + 12);
    g.save();
    g.translate(32, 32);
    g.rotate(-Math.PI / 4);
    g.scale(k, k);
    arrowShape(g, -len / 2, look);
    g.restore();
    return;
  }
  if (id === 'apple') {
    g.beginPath();
    g.arc(26, 36, 13, 0, TAU);
    g.arc(38, 36, 13, 0, TAU);
    g.fillStyle = '#e8453c';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = OL;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.ellipse(25, 31, 4, 6, -0.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(32, 25);
    g.quadraticCurveTo(33, 16, 37, 13);
    g.strokeStyle = '#6b3a1c';
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.ellipse(41, 17, 7, 3.5, -0.4, 0, TAU);
    g.fillStyle = '#5fd35a';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = OL;
    g.stroke();
    return;
  }
  if (id === 'umbrella') {
    g.beginPath();
    g.moveTo(32, 30);
    g.lineTo(32, 52);
    g.quadraticCurveTo(32, 57, 27, 55);
    g.strokeStyle = OL;
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.moveTo(8, 32);
    g.quadraticCurveTo(32, 2, 56, 32);
    g.quadraticCurveTo(48, 27, 44, 32);
    g.quadraticCurveTo(38, 27, 32, 32);
    g.quadraticCurveTo(26, 27, 20, 32);
    g.quadraticCurveTo(14, 27, 8, 32);
    g.fillStyle = '#ff4fa3';
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    return;
  }
  if (kind === 'shield') {
    if (id === 'bubble') {
      const rg = g.createRadialGradient(26, 24, 3, 32, 32, 24);
      rg.addColorStop(0, 'rgba(255,255,255,.9)');
      rg.addColorStop(0.6, 'rgba(160,230,255,.35)');
      rg.addColorStop(1, 'rgba(90,190,240,.75)');
      g.beginPath();
      g.arc(32, 32, 23, 0, TAU);
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#2aa7d6';
      g.stroke();
      return;
    }
    if (id === 'charm') {
      g.strokeStyle = '#2aa7d6';
      g.lineWidth = 4;
      for (const [y, w] of [[22, 34], [32, 40], [42, 28]] as const) {
        g.beginPath();
        g.moveTo(32 - w / 2, y);
        g.quadraticCurveTo(32, y - 8, 32 + w / 2, y);
        g.quadraticCurveTo(32 + w / 2 + 6, y + 5, 32 + w / 2 - 3, y + 7);
        g.stroke();
      }
      return;
    }
    g.beginPath();
    g.arc(32, 32, 22, 0, TAU);
    g.fillStyle = '#a8612a';
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = OL;
    g.stroke();
    g.beginPath();
    g.arc(32, 32, 15, 0, TAU);
    g.strokeStyle = '#e9a866';
    g.lineWidth = 2;
    g.stroke();
    g.beginPath();
    g.arc(32, 32, 5, 0, TAU);
    g.fillStyle = '#cfd8e6';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = OL;
    g.stroke();
    return;
  }
  // A bow, standing up, with its string.
  const [c1, c2] = BOW_COLOURS[id] ?? BOW_COLOURS.starter;
  const curve = id === 'recurve' ? 18 : id === 'long' ? 14 : 20;
  g.beginPath();
  g.moveTo(24, 6);
  g.lineTo(24, 58);
  g.strokeStyle = '#fbf4e4';
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.moveTo(24, 6);
  if (id === 'recurve') g.bezierCurveTo(50, 10, 34, 54, 24, 58);
  else g.quadraticCurveTo(24 + curve * 2, 32, 24, 58);
  g.strokeStyle = OL;
  g.lineWidth = 7;
  g.stroke();
  g.strokeStyle = c1;
  g.lineWidth = 4.5;
  g.stroke();
  g.strokeStyle = c2;
  g.lineWidth = 1.5;
  g.stroke();
  if (id === 'golden') {
    g.fillStyle = '#fffbe0';
    for (const [x, y] of [[40, 20], [45, 34], [38, 47]] as const) {
      g.beginPath();
      g.arc(x, y, 2, 0, TAU);
      g.fill();
    }
  }
}

export function ItemIcon({ kind, id, size = 52 }: { kind: ShopKind; id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let g: CanvasRenderingContext2D | null = null;
    try {
      g = c.getContext('2d');
    } catch {
      g = null;
    }
    if (!g) return;
    const ratio = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.width = Math.round(size * ratio);
    c.height = Math.round(size * ratio);
    g.setTransform((size / 64) * ratio, 0, 0, (size / 64) * ratio, 0, 0);
    g.clearRect(0, 0, 64, 64);
    drawItem(g, kind, id);
  }, [kind, id, size]);
  return <canvas ref={ref} className="ar-icon" width={size} height={size} style={{ width: size, height: size }} aria-hidden="true" />;
}
