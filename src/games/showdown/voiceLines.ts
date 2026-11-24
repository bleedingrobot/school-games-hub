/**
 * Everything the Class Showdown announcer says on the projector (docs/SHOWDOWN-PLAN.md, section 7).
 * iPads stay silent. Every line is read by Bella (Kokoro af_bella, like every game): the clips are in public/voice/showdown/,
 * made with scripts/voice-clips.py showdown; voiceLines.test.ts checks every line has one.
 */
import { BOSSES } from '../../../shared/showdown/bosses';
export const VOICE_FOLDER = 'voice/showdown/';

export const ANNOUNCER = {
  joinNow: 'Join now!',
  fight: 'Three, two, one, fight!',
  windUp: 'The boss is winding up! Shield up!',
  held: 'Shield held!',
  broke: 'The shield broke!',
  weakSpot: 'Weak spot!',
  golden: 'Golden question!',
  phase: 'The boss is changing!',
  thirty: 'Thirty seconds!',
  beaten: 'The boss is beaten!',
  timeUp: "Time's up!",
  soClose: 'So close!',
} as const;

/** Gold Rush says these in place of the boss lines. */
export const GOLD_RUSH_LINES = {
  joinNow: 'Grab your pickaxe! Join now!',
  start: 'Dig, dig, dig!',
  caveIn: 'Cave-in! Prop up the roof!',
  held: 'The roof holds!',
  broke: 'Cave-in!',
  lode: 'Mother lode! Double gold!',
  phase: 'The mountain rumbles!',
  done: 'You dug it all out!',
} as const;

/** Sky Climb says these in place of the boss lines. */
export const SKY_CLIMB_LINES = {
  joinNow: 'Sky Climb! Join now, and get ready to climb!',
  start: 'Climb to the summit! Three in a row is a jump!',
  storm: 'A storm is coming! Keep answering to hold on!',
  held: 'You held on! The storm has passed!',
  blown: 'Whoosh! The wind blew some climbers back down!',
  updraft: 'Updraft! Double height!',
  phase: 'Above the clouds! Keep climbing!',
  done: 'You reached the summit!',
} as const;

/** Shrinking Island says these in place of the boss lines. */
export const ISLAND_LINES = {
  joinNow: 'Shrinking Island! Join now!',
  start: 'Build the raft before the island sinks!',
  wave: 'Big wave coming! Hold it back!',
  held: 'We held back the wave!',
  broke: 'Sploosh! The wave crashed over the beach!',
  crate: 'A crate washed ashore! Double planks!',
  phase: 'The tide is rising!',
  done: 'The raft is ready! Sail away!',
} as const;

/** King of the Hill says these in place of the boss lines, and who takes the crown. */
export const HILL_LINES = {
  joinNow: 'King of the Hill! Join now!',
  start: 'Score fast to take the crown!',
  charge: 'A challenger charges the hill!',
  held: 'We held the hill!',
  broke: 'Crash! The crown is up for grabs!',
  double: 'Double crown!',
  phase: 'The walls are rising!',
  done: 'The castle is built!',
  newKing: 'A new king of the hill!',
  red: 'Red team takes the crown!',
  blue: 'Blue team takes the crown!',
  gold: 'Gold team takes the crown!',
  green: 'Green team takes the crown!',
} as const;

/** Auction House (auction.ts): the class fills the royal treasury and bids for treasures. */
export const AUCTION_LINES = {
  joinNow: 'The Auction House is open! Join now!',
  start: 'Earn coins, then bid for treasure!',
  thieves: 'Thieves! Guard the treasure!',
  held: 'The thieves are caught!',
  broke: 'Oh no! The thieves got away with it!',
  golden: 'Golden hour! Double coins!',
  phase: 'The treasury is filling up!',
  done: 'The royal treasury is full!',
  lot: 'A new treasure! Start your bids!',
  mystery: 'A mystery box! What could be inside?',
  dragon: 'The golden dragon! The last treasure of the day!',
  sold: 'Going, going, gone! Sold!',
  unsold: 'No bids! It goes back in the vault.',
} as const;

/**
 * More narration (James, 24 Nov 2026: "more narration with Bella during the game, like more guards needed"). The big screen
 * says these when the moment comes, never on top of another line (audio.ts spaces them).
 */
export const NARRATION = {
  halfway: 'Halfway there! Keep going!',
  nearly: 'Nearly there! One last push!',
  oneMinute: 'One minute left!',
  fiveRow: 'Five in a row! On fire!',
  tenRow: 'Ten in a row! Unstoppable!',
  luckyChest: 'A lucky chest!',
  revive: 'A Healer to the rescue!',
  paused: 'Paused. Eyes on the teacher.',
  resumed: "And we're back! Go, go, go!",
  newLeader: 'We have a new leader!',
  shieldClose: 'Nearly there! Keep answering!',
  goldenEnd: 'Golden question time is over!',
  redPush: 'Red team is pushing!',
  bluePush: 'Blue team is pushing!',
  turnRed: 'The boss turns on Red team!',
  turnBlue: 'The boss turns on Blue team!',
  turnGold: 'The boss turns on Gold team!',
  turnGreen: 'The boss turns on Green team!',
} as const;

/** Per arena: the call for more Guards (in its own word for them), for a Healer, and the teacher's angry button. */
export const ARENA_CALLS: Record<'boss' | 'goldrush' | 'skyclimb' | 'island' | 'hill' | 'auction', { guards: string; healer: string; enrage: string }> = {
  boss: { guards: 'We need more Guards!', healer: 'We need a Healer!', enrage: 'The boss is enraged!' },
  goldrush: { guards: 'We need more Prop-holders!', healer: 'We need a Medic!', enrage: 'The mountain roars!' },
  skyclimb: { guards: 'We need more Anchors!', healer: 'We need a Medic!', enrage: 'The wind is howling!' },
  island: { guards: 'We need more Wave-breakers!', healer: 'We need a Medic!', enrage: 'The sea is angry!' },
  hill: { guards: 'We need more Defenders!', healer: 'We need a Medic!', enrage: 'Challengers storm the hill!' },
  auction: { guards: 'We need more Watchmen!', healer: 'We need a Medic!', enrage: 'A gang of thieves!' },
};

/**
 * Other takes of the lines heard most, so they don't sound the same every time (James, 24 Nov 2026: "more variety"). The
 * announcer picks one at random each time, never the one it said last.
 */
export const TAKES: Record<string, readonly string[]> = {
  [ANNOUNCER.held]: ['Blocked! Great teamwork!', 'The shield holds! Nice one!'],
  [ANNOUNCER.broke]: ['Crack! The shield is down!', 'Oof! It got through!'],
  [ANNOUNCER.windUp]: ['Here it comes! Shields up!', 'Get ready! Shield up now!'],
  [ANNOUNCER.weakSpot]: ['Weak spot! Hit it hard!', 'Double damage! Go, go, go!'],
  [ANNOUNCER.golden]: ['Golden question! Triple points!'],
  [ANNOUNCER.beaten]: ['Victory! The boss is down!'],
  [GOLD_RUSH_LINES.held]: ['Phew! The roof is safe!'],
  [SKY_CLIMB_LINES.held]: ['Hold on tight! You made it through!'],
  [ISLAND_LINES.held]: ['The wave is gone! Great teamwork!'],
  [HILL_LINES.held]: ['Charge stopped! The hill is ours!'],
  [AUCTION_LINES.held]: ['Gotcha! No stealing today!'],
  [AUCTION_LINES.sold]: ['Sold, to the lucky bidder!', 'Bang goes the hammer! Sold!'],
  [AUCTION_LINES.lot]: ['Next up, a shiny treasure!', 'Fresh treasure on the stage! Who will bid?'],
  [HILL_LINES.newKing]: ['The crown has a new owner!', 'Long live the new king!'],
  [NARRATION.fiveRow]: ['Five in a row! Brilliant!', 'Five right in a row! Amazing!'],
  [NARRATION.luckyChest]: ['Ooh, a lucky chest!'],
  [NARRATION.revive]: ['Wakey wakey! A Healer helped a friend!'],
  [ARENA_CALLS.boss.guards]: ['Guards needed! Who can help?'],
  [ARENA_CALLS.boss.healer]: ['Calling all Healers!'],
};

/** One of a line's takes: any but `last`. */
export function pickTake(line: string, last: string | null, random = Math.random): string {
  const all = [line, ...(TAKES[line] ?? [])].filter((x) => x !== last);
  return all[Math.floor(random() * all.length)] ?? line;
}

/** The "How to play" screen before a round (howToPlay.ts): each arena's goal, each mode's way to win, and the go. */
export const HOW_TO_LINES = {
  boss: 'Boss Bounty! Answer questions to beat the boss before time runs out!',
  goldrush: 'Gold Rush! Answer questions to dig all the gold out of the mountain!',
  skyclimb: 'Sky Climb! Every right answer is a step up. Reach the summit!',
  island: 'Shrinking Island! Answer questions to build the raft before the water rises!',
  hill: 'King of the Hill! Build the castle, and score fast to wear the crown!',
  auction: 'Auction House! Earn coins, bid for treasure, and fill the royal treasury!',
  class: "We're one team today. Pick a role and work together!",
  teams2: 'Two teams! Work together, and do more than the other team!',
  teams4: 'Four teams! The team with the most points wins!',
  solo: 'Everyone for themselves! Get into the top ten!',
  ready: 'Ready? Get your iPads!',
} as const;

export const allVoiceLines = (): string[] => [...Object.values(HOW_TO_LINES), ...Object.values(NARRATION), ...new Set(Object.values(ARENA_CALLS).flatMap((c) => [c.guards, c.healer, c.enrage])), ...Object.values(TAKES).flat(), ...Object.values(AUCTION_LINES), ...Object.values(HILL_LINES), ...Object.values(ANNOUNCER), ...Object.values(GOLD_RUSH_LINES), ...Object.values(SKY_CLIMB_LINES), ...Object.values(ISLAND_LINES), ...BOSSES.map((b) => b.roar)];
