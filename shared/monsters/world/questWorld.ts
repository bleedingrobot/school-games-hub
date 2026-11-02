/**
 * Where quests meet the world (docs/MONSTERS-QUESTS-PLAN.md, stage Q.4): what people with a quest
 * say, what a battle counts for, eggs given as rewards, and today's weather for the long grass.
 * Pure, like world.ts: every function gives back a new `WorldState`.
 */
import { formAt, RARE_FAMILIES, speciesOf } from '../monsterBook';
import { TYPE_LABEL } from '../types';
import type { Monster } from '../rules';
import { addToBag } from './rewards';
import { Dice } from './rng';
import { addBits, canMake, describeBits, RECIPES, takeBits } from '../quests/bits';
import { addEgg, daysHad, daysNeeded, EGG_LABEL, EGGS, findEgg, hatch, HATCH_SPOTS, isReady, warmEgg } from '../quests/eggs';
import { afterGiant, canWake, giantById, GIANTS, isAwake, type Giant } from '../quests/giants';
import { podFlag, podsFound, puzzleById } from '../quests/puzzles';
import { bringToBoard, canStart, jobsFor, questById, QUESTS, record, talkTo, type Given, type Job } from '../quests/quests';
import { emptyQuestSave, type EggKind, type ProgressEvent, type QuestSave } from '../quests/types';
import { spottedToday, WEATHER, WEATHER_LABEL, weatherFor, type Today } from './weather';
import { AREAS } from './areas';
import type { GameMap, Thing, WorldState } from './types';

/** What a game knows about today that the save doesn't: the NZ day, the pupil, and the play days the database has counted. */
export interface QuestOptions {
  day?: string;
  player?: string;
  playDays?: number;
}

export const questOf = (state: WorldState): QuestSave => state.quest ?? emptyQuestSave();

/** What you hold for opening the way: badges, and quest flags (a woken giant). */
export const keysOf = (state: Pick<WorldState, 'badges' | 'quest'>): string[] => (state.quest?.flags.length ? [...state.badges, ...state.quest.flags] : state.badges);

const maxArea = (state: WorldState) => Math.min(6, state.badges.length + 1);

/** Gives what a quest or job handed out: items into the bag, eggs into the basket (or kept for later if it is full). */
function applyGiven(state: WorldState, q: QuestSave, given: Given, opts: QuestOptions): { state: WorldState; lines: string[] } {
  const lines: string[] = [];
  let next: WorldState = { ...state, quest: q };
  if (Object.keys(given.items).length) next = { ...next, bag: addToBag(next.bag, given.items) };
  for (const ref of given.eggs) next = giveEgg(next, ref, opts, lines);
  return { state: next, lines };
}

/** An egg from a reward ("quest:shell:water"): rolled with the world's dice, so it can't be re-rolled by reloading. */
function giveEgg(state: WorldState, ref: string, opts: QuestOptions, lines: string[]): WorldState {
  const kind = ref.slice(ref.lastIndexOf(':') + 1) as EggKind;
  const q = questOf(state);
  if (q.flags.includes(`egg:${ref}`)) return state;
  const dice = new Dice(state.seed);
  const egg = findEgg(ref, kind, opts.playDays ?? 0, () => dice.next());
  const added = addEgg(q, egg);
  if (!added.added) {
    // A full basket: the egg waits (the flag says it is owed) and comes once there is room.
    const owed = `owed:${ref}`;
    lines.push(`Your egg basket is full! The ${EGG_LABEL[kind]} will be waiting for you once there is room.`);
    return { ...state, seed: dice.seed, quest: q.flags.includes(owed) ? q : { ...q, flags: [...q.flags, owed] } };
  }
  lines.push(`You got a ${EGG_LABEL[kind]}! Keep playing on different days and it will be ready to hatch.`);
  return { ...state, seed: dice.seed, quest: added.q };
}

/** Eggs that were owed while the basket was full, given now if there is room. */
export function giveOwedEggs(state: WorldState, opts: QuestOptions): { state: WorldState; lines: string[] } {
  const lines: string[] = [];
  let next = state;
  for (const f of questOf(state).flags) {
    if (!f.startsWith('owed:')) continue;
    const ref = f.slice(5);
    if (!questOf(next).flags.includes(`egg:${ref}`) && questOf(next).eggs.length < 3) next = giveEgg(next, ref, opts, lines);
  }
  return { state: next, lines };
}

/** Counts something that happened, and gives any rewards. */
export function recordEvent(state: WorldState, ev: ProgressEvent, opts: QuestOptions): { state: WorldState; lines: string[] } {
  const ctx = opts.player ? { maxArea: maxArea(state), player: opts.player } : undefined;
  const { q, given } = record(questOf(state), ev, opts.day, ctx);
  // Nothing counted: keep the state as it was (a game with no quest data stays without it).
  if (JSON.stringify(q) === JSON.stringify(questOf(state))) return { state, lines: [] };
  const out = applyGiven(state, q, given, opts);
  for (const id of given.finished) out.lines.unshift(`Quest complete: ${questById(id)!.title}!`);
  if (given.jobs.length) out.lines.push(given.jobs.length === 1 ? 'You finished a notice board job!' : 'You finished notice board jobs!');
  if (Object.keys(given.bits).length) out.lines.push(`You collected ${describeBits(given.bits)}.`);
  return out;
}

/** What a finished battle counts for: a win (with its bits) or a catch. */
export function battleEvents(map: GameMap, outcome: string, foes: readonly string[], trainer?: Thing, caught?: Monster): ProgressEvent[] {
  const area = Math.max(map.area, 0);
  if (outcome === 'caught' && caught) return [{ kind: 'caught', map: map.id, area, species: caught.species }];
  if (outcome === 'won') return [{ kind: 'won', map: map.id, area, foes: [...foes], ...(trainer ? { trainer: trainer.id } : {}) }];
  return [];
}

/** After a giant battle: winning or catching opens the way for good. */
export function finishGiant(state: WorldState, giant: Giant, outcome: 'won' | 'caught' | 'lost' | 'ran'): WorldState {
  const q = afterGiant(questOf(state), giant, outcome);
  return q === questOf(state) ? state : { ...state, quest: q };
}

export interface QuestTalk {
  state: WorldState;
  pages: string[];
  /** A giant to battle once the talking is done. */
  giant?: Giant;
}

/** Does this person have anything to do with a quest? */
export const hasQuest = (person: string) => QUESTS.some((q) => q.giver === person || q.steps.some((s) => s.person === person));

/** Talking to a person who gives or takes part in a quest. Null if they have nothing quest-y to say now. */
export function questTalk(state: WorldState, person: Thing, opts: QuestOptions): QuestTalk | null {
  if (!hasQuest(person.id)) return null;
  const res = talkTo(questOf(state), person.id, state.team, state.badges.length);
  if (res.said === 'nothing') return null;
  const quest = res.quest!;
  const st = res.q.quests[quest.id];
  const nextHint = st ? quest.steps[st.step].hint.replace('{left}', String((quest.steps[st.step].count ?? 1) - st.n)) : '';
  const out = applyGiven(state, res.q, res.given, opts);
  const pages: string[] = [];
  if (res.said === 'started') pages.push(`Can you help me? ${quest.title}!`, `Here is what to do: ${nextHint}.`);
  else if (res.said === 'need') pages.push(`Not yet! ${quest.steps[questOf(state).quests[quest.id].step].hint.replace('{left}', '…')}.`);
  else if (res.said === 'advanced') pages.push('Thank you!', `Next: ${nextHint}.`);
  else pages.push(`You did it! ${quest.title}: all done. Thank you so much!`);
  return { state: out.state, pages: [...pages, ...out.lines] };
}

/** Talking to a sleeping giant: what it looks like, and a battle if you have its wake-up item. */
export function giantTalk(state: WorldState, thing: Thing): QuestTalk {
  const giant = giantById(thing.giant ?? '')!;
  const q = questOf(state);
  if (isAwake(q, giant)) return { state, pages: ['The way is clear now. The giant has moved off.'] };
  if (canWake(q, giant, state.badges)) return { state, pages: [giant.asleep, `You use the ${giant.itemName}…`, `${speciesOf(giant.species).name} wakes up with a huge yawn. It looks grumpy!`], giant };
  const extra = state.badges.includes(giant.badge) ? `The Tinker in Harbour Town could make a ${giant.itemName}.` : 'Maybe come back when you are a stronger trainer.';
  return { state, pages: [giant.asleep, extra] };
}

/** Today in one area: its weather, and the spotted family if it is here today. */
export function todayIn(map: GameMap, maps: Readonly<Record<string, GameMap>>, day?: string): Today | undefined {
  if (!day || map.area < 1) return undefined;
  const spotted = spottedToday(day, familyAreas(maps));
  return { weather: weatherFor(day, map.area), ...(spotted.area === map.area ? { spotted: spotted.family } : {}) };
}

let areasCache: { maps: unknown; areas: Record<string, number> } | undefined;
/** The first area each family turns up in the wild. */
function familyAreas(maps: Readonly<Record<string, GameMap>>): Record<string, number> {
  if (areasCache?.maps === maps) return areasCache.areas;
  const areas: Record<string, number> = {};
  for (const m of Object.values(maps)) for (const e of m.wild) if (m.area > 0 && (areas[e] === undefined || m.area < areas[e])) areas[e] = m.area;
  areasCache = { maps, areas };
  return areas;
}

// ── The Tinker, the notice board and the egg basket (the menu screens call these) ──────────────

export type QuestResult = { ok: true; state: WorldState; message: string } | { ok: false; why: string };

/** Makes something at the Tinker. An egg warmer is used straight away on the first egg that isn't warmed yet. */
export function make(state: WorldState, recipeId: string): QuestResult {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, why: 'The Tinker does not know how to make that.' };
  const q = questOf(state);
  if (recipe.warmer && !q.eggs.some((e) => !e.warmed)) return { ok: false, why: 'You have no egg that needs warming.' };
  const can = canMake(q, recipe);
  if ('why' in can) return { ok: false, why: can.why };
  let next: QuestSave = { ...q, bits: takeBits(q.bits, can.cost) };
  let message = `The Tinker made you a ${recipe.name}!`;
  if (recipe.flag) next = { ...next, flags: [...next.flags, recipe.flag] };
  if (recipe.warmer) {
    const egg = next.eggs.find((e) => !e.warmed)!;
    next = warmEgg(next, egg.id);
    message = `The Tinker warmed your ${EGG_LABEL[egg.kind]}. It needs one day less now!`;
  }
  return { ok: true, state: { ...state, quest: next, ...(recipe.items ? { bag: addToBag(state.bag, recipe.items) } : {}) }, message };
}

/** Today's jobs, with how far through each one is. */
export function boardToday(state: WorldState, opts: QuestOptions): { job: Job; n: number; done: boolean }[] {
  if (!opts.day || !opts.player) return [];
  const q = questOf(state);
  const board = q.board?.day === opts.day ? q.board : undefined;
  return jobsFor(opts.day, opts.player, { maxArea: maxArea(state) }).map((job, i) => ({ job, n: board?.n[i] ?? 0, done: board?.paid.includes(i) ?? false }));
}

/** Hands bits in at the board for today's "bring" job. */
export function handIn(state: WorldState, opts: QuestOptions): QuestResult {
  if (!opts.day || !opts.player) return { ok: false, why: 'The board is not ready yet.' };
  const { q, given } = bringToBoard(questOf(state), opts.day, { maxArea: maxArea(state), player: opts.player });
  if (!given.jobs.length) return { ok: false, why: 'You don’t have enough bits for that job yet.' };
  const out = applyGiven(state, q, given, opts);
  return { ok: true, state: out.state, message: ['Job done! Thank you.', ...out.lines].join(' ') };
}

/** The hatching spot you are standing on or right next to, if any. */
export function spotHere(state: WorldState, map: GameMap): string | undefined {
  return map.spots.find((s) => Math.abs(s.x - state.x) + Math.abs(s.y - state.y) <= 1 && Object.values(HATCH_SPOTS).some((h) => h.map === map.id && h.spot === s.name))?.name;
}

/** Hatches an egg here: the monster joins the team, or the box if the team is full. */
export function hatchHere(state: WorldState, map: GameMap, eggId: string, opts: QuestOptions): QuestResult {
  const egg = questOf(state).eggs.find((e) => e.id === eggId);
  if (!egg) return { ok: false, why: 'That egg isn’t in your basket.' };
  const playDays = opts.playDays ?? 0;
  if (!isReady(egg, playDays)) return { ok: false, why: `This egg needs ${daysNeeded(egg) - daysHad(egg, playDays)} more days of play.` };
  const spot = spotHere(state, map);
  const out = spot ? hatch(questOf(state), eggId, playDays, { map: map.id, spot }) : null;
  if (!out) return { ok: false, why: `This egg wants ${HATCH_SPOTS[egg.kind].wants}. Take it to ${HATCH_SPOTS[egg.kind].place}.` };
  const toTeam = state.team.length < 6;
  let next: WorldState = { ...state, quest: out.q, team: toTeam ? [...state.team, out.monster] : state.team, box: toTeam ? state.box : [...state.box, out.monster] };
  const owed = giveOwedEggs(next, opts);
  next = owed.state;
  const name = speciesOf(out.monster.species).name;
  return { ok: true, state: next, message: [`Your egg hatched! It’s ${out.monster.shiny ? 'a shiny ' : ''}${name}! ${toTeam ? 'It joined your team.' : 'It went to your monster box.'}`, ...owed.lines].join(' ') };
}

/**
 * A puzzle solved (on its screen, or the last seed pod found): sets "solved:<id>" and gives its prize
 * the first time, and always counts for a quest step or a job that is waiting for it.
 */
export function solvePuzzle(state: WorldState, id: string, opts: QuestOptions): QuestResult {
  const p = puzzleById(id);
  if (!p) return { ok: false, why: 'There is no puzzle here.' };
  const q = questOf(state);
  const flag = `solved:${id}`;
  const lines: string[] = [];
  let next = state;
  if (!q.flags.includes(flag)) {
    next = { ...state, quest: { ...q, flags: [...q.flags, flag] } };
    if ('egg' in p.prize) next = giveEgg(next, `puzzle:${id}:${p.prize.egg}`, opts, lines);
    else {
      const bits = { [p.prize.bits]: p.prize.n };
      next = { ...next, quest: { ...questOf(next), bits: addBits(questOf(next).bits, bits) } };
      lines.push(`You found ${describeBits(bits)}.`);
    }
  }
  const counted = recordEvent(next, { kind: 'solved', id }, opts);
  return { ok: true, state: counted.state, message: ['Solved!', ...lines, ...counted.lines].join(' ') };
}

/** Searching a bush for a seed pod: each is found once, and the last one solves the puzzle. */
export function searchPod(state: WorldState, thing: Thing, opts: QuestOptions): { state: WorldState; pages: string[] } {
  const p = puzzleById(thing.puzzle ?? '');
  if (!p || p.kind !== 'pods') return { state, pages: thing.pages };
  const q = questOf(state);
  const flag = podFlag(p.id, thing.id);
  if (q.flags.includes(flag)) return { state, pages: ['You already searched here.'] };
  const found: WorldState = { ...state, quest: { ...q, flags: [...q.flags, flag] } };
  const n = podsFound(questOf(found).flags, p.id);
  if (n < p.count) return { state: found, pages: [...thing.pages, `You found a seed pod! That's ${n} of ${p.count}.`] };
  const solved = solvePuzzle(found, p.id, opts) as Extract<QuestResult, { ok: true }>;
  return { state: solved.state, pages: [...thing.pages, `You found the last seed pod! That's all ${p.count}.`, solved.message] };
}

/**
 * What an area's welcome sign says can still be done there, worked out fresh for this pupil: who
 * needs help, puzzles, seed pods, the sleeping giant, eggs that hatch here, chests, rare monsters and
 * today's weather. Two hints to a page, so a pupil taps through a few short pages.
 */
export function areaHints(state: WorldState, map: GameMap, maps: Readonly<Record<string, GameMap>>, opts: QuestOptions): string[] {
  const q = questOf(state);
  const hints: string[] = [];
  const quest = QUESTS.find((x) => x.giver.startsWith(`${map.id}:`));
  if (quest) {
    const name = quest.giver.split(':')[1];
    const who = ['Hermit', 'Teacher'].includes(name) ? `the ${name}` : name;
    const st = q.quests[quest.id];
    if (q.flags.includes(`quest-done:${quest.id}`)) hints.push(`You helped ${who}. Thank you!`);
    else if (st) {
      const task = quest.steps[st.step];
      hints.push(`Your quest here: ${task.hint.replace('{left}', String((task.count ?? 1) - st.n))}.`);
    } else if (canStart(q, quest, state.badges.length)) hints.push(`${who[0].toUpperCase()}${who.slice(1)} needs help. Go and talk to them!`);
  }
  for (const id of new Set(map.things.filter((t) => t.kind === 'puzzle').map((t) => t.puzzle!))) {
    const p = puzzleById(id)!;
    const solved = q.flags.includes(`solved:${id}`);
    if (p.kind === 'pods') hints.push(solved ? 'You found all the seed pods here.' : `Seed pods are hidden in the trees here. You have found ${podsFound(q.flags, id)} of ${p.count}.`);
    else hints.push(solved ? `You solved the ${p.title.toLowerCase()} here.` : `There is a puzzle to solve here: ${p.title.toLowerCase()}.`);
  }
  for (const g of GIANTS.filter((x) => x.map === map.id)) {
    const giant = speciesOf(g.species).name;
    if (isAwake(q, g)) hints.push(`${giant} is awake, so the way to ${maps[g.opens]?.name ?? 'the side path'} is open.`);
    else if (!state.badges.includes(g.badge)) hints.push(`A giant monster is asleep on a side path. Win the ${TYPE_LABEL[speciesOf(g.species).type]} badge first, then find a way to wake it.`);
    else hints.push(`A giant monster is asleep on a side path. Ask the Tinker in Harbour Town to make a ${g.itemName.toLowerCase()} to wake it.`);
  }
  for (const nest of map.things.filter((t) => t.kind === 'nest')) {
    const found = opts.day !== undefined && q.flags.includes(`nest:${nest.id}:${weekOf(opts.day)}`);
    hints.push(found ? 'You found this week’s egg in the nest here. A new one is laid next week.' : `There is an egg nest here. A new ${EGG_LABEL[nest.egg!]} is laid in it every week.`);
  }
  for (const [kind, spot] of Object.entries(HATCH_SPOTS)) if (spot.map === map.id) hints.push(`A ${EGG_LABEL[kind as EggKind]} that is ready hatches here, at ${spot.place.replace(/ in .*$/, '')}.`);
  const closed = map.things.filter((t) => t.kind === 'chest' && !state.chests.includes(t.id)).length;
  hints.push(closed ? `There ${closed === 1 ? 'is 1 chest' : `are ${closed} chests`} still to find here.` : 'You have opened every chest here.');
  if (map.wild.some((f) => RARE_FAMILIES[f] && !RARE_FAMILIES[f].giant)) hints.push('Rare monsters live here. Keep exploring the long grass!');
  const today = todayIn(map, maps, opts.day);
  if (today) {
    hints.push(`Today: ${WEATHER_LABEL[today.weather].toLowerCase()}, so ${TYPE_LABEL[WEATHER.brings[today.weather]]} monsters are out more.`);
    if (today.spotted) hints.push(`${speciesOf(formAt(today.spotted, 1)).name} has been spotted here today!`);
  }
  const pages: string[] = [];
  for (let i = 0; i < hints.length; i += 2) pages.push(hints.slice(i, i + 2).join(' '));
  return pages;
}

/** The week a NZ day is in (weeks start on a Monday), for the egg nests' one egg a week. */
export const weekOf = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) / 86_400_000 + 3) / 7);

/** Searching an egg nest: one egg a week each, kept for later in the week if the basket is full. */
export function searchNest(state: WorldState, thing: Thing, opts: QuestOptions): { state: WorldState; pages: string[] } {
  const kind = thing.egg!;
  const q = questOf(state);
  const week = opts.day ? weekOf(opts.day) : undefined;
  const flag = `nest:${thing.id}:${week}`;
  if (week === undefined || q.flags.includes(flag)) return { state, pages: [...thing.pages, 'The nest is empty. A new egg is laid here every week, so come back next week!'] };
  if (q.eggs.length >= EGGS.basket) return { state, pages: [...thing.pages, `There is a ${EGG_LABEL[kind]} in the nest, but your egg basket is full. Hatch an egg, then come back this week!`] };
  // Only this week's flag is kept for each nest.
  const flags = [...q.flags.filter((f) => !f.startsWith(`nest:${thing.id}:`)), flag];
  const lines: string[] = [];
  const next = giveEgg({ ...state, quest: { ...q, flags } }, `nest:${thing.id}:${week}:${kind}`, opts, lines);
  return { state: next, pages: [...thing.pages, ...lines] };
}

/** The "what next" line's last resort: where the next badge is won. */
export function badgeStep(state: WorldState): { text: string; target: { map: string } } | undefined {
  const next = AREAS.find((a) => !state.badges.includes(a.badge));
  if (!next) return undefined;
  return { text: `Win the ${TYPE_LABEL[next.type]} badge: beat the trainer at the top of the Tower in ${next.name}.`, target: { map: next.map } };
}
