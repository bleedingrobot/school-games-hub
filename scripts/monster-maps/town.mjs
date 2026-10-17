import { MapMaker, TD, TT } from './lib.mjs';

// ───────────────────────── Harbour Town (the start) ─────────────────────────
export function harbourTown() {
  const m = new MapMaker('harbour-town', 'Harbour Town', 24, 18);
  m.border([[11, 0], [12, 0]]);
  m.path(11, 0, 2, 14);   // the road north to Kauri Bush
  m.path(3, 12, 18, 2);   // the road across town
  m.path(4, 9, 3, 3);     // the square outside the Healing Centre
  m.path(15, 9, 3, 3);    // the square outside the teacher's house
  m.house(5, 5, { roof: 'red', wall: 'grey', door: true });          // the Healing Centre: door at (6,8)
  m.house(16, 5, { roof: 'blue', wall: 'brown' });                    // a house (just for show)
  m.house(1, 6, { roof: 'blue', wall: 'grey' });                      // a house (just for show)
  m.house(20, 8, { roof: 'red', wall: 'brown' });                     // a house (just for show)
  for (const [x, y] of [[3, 2], [8, 3], [15, 2], [19, 3], [21, 2], [2, 15], [9, 16], [20, 16], [13, 16]]) m.tree(x, y);
  for (const [x, y] of [[9, 2], [14, 3], [6, 3]]) m.bush(x, y);
  m.bigTree(2, 11); m.bigTree(22, 6); m.bigTree(8, 8);
  m.fence(14, 15, 5); m.fence(2, 4, 4);
  m.water(17, 15, 4, 2);
  // Things to do.
  m.sign('welcome', 9, 14, 'Welcome to Harbour Town! The wild monsters live up the road, in Kauri Bush.');
  m.sign('healing-sign', 8, 9, 'Healing Centre. Tired monsters rest here.');
  m.sign('north-sign', 14, 1, 'North: Kauri Bush. Watch out for long grass!');
  m.sign('pond-sign', 16, 14, 'Please do not feed the Minnowus.');
  m.person('Teacher', 84, 13, 15, 'left', 'Hello! I am your teacher. Welcome to Maths Monsters!\nEvery monster stands for one kind of maths. Fire is times tables, Water is adding and taking away.\nIn a battle your monster attacks by answering a maths question. Right answers hit hard, quick ones hit harder, and a wrong one still does a little.\nNobody ever loses anything for a wrong answer. If your team gets tired, you just wake up at the Healing Centre.\nWalk in the long grass up north to find wild monsters. Throw a ball to catch them!\nThe end of each area has a Topic Tower. Beat its trainer to win a badge and open the way to the next area.\nPress M or Escape to open your menu any time.\nGood luck!');
  m.person('Fisher', 111, 19, 14, 'left', 'The Minnowus here are so quick. I swear one swam off with my sandwich.');
  m.wall(3, 14, TD(89)); m.object('box', 'Monster box', 3, 14, { text: 'This is your Monster box. It keeps the monsters that do not fit in your team of six.\nYour box holds {box} monsters. Let us have a look!' });
  m.wall(2, 14, TD(63)); m.object('book', 'Monster book', 2, 14, { text: 'This is the Monster book. It lists every monster you meet, with its type, its maths and how it grows.\nLet us have a look!' });
  m.warp('to-bush-left', 11, 0, 'kauri-bush', 11, 18, 'up');
  m.warp('to-bush-right', 12, 0, 'kauri-bush', 12, 18, 'up');
  m.warp('to-healing-centre', 6, 8, 'healing-centre', 5, 5, 'up');
  m.spot('start', 11, 15, 'up');
  m.spot('box', 3, 15, 'up');
  m.spot('book', 2, 13, 'down');
  m.save();
}

// ───────────────────────── Healing Centre (inside) ─────────────────────────
export function healingCentre() {
  const m = new MapMaker('healing-centre', 'Healing Centre', 10, 7);
  m.floor(TD(49));
  for (let x = 0; x < 10; x++) { m.wall(x, 0, TD(40)); m.wall(x, 1, TD(x === 2 || x === 7 ? 28 : 40)); }
  m.wall(4, 1, TD(29)); // the red banner over the nurse
  for (const x of [2, 3, 5, 6]) m.wall(x, 2, TD(72)); // the counter, with a gap for the nurse
  m.object('nurse', 'Nurse Joy', 4, 2, { sprite: 99, facing: 'down', text: 'Welcome to the Healing Centre! Let me look after your monsters.' });
  for (let x = 0; x < 10; x++) if (x !== 5) m.wall(x, 6, TD(40));
  m.wall(5, 6, TT(89));
  m.bush(1, 4); m.bush(8, 4);
  m.sign('poster', 1, 2, 'A poster: "A rested monster is a happy monster. Talk to the nurse any time!"', TT(93));
  m.warp('out', 5, 6, 'harbour-town', 6, 9, 'down');
  m.spot('wake', 4, 3, 'up');
  m.save();
}
