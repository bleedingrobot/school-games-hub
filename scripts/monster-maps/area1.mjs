import { MapMaker, PEOPLE, TT, towerRooms } from './lib.mjs';

// ───────────────────────── Area 1: Kauri Bush (Leaf: place value and rounding) ─────────────────────────
// Wild levels 2-6. The Leaf families live here; one of each other type's first forms pops up too.
export function kauriBush() {
  const wild = ['digibud', 'digibud', 'roundroot', 'roundroot', 'placepetal', 'placepetal', 'plusplash', 'minnowus', 'multipup', 'divvy', 'fractopus', 'pebblepoint'];
  const m = new MapMaker('kauri-bush', 'Area 1: Kauri Bush', 25, 20, 1, wild);
  // The far half (the north) has higher-level monsters and harder questions.
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[11, 19], [12, 19], [21, 0]]);
  m.path(11, 13, 2, 7);   // from town, north
  m.path(11, 11, 9, 2);   // east
  m.path(18, 3, 2, 9);    // north again, towards the Tower and Shell Beach
  m.path(18, 2, 4, 2);    // the way to the gate
  m.path(14, 6, 5, 2);    // to the Tower door
  m.path(4, 15, 8, 2);    // a side trail west
  m.longGrass(2, 11, 6, 3); m.longGrass(2, 17, 7, 2); m.longGrass(17, 15, 3, 3);
  m.longGrass(2, 3, 10, 4); m.longGrass(3, 7, 9, 3); m.longGrass(13, 8, 3, 2); m.longGrass(20, 6, 3, 7);
  for (const [x, y] of [[8, 13], [3, 14], [22, 15], [20, 17]]) m.tree(x, y);
  for (const [x, y] of [[9, 4], [13, 10], [16, 12], [22, 4], [5, 10]]) m.bigTree(x, y);
  for (const [x, y] of [[16, 8], [21, 11], [10, 2], [23, 8], [7, 17]]) m.bush(x, y);
  m.water(21, 14, 3, 2);
  // The Tower, a healing hut, and the gate on to Shell Beach.
  m.towerBuilding(12, 1);
  m.warp('to-tower', 14, 5, 'tower-1-hall', 5, 7, 'up');
  m.hut(14, 13, 13, 15, 'Nurse Pania', 'Kia ora! I look after tired monsters here in the bush.');
  m.gate('area-2-gate', 21, 1, 'leaf', 'A rope fence blocks the path north. A sign says: "Shell Beach. Only for trainers with a Leaf badge!"');
  m.warp('to-shell-beach', 21, 0, 'shell-beach', 21, 18, 'up');
  // Signs, people, a trainer and two chests.
  m.sign('bush-sign', 10, 18, 'Kauri Bush. Wild monsters hide in the long grass. Walk in it and see who jumps out!');
  m.sign('trail-sign', 16, 10, 'North: the Leaf Tower and Shell Beach. South: Harbour Town.');
  m.sign('west-sign', 4, 14, 'West trail: lots of long grass. Be ready!');
  m.sign('hut-sign', 13, 14, 'Rest hut. Nurse Pania will heal your team for free.');
  m.sign('tower-sign', 15, 6, 'The Leaf Tower. Beat the Tower trainer to win the Leaf badge.');
  m.sign('chest-sign', 9, 11, 'A chest is hidden in the long grass to the west. Look for a little box!');
  m.person('Mere', PEOPLE.elder, 15, 17, 'left', 'Tip: if a monster is nearly out of health, it is much easier to catch.\nA right answer helps too!');
  m.person('Tama', PEOPLE.man, 9, 12, 'right', 'Why was six afraid of seven?\nBecause seven eight nine!');
  m.person('Hermit', PEOPLE.hooded, 11, 6, 'right', 'Each monster uses the maths of its type. Water monsters ask adding and taking away, Fire monsters ask times tables.\nBring a monster of every type, and you can practise everything!');
  m.trainer('Ranger Kiri', 96, 16, 9, 'right', { sight: 4, text: 'Hey! You there! I saw you walk past. Show me your monsters!', win: 'Great battle! You are getting good at this. Keep going!', team: 'digibud:4,plusplash:4', loot: 'trainer-small' });
  m.chest('Chest in the bush', 6, 12, 'balls', 'A wooden chest, half hidden in the grass. You lift the lid...');
  m.chest('Chest by the Tower', 17, 4, 'mixed', 'A chest sits beside the path. You lift the lid...');
  m.warp('to-town-left', 11, 19, 'harbour-town', 11, 1, 'down');
  m.warp('to-town-right', 12, 19, 'harbour-town', 12, 1, 'down');
  m.spot('entrance', 11, 18, 'up');
  m.spot('trainer-approach', 18, 10, 'up');
  m.spot('grass-edge', 17, 14, 'down');
  m.spot('nurse', 12, 15, 'right');
  m.spot('chest', 6, 11, 'down');
  m.spot('tower-door', 14, 6, 'up');
  m.spot('gate', 21, 2, 'up');
  m.save();

  towerRooms({
    n: 1, area: 1, label: 'Leaf', outside: 'kauri-bush', outsideX: 14, outsideY: 6, guide: 'Tower guide Wiremu', sprite: PEOPLE.villager, badge: 'leaf',
    hint: 'Welcome to the Leaf Tower! Leaf monsters ask place value and rounding: what is the 4 worth in 3,406? What is 678 to the nearest 10?\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Hemi', trainerSprite: PEOPLE.knight,
    text: 'So you came to climb my Tower! I am Hemi. Leaf monsters never forget what a digit is worth. Let us see about yours!',
    win: 'Well done! The Leaf badge is yours. The path to Shell Beach is open now. Go and see the sea!',
    team: 'digibud:6,roundroot:7,placepetal:8',
  });
}
