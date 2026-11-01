/**
 * The clans server function (Clan Quest, stage C.5 part A). The website sends one action at a time ("buy this",
 * "wake her", "do today's quest with this answer"); this loads the clan, runs the very same shared/clans rules the
 * screens use, and saves the result. The browser is never believed about gold, levels, days or prizes.
 *
 * Every request carries an id the browser made. If the same id arrives twice (a slow connection, a double tap)
 * the first answer is sent back and nothing is paid again. If two requests race, the database refuses the second
 * save (its copy was old), and this loads again and redoes the action.
 *
 * Mine fights go through the same door as everything else: `fightStart` and one `fightRound` per round played, replayed
 * and paid by shared/clans (see actions.ts). The teacher's switch is checked on every request, with the clan itself, so
 * switching Clan Quest off stops it at once.
 *
 * Stage C.6 part B: the teacher's maths settings (year band, topics, times tables, mine fights a day) are read from the database on every
 * request and sent with the clan, so the browser and the server always use the same ones. Fame, points and achievements are added by the
 * database in the same save (from the counts the rules put in the result); this only asks for the new fame and achievements afterwards.
 * The maths answers a request produced go in the teacher's private records once the save is kept (a retry reuses the same batch id).
 *
 * Ladder fights (20 Oct 2026): a `fightStart` that asks for one loads the child's maths (records, class settings, focus) so the rules
 * can make the fight's Battle Cry questions; `publicState` sends the browser only what to show of them, never an answer. Each
 * `cryCheck` answer goes in the child's own maths records (ladder place, skill map, focus results) once its save is kept.
 */
import { applyAction, parseAction, type Applied, type Effects, type Result, type ServerState, type ShownFight } from '../../../shared/clans/actions';
import { readClock, type SeasonClock } from '../../../shared/clans/season';
import type { Empire, Village } from '../../../shared/clans/types';
import type { RaidTarget, Sketch } from '../../../shared/clans/village';
import { nzDayNumber } from '../../../shared/clans/clock';
import { UNTIMED_MS } from '../../../shared/clans/battleCry';
import { CONFIG } from '../../../shared/clans/config';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { readPracticalSettings, type PracticalSettings } from '../../../shared/maths/practical';
import { publicQuestion, type MathsContext } from '../../../shared/maths/serverQuestions';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** A database answer. 'refused': the database said no (bad data). 'busy': it couldn't be reached. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'refused' | 'busy' };

/** What load_clan() gives back. `state` is null until the student has made a clan. */
export interface Loaded {
  seed: number;
  version: number;
  state: ServerState | null;
  /** The answer kept for this request id, if it was already done. */
  replay: Result | null;
  /** Is Clan Quest switched on? A teacher can always use it, so they can try it before the class can. */
  enabled: boolean;
  /** The latest village news lines, newest first. Written by the midnight job and by raids, never by a student. */
  news: string[];
  /** The levels of the old class (group) village this clan was in. Used once, to convert an old save to "My Village"; ignored after that. */
  groupVillage?: Village | null;
  /** This clan's hidden public id (never the account id). */
  self?: string | null;
  /** The teacher's switch for raids on classmates. */
  raidsOn?: boolean;
  /** What raiders did to this clan lately, for it to read. */
  notes?: string[];
}

/** A clan to be raided, as the database loads it. `version` is the copy the save will be checked against. */
export type LoadedTarget = (RaidTarget & { version: number }) | null;

/** What a raid saves besides the raiders' clan: the raided clan's empire and purse (checked against its version) and the lines to write. */
export interface RaidSave {
  targetId: string;
  targetVersion: number;
  empire: Empire;
  /** The raided clan's purse after the raid. */
  gold: number;
  news: string;
  note: string;
}

/** What the database says besides the clan, on every request (clan_extras): the teacher's settings, this clan's fame and its achievements. */
export interface Extras {
  settings: { enabledTopics: unknown; yearBand: unknown; enabledTables: unknown; fightsPerDay: number; season: number; typedNames?: unknown };
  fame: number;
  /** The ids of the achievements earned so far. */
  achievements: string[];
  /** The season clock (clan_extras). Missing or odd before the migration is live: `readClock` turns it into null. */
  clock?: unknown;
}

export type SaveStatus = { status: 'saved'; version: number } | { status: 'duplicate'; result: Result } | { status: 'stale' };

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  load(player: string, requestId: string): Promise<Outcome<Loaded>>;
  save(player: string, expectedVersion: number, requestId: string, action: string, state: ServerState, result: Result): Promise<Outcome<SaveStatus>>;
  /** The other clans in the pupil's class, for the list of who can be raided. None if the pupil has no class. */
  mates(player: string): Promise<Outcome<Sketch[]>>;
  /** One clan in the pupil's class, to raid it. Null if there is none. */
  target(player: string, targetId: string): Promise<Outcome<LoadedTarget>>;
  /** Saves a raid: both clans, one transaction. */
  saveRaid(player: string, expectedVersion: number, raid: RaidSave, requestId: string, state: ServerState, result: Result): Promise<Outcome<SaveStatus>>;
  /** The teacher's settings, and this pupil's fame and achievements. */
  extras(player: string): Promise<Outcome<Extras>>;
  /** Adds answers to the teacher's private maths records. `batchKey` makes a retry count once. */
  recordAnswers(player: string, batchKey: string, answers: FactAnswer[]): Promise<Outcome<number>>;
  /** The child's maths records, class question settings and focus, to make a ladder fight's questions. Null if they couldn't be read. */
  mathsContext(player: string): Promise<MathsContext | null>;
  /** Adds ladder answers to the child's own maths records, the shared way (recordMathsAnswers). `once` makes a resend count once. Never throws. */
  recordLadderAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Milliseconds since 1970. */
  now(): number;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A batch id for the answers of one request: the same request always gives the same id, so a retry is never counted twice. */
export async function batchIdFor(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`clans:${key}`)));
  const h = hex(digest.slice(0, 16));
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Requests one student may make a minute. A busy minute in the shop is about ten. */
export const MAX_REQUESTS_PER_MINUTE = 40;
/** How many times a request is redone after another one saved first. */
export const MAX_TRIES = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fight in progress as the browser may see it: a ladder fight's questions with no answers (the marks so far are its own). */
export function publicFight(fight: NonNullable<ServerState['fight']>): ShownFight {
  const { questions, ...rest } = fight;
  return questions ? { ...rest, questions: questions.map((q, i) => publicQuestion(q, i)) } : rest;
}

/** What the browser is told about a clan: everything it shows, nothing it could use to cheat. */
export function publicState(state: ServerState, settings: PracticalSettings, loaded: Pick<Loaded, 'news' | 'raidsOn' | 'notes'>, extras?: Extras) {
  const { clan, seed, day, fightsLeft, fightNo, raidNo, fight } = state;
  return {
    clan, seed, day, fightsLeft, fightNo, raidNo, fight: fight ? publicFight(fight) : null, settings, news: loaded.news,
    raidsOn: loaded.raidsOn ?? false, notes: loaded.notes ?? [],
    fame: extras?.fame ?? 0, season: extras?.settings.season ?? 1, fightsPerDay: extras?.settings.fightsPerDay ?? CONFIG.fightsPerDay,
    achievements: extras?.achievements ?? [],
    clock: readClock(extras?.clock),
  };
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleClans(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as { requestId?: unknown; action?: unknown } | null;
    const action = body ? parseAction(body.action) : null;
    if (!body || typeof body.requestId !== 'string' || !UUID.test(body.requestId) || !action) {
      // Logs say what was wrong, never who sent it.
      console.warn('clans: refused a request that could not be read');
      return reply(400, { error: "That couldn't be read." });
    }
    const requestId = body.requestId.toLowerCase();
    const today = nzDayNumber(services.now());
    let extras = await services.extras(player);
    if (!extras.ok) return extras.why === 'busy' ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
    // The teacher's settings, read fresh for this request. A fight that is already open keeps the ones it started with.
    const settings = readPracticalSettings(extras.value.settings);
    const fightsPerDay = Number.isInteger(extras.value.settings.fightsPerDay) ? extras.value.settings.fightsPerDay : CONFIG.fightsPerDay;
    // Made-up hero names only when the teacher has switched them on (an older database without the switch means off).
    const typedNames = extras.value.settings.typedNames === true;
    // Only a ladder fight's start needs the child's maths. If it can't be read the fight is an old-style one (the rules decide).
    const clock: SeasonClock | null = readClock(extras.value.clock);
    const maths = action.type === 'fightStart' && action.ladder ? await services.mathsContext(player) : undefined;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const loaded = await services.load(player, requestId);
      if (!loaded.ok) return loaded.why === 'busy' ? reply(503, { error: "We couldn't reach your clan just now." }) : reply(400, { error: "That couldn't be read." });
      const { seed, version, state, replay, enabled } = loaded.value;
      if (!enabled) return reply(403, { error: 'Clan Quest is not switched on yet.', off: true });
      const shown = (s: ServerState, from: Pick<Loaded, 'news' | 'raidsOn' | 'notes'> = loaded.value) => publicState(s, settings, from, extras.ok ? extras.value : undefined);

      // Done before: the same answer, and the clan as it is now.
      if (replay) return reply(200, { ok: true, replayed: true, seed, state: state && shown(state), result: replay });

      // groupVillage is only read the first time an old save is converted to "My Village".
      const ctx = { seed, today, settings, maths, fightsPerDay, groupVillage: loaded.value.groupVillage ?? null, self: loaded.value.self ?? undefined, raidsOn: loaded.value.raidsOn ?? false, typedNames, clock };
      let target: LoadedTarget = null;
      if (state && action.type === 'raidTargets') {
        const mates = await services.mates(player);
        if (!mates.ok) return mates.why === 'busy' ? reply(503, { error: "We couldn't reach your village just now." }) : reply(400, { error: "That couldn't be read." });
        Object.assign(ctx, { mates: mates.value });
      }
      if (state && action.type === 'raidClass') {
        const found = await services.target(player, action.target);
        if (!found.ok) return found.why === 'busy' ? reply(503, { error: "We couldn't reach your village just now." }) : reply(400, { error: "That couldn't be read." });
        target = found.value;
        Object.assign(ctx, { target });
      }

      const applied: Applied = applyAction(state, action, ctx);
      if (!applied.ok) {
        // Refused: nothing is saved. The browser is shown the clan as it should be (after the night's rest, if a new day began).
        const current = state && applyAction(state, { type: 'load' }, ctx);
        return reply(200, { ok: false, why: applied.why, say: applied.say, seed, state: current && current.ok && current.state ? shown(current.state) : null });
      }
      const effects: Effects = applied.effects ?? {};

      if (!applied.changed || !applied.state) {
        // Nothing to save.
        return reply(200, { ok: true, replayed: false, seed, state: applied.state && shown(applied.state), result: applied.result, ...(applied.newSeason ? { newSeason: true } : {}) });
      }

      const saved = effects.raid
        ? target
          ? await services.saveRaid(player, version, { targetId: target.id, targetVersion: target.version, empire: effects.raid.empire, gold: effects.raid.gold, news: effects.raid.news, note: effects.raid.note }, requestId, applied.state, applied.result)
          : ({ ok: false, why: 'refused' } as const)
        : await services.save(player, version, requestId, action.type, applied.state, applied.result);
      if (!saved.ok) return saved.why === 'busy' ? reply(503, { error: "We couldn't save your clan just now." }) : reply(400, { error: "That couldn't be saved." });
      if (saved.value.status === 'saved') {
        // The maths answers go in the teacher's private records (a wrong answer is kept too; none of this ever blocks).
        if (effects.answers?.length) {
          const at = services.now();
          const answers = effects.answers.map((a): FactAnswer => ({ key: a.key, correct: a.correct, ms: UNTIMED_MS, at }));
          await services.recordAnswers(player, requestId, answers);
        }
        if (effects.ladder?.answers.length) {
          const at = services.now();
          await services.recordLadderAnswers(player, effects.ladder.once, effects.ladder.answers.map((a): FactAnswer => ({ ...a, at })));
        }
        // The database has added any fame, points and achievements in the same save: ask again for the new ones.
        const fresh = await services.extras(player);
        if (fresh.ok) extras = fresh;
        // A raid wrote a line of news: ask again so the browser sees it.
        let latest: Pick<Loaded, 'news' | 'raidsOn' | 'notes'> = loaded.value;
        if (applied.result.type === 'raidClass') {
          const again = await services.load(player, '00000000-0000-4000-8000-000000000000');
          if (again.ok) latest = again.value;
        }
        return reply(200, { ok: true, replayed: false, seed, state: shown(applied.state, latest), result: applied.result, ...(applied.newSeason ? { newSeason: true } : {}) });
      }
      // 'duplicate' or 'stale': another copy of this request, or another request, saved first. Load again.
    }
    return reply(409, { error: 'Your clan was busy. Please try that again.' });
  };
}
