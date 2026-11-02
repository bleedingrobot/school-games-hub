import { MapMaker, PEOPLE, X } from './lib.mjs';

/*
 * The three bonus areas behind the sleeping giants (docs/MONSTERS-QUESTS-PLAN.md section 4). Each is
 * a side path off its area, with the same wild levels and questions, rarer monsters, a trainer and a
 * hatching spot. They are 20 x 14, and you come in on the side the giant slept on.
 */

// ───────────────────────── Steam Valley (off Fire Mountain, behind Snorumble) ─────────────────────────
export function steamValley() {
  const wild = ['factorch', 'multipup', 'squaremander', 'squaremander', 'coinrock', 'centipebble', 'centipebble', 'arraydillo', 'tuatenth', 'kilokiwi'];
  const m = new MapMaker('steam-valley', 'Steam Valley', 20, 14, 3, wild, 'ash');
  m.border([[0, 7]], (x, y) => m.boulder(x, y, true));
  m.path(1, 7, 10, 2); m.path(9, 3, 2, 5); m.path(9, 9, 2, 3);
  m.water(12, 2, 5, 3); // the hot springs
  m.longGrass(2, 2, 6, 4); m.longGrass(2, 10, 6, 3); m.longGrass(12, 7, 6, 5);
  m.sign('valley-sign', 3, 9, 'Steam Valley. Warm steam rises from the hot springs. Rare monsters love it here!');
  m.sign('springs-sign', 11, 2, 'The hot springs. A warm egg brought here will hatch in the steam.');
  m.trainer('Geyser Gus', PEOPLE.viking, 10, 12, 'up', { sight: 3, text: 'Whoosh! The geysers made me strong. Let us battle!', win: 'Phew, you are hotter than a geyser!', team: 'squaremander:19,centipebble:19', loot: 'trainer-big' });
  m.warp('to-fire-mountain', 0, 7, 'fire-mountain', 22, 7, 'left');
  m.spot('entrance', 1, 7, 'right');
  m.spot('hot-springs', 11, 3, 'right');
  m.puzzle('Hot spring chest', 'steam-lock', 15, 9, 'A chest with a number lock. Signs nearby give clues.');
  m.scatter(8, (x, y) => m.boulder(x, y, true), { seed: 21 });
  m.scatter(5, (x, y) => m.autumnSmall(x, y), { seed: 22 });
  m.save();
}

// ───────────────────────── Lagoon Isle (off Shell Beach, behind Drowsea) ─────────────────────────
export function lagoonIsle() {
  const wild = ['plusplash', 'minnowus', 'carrycrab', 'carrycrab', 'remaindeer', 'denomibolt', 'plustoise', 'quarterowl', 'shareseal'];
  const m = new MapMaker('lagoon-isle', 'Lagoon Isle', 20, 14, 2, wild, 'beach');
  m.border([[0, 7]], (x, y) => m.bush(x, y));
  m.path(1, 7, 8, 2); m.path(7, 3, 2, 5); m.path(7, 9, 2, 3);
  m.water(11, 3, 7, 7); // the lagoon
  m.longGrass(2, 2, 4, 4); m.longGrass(2, 10, 4, 3); m.longGrass(9, 11, 8, 2);
  m.sign('isle-sign', 3, 9, 'Lagoon Isle. The water here is calm and warm. Shy monsters live by the lagoon.');
  m.sign('pools-sign', 9, 3, 'The rock pools. A water egg brought here will hatch in the waves.');
  m.trainer('Diver Ngaio', PEOPLE.woman, 8, 12, 'up', { sight: 3, text: 'I dive for shells all day. My monsters dive too! Ready?', win: 'Wow, you swim like a Carrycrab!', team: 'carrycrab:12,plusplash:12', loot: 'trainer-big' });
  m.warp('to-shell-beach', 0, 7, 'shell-beach', 22, 11, 'left');
  m.spot('entrance', 1, 7, 'right');
  m.spot('rock-pools', 10, 4, 'right');
  m.puzzle('Lagoon stones', 'lagoon-stones', 5, 11, 'Stepping stones across the lagoon.');
  m.scatter(8, (x, y) => m.palm(x, y), { seed: 23, y0: 2 });
  m.scatter(4, (x, y) => m.boulder(x, y), { seed: 24 });
  m.save();
}

// ───────────────────────── Aurora Hollow (off Snowy Peaks, behind Yawnberg) ─────────────────────────
export function auroraHollow() {
  const wild = ['divvy', 'sharebear', 'remaindeer', 'remaindeer', 'denomibolt', 'denomibolt', 'shareseal', 'quarterowl', 'tuatenth', 'arraydillo'];
  const m = new MapMaker('aurora-hollow', 'Aurora Hollow', 20, 14, 4, wild, 'snow');
  m.border([[19, 7]], (x, y) => m.snowPine(x, y));
  m.path(9, 7, 10, 2); m.path(9, 3, 2, 5); m.path(9, 9, 2, 3);
  m.ice(2, 2, 5, 4); // the ice cave floor
  m.rock(1, 1, 7, 1);
  m.longGrass(12, 2, 6, 4); m.longGrass(12, 10, 6, 3); m.longGrass(2, 8, 5, 4);
  m.sign('hollow-sign', 16, 9, 'Aurora Hollow. On clear nights the southern lights glow over the snow.');
  m.sign('cave-sign', 7, 3, 'The ice cave. A cold egg brought here will hatch in the frost.');
  m.trainer('Skier Rewi', PEOPLE.ranger, 9, 12, 'up', { sight: 3, text: 'I ski here every night under the lights. Battle me!', win: 'Brrr, that was a cool battle!', team: 'remaindeer:24,sharebear:24', loot: 'trainer-big' });
  m.warp('to-snowy-peaks', 19, 7, 'snowy-peaks', 2, 13, 'right');
  m.spot('entrance', 18, 7, 'left');
  m.spot('ice-cave', 6, 4, 'left');
  m.puzzle('Frozen lake', 'aurora-slide', 12, 6, 'A frozen lake under the lights. A chest glints on the ice.');
  m.scatter(8, (x, y) => m.snowTree(x, y), { seed: 25, y0: 2 });
  m.scatter(4, (x, y) => m.snowBush(x, y), { seed: 26 });
  m.save();
}
