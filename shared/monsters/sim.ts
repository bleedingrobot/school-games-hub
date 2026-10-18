/**
 * Plays lots of battles with pretend students (who get 50%, 75% or 90% of questions right) to
 * tune battle length, difficulty and levelling. Run it with `npm run monsters:sim`.
 */
import { randomFromSeed } from '../space/random';
import { AREA_LEVELS } from './bands';
import { foeAttackIndex, healTeam, isOver, newBattle, play, type Bag, type BattleAction, type BattleState } from './engine';
import { FAMILIES, formAt, speciesOf } from './monsterBook';
import { makeMonster, maxHpOf, type AnswerResult, type Monster } from './rules';
import { typeMultiplier } from './types';

export interface Student {
  /** How often the answer is right. */
  right: number;
  /** Of the right answers, how many are quick. */
  quick: number;
  /** Throws a ball when a wild monster is at or below this share of its health (0 = never catches). */
  catchBelow: number;
}

export const STUDENTS = { '50%': 0.5, '75%': 0.75, '90%': 0.9 };

/** Rough real seconds: answering a question, plus the animations around each move. */
export const SECONDS = { perQuestion: 8, perAction: 4 };

const FAMILY_IDS = Object.keys(FAMILIES);

export function randomWild(level: number, random: () => number): Monster {
  const family = FAMILY_IDS[Math.floor(random() * FAMILY_IDS.length)];
  return makeMonster(formAt(family, level), level);
}

export function randomTeam(level: number, size: number, random: () => number): Monster[] {
  return Array.from({ length: size }, () => randomWild(level, random));
}

function answerFor(student: Student, random: () => number): AnswerResult {
  if (random() >= student.right) return 'wrong';
  return random() < student.quick ? 'quick-right' : 'right';
}

/** What a sensible student does next. */
export function chooseAction(state: BattleState, student: Student, random: () => number): BattleAction {
  const me = state.team[state.active];
  if (state.phase === 'replace') {
    return { kind: 'switch', to: state.team.findIndex((m) => m.hp > 0) };
  }
  const foe = state.foes[state.foeActive];
  if (me.hp / maxHpOf(me) < 0.3) {
    const item = state.bag.potion ? 'potion' : state.bag['super-potion'] ? 'super-potion' : undefined;
    if (item) return { kind: 'item', item };
  }
  if (state.kind === 'wild' && student.catchBelow > 0 && (state.bag.ball ?? 0) > 0 && foe.hp / maxHpOf(foe) <= student.catchBelow) {
    return { kind: 'catch', answer: answerFor(student, random) };
  }
  const mine = speciesOf(me.species);
  const best = mine.attacks.reduce((bi, a, i, all) => {
    const score = (x: typeof a) => x.power * typeMultiplier(mine.type, speciesOf(foe.species).type);
    return score(a) > score(all[bi]) ? i : bi;
  }, 0);
  return { kind: 'fight', attack: best, answer: answerFor(student, random) };
}

export interface BattleReport {
  won: boolean;
  questions: number;
  actions: number;
  seconds: number;
  state: BattleState;
}

export function playBattle(setup: Parameters<typeof newBattle>[0], student: Student, random: () => number): BattleReport {
  let { state } = newBattle(setup);
  let actions = 0;
  while (!isOver(state) && actions < 200) {
    state = play(state, chooseAction(state, student, random), random).state;
    actions += 1;
  }
  return {
    won: state.phase === 'won' || state.phase === 'caught',
    questions: state.questions,
    actions,
    seconds: state.questions * SECONDS.perQuestion + actions * SECONDS.perAction,
    state,
  };
}

const BAG = (): Bag => ({ potion: 3, ball: 5 });

export interface Spread { mean: number; p50: number; p90: number; max: number }
export function spread(values: number[]): Spread {
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { mean: s.reduce((a, b) => a + b, 0) / (s.length || 1), p50: at(0.5), p90: at(0.9), max: s[s.length - 1] };
}

export interface WildReport { winRate: number; questions: Spread; minutes: Spread }

/** Wild battles in an area, the student's team matched to the area (lead level = `teamLevel`). */
export function simWild(area: number, student: Student, battles: number, seed: string, teamLevel?: number): WildReport {
  const random = randomFromSeed(seed);
  const [lo, hi] = AREA_LEVELS[area - 1];
  const level = teamLevel ?? Math.round((lo + hi) / 2);
  const questions: number[] = [];
  const minutes: number[] = [];
  let won = 0;
  for (let i = 0; i < battles; i++) {
    const foeLevel = lo + Math.floor(random() * (hi - lo + 1));
    const r = playBattle({
      kind: 'wild', area, far: random() < 0.5, team: randomTeam(level, 3, random), bag: BAG(), foes: [randomWild(foeLevel, random)],
    }, student, random);
    if (r.won) won += 1;
    questions.push(r.questions);
    minutes.push(r.seconds / 60);
  }
  return { winRate: won / battles, questions: spread(questions), minutes: spread(minutes) };
}

/** A Tower trainer with 3 monsters (levels top, top+1, top+2) against a team at the area's top level. */
export function simTower(area: number, student: Student, battles: number, seed: string): WildReport {
  const random = randomFromSeed(seed);
  const top = AREA_LEVELS[area - 1][1];
  const questions: number[] = [];
  const minutes: number[] = [];
  let won = 0;
  for (let i = 0; i < battles; i++) {
    const r = playBattle({
      kind: 'trainer', area, far: true, team: randomTeam(top, 3, random), bag: BAG(),
      foes: [0, 1, 2].map((d) => randomWild(top + d, random)),
    }, student, random);
    if (r.won) won += 1;
    questions.push(r.questions);
    minutes.push(r.seconds / 60);
  }
  return { winRate: won / battles, questions: spread(questions), minutes: spread(minutes) };
}

export interface LevellingReport {
  /** Wild battles it took to get the lead monster ready (the area's top wild level) in each area. */
  battlesToReady: number[];
  /** Lead monster's level at the end of each area. */
  levelAfterArea: number[];
  /** Battles per level gained, in bands of levels. */
  battlesPerLevel: { from: number; to: number; battles: number }[];
  totalBattles: number;
  /** Battles lost (all were wild battles or trainers; nothing is ever lost but time). */
  losses: number;
  minutes: number;
}

/**
 * A student walks through the game. In each area they fight wild monsters until the lead monster
 * is as strong as the area's toughest wild monster (at most 80 battles), then beat 3 trainers
 * (2 monsters each) and the Tower. Shows how many battles each area takes and whether
 * levelling feels steady.
 */
export function simLevelling(student: Student, seed: string): LevellingReport {
  const random = randomFromSeed(seed);
  let team = randomTeam(5, 3, random);
  const levelAt: number[] = []; // battle number at which the lead first reached level L
  let battles = 0;
  let losses = 0;
  let seconds = 0;
  const battlesToReady: number[] = [];
  const levelAfterArea: number[] = [];
  const lead = () => team.reduce((m, x) => (x.level > m ? x.level : m), 0);
  const note = () => {
    for (let l = 1; l <= lead(); l++) if (levelAt[l] === undefined) levelAt[l] = battles;
  };
  note();
  const fight = (kind: 'wild' | 'trainer', area: number, far: boolean, foes: Monster[]) => {
    // The lead goes first, like a student's favourite.
    team = [...team].sort((a, b) => b.level - a.level);
    const r = playBattle({ kind, area, far, team, bag: { potion: 5, ball: 0 }, foes }, student, random);
    team = healTeam(r.state.team);
    battles += 1;
    seconds += r.seconds;
    if (!r.won) losses += 1;
    note();
  };
  for (let area = 1; area <= AREA_LEVELS.length; area++) {
    const [lo, hi] = AREA_LEVELS[area - 1];
    const level = () => lo + Math.floor(random() * (hi - lo + 1));
    let n = 0;
    while (lead() < hi && n < 80) {
      fight('wild', area, lead() >= (lo + hi) / 2, [randomWild(level(), random)]);
      n += 1;
    }
    battlesToReady.push(n);
    for (let i = 0; i < 3; i++) fight('trainer', area, true, [randomWild(level(), random), randomWild(level(), random)]);
    fight('trainer', area, true, [0, 1, 2].map((d) => randomWild(hi + d, random)));
    levelAfterArea.push(lead());
    // The rest of the team catches up between areas (new catches, a little training).
    team = team.map((m) => (m.level < lead() - 3 ? makeMonster(formAt(speciesOf(m.species).family, lead() - 3), lead() - 3) : m));
  }
  const bands: LevellingReport['battlesPerLevel'] = [];
  for (const [from, to] of [[5, 10], [10, 20], [20, 30], [30, 40], [40, 45]]) {
    if (levelAt[to] !== undefined && levelAt[from] !== undefined) bands.push({ from, to, battles: (levelAt[to] - levelAt[from]) / (to - from) });
  }
  return { battlesToReady, levelAfterArea, battlesPerLevel: bands, totalBattles: battles, losses, minutes: seconds / 60 };
}

export { foeAttackIndex, formAt };
