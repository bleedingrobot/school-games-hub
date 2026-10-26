/**
 * Every word a student sees in Gem Keep, in one place (NZ English). Te reo Māori could be
 * added later by swapping this file.
 */
import type { Colour } from '../../../shared/gem-keep/gems';
import type { Refusal, Targeting } from '../../../shared/gem-keep/engine';
import type { EnemyKind } from '../../../shared/gem-keep/config';

export const TEXT = {
  name: 'Gem Keep',
  tagline: 'Forge gems, defend the Keep!',
  loading: 'Building the Keep…',
  keep: 'Keep',
  mana: 'Mana',
  wave: (n: number, of: number) => `Wave ${n} of ${of}`,
  nextWave: (n: number) => `Start wave ${n}`,
  bossWave: (n: number) => `Start wave ${n} (boss!)`,
  waveRunning: 'Wave coming…',
  pause: 'Pause',
  resume: 'Keep going',
  speed: (n: number) => `${n}× speed`,
  brighter: 'Brighter map',
  paused: 'Paused',
  pausedHint: 'You can still build and forge gems while the game is paused.',
  forge: 'Forge a gem',
  bag: 'Your gems',
  bagEmpty: 'Empty',
  emptySlot: (n: number) => `Gem slot ${n}, empty`,
  gemName: (grade: number, colours: Colour[]) =>
    `Grade ${grade} ${colours.map((c) => COLOUR_NAMES[c].toLowerCase()).join(' and ')} gem`,
  cost: (mana: number) => `${mana} mana`,
  build: (cost: number) => `Build a tower (${cost} mana)`,
  buildHint: 'Towers go on grass. Then put a gem in it.',
  cantBuild: "You can't build here. Pick a grass tile.",
  tower: (level: number) => `Tower, level ${level}`,
  towerEmpty: 'No gem yet. Tap a gem in your bag, or forge one.',
  upgrade: (cost: number) => `Upgrade tower (${cost} mana)`,
  upgradeShort: 'Upgrade',
  maxLevel: 'Top level!',
  takeOut: 'Take the gem out',
  takeOutShort: 'Take out',
  combine: 'Combine',
  combineCost: (cost: number) => `Combine costs ${cost} mana`,
  combineHint: 'Tap another gem of the same grade (in your bag or a tower) to combine them.',
  cancel: 'Cancel',
  placeHint: 'Tap a tower to put this gem in it.',
  targeting: 'Aim at',
  targetingNames: { first: 'First in line', strongest: 'Strongest' } satisfies Record<Targeting, string>,
  stats: (damage: number, rate: number, range: number) =>
    `Damage ${Math.round(damage)} · ${rate.toFixed(1)} shots/s · range ${range.toFixed(1)}`,
  wonTitle: 'You held the Keep!',
  wonBody: (keep: number) => `The Keep finished with ${keep}% health.`,
  stars: (n: number) => `${n} out of 3 stars`,
  lostTitle: 'The Keep fell',
  lostBody: 'Every level can be won. Try a new plan: more towers, or bigger gems!',
  playAgain: 'Play again',
  tryAgain: 'Try again',
  rotate: 'Turn your device sideways to play Gem Keep.',
  boardLabel:
    'The map. Use the arrow keys to move around it and Enter to pick a tile. Enemies walk the path to the Keep.',
  tileLabel: (x: number, y: number, what: string) => `Column ${x + 1}, row ${y + 1}: ${what}`,
  // The campaign map.
  mapTitle: 'Gem Keep',
  mapIntro: 'Defend the Keep with gems, powered by your times tables. Pass a Level Key to open the next level.',
  totalStars: (n: number, of: number) => `${n} of ${of} stars`,
  levelLabel: (n: number, name: string) => `Level ${n}: ${name}`,
  levelStars: (n: number) => (n === 1 ? '1 star' : `${n} stars`),
  locked: (n: number) => `Pass level ${n}'s Level Key to open this`,
  stopLabel: (n: number, name: string, stars: number, locked: boolean) =>
    `Level ${n}, ${name}, ${stars === 1 ? '1 star' : `${stars} stars`}${locked ? ', locked' : ''}`,
  playLevel: (n: number) => `Play level ${n}`,
  tables: (tables: number[]) => tables.map((t) => `×${t}`).join(' '),
  tablesLabel: (tables: number[]) => `Times tables: ${tables.join(', ')}`,
  savedHere: 'Your progress is saved on this device.',
  focusAllLevels: 'The maths in every level follows this. Levels unlock the same way as always.',
  savedAccount: 'Your progress is saved to your account, so it follows you to any device.',
  savingLater: 'No connection right now: you can still play, and your progress saves when you’re back online.',
  backToMap: 'Map',
  backToMapLong: 'Back to the map',
  nextLevel: 'Next level',
  levelHeading: (n: number, name: string) => `Level ${n} · ${name}`,
  // The maths.
  well: 'Mana Well',
  wellLabel: (left: number) => `Mana Well: ${left} questions left`,
  wellResting: 'Resting',
  wellNote: (right: number) => `Right answers give mana. ${right} right so far.`,
  wellDone: 'Back to the game',
  wellReward: (mana: number, streak: number) => `+${mana} mana${streak >= 3 ? ` · ${streak} in a row!` : ''}`,
  forgeTitle: (colour: Colour) => `Gem Forge: ${COLOUR_NAMES[colour].toLowerCase()} gem`,
  combineTitle: 'Gem Forge: combine',
  forgeNote: 'Answer to forge it.',
  forgeMissed: 'Not this time, and nothing was spent. Try again for a new question!',
  gateTitle: 'Wave Gate',
  gateNote: (asked: number, right: number) => `A boss is coming! Question ${asked + 1} of 3 · ${right} right`,
  surge: (share: number) => (share >= 0.25 ? 'Power Surge! Towers hit 25% harder this wave.' : share > 0 ? 'Towers hit 10% harder this wave.' : 'Here comes the boss!'),
  shieldTitle: 'Keep Shield',
  shieldNote: (asked: number, right: number) => `The Keep needs help! Each right answer heals it. Question ${asked + 1} of 5 · ${right} right`,
  shielded: (healed: number) => (healed > 0 ? `The Keep Shield healed ${healed} health!` : 'The Keep Shield fizzled. Keep going!'),
  keyTitle: 'Level Key',
  keyNote: (asked: number, right: number) => `Question ${asked + 1} of 10 · ${right} right`,
  keyIntro: (pass: number) => `Unlock the next level with the Level Key: get ${pass} out of 10 right.`,
  keyStart: 'Try the Level Key',
  keyAgain: 'Try the Level Key again',
  keyPassed: (right: number) => `Level Key: ${right} out of 10. The next level is unlocked!`,
  keyFailed: (right: number, pass: number) => `Level Key: ${right} out of 10. You need ${pass}. You can try again straight away with new questions.`,
  keyPractise: 'Facts to practise:',
} as const;

export const COLOUR_NAMES: Record<Colour, string> = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

/** What each colour does, and its shape (so it can be told apart without colour). */
export const COLOUR_INFO: Record<Colour, { power: string; shape: string }> = {
  red: { power: 'Hits a group', shape: 'triangle' },
  blue: { power: 'Slows enemies', shape: 'circle' },
  green: { power: 'Poisons', shape: 'hexagon' },
  yellow: { power: 'Big hits', shape: 'star' },
};

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  walker: 'Walker',
  runner: 'Runner',
  brute: 'Brute',
  swarm: 'Swarm',
  boss: 'Boss',
};

export const REFUSALS: Record<Refusal, string> = {
  'game-over': 'This game is over.',
  'not-buildable': "You can't build there. Pick a grass tile.",
  'tower-there': "There's already a tower there.",
  'no-tower': "There's no tower there.",
  'max-level': 'That tower is already at the top level.',
  'no-mana': 'Not enough mana yet. Visit the Mana Well!',
  'no-gem': 'There is no gem there.',
  'inventory-full': 'Your gem bag is full. Put a gem in a tower or combine two.',
  'same-gem': 'Pick a different gem to combine with.',
  'different-grades': 'Only gems of the same grade can combine.',
  'max-grade': 'Grade 5 is the biggest a gem can get!',
  'wave-running': 'A wave is already coming.',
  'no-more-waves': 'That was the last wave.',
  'well-empty': 'The Mana Well is resting until the next wave.',
  'no-shield': 'The Keep Shield has already been used.',
};
