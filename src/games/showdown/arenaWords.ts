/**
 * Every arena's own words for the same moments (docs/SHOWDOWN-PLAN.md section 4): the boss's health, the shield check,
 * the double event, the roles... Boss Bounty's are the defaults; each other arena says the same things its own way.
 * The big screen, the iPad and the announcer all read them from here, so a new arena is one entry.
 */
import type { Arena, Role } from '../../../shared/showdown/types';
import { ANNOUNCER, GOLD_RUSH_LINES, HILL_LINES, ISLAND_LINES, SKY_CLIMB_LINES } from './voiceLines';

export interface ArenaWords {
  /** The arena's name in the teacher's picker. */
  name: string;
  /** The goal bar's label (null = the boss's own name). */
  goal: string | null;
  /** True when the bar fills up as the class gets closer (a climb), rather than emptying (a boss's health). */
  fills: boolean;
  roles: Record<Role, { name: string; line: string; emoji: string }>;
  /** The question's title on the iPad, by role. */
  titles: Record<Role, string>;
  lobbyCry: string;
  lobbyHint: string | null;
  /** The shield check: the big screen's label, a team's label, held and broke. */
  shieldUp: string;
  shieldTeam: string;
  held: string;
  broke: string;
  needGuards: string;
  windBanner: string;
  heldBanner: (team: string | null) => string;
  brokeBanner: (team: string | null) => string;
  weakBanner: string;
  phaseBanner: (phase: 2 | 3) => string;
  enrageBanner: string;
  enrageButton: string;
  beatenBanner: string;
  /** The iPad's notices. */
  notices: { wind: string; heldNote: string; enrage: string; weak: string; phase: (phase: 2 | 3) => string; calm: string };
  /** What the teams' banners count. */
  teamUnit: string | null;
  mostDamage: string;
  awards: Record<string, string>;
  recapTitle: (won: boolean) => string;
  recapHead: (won: boolean, pct: number, boss: string) => string;
  overLine: ((won: boolean) => string) | null;
  lines: { joinNow: string; start: string | null; windUp: string; held: string; broke: string; weak: string; phase: string; done: string };
}

const BOSS_ROLES: ArenaWords['roles'] = {
  striker: { name: 'Striker', line: 'Hit the boss', emoji: '⚔️' },
  guard: { name: 'Guard', line: 'Hold the shield', emoji: '🛡️' },
  healer: { name: 'Healer', line: 'Wake up dazed friends', emoji: '💖' },
};

const BOSS: ArenaWords = {
  name: 'Boss Bounty', goal: null, fills: false,
  roles: BOSS_ROLES,
  titles: { striker: 'Hit the boss!', guard: 'Hold the shield!', healer: 'Wake a friend!' },
  lobbyCry: '', lobbyHint: null,
  shieldUp: 'SHIELD UP!', shieldTeam: 'SHIELD', held: 'CLANG!', broke: 'CRACK!', needGuards: 'Need more Guards!',
  windBanner: 'BOSS IS WINDING UP!',
  heldBanner: (tm) => `${tm ? `${tm} shield` : 'Shield'} held!`,
  brokeBanner: (tm) => (tm ? `${tm} shield broke!` : 'The shield broke!'),
  weakBanner: 'WEAK SPOT! Hit it now!',
  phaseBanner: (p) => (p === 2 ? 'THE BOSS IS CHANGING!' : 'THE BOSS IS FURIOUS!'),
  enrageBanner: 'The boss is ENRAGED!', enrageButton: 'Enrage', beatenBanner: 'THE BOSS IS BEATEN!',
  notices: {
    wind: '🛡️ The boss is winding up! Shield up!', heldNote: '🛡️ Shield held!', enrage: '😡 The boss is enraged!', weak: '🎯 Weak spot! Double damage!',
    phase: (p) => (p === 3 ? '🔥 Last phase! Finish it!' : '💢 The boss is getting angry!'), calm: '⚔️ Keep hitting the boss!',
  },
  teamUnit: null, mostDamage: 'Most damage', awards: {},
  recapTitle: (won) => (won ? 'VICTORY!' : 'So close!'),
  recapHead: (won, _pct, boss) => (won ? `You beat the ${boss}!` : 'So close! Next time!'),
  overLine: null,
  lines: { joinNow: ANNOUNCER.joinNow, start: null, windUp: ANNOUNCER.windUp, held: ANNOUNCER.held, broke: ANNOUNCER.broke, weak: ANNOUNCER.weakSpot, phase: ANNOUNCER.phase, done: ANNOUNCER.beaten },
};

const GOLD_RUSH: ArenaWords = {
  ...BOSS,
  name: 'Gold Rush', goal: 'Gold left in the mountain',
  roles: {
    striker: { name: 'Digger', line: 'Dig the gold', emoji: '⛏️' },
    guard: { name: 'Prop-holder', line: 'Hold up the roof', emoji: '🛡️' },
    healer: { name: 'Medic', line: 'Wake dazed friends', emoji: '💖' },
  },
  titles: { striker: 'Dig for gold!', guard: 'Prop up the roof!', healer: 'Wake a friend!' },
  lobbyCry: 'Dig, dig, dig!', lobbyHint: 'Open Class Showdown on your iPad, then pick a seam to dig!',
  shieldUp: 'PROP UP THE ROOF!', shieldTeam: 'ROOF', held: 'HOLDS!', broke: 'CAVE-IN!', needGuards: 'Need more roof-holders!',
  windBanner: 'CAVE-IN! Prop up the roof!',
  heldBanner: (tm) => `${tm ? `${tm} roof` : 'The roof'} holds!`,
  brokeBanner: (tm) => (tm ? `${tm} cave-in!` : 'The roof caved in!'),
  weakBanner: 'MOTHER LODE! Double gold!',
  phaseBanner: (p) => (p === 2 ? 'THE MOUNTAIN RUMBLES!' : 'THE MOUNTAIN SHAKES!'),
  enrageBanner: 'The mountain ROARS!', enrageButton: 'Rumble', beatenBanner: 'YOU DUG IT ALL OUT!',
  notices: {
    wind: '⚠️ Cave-in! Prop up the roof!', heldNote: '🛡️ The roof holds!', enrage: '🌋 The mountain rumbles!', weak: '💰 Mother lode! Double gold!',
    phase: () => '⛏ Keep digging!', calm: '⛏ Keep digging!',
  },
  teamUnit: 'gold dug', mostDamage: 'Most gold',
  awards: { most_damage: 'Biggest digger', last_hit: 'Last dig', shield_wall: 'Roof holder' },
  recapTitle: (won) => (won ? 'YOU DUG IT ALL!' : 'So close!'),
  recapHead: (won, pct) => (won ? 'You dug out the mountain!' : `So close! You dug out ${pct}% of it!`),
  overLine: (won) => (won ? '⛏ The class dug out the whole mountain!' : '⛏ So close! Some gold is left.'),
  lines: { joinNow: GOLD_RUSH_LINES.joinNow, start: GOLD_RUSH_LINES.start, windUp: GOLD_RUSH_LINES.caveIn, held: GOLD_RUSH_LINES.held, broke: GOLD_RUSH_LINES.broke, weak: GOLD_RUSH_LINES.lode, phase: GOLD_RUSH_LINES.phase, done: GOLD_RUSH_LINES.done },
};

const SKY_CLIMB: ArenaWords = {
  ...BOSS,
  name: 'Sky Climb', goal: 'Climb to the summit', fills: true,
  roles: {
    striker: { name: 'Climber', line: 'Climb higher', emoji: '🧗' },
    guard: { name: 'Anchor', line: 'Hold the rope in a storm', emoji: '🪢' },
    healer: { name: 'Medic', line: 'Wake dazed friends', emoji: '💖' },
  },
  titles: { striker: 'Climb!', guard: 'Hold the rope!', healer: 'Wake a friend!' },
  lobbyCry: 'Climb to the summit!', lobbyHint: 'Open Class Showdown on your iPad. Every right answer is a step up!',
  shieldUp: 'HOLD ON TIGHT!', shieldTeam: 'ROPE', held: 'HELD ON!', broke: 'WHOOSH!', needGuards: 'Need more Anchors!',
  windBanner: 'STORM! Keep answering to hold on!',
  heldBanner: (tm) => `${tm ? `${tm} held on` : 'Everyone held on'}! The storm has passed!`,
  brokeBanner: (tm) => (tm ? `The wind got ${tm}!` : 'The wind blew us back!'),
  weakBanner: 'UPDRAFT! Double height!',
  phaseBanner: (p) => (p === 2 ? 'ABOVE THE CLOUDS!' : 'THE SUMMIT IS CLOSE!'),
  enrageBanner: 'The wind is HOWLING!', enrageButton: 'Gale', beatenBanner: 'YOU REACHED THE SUMMIT!',
  notices: {
    wind: '⛈️ Storm! Answer to hold on!', heldNote: '🪢 You held on!', enrage: '🌪️ The wind is howling!', weak: '🌬️ Updraft! Double height!',
    phase: (p) => (p === 3 ? '🏔️ The summit is close!' : '☁️ Above the clouds!'), calm: '🧗 Keep climbing! 3 in a row is a jump!',
  },
  teamUnit: 'metres', mostDamage: 'Highest climber',
  awards: { most_damage: 'Highest climber', last_hit: 'First to the top', shield_wall: 'Rock-solid anchor' },
  recapTitle: (won) => (won ? 'SUMMIT!' : 'So close!'),
  recapHead: (won, pct) => (won ? 'You reached the summit!' : `So close! You climbed ${pct}% of the way!`),
  overLine: (won) => (won ? '🏔️ The class reached the summit!' : '🧗 So close! Nearly at the top.'),
  lines: { joinNow: SKY_CLIMB_LINES.joinNow, start: SKY_CLIMB_LINES.start, windUp: SKY_CLIMB_LINES.storm, held: SKY_CLIMB_LINES.held, broke: SKY_CLIMB_LINES.blown, weak: SKY_CLIMB_LINES.updraft, phase: SKY_CLIMB_LINES.phase, done: SKY_CLIMB_LINES.done },
};

const ISLAND: ArenaWords = {
  ...BOSS,
  name: 'Shrinking Island', goal: 'Build the rescue raft', fills: true,
  roles: {
    striker: { name: 'Builder', line: 'Build the raft', emoji: '🔨' },
    guard: { name: 'Wave-breaker', line: 'Hold back the big waves', emoji: '🌊' },
    healer: { name: 'Medic', line: 'Wake dazed friends', emoji: '💖' },
  },
  titles: { striker: 'Build the raft!', guard: 'Hold back the wave!', healer: 'Wake a friend!' },
  lobbyCry: 'Build the raft!', lobbyHint: 'Open Class Showdown on your iPad. Right answers move you inland, away from the water!',
  shieldUp: 'HOLD BACK THE WAVE!', shieldTeam: 'SEA WALL', held: 'HELD!', broke: 'SPLOOSH!', needGuards: 'Need more Wave-breakers!',
  windBanner: 'BIG WAVE COMING! Answer to hold it back!',
  heldBanner: (tm) => `${tm ? `${tm} held` : 'We held'} back the wave!`,
  brokeBanner: (tm) => (tm ? `The wave hit ${tm}!` : 'The wave crashed over the beach!'),
  weakBanner: 'A CRATE WASHED ASHORE! Double planks!',
  phaseBanner: (p) => (p === 2 ? 'THE TIDE IS RISING!' : 'THE ISLAND IS SINKING!'),
  enrageBanner: 'The sea is ANGRY!', enrageButton: 'Storm', beatenBanner: 'THE RAFT IS READY! Sail away!',
  notices: {
    wind: '🌊 Big wave! Answer to hold it back!', heldNote: '🛡️ We held back the wave!', enrage: '🌪️ The sea is angry!', weak: '📦 Crate ashore! Double planks!',
    phase: (p) => (p === 3 ? '🏝️ The island is sinking! Finish the raft!' : '🌊 The tide is rising!'), calm: '🔨 Keep building! Right answers move you inland.',
  },
  teamUnit: 'planks', mostDamage: 'Most planks',
  awards: { most_damage: 'Master builder', last_hit: 'Last plank', shield_wall: 'Wave-breaker' },
  recapTitle: (won) => (won ? 'SAIL AWAY!' : 'So close!'),
  recapHead: (won, pct) => (won ? 'The raft is built! Everyone sails away!' : `So close! The raft is ${pct}% built!`),
  overLine: (won) => (won ? '⛵ The class built the raft and sailed away!' : '🏝️ So close! The raft was nearly built.'),
  lines: { joinNow: ISLAND_LINES.joinNow, start: ISLAND_LINES.start, windUp: ISLAND_LINES.wave, held: ISLAND_LINES.held, broke: ISLAND_LINES.broke, weak: ISLAND_LINES.crate, phase: ISLAND_LINES.phase, done: ISLAND_LINES.done },
};

const HILL: ArenaWords = {
  ...BOSS,
  name: 'King of the Hill', goal: 'Build the hilltop castle', fills: true,
  roles: {
    striker: { name: 'Mason', line: 'Build the castle', emoji: '🧱' },
    guard: { name: 'Defender', line: 'Hold off challengers', emoji: '🛡️' },
    healer: { name: 'Medic', line: 'Wake dazed friends', emoji: '💖' },
  },
  titles: { striker: 'Build the castle!', guard: 'Hold off the charge!', healer: 'Wake a friend!' },
  lobbyCry: 'Who will wear the crown?', lobbyHint: 'Open Class Showdown on your iPad. Score fast to take the crown!',
  shieldUp: 'HOLD OFF THE CHARGE!', shieldTeam: 'WALL', held: 'HELD!', broke: 'CRASH!', needGuards: 'Need more Defenders!',
  windBanner: 'A CHALLENGER CHARGES THE HILL!',
  heldBanner: (tm) => `${tm ? `${tm} held` : 'We held'} the hill!`,
  brokeBanner: (tm) => `The challenger broke through${tm ? ` ${tm}` : ''}! The crown is up for grabs!`,
  weakBanner: 'DOUBLE CROWN! Double stones, double crown points!',
  phaseBanner: (p) => (p === 2 ? 'THE WALLS ARE RISING!' : 'THE TOWERS GO UP!'),
  enrageBanner: 'Challengers STORM the hill!', enrageButton: 'Charge', beatenBanner: 'THE CASTLE IS BUILT!',
  notices: {
    wind: '⚔️ A challenger charges! Answer to hold the hill!', heldNote: '🛡️ We held the hill!', enrage: '🐎 Challengers storm the hill!', weak: '👑 Double crown! Double everything!',
    phase: (p) => (p === 3 ? '🏰 The towers go up! Finish the castle!' : '🧱 The walls are rising!'), calm: '👑 Score fast to take the crown!',
  },
  teamUnit: null, mostDamage: 'Most stones',
  awards: { most_damage: 'Master mason', last_hit: 'Last stone', shield_wall: 'Hill defender' },
  recapTitle: (won) => (won ? 'CASTLE BUILT!' : 'So close!'),
  recapHead: (won, pct) => (won ? 'The castle is built! Long live the king!' : `So close! The castle is ${pct}% built!`),
  overLine: (won) => (won ? '🏰 The class built the castle on the hill!' : '🧱 So close! The castle was nearly built.'),
  lines: { joinNow: HILL_LINES.joinNow, start: HILL_LINES.start, windUp: HILL_LINES.charge, held: HILL_LINES.held, broke: HILL_LINES.broke, weak: HILL_LINES.double, phase: HILL_LINES.phase, done: HILL_LINES.done },
};

const WORDS: Record<Arena, ArenaWords> = { boss: BOSS, goldrush: GOLD_RUSH, skyclimb: SKY_CLIMB, island: ISLAND, hill: HILL };

export const arenaWords = (arena: Arena | null | undefined): ArenaWords => WORDS[arena ?? 'boss'] ?? BOSS;
/** The arenas in the teacher's picker, in order. */
export const ARENA_CHOICES = (Object.keys(WORDS) as Arena[]).map((id) => ({ id, name: WORDS[id].name }));
