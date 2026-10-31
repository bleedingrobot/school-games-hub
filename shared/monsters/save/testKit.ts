/**
 * Test helpers (used by the tests, never by the game): play whole battles and whole sessions with
 * pretend students and write down exactly what the website would send, so the server check can be
 * tried on honest play as well as on tampered saves.
 */
import { makePack, type TopicId } from '../../maths/skillPacks';
import {
  activeFoe, activeMonster, isOver, judgeAnswer, newBattle, play, questionFor, type BattleAction, type BattleSetup, type BattleState,
} from '../engine';
import { bandFor } from '../bands';
import { WORLD_MAPS } from '../maps';
import { speciesOf } from '../monsterBook';
import { maxHpOf } from '../rules';
import { Dice } from '../world/rng';
import { wildFor } from '../world/encounters';
import type { Thing, WorldState } from '../world/types';
import { finishBattle, newWorld, trainerBattle, wildBattle, type Maps } from '../world/world';
import { startTeam } from '../world/start';
import { effectiveTopic } from '../topics';
import type { TypeId } from '../types';
import type { BattleReport, BattleStep, SaveItem } from './check';
import type { QuestionReport } from './verify';

export interface Student {
  /** Chance of a right answer. */
  right: number;
  /** Milliseconds a question takes. */
  ms: number;
  calm?: boolean;
  /** Topics the teacher left on (default: all). */
  topics?: readonly TopicId[];
}

export const NORMAL: Student = { right: 0.75, ms: 6000 };

/** A fake clock that moves only when a student does something. */
export class Clock {
  constructor(public t: number) {}
  now = () => this.t;
  tick(ms: number) {
    this.t += ms;
  }
}

let nextUuid = 1;
export const uuid = () => `00000000-0000-4000-8000-${String(nextUuid++).padStart(12, '0')}`;

/** Plays one battle to the end. */
export function playBattle(setup: BattleSetup, where: { map: string; trainer?: Thing }, student: Student, dice: Dice, clock: Clock): { report: BattleReport; final: BattleState } {
  const packs = new Map<TopicId, ReturnType<typeof makePack>>();
  const pack = (t: TopicId) => {
    if (!packs.has(t)) packs.set(t, makePack(t, [], () => dice.next(), clock.now));
    return packs.get(t)!;
  };
  let state = newBattle(setup).state;
  const steps: BattleStep[] = [];
  const doStep = (action: BattleAction, q?: QuestionReport) => {
    const randoms: number[] = [];
    const random = () => {
      const n = dice.next();
      randoms.push(n);
      return n;
    };
    state = play(state, action, random).state;
    steps.push({ action, ...(q ? { q } : {}), randoms });
  };
  const ask = (kind: 'fight' | 'catch') => {
    const spec = questionFor(state, { kind })!;
    const topic = effectiveTopic(spec.topic, student.topics);
    const band = topic === spec.topic ? spec.band : bandFor(topic, state.area, state.far);
    const question = pack(topic).nextQuestion({ level: band })!;
    const correct = dice.next() < student.right;
    const given = correct ? question.answer : question.answer + 1;
    clock.tick(student.ms);
    const marked = pack(topic).recordAnswer(question, given, student.ms);
    const q: QuestionReport = {
      topic, band, key: question.factKey, ...(question.params ? { params: question.params } : {}), ...(topic === 'times-tables' ? { kind: question.kind, parts: question.parts } : {}),
      given, ms: student.ms, at: clock.now(),
    };
    return { q, result: judgeAnswer({ correct: marked.correct, ms: student.ms, topic, band, calm: student.calm }) };
  };
  for (let guard = 0; !isOver(state) && guard < 400; guard++) {
    if (state.phase === 'replace') {
      doStep({ kind: 'switch', to: state.team.findIndex((m) => m.hp > 0) });
      continue;
    }
    const foe = activeFoe(state);
    const hurt = foe.hp / maxHpOf(foe) < 0.5;
    if (state.kind === 'wild' && hurt && (state.bag.ball ?? 0) > 0 && dice.next() < 0.5) {
      const { q, result } = ask('catch');
      doStep({ kind: 'catch', answer: result, ball: 'ball' }, q);
      continue;
    }
    const me = activeMonster(state);
    const attack = speciesOf(me.species).attacks.length - 1;
    const { q, result } = ask('fight');
    doStep({ kind: 'fight', attack: Math.min(attack, Math.floor(dice.next() * 2) + (attack > 1 ? 1 : 0)), answer: result }, q);
  }
  return { final: state, report: { id: uuid(), map: where.map, ...(where.trainer ? { trainer: where.trainer.id } : {}), setup, steps, outcome: state.phase as BattleReport['outcome'] } };
}

/** A pretend session: a student who starts a game and plays on, making a save item after each chunk of play. */
export class Session {
  world: WorldState;
  battles: BattleReport[] = [];
  seq = 0;
  readonly dice: Dice;
  readonly clock: Clock;
  private first = true;
  /** Where the student wanders: after losing they wake at a healing spot, and this brings them back. */
  private field = { map: 'kauri-bush', spot: 'entrance' };

  constructor(readonly picks: [TypeId, TypeId] = ['water', 'fire'], readonly student: Student = NORMAL, startAt = Date.UTC(2026, 9, 20, 1, 0, 0), readonly maps: Maps = WORLD_MAPS, seed = 7) {
    this.dice = new Dice(seed);
    this.clock = new Clock(startAt);
    this.world = newWorld({ maps }, startTeam(picks), seed);
  }

  /** Puts the student at a named spot on a map. */
  goto(map: string, spot: string) {
    const s = this.maps[map].spots.find((p) => p.name === spot)!;
    this.field = { map, spot };
    this.world = { ...this.world, map, x: s.x, y: s.y, facing: s.facing, beaten: [] };
  }

  /** Walks `steps` steps (just counts them) taking `seconds`. */
  walk(steps: number, seconds = steps / 4) {
    this.world = { ...this.world, steps: this.world.steps + steps };
    this.clock.tick(seconds * 1000);
  }

  /** A wild battle, as the grass would start one. */
  wild(): BattleReport {
    if (this.world.map !== this.field.map) this.goto(this.field.map, this.field.spot);
    const map = this.maps[this.world.map];
    this.walk(14);
    const grass = map.isGrass.findIndex(Boolean);
    const x = grass % map.width;
    const y = Math.floor(grass / map.width);
    const foe = wildFor(map, x, y, this.dice)!;
    const setup = wildBattle(this.world, { kind: 'wild', foe, area: map.area, far: map.far[grass] });
    return this.fight(setup, undefined);
  }

  trainer(id: string): BattleReport {
    const map = this.maps[this.world.map];
    const t = map.things.find((x) => x.id === id)!;
    return this.fight(trainerBattle(this.world, { maps: this.maps }, t), t);
  }

  private fight(setup: BattleSetup, trainer: Thing | undefined): BattleReport {
    const { report, final } = playBattle(setup, { map: this.world.map, trainer }, this.student, this.dice, this.clock);
    this.battles.push(report);
    this.world = finishBattle(this.world, { outcome: final.phase as 'won', team: final.phase === 'lost' ? final.team : final.team, box: final.box, bag: final.bag }, trainer).state;
    this.clock.tick(4000);
    return report;
  }

  /** The save item for everything since the last one. */
  save(): SaveItem {
    this.seq += 1;
    const item: SaveItem = {
      saveId: uuid(), seq: this.seq, at: this.clock.now(), ...(this.first ? { start: this.picks } : {}),
      world: structuredClone(this.world), battles: structuredClone(this.battles),
    };
    this.first = false;
    this.battles = [];
    return item;
  }
}
