/** Every drawn picture in Diamond Drop on one sheet, for checking the code art (not part of the game). */
import { FIELD_H, FIELD_W, GEMS } from '../../shared/diamond/config';
import { WORKSHOP_ITEMS } from '../../shared/diamond/workshopItems';
import { drawBackground, drawCrab, drawGem, drawNugget, drawRock, drawSack } from '../../src/games/diamond/art/draw';
import { drawItem } from '../../src/games/diamond/art/items';

const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
ctx.font = '13px system-ui';
const label = (t: string, x: number, y: number) => { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, x, y); };

// The 10 levels, 5 to a row.
for (let l = 1; l <= 10; l++) {
  const x = ((l - 1) % 5) * 280, y = Math.floor((l - 1) / 5) * 210;
  ctx.save(); ctx.translate(x + 4, y + 4); ctx.scale(270 / FIELD_W, 189 / FIELD_H); drawBackground(ctx, l); ctx.restore();
  label(`Level ${l}`, x + 140, y + 207);
}
// Gems, big and small, and shadows.
GEMS.forEach((g, i) => {
  const x = 60 + i * 130;
  ctx.fillStyle = '#2a3350'; ctx.fillRect(x - 55, 430, 110, 150);
  drawGem(ctx, g.id, x, 480, 40, { halo: true });
  drawGem(ctx, g.id, x - 25, 550, 12);
  drawGem(ctx, g.id, x + 25, 550, 18, { shadow: true });
  label(g.name, x, 598);
});
// Rocks, sack, crabs, Nugget's poses.
drawRock(ctx, 60, 660, 28, 1); drawRock(ctx, 150, 660, 42, 2); drawSack(ctx, 240, 660, 22);
drawCrab(ctx, 320, 665, 20, 0, true, 'ruby'); drawCrab(ctx, 400, 665, 20, 0.3, false);
(['stand', 'wave', 'point', 'cheer', 'oops'] as const).forEach((p, i) => { drawNugget(ctx, 500 + i * 90, 700, 70, undefined, p, 0.4, true); label(p, 500 + i * 90, 715); });
// Every Workshop upgrade.
WORKSHOP_ITEMS.forEach((it, i) => {
  const x = (i % 11) * 126 + 10, y = 740 + Math.floor(i / 11) * 140;
  ctx.fillStyle = '#2a1d14'; ctx.fillRect(x, y, 110, 110);
  ctx.save(); ctx.translate(x + 5, y + 5); drawItem(ctx, it, 1.2); ctx.restore();
  label(it.name, x + 55, y + 126);
});
