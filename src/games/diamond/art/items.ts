/**
 * Pictures for the Workshop: a drawn icon for every upgrade, and the swinging claw that shows what's worn (or being
 * tried on). Drawn with the same art as the play screen, so an upgrade looks the same in the shop and in a level.
 */
import type { Slot, WorkshopItem } from '../../../../shared/diamond/config';
import { EFFECT_COLOUR, drawClaw, drawGem, drawNugget, drawRope, drawTrail, drawWinch } from './draw';

type Ctx = CanvasRenderingContext2D;
export type Worn = Partial<Record<Slot, string>>;

/** An upgrade's icon in a 100-unit box. */
export function drawItem(ctx: Ctx, item: WorkshopItem, time: number) {
  ctx.save();
  switch (item.slot) {
    case 'head':
      drawRope(ctx, 50, 0, 50, 26, undefined, time, true);
      drawClaw(ctx, 50, 26, 0, false, item.id, 56, time);
      break;
    case 'rope':
      drawRope(ctx, 50, 0, 50, 72, item.id, time, true);
      drawClaw(ctx, 50, 72, 0, false, undefined, 26);
      break;
    case 'trail': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 24; i++) pts.push([30 + i * 1.5, 70 - i * 1.5 + Math.sin(i / 3) * 2]);
      ctx.save();
      ctx.translate(46, 54); ctx.scale(1.5, 1.5); ctx.translate(-50, -50);
      drawTrail(ctx, pts, item.id, 1.3, false);
      ctx.restore();
      drawClaw(ctx, 84, 16, -0.8, false, undefined, 24);
      break;
    }
    case 'catch':
      catchIcon(ctx, item.id);
      break;
    case 'winch':
      ctx.translate(50, 42);
      ctx.scale(0.85, 0.85);
      drawWinch(ctx, 0, 0, item.id, 0.4, 0.5, true);
      break;
    case 'hat':
      drawNugget(ctx, 44, 94, 80, item.id, 'stand', 0, true);
      break;
  }
  ctx.restore();
}

function catchIcon(ctx: Ctx, id: string) {
  const colour = EFFECT_COLOUR[id] ?? '#fde047';
  const g = ctx.createRadialGradient(50, 50, 4, 50, 50, 46);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(50, 50, 46, 0, Math.PI * 2); ctx.fill();
  switch (id) {
    case 'fireworks':
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        ctx.strokeStyle = ['#f87171', '#fde047', '#60a5fa', '#4ade80'][i % 4]; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(50 + Math.cos(a) * 12, 50 + Math.sin(a) * 12); ctx.lineTo(50 + Math.cos(a) * 34, 50 + Math.sin(a) * 34); ctx.stroke();
      }
      break;
    case 'disco-ball':
      ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(50, 54, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let x = 30; x < 72; x += 9) for (let y = 34; y < 76; y += 9) { ctx.fillStyle = (x + y) % 2 ? '#f8fafc' : '#94a3b8'; ctx.fillRect(x, y, 7, 7); }
      ctx.strokeStyle = '#475569'; ctx.beginPath(); ctx.moveTo(50, 4); ctx.lineTo(50, 28); ctx.stroke();
      break;
    case 'gem-rain':
    case 'gem-rain-deluxe': {
      const gems = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'] as const;
      gems.forEach((gem, i) => drawGem(ctx, gem, 20 + i * 15, 24 + ((i * 23) % 50), id === 'gem-rain' ? 9 : 12));
      if (id === 'gem-rain-deluxe') drawGem(ctx, 'heartDiamond', 50, 60, 14);
      break;
    }
    case 'trumpet-fanfare':
      ctx.save(); ctx.translate(48, 56); ctx.rotate(-0.4);
      ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2.5;
      ctx.fillRect(-34, -5, 40, 10); ctx.strokeRect(-34, -5, 40, 10);
      ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(32, -20); ctx.lineTo(32, 20); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      break;
    case 'happy-dance':
      drawNugget(ctx, 44, 92, 74, undefined, 'cheer', 0, true);
      break;
  }
}

/**
 * The winch with its rope and claw swinging under it, in a 200 × 160 box, wearing `worn`. Used for "try it on" and on
 * the level map. With less motion it still swings (the swing is the game) but slowly, with a still glow for trails.
 */
export function drawRig(ctx: Ctx, worn: Worn, time: number, still: boolean, trail: [number, number][], nugget = true) {
  const swing = Math.sin(time * (still ? 0.6 : 1.4)) * 0.6;
  const len = 92;
  const px = 100, py = 34;
  const tx = px + Math.sin(swing) * len, ty = py + Math.cos(swing) * len;
  trail.push([tx, ty]);
  if (trail.length > 26) trail.shift();
  drawTrail(ctx, trail, worn.trail, time, still);
  drawRope(ctx, px, py, tx, ty, worn.rope, time, still);
  drawClaw(ctx, tx, ty, swing, false, worn.head, 34, time);
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(0.8, 0.8);
  ctx.translate(-px, -py);
  drawWinch(ctx, px, py, worn.winch, time * 0.5, time, still);
  ctx.restore();
  if (nugget) drawNugget(ctx, 186, 156, 44, worn.hat, 'wave', time, still, -1);
}
