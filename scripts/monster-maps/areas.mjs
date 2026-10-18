import { MapMaker, PEOPLE, TT, towerRooms } from './lib.mjs';

/*
 * Areas 2 to 6. Every area is about 25 x 20: you come in at the bottom (the "entrance"), a path
 * leads up to the Topic Tower, and past it to a gate that stays shut until you hold the badge.
 * The north half (rows 0-9) is the "far half": higher wild levels and harder questions.
 * Each area leans on one type (its three families turn up twice as often in the long grass) and
 * every other type shows too, so every family's first form can be caught by area 2.
 * Wild levels: area 2: 7-12, 3: 13-19, 4: 20-27, 5: 28-36, 6: 37-45 (shared/monsters/bands.ts).
 */

// ───────────────────────── Area 2: Shell Beach (Water: adding and taking away) ─────────────────────────
export function shellBeach() {
  const wild = ['plusplash', 'plusplash', 'minnowus', 'minnowus', 'carrycrab', 'carrycrab', 'factorch', 'squaremander', 'remaindeer', 'sharebear', 'numeratot', 'denomibolt', 'coinrock', 'centipebble'];
  const m = new MapMaker('shell-beach', 'Area 2: Shell Beach', 25, 20, 2, wild, 'beach');
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[21, 19], [3, 0]], (x, y) => m.bush(x, y));
  m.path(20, 12, 2, 7); m.path(9, 12, 13, 2); m.path(9, 6, 2, 8); m.path(3, 6, 8, 2); m.path(3, 2, 2, 5);
  m.longGrass(10, 15, 5, 3); m.longGrass(2, 9, 6, 2); m.longGrass(13, 7, 8, 3); m.longGrass(5, 8, 3, 1); m.longGrass(5, 2, 2, 3);
  m.water(15, 1, 9, 5); m.water(1, 12, 6, 6); m.water(12, 9, 2, 2);
  m.towerBuilding(8, 1);
  m.warp('to-tower', 10, 5, 'tower-2-hall', 5, 7, 'up');
  m.hut(16, 15, 19, 16, 'Nurse Hinemoa', 'Kia ora! Come and rest your monsters on the sand.', 'left');
  m.gate('area-3-gate', 3, 1, 'water', 'A rope fence blocks the steep path north. A sign says: "Fire Mountain. Only for trainers with a Water badge!"');
  m.warp('to-fire-mountain', 3, 0, 'fire-mountain', 3, 18, 'up');
  m.sign('beach-sign', 22, 17, 'Shell Beach. Water monsters splash about here. Their attacks ask adding and taking away.');
  m.sign('tower-sign', 11, 6, 'The Water Tower. Beat the Tower trainer to win the Water badge.');
  m.sign('hut-sign', 18, 15, 'Rest hut. Nurse Hinemoa will heal your team for free.');
  m.sign('gate-sign', 5, 4, 'North-west: the path up to Fire Mountain. You need the Water badge.');
  m.sign('chest-sign-1', 21, 10, 'A chest is buried in the dunes just east of here.');
  m.sign('chest-sign-2', 7, 4, 'A chest is hiding in the corner by the sea, up north.');
  m.person('Hine', PEOPLE.woman, 18, 10, 'down', 'I counted 47 shells on the beach. Then a wave took 18 away. That leaves 29!\nAdding and taking away is what Water monsters are all about.');
  m.person('Old Joe', PEOPLE.elder, 12, 11, 'right', 'What did the ocean say to the beach?\nNothing, it just waved!');
  m.person('Surfer Tui', PEOPLE.man, 6, 10, 'right', 'Tip: Water is strong against Fire, but weak against Leaf. Bring a Leaf monster if you want to beat a Water one!');
  m.trainer('Lifeguard Sam', PEOPLE.guard, 12, 8, 'left', { sight: 2, text: 'Stop right there! Nobody swims past me without a battle!', win: 'You are a strong swimmer! I mean trainer.', team: 'plusplash:9,minnowus:9', loot: 'trainer-small' });
  m.trainer('Swimmer Aroha', PEOPLE.woman, 7, 3, 'left', { sight: 3, text: 'My Water monsters have been training all summer. Want to see?', win: 'Wow, you made a splash!', team: 'carrycrab:10,plusplash:11', loot: 'trainer-small' });
  m.chest('Chest in the dunes', 22, 10, 'balls', 'A chest is half buried in the sand. You dig it out and lift the lid...');
  m.chest('Chest by the sea', 6, 3, 'mixed', 'A chest sits right at the water\'s edge. You lift the lid...');
  m.warp('to-bush', 21, 19, 'kauri-bush', 21, 1, 'down');
  m.spot('entrance', 21, 18, 'up');
  m.spot('trainer-approach', 11, 9, 'up');
  m.spot('grass-edge', 12, 14, 'down');
  m.spot('nurse', 20, 16, 'left');
  m.spot('chest', 22, 11, 'up');
  m.spot('tower-door', 10, 6, 'up');
  m.spot('gate', 3, 2, 'up');
  m.scatter(16, (x, y) => m.palm(x, y), { seed: 2, y0: 2 });
  m.scatter(7, (x, y) => m.boulder(x, y), { seed: 3 });
  m.scatter(6, (x, y) => m.bush(x, y), { seed: 4 });
  m.save();
  towerRooms({
    n: 2, area: 2, label: 'Water', outside: 'shell-beach', outsideX: 10, outsideY: 6, guide: 'Tower guide Ana', sprite: PEOPLE.villager, badge: 'water',
    hint: 'Welcome to the Water Tower! Water monsters ask adding and taking away: 47 + 36, 120 - 58, change from a $10 note.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Moana', trainerSprite: PEOPLE.knight,
    text: 'The tide is in and so am I! I am Moana. Water monsters are all about adding and taking away. Show me what you have got!',
    win: 'You rode that wave perfectly! The Water badge is yours. Fire Mountain is open now. Wear something cool!',
    team: 'plusplash:12,minnowus:13,carrycrab:14',
  });
}

// ───────────────────────── Area 3: Fire Mountain (Fire: times tables) ─────────────────────────
export function fireMountain() {
  const wild = ['factorch', 'factorch', 'multipup', 'multipup', 'squaremander', 'squaremander', 'roundroot', 'placepetal', 'plusplash', 'minnowus', 'remaindeer', 'sharebear', 'numeratot', 'coinrock'];
  const m = new MapMaker('fire-mountain', 'Area 3: Fire Mountain', 25, 20, 3, wild, 'ash');
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[3, 19], [20, 0]], (x, y) => m.boulder(x, y, true));
  m.path(3, 12, 2, 7); m.path(3, 12, 12, 2); m.path(12, 6, 2, 8); m.path(12, 6, 10, 2); m.path(19, 2, 2, 5);
  m.longGrass(6, 15, 6, 3); m.longGrass(17, 15, 3, 3); m.longGrass(2, 3, 7, 4); m.longGrass(2, 8, 4, 3); m.longGrass(22, 3, 2, 4); m.longGrass(15, 9, 3, 2);
  m.lava(17, 9, 6, 3); m.lava(20, 15, 3, 3); m.lava(1, 15, 2, 3); m.lava(6, 1, 3, 2);
  m.towerBuilding(10, 1);
  m.warp('to-tower', 12, 5, 'tower-3-hall', 5, 7, 'up');
  m.hut(6, 8, 9, 11, 'Nurse Mere', 'Phew, it is hot up here! Come and cool your monsters down.', 'left');
  m.gate('area-4-gate', 20, 1, 'fire', 'A rope fence blocks the icy path north. A sign says: "Snowy Peaks. Only for trainers with a Fire badge!"');
  m.warp('to-snowy-peaks', 20, 0, 'snowy-peaks', 20, 18, 'up');
  m.sign('mountain-sign', 5, 17, 'Fire Mountain. Fire monsters live here. Their attacks ask times tables. Keep away from the lava!');
  m.sign('tower-sign', 14, 6, 'The Fire Tower. Beat the Tower trainer to win the Fire badge.');
  m.sign('hut-sign', 10, 11, 'Rest hut. Nurse Mere will heal your team for free.');
  m.sign('gate-sign', 18, 4, 'North-east: the icy path to Snowy Peaks. You need the Fire badge.');
  m.sign('chest-sign-1', 21, 13, 'A chest is sitting by the lava to the east.');
  m.sign('chest-sign-2', 9, 5, 'A chest is tucked in beside the Tower, up north.');
  m.person('Vera', PEOPLE.woman, 8, 14, 'right', 'Times tables are quick if you know your fours: double, then double again!\n7 x 8 is 56. Just remember five, six, seven, eight: 56 = 7 x 8.');
  m.person('Ash', PEOPLE.man, 15, 11, 'down', 'What do you get if you multiply a volcano by a fish?\nI have no idea, but it is very hot!');
  m.person('Old Kui', PEOPLE.elder, 16, 3, 'down', 'Tip: Fire is strong against Ice, but weak against Water. A Water monster is a very good friend on this mountain.');
  m.trainer('Hiker Rob', PEOPLE.ranger, 10, 9, 'right', { sight: 2, text: 'I have climbed this mountain a hundred times, with my monsters. Let us battle!', win: 'Great fight! My knees are weaker than my monsters.', team: 'factorch:15,multipup:16', loot: 'trainer-small' });
  m.trainer('Firefighter Kate', PEOPLE.guard, 17, 3, 'down', { sight: 3, text: 'I put out fires all day. Now I will put out your team!', win: 'Hot stuff! You put out my fire.', team: 'squaremander:17,multipup:17', loot: 'trainer-big' });
  m.chest('Chest by the lava', 21, 12, 'balls', 'A chest sits right next to the lava. It is warm to touch. You lift the lid...');
  m.chest('Chest by the Tower', 9, 4, 'super', 'A chest hides in the shadow of the Tower. You lift the lid...');
  m.warp('to-beach', 3, 19, 'shell-beach', 3, 1, 'down');
  m.spot('entrance', 3, 18, 'up');
  m.spot('trainer-approach', 12, 10, 'up');
  m.spot('grass-edge', 7, 14, 'down');
  m.spot('nurse', 9, 12, 'up');
  m.spot('chest', 20, 12, 'right');
  m.spot('tower-door', 12, 6, 'up');
  m.spot('gate', 20, 2, 'up');
  m.scatter(10, (x, y) => m.autumnTree(x, y), { seed: 5, y0: 2 });
  m.scatter(6, (x, y) => m.autumnSmall(x, y), { seed: 6 });
  m.scatter(10, (x, y) => m.boulder(x, y, true), { seed: 7 });
  m.save();
  towerRooms({
    n: 3, area: 3, label: 'Fire', outside: 'fire-mountain', outsideX: 12, outsideY: 6, guide: 'Tower guide Tipene', sprite: PEOPLE.monk, badge: 'fire',
    hint: 'Welcome to the Fire Tower! Fire monsters ask times tables: 7 x 8, 9 x 6, 12 x 4.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Rangi', trainerSprite: PEOPLE.viking,
    text: 'Feel the heat! I am Rangi, keeper of the Fire Tower. My monsters know every times table. Do yours?',
    win: 'You are on fire! The Fire badge is yours. The icy path to Snowy Peaks is open now. Take a coat!',
    team: 'factorch:19,multipup:20,squaremander:21',
  });
}

// ───────────────────────── Area 4: Snowy Peaks (Ice: division) ─────────────────────────
export function snowyPeaks() {
  const wild = ['divvy', 'divvy', 'remaindeer', 'remaindeer', 'sharebear', 'sharebear', 'digibud', 'roundroot', 'carrycrab', 'minnowus', 'squaremander', 'fractopus', 'pebblepoint', 'centipebble'];
  const m = new MapMaker('snowy-peaks', 'Area 4: Snowy Peaks', 25, 20, 4, wild, 'snow');
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[20, 19], [4, 0]], (x, y) => m.snowPine(x, y));
  m.path(20, 12, 2, 7); m.path(10, 12, 12, 2); m.path(13, 6, 2, 8); m.path(4, 6, 11, 2); m.path(4, 2, 2, 5);
  m.ice(16, 2, 7, 4); m.ice(2, 10, 5, 3);
  m.longGrass(11, 15, 5, 3); m.longGrass(2, 14, 6, 3); m.longGrass(16, 8, 6, 3); m.longGrass(6, 8, 5, 3); m.longGrass(7, 2, 3, 3);
  m.towerBuilding(11, 1);
  m.warp('to-tower', 13, 5, 'tower-4-hall', 5, 7, 'up');
  m.hut(16, 15, 19, 16, 'Nurse Aroha', 'Brrr! Come in from the cold. I will warm your monsters up.', 'left');
  m.gate('area-5-gate', 4, 1, 'ice', 'A rope fence blocks the dark cave mouth north. A sign says: "Glowworm Caves. Only for trainers with an Ice badge!"');
  m.warp('to-glowworm-caves', 4, 0, 'glowworm-caves', 4, 18, 'up');
  m.sign('peaks-sign', 22, 17, 'Snowy Peaks. Ice monsters live here. Their attacks ask division: sharing things out equally.');
  m.sign('tower-sign', 15, 6, 'The Ice Tower. Beat the Tower trainer to win the Ice badge.');
  m.sign('hut-sign', 18, 15, 'Rest hut. Nurse Aroha will heal your team for free.');
  m.sign('gate-sign', 6, 4, 'North-west: the way to the Glowworm Caves. You need the Ice badge.');
  m.sign('chest-sign-1', 21, 10, 'A chest is half buried in a snow drift just east of here.');
  m.sign('chest-sign-2', 7, 6, 'A chest is frozen into the snow by the path, to the north-west.');
  m.person('Skier Jo', PEOPLE.man, 17, 11, 'down', 'If 24 snowballs are shared by 6 friends, each friend gets 4. Division is just fair sharing!');
  m.person('Nana Pip', PEOPLE.elder, 12, 10, 'right', 'What do you call a snowman in July?\nA puddle!');
  m.person('Ranger Fern', PEOPLE.woman, 8, 5, 'right', 'Tip: Ice is strong against Spark, but weak against Fire. Fire monsters melt Ice monsters!');
  m.trainer('Skier Ben', PEOPLE.hooded, 16, 9, 'left', { sight: 3, text: 'I just flew down that slope. Now let me fly past your team!', win: 'Smooth moves! You carved me up.', team: 'divvy:24,sharebear:25', loot: 'trainer-small' });
  m.trainer('Snowboarder Mia', PEOPLE.woman, 9, 3, 'down', { sight: 3, text: 'Hey! Wanna race? Okay, battle instead!', win: 'Gnarly! You have got it.', team: 'remaindeer:25,divvy:26', loot: 'trainer-big' });
  m.chest('Chest in the snow drift', 22, 9, 'balls', 'A chest is poking out of the snow. You brush it off and lift the lid...');
  m.chest('Chest by the path', 2, 4, 'repel', 'A frosty chest sits by the path. You lift the lid...');
  m.warp('to-fire-mountain', 20, 19, 'fire-mountain', 20, 1, 'down');
  m.spot('entrance', 20, 18, 'up');
  m.spot('trainer-approach', 14, 9, 'right');
  m.spot('grass-edge', 13, 14, 'down');
  m.spot('nurse', 20, 16, 'left');
  m.spot('chest', 22, 10, 'up');
  m.spot('tower-door', 13, 6, 'up');
  m.spot('gate', 4, 2, 'up');
  m.scatter(18, (x, y) => m.snowTree(x, y), { seed: 8, y0: 2 });
  m.scatter(8, (x, y) => m.snowPine(x, y), { seed: 9 });
  m.scatter(6, (x, y) => m.snowBush(x, y), { seed: 10 });
  m.scatter(5, (x, y) => m.boulder(x, y), { seed: 11 });
  m.save();
  towerRooms({
    n: 4, area: 4, label: 'Ice', outside: 'snowy-peaks', outsideX: 13, outsideY: 6, guide: 'Tower guide Pita', sprite: PEOPLE.villager, badge: 'ice',
    hint: 'Welcome to the Ice Tower! Ice monsters ask division: 56 divided by 7, 35 divided by 5, and remainders.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Maia', trainerSprite: PEOPLE.guard,
    text: 'Cool as ice, that is me. I am Maia. Ice monsters share everything out fairly. Can you share out my attacks?',
    win: 'Cool! The Ice badge is yours. The Glowworm Caves are open now. Take a torch!',
    team: 'divvy:27,remaindeer:28,sharebear:29',
  });
}

// ───────────────────────── Area 5: Glowworm Caves (Spark: fractions) ─────────────────────────
export function glowwormCaves() {
  const wild = ['fractopus', 'fractopus', 'numeratot', 'numeratot', 'denomibolt', 'denomibolt', 'placepetal', 'plusplash', 'multipup', 'sharebear', 'coinrock', 'pebblepoint'];
  const m = new MapMaker('glowworm-caves', 'Area 5: Glowworm Caves', 25, 20, 5, wild, 'cave');
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[4, 19], [19, 0]], (x, y) => m.rock(x, y));
  m.path(4, 12, 2, 7); m.path(4, 12, 10, 2); m.path(11, 6, 2, 8); m.path(11, 6, 10, 2); m.path(19, 2, 2, 5);
  m.longGrass(8, 15, 5, 3); m.longGrass(2, 8, 6, 3); m.longGrass(2, 2, 6, 5); m.longGrass(15, 9, 4, 3); m.longGrass(22, 13, 2, 4);
  m.water(17, 16, 4, 2); m.water(2, 15, 3, 2);
  m.towerBuilding(9, 1);
  m.warp('to-tower', 11, 5, 'tower-5-hall', 5, 7, 'up');
  m.hut(14, 14, 13, 14, 'Nurse Kowhai', 'Welcome to the caves! It is cosy in here. Let me look after your monsters.', 'right');
  m.gate('area-6-gate', 19, 1, 'spark', 'A rope fence blocks the tunnel north. A sign says: "Harbour City. Only for trainers with a Spark badge!"');
  m.warp('to-harbour-city', 19, 0, 'harbour-city', 19, 18, 'up');
  m.sign('cave-sign', 6, 17, 'Glowworm Caves. Spark monsters glow here. Their attacks ask fractions: halves, quarters and more.');
  m.sign('tower-sign', 13, 6, 'The Spark Tower. Beat the Tower trainer to win the Spark badge.');
  m.sign('hut-sign', 13, 15, 'Rest hut. Nurse Kowhai will heal your team for free.');
  m.sign('gate-sign', 17, 4, 'North-east: the tunnel to Harbour City. You need the Spark badge.');
  m.sign('chest-sign-1', 21, 12, 'A chest is glowing in the corner to the east.');
  m.sign('chest-sign-2', 9, 6, 'A chest is wedged behind the stalagmites by the Tower.');
  m.person('Glow Gran', PEOPLE.elder, 7, 12, 'down', 'Look up! Thousands of glowworms! If half of them are asleep, and a quarter are chatting, how many are awake? A quarter!');
  m.person('Spelunker Bo', PEOPLE.man, 14, 11, 'left', 'Why did the fraction not go in the cave?\nIt was afraid of getting stuck on a denominator!');
  m.person('Wee Hana', PEOPLE.villager, 17, 5, 'down', 'Tip: Spark is strong against Stone, but weak against Ice. Bring an Ice monster to the caves!');
  m.trainer('Caver Pete', PEOPLE.hooded, 8, 10, 'down', { sight: 3, text: 'It is dark in here, but I can still see you coming. Battle?', win: 'You shine brighter than my torch!', team: 'fractopus:30,numeratot:31', loot: 'trainer-small' });
  m.trainer('Miner Rua', PEOPLE.monk, 15, 4, 'down', { sight: 3, text: 'I dig for crystals, but monsters are even better. Let us fight!', win: 'You struck gold! Well, not gold. But a very good battle.', team: 'denomibolt:33,fractopus:33', loot: 'trainer-big' });
  m.chest('Chest in the corner', 22, 12, 'balls', 'A chest glows in the dark. You lift the lid...');
  m.chest('Chest behind the stalagmites', 8, 5, 'great', 'A chest hides behind the stalagmites. You lift the lid...');
  m.warp('to-snowy-peaks', 4, 19, 'snowy-peaks', 4, 1, 'down');
  m.spot('entrance', 4, 18, 'up');
  m.spot('trainer-approach', 8, 12, 'down');
  m.spot('grass-edge', 9, 14, 'down');
  m.spot('nurse', 13, 13, 'down');
  m.spot('chest', 22, 11, 'down');
  m.spot('tower-door', 11, 6, 'up');
  m.spot('gate', 19, 2, 'up');
  m.scatter(16, (x, y) => m.stalagmite(x, y), { seed: 12, y0: 2 });
  m.scatter(8, (x, y) => m.crystal(x, y), { seed: 13 });
  m.scatter(6, (x, y) => m.boulder(x, y, true), { seed: 14 });
  m.save();
  towerRooms({
    n: 5, area: 5, label: 'Spark', outside: 'glowworm-caves', outsideX: 11, outsideY: 6, guide: 'Tower guide Ngaio', sprite: PEOPLE.woman, badge: 'spark',
    hint: 'Welcome to the Spark Tower! Spark monsters ask fractions: half of 18, which is bigger, 2/3 or 3/4, and adding fractions.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Wiremu', trainerSprite: PEOPLE.hooded,
    text: 'Zap! You found me. I am Wiremu, keeper of the Spark Tower. Every spark is just a small part of a whole. Let us see yours!',
    win: 'Electrifying! The Spark badge is yours. The tunnel to Harbour City is open now. Nearly there!',
    team: 'fractopus:36,numeratot:37,denomibolt:38',
  });
}

// ───────────────────────── Area 6: Harbour City (Stone: decimals and money) ─────────────────────────
export function harbourCity() {
  const wild = ['pebblepoint', 'pebblepoint', 'coinrock', 'coinrock', 'centipebble', 'centipebble', 'digibud', 'minnowus', 'factorch', 'remaindeer', 'denomibolt', 'placepetal'];
  const m = new MapMaker('harbour-city', 'Area 6: Harbour City', 25, 20, 6, wild, 'city');
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  m.border([[19, 19]]);
  m.path(19, 12, 2, 7); m.path(6, 12, 15, 2); m.path(8, 6, 2, 8); m.path(8, 6, 8, 2);
  m.longGrass(2, 14, 5, 3); m.longGrass(9, 15, 4, 3); m.longGrass(11, 8, 5, 3); m.longGrass(2, 8, 4, 3);
  m.water(17, 1, 7, 6); m.water(18, 8, 5, 2);
  m.house(2, 1, { roof: 'blue', wall: 'grey' }); m.house(21, 14, { roof: 'red', wall: 'grey' });
  m.house(2, 8 + 6, { roof: 'red', wall: 'brown' });
  m.towerBuilding(6, 1);
  m.warp('to-tower', 8, 5, 'tower-6-hall', 5, 7, 'up');
  m.hut(14, 14, 17, 14, 'Nurse Sina', 'Welcome to the big city! Let me rest your monsters.', 'left');
  m.sign('city-sign', 17, 17, 'Harbour City. Stone monsters live here. Their attacks ask decimals and money: $2.40 + $1.75 and 0.3 + 0.5.');
  m.sign('tower-sign', 10, 6, 'The Stone Tower. Beat the Tower trainer to win the Stone badge, the last one!');
  m.sign('hut-sign', 13, 14, 'Rest hut. Nurse Sina will heal your team for free.');
  m.sign('harbour-sign', 16, 4, 'The harbour. Ships come here from all over the world.');
  m.sign('chest-sign-1', 23, 12, 'A chest is stashed behind the shops to the east.');
  m.sign('chest-sign-2', 4, 11, 'A chest is waiting in the corner park, to the west.');
  m.person('Shopkeeper Lu', PEOPLE.villager, 13, 11, 'down', 'A book costs $3.50 and a pen costs $1.25. That is $4.75 altogether. Money is just decimals!');
  m.person('Captain Tui', PEOPLE.elder, 15, 9, 'down', 'What kind of money do pirates love?\nBuck-aneers!');
  m.person('Mayor Kiri', PEOPLE.woman, 11, 5, 'left', 'Welcome to Harbour City! This is the end of the road, for now. Win the Stone badge and you will hold all six!\nTip: Stone is strong against Leaf, but weak against Spark.');
  m.trainer('Dock worker Sione', PEOPLE.man, 12, 9, 'down', { sight: 3, text: 'I carry heavy crates all day. My monsters are even stronger!', win: 'Strong! I should hire you for the docks.', team: 'pebblepoint:40,coinrock:40', loot: 'trainer-small' });
  m.trainer('Sailor Hana', PEOPLE.ranger, 13, 3, 'down', { sight: 3, text: 'Ahoy! Prepare for a battle on the high seas, well, on the quay!', win: 'Shiver me timbers! You win.', team: 'centipebble:42,pebblepoint:43', loot: 'trainer-big' });
  m.chest('Chest behind the shops', 23, 11, 'balls', 'A chest is stashed behind the shops. You lift the lid...');
  m.chest('Chest in the corner park', 3, 12, 'mixed', 'A chest sits under a tree in the park. You lift the lid...');
  m.warp('to-glowworm-caves', 19, 19, 'glowworm-caves', 19, 1, 'down');
  m.spot('entrance', 19, 18, 'up');
  m.spot('trainer-approach', 12, 11, 'down');
  m.spot('grass-edge', 10, 14, 'down');
  m.spot('nurse', 17, 13, 'down');
  m.spot('chest', 22, 11, 'right');
  m.spot('tower-door', 8, 6, 'up');
  m.scatter(12, (x, y) => m.bigTree(x, y), { seed: 15, y0: 2 });
  m.scatter(10, (x, y) => m.tree(x, y), { seed: 16 });
  m.scatter(6, (x, y) => m.bush(x, y), { seed: 17 });
  m.fence(2, 10, 4); m.fence(21, 10, 3);
  m.save();
  towerRooms({
    n: 6, area: 6, label: 'Stone', outside: 'harbour-city', outsideX: 8, outsideY: 6, guide: 'Tower guide Sefa', sprite: PEOPLE.man, badge: 'stone',
    hint: 'Welcome to the Stone Tower, the last one! Stone monsters ask decimals and money: 0.3 + 0.5, $10 - $3.65, rounding.\nThe Tower trainer waits at the top. Heal up first, then climb the ladder!',
    trainerName: 'Tower trainer Aroha', trainerSprite: PEOPLE.knight,
    text: 'You made it all the way to the Stone Tower! I am Aroha. Stone monsters are tough and exact. Every cent counts!',
    win: 'Magnificent! The Stone badge is yours, and that makes all six. You are a Maths Monsters champion!',
    team: 'pebblepoint:45,coinrock:46,centipebble:47',
  });
}
