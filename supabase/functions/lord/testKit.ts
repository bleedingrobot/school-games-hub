import { expect } from 'vitest';
import { ARMOURS, MAX_LEVEL, WEAPONS, baseStats, expNeeded } from '../../../shared/lord/data';
import { forestTrip, makeRandom, stepFight } from '../../../shared/lord/engine';
import { emptyDb, memoryServices, type MemoryDb } from '../../../shared/lord/memoryServices';
import { eventsOn } from '../../../shared/lord/events';
import { offersSizeItUp, topicsOn } from '../../../shared/lord/maths';
import { questionLevel, type Proof } from '../../../shared/lord/proof';
import type { LordState } from '../../../shared/lord/server';
import type { FightAction, FightState, Hero } from '../../../shared/lord/types';
import { makeExtraPack, makePack, type ExtraTopicId, type TopicId } from '../../../shared/maths/skillPacks';
import { makeHandler, type HandlerServices } from './handler';

// 2026-10-19 00:00 UTC is 1 pm in New Zealand (summer time). NZ midnight between the 19th and 20th is 11:00 UTC.
export const DAY1 = Date.parse('2026-10-19T00:00:00Z');
export const NZ_MIDNIGHT = Date.parse('2026-10-19T11:00:00Z');
export const SEASON_START = '2026-10-19';

/** A pupil at the keyboard: sends requests through the real handler against an in-memory database. */
export class Game {
  db: MemoryDb;
  clock = DAY1;
  /** Seeds the server will use next (then random ones). */
  forced: number[] = [];
  random = makeRandom(7);
  state: LordState | null = null;
  services: HandlerServices;
  handler: (r: Request) => Promise<Response>;

  constructor(settings: Parameters<typeof emptyDb>[0] = { seasonStart: SEASON_START }) {
    this.db = emptyDb(settings);
    const base = memoryServices(this.db, { now: () => this.clock, seed: () => this.forced.shift() ?? Math.floor(this.random() * 4294967296) });
    this.services = { ...base, userIdFor: async (token: string) => (token === 'good-token' ? 'pupil-1' : null) };
    this.handler = makeHandler(this.services);
  }

  async raw(body: unknown, token: string | null = 'good-token') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.handler(new Request('http://x/lord', { method: 'POST', headers, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  }

  /** A normal request: a fresh id and the version the pupil last saw. */
  async send(action: Record<string, unknown>, over: { version?: number | null; requestId?: string } = {}) {
    const request: Record<string, unknown> = { ...action, requestId: over.requestId ?? crypto.randomUUID() };
    const version = over.version === undefined ? this.state?.version : over.version;
    if (version !== null && version !== undefined) request.version = version;
    const out = await this.raw(request);
    if (out.body?.state) this.state = out.body.state;
    return out;
  }

  async start(heroClass = 'knight') {
    await this.send({ action: 'load' });
    return this.send({ action: 'start-hero', heroClass });
  }

  hero(): Hero {
    return this.db.row!.hero;
  }
  /** Changes the saved hero directly (the way a long game would have). */
  patch(change: Partial<Hero>) {
    this.db.row = { ...this.db.row!, hero: { ...this.db.row!.hero, ...change } };
  }
  async refresh() {
    const out = await this.send({ action: 'load' });
    return out.body.state as LordState;
  }
  /** The next trip into the forest finds a monster (or an event, if asked). */
  forceTrip(kind: 'fight' | 'event') {
    const events = eventsOn(topicsOn(this.db.settings.topics));
    for (let s = 1; s < 5000; s++) if (forestTrip(this.hero(), s, events).kind === kind) return this.forced.push(s);
    throw new Error('no seed');
  }
  /** Takes a forest trip that is a fight (one that offers "size it up", if asked). */
  async fight(sizeUp?: boolean) {
    for (let s = 1; s < 20000; s++) {
      const trip = forestTrip(this.hero(), s);
      if (trip.kind === 'fight' && (sizeUp === undefined || offersSizeItUp(trip.seed) === sizeUp)) {
        this.forced.push(s);
        break;
      }
    }
    const out = await this.send({ action: 'forest' });
    expect(out.body.ok).toBe(true);
    return out.body.state.openFight as NonNullable<LordState['openFight']>;
  }
}

/** Plays a fight the way the browser does: stepFight with the same start the server sent. */
export function play(start: FightState, pick: (f: FightState) => FightAction = () => ({ type: 'attack' })) {
  const actions: FightAction[] = [];
  let fight = start;
  while (!fight.over && actions.length < 200) {
    const action = pick(fight);
    actions.push(action);
    fight = stepFight(fight, action);
  }
  return { actions, fight };
}

/** A maths answer the way the question box reports it. */
export function proof(pack: TopicId | ExtraTopicId, heroLevel: number, right = true): Proof {
  const p = pack === 'money' || pack === 'patterns' ? makeExtraPack(pack) : makePack(pack);
  const level = questionLevel(pack, heroLevel);
  const q = p.nextQuestion({ level })!;
  // Far from any real answer: a missing-factor question also accepts the other factor, which "answer + 1" can be.
  const wrong = q.answer + 1000;
  return { pack, key: q.factKey, kind: q.kind, params: q.params, level, given: right ? q.answer : wrong, ms: 4000 };
}

export const STRONG = { strength: 900, defence: 50, hp: 400, maxHp: 400 };
/** A hero who has beaten every master and can face the dragon with the best gear. */
export const DRAGON_SLAYER: Partial<Hero> = {
  level: MAX_LEVEL, exp: expNeeded(MAX_LEVEL - 1), ...baseStats(MAX_LEVEL), hp: baseStats(MAX_LEVEL).maxHp,
  weapon: WEAPONS.length - 1, armour: ARMOURS.length - 1, strength: 5000,
};

