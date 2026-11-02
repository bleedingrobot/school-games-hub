/**
 * Story quests and the notice board's daily jobs (docs/MONSTERS-QUESTS-PLAN.md section 2). The quests
 * are data (QUESTS, JOB_POOL): EASY TO EDIT. The functions are pure: they take the quest part of a
 * save and something that happened, and give back a new one, never changing what they were given.
 *
 * Giver and trainer ids are map thing ids ("<map>:<name>"); Q.4 puts these people on the maps.
 */
import type { Bag } from '../engine';
import { speciesOf } from '../monsterBook';
import type { Monster } from '../rules';
import { TYPES, type TypeId } from '../types';
import { addBits, bitsForWin, hasBits, takeBits } from './bits';
import type { Bits, Egg, ProgressEvent, Quest, QuestSave, Reward, Task } from './types';

export const QUESTS: readonly Quest[] = [
  {
    id: 'kauri', title: 'The lost seed pods', giver: 'kauri-bush:Hermit', area: 1,
    steps: [
      { do: 'solve', id: 'kauri-seeds', hint: 'Find the 3 seed pods hidden in Kauri Bush' },
      { do: 'catch', type: 'leaf', hint: 'Catch a Leaf monster for the Hermit’s garden' },
      { do: 'talk', person: 'kauri-bush:Hermit', hint: 'Go back to the Hermit in Kauri Bush' },
    ],
    reward: { egg: 'leafy', items: { ball: 5 } },
  },
  {
    id: 'shell', title: 'Clear the rock pools', giver: 'shell-beach:Hine', area: 2,
    steps: [
      { do: 'win', area: 2, count: 3, hint: 'Win {left} more battles on Shell Beach' },
      { do: 'solve', id: 'shell-stones', hint: 'Cross the stepping stones in the rock pool' },
      { do: 'show', person: 'shell-beach:Hine', type: 'water', level: 12, hint: 'Show Hine a Water monster at level 12 or more' },
    ],
    reward: { egg: 'water', flag: 'part:lifeguard' },
  },
  {
    id: 'fire', title: 'The miner’s lanterns', giver: 'fire-mountain:Old Kui', area: 3,
    steps: [
      { do: 'bring', person: 'fire-mountain:Old Kui', type: 'fire', count: 5, hint: 'Bring 5 embers to Old Kui on Fire Mountain' },
      { do: 'solve', id: 'fire-lanterns', hint: 'Light the lanterns in the lava tube in the right order' },
      { do: 'talk', person: 'fire-mountain:Old Kui', hint: 'Tell Old Kui the lanterns are lit' },
    ],
    reward: { flag: 'part:miner', items: { 'super-potion': 2 } },
  },
  {
    id: 'snow', title: 'The warden’s hut', giver: 'snowy-peaks:Ranger Fern', area: 4,
    steps: [
      { do: 'solve', id: 'snow-slide', hint: 'Find the signpost by the snowy path and slide across the ice to the chest' },
      { do: 'catch', type: 'ice', hint: 'Catch an Ice monster on Snowy Peaks' },
      { do: 'bring', person: 'snowy-peaks:Ranger Fern', type: 'ice', count: 5, hint: 'Bring 5 frost crystals to Ranger Fern' },
    ],
    reward: { egg: 'cold' },
  },
  {
    id: 'caves', title: 'The lost torch', giver: 'glowworm-caves:Glow Gran', area: 5,
    steps: [
      { do: 'solve', id: 'cave-count', hint: 'Count the glowworm groups and tell the stone door' },
      { do: 'visit', map: 'glowworm-caves', spot: 'torch', hint: 'Find the lost torch deep in the caves' },
      { do: 'talk', person: 'glowworm-caves:Glow Gran', hint: 'Take the torch back to Glow Gran' },
    ],
    reward: { flag: 'part:cave-guide', items: { 'great-ball': 2 } },
  },
  {
    id: 'harbour', title: 'The busy wharf', giver: 'harbour-city:Captain Tui', area: 6,
    steps: [
      { do: 'solve', id: 'wharf-crates', hint: 'Push the crates off the wharf path' },
      { do: 'win', area: 6, trainer: true, count: 3, hint: 'Beat {left} more trainers in Harbour City' },
      { do: 'talk', person: 'harbour-city:Captain Tui', hint: 'Go back to Captain Tui' },
    ],
    reward: { egg: 'stony' },
  },
  {
    id: 'finale', title: 'The Teacher’s big question', giver: 'harbour-town:Teacher', area: 0, badges: 6,
    needs: ['woke:snorumble', 'woke:drowsea', 'woke:yawnberg'],
    steps: [
      { do: 'talk', person: 'harbour-town:Teacher', hint: 'Hatch an egg of each kind, then see the Teacher' },
    ],
    reward: { flag: 'finale-egg' },
  },
];

const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const questById = (id: string) => QUEST_BY_ID.get(id);

/** The finale's talk step only counts once an egg of every kind has hatched. */
export const FINALE_NEEDS = ['hatched:leafy', 'hatched:water', 'hatched:warm', 'hatched:cold', 'hatched:glowing', 'hatched:stony'];

/** Can this quest be started now: in an area you can reach, its badges and flags held, not started or done. */
export function canStart(q: QuestSave, quest: Quest, badges: number): boolean {
  if (q.flags.includes(`quest-done:${quest.id}`) || q.quests[quest.id]) return false;
  if (badges < (quest.badges ?? Math.max(0, quest.area - 1))) return false;
  return (quest.needs ?? []).every((f) => q.flags.includes(f));
}

export function startQuest(q: QuestSave, id: string): QuestSave {
  return skipSolved({ ...q, quests: { ...q.quests, [id]: { step: 0, n: 0 } } }, id);
}

/** A puzzle solved before its quest got there still counts: moves past "solve" steps already done (never the last step). */
function skipSolved(q: QuestSave, id: string): QuestSave {
  const steps = questById(id)!.steps;
  let st = q.quests[id];
  while (st.step < steps.length - 1 && steps[st.step].do === 'solve' && q.flags.includes(`solved:${steps[st.step].id}`)) st = { step: st.step + 1, n: 0 };
  return st === q.quests[id] ? q : { ...q, quests: { ...q.quests, [id]: st } };
}

const countOf = (t: Task) => t.count ?? 1;

/** Does this event count towards this task? (bring, show and talk are handled when talking: see `talkTo`.) */
function counts(t: Task, ev: ProgressEvent): number {
  switch (t.do) {
    case 'catch':
      return ev.kind === 'caught' && (!t.type || speciesOf(ev.species).type === t.type) && (!t.area || ev.area === t.area) ? 1 : 0;
    case 'win':
      return ev.kind === 'won' && (!t.area || ev.area === t.area) && (!t.map || ev.map === t.map) && (!t.trainer || ev.trainer !== undefined) ? 1 : 0;
    case 'beat':
      return ev.kind === 'won' && ev.trainer === t.id ? 1 : 0;
    case 'visit':
      return ev.kind === 'visit' && ev.map === t.map && ev.spot.startsWith(t.spot ?? '') ? 1 : 0;
    case 'solve':
      return ev.kind === 'solved' && ev.id === t.id ? 1 : 0;
    case 'talk':
      return ev.kind === 'talk' && ev.person === t.person ? 1 : 0;
    default:
      return 0;
  }
}

export interface Given {
  /** Quests finished, and jobs paid, by this event. */
  finished: string[];
  jobs: number[];
  items: Bag;
  bits: Bits;
  eggs: string[];
}

const nothingGiven = (): Given => ({ finished: [], jobs: [], items: {}, bits: {}, eggs: [] });

/** Moves a quest on by one step, or finishes it (setting its flag); returns whether it finished. */
function advance(q: QuestSave, id: string): boolean {
  const quest = questById(id)!;
  const st = q.quests[id];
  if (st.step + 1 >= quest.steps.length) {
    const { [id]: _, ...rest } = q.quests;
    q.quests = rest;
    q.flags = [...q.flags, `quest-done:${id}`];
    return true;
  }
  q.quests = skipSolved({ ...q, quests: { ...q.quests, [id]: { step: st.step + 1, n: 0 } } }, id).quests;
  return false;
}

/** Gives a reward: items and bits go to the caller's bag; an egg is rolled by the caller (see eggs.ts); a flag is set. */
function give(q: QuestSave, r: Reward, out: Given, source: string) {
  if (r.items) for (const [k, v] of Object.entries(r.items)) out.items[k as keyof Bag] = (out.items[k as keyof Bag] ?? 0) + (v ?? 0);
  if (r.bits) {
    q.bits = addBits(q.bits, r.bits);
    out.bits = addBits(out.bits, r.bits);
  }
  if (r.egg) out.eggs.push(`${source}:${r.egg}`);
  if (r.flag && !q.flags.includes(r.flag)) q.flags = [...q.flags, r.flag];
}

/**
 * Counts something that happened towards the started quests and today's jobs. A won battle also
 * gives its bits. Returns the new quest save and what was given (items for the bag, eggs to roll).
 */
export function record(prev: QuestSave, ev: ProgressEvent, day?: string, ctx?: JobContext & { player: string }): { q: QuestSave; given: Given } {
  const q: QuestSave = { ...prev };
  const out = nothingGiven();
  if (ev.kind === 'won') {
    const bits = bitsForWin(ev.foes, ev.trainer !== undefined);
    q.bits = addBits(q.bits, bits);
    out.bits = addBits(out.bits, bits);
  }
  for (const id of Object.keys(prev.quests)) {
    const quest = questById(id);
    if (!quest) continue;
    const st = q.quests[id];
    const task = quest.steps[st.step];
    if (!task || task.do === 'talk' || !counts(task, ev)) continue;
    const n = st.n + 1;
    if (n >= countOf(task)) {
      if (advance(q, id)) {
        out.finished.push(id);
        give(q, quest.reward, out, `quest:${id}`);
      }
    } else q.quests = { ...q.quests, [id]: { step: st.step, n } };
  }
  if (day && ctx) jobsRecord(q, ev, day, ctx, out);
  return { q, given: out };
}

/**
 * Talking to a person: starts their quest, or hands over bits, shows a monster, or finishes a talk
 * step. `team` is checked for show steps. Returns what changed, and what the person should say about it.
 */
export function talkTo(prev: QuestSave, person: string, team: readonly Monster[], badges: number): { q: QuestSave; given: Given; said: 'started' | 'advanced' | 'finished' | 'need' | 'nothing'; quest?: Quest } {
  let q: QuestSave = { ...prev };
  const out = nothingGiven();
  for (const quest of QUESTS) {
    const st = q.quests[quest.id];
    if (!st) {
      if (quest.giver === person && canStart(q, quest, badges)) return { q: startQuest(q, quest.id), given: out, said: 'started', quest };
      continue;
    }
    const task = quest.steps[st.step];
    if (task.person !== person) continue;
    let ok = false;
    if (task.do === 'talk') ok = quest.id !== 'finale' || FINALE_NEEDS.every((f) => q.flags.includes(f));
    else if (task.do === 'bring') {
      const need: Bits = { [task.type as TypeId]: countOf(task) };
      if (hasBits(q.bits, need)) {
        q = { ...q, bits: takeBits(q.bits, need) };
        ok = true;
      }
    } else if (task.do === 'show') ok = team.some((m) => speciesOf(m.species).type === task.type && m.level >= (task.level ?? 1));
    if (!ok) return { q, given: out, said: 'need', quest };
    const done = advance(q, quest.id);
    if (done) {
      out.finished.push(quest.id);
      give(q, quest.reward, out, `quest:${quest.id}`);
    }
    return { q, given: out, said: done ? 'finished' : 'advanced', quest };
  }
  return { q, given: out, said: 'nothing' };
}

// ── The notice board ────────────────────────────────────────────────────────────────

export interface Job extends Task {
  reward: Reward;
}

/** What the board needs to know to pick fair jobs: which areas the pupil can reach. */
export interface JobContext {
  /** 1 + badges, at most 6. */
  maxArea: number;
}

/** EASY TO EDIT: the jobs the board picks from. `{area}` jobs are filled in with an area the pupil can reach; `{type}` with a type. */
const JOB_POOL = {
  battle: [
    (area: number): Job => ({ do: 'win', area, count: 3, hint: `Notice board: win {left} more battles in ${AREA_NAME[area]}`, reward: { items: { ball: 2 } } }),
    (_area: number, type: TypeId): Job => ({ do: 'catch', type, count: 2, hint: `Notice board: catch {left} more ${TYPE_NAME[type]} monsters`, reward: { items: { potion: 2 } } }),
    (area: number): Job => ({ do: 'win', area, trainer: true, hint: `Notice board: beat a trainer in ${AREA_NAME[area]}`, reward: { items: { 'great-ball': 1 } } }),
  ],
  quiet: [
    (_area: number, type: TypeId): Job => ({ do: 'bring', person: 'harbour-town:Notice Board', type, count: 3, hint: `Notice board: bring 3 ${TYPE_BITS[type]} to the board`, reward: { items: { 'super-potion': 1 } } }),
    // The world sends { kind: 'visit', spot: 'enter' } when you arrive on a map.
    (area: number): Job => ({ do: 'visit', map: AREA_MAP[area], spot: 'enter', hint: `Notice board: visit ${AREA_NAME[area]}`, reward: { bits: { leaf: 2, water: 2 } } }),
  ],
};

const AREA_NAME: Record<number, string> = { 1: 'Kauri Bush', 2: 'Shell Beach', 3: 'Fire Mountain', 4: 'Snowy Peaks', 5: 'Glowworm Caves', 6: 'Harbour City' };
const AREA_MAP: Record<number, string> = { 1: 'kauri-bush', 2: 'shell-beach', 3: 'fire-mountain', 4: 'snowy-peaks', 5: 'glowworm-caves', 6: 'harbour-city' };
const TYPE_NAME: Record<TypeId, string> = { leaf: 'Leaf', water: 'Water', fire: 'Fire', ice: 'Ice', spark: 'Spark', stone: 'Stone' };
const TYPE_BITS: Record<TypeId, string> = { leaf: 'kawakawa leaves', water: 'shells', fire: 'embers', ice: 'frost crystals', spark: 'glow dust', stone: 'pebbles' };

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Today's three jobs for a pupil: two battle jobs and one that needs no battle, in areas they can
 * reach. The same day, pupil and areas always give the same jobs, so the server can check them.
 */
export function jobsFor(day: string, player: string, ctx: JobContext): Job[] {
  const h = (salt: string) => hash(`${day}:${player}:${salt}`);
  const areas = Array.from({ length: Math.min(6, Math.max(1, ctx.maxArea)) }, (_, i) => i + 1);
  const types = areas.map((a) => TYPES[a - 1]);
  const pick = <T,>(list: readonly T[], salt: string) => list[h(salt) % list.length];
  const make = (maker: (area: number, type: TypeId) => Job, salt: string) => maker(pick(areas, `${salt}:a`), pick(types, `${salt}:t`));
  const first = h('b1') % JOB_POOL.battle.length;
  const second = (first + 1 + (h('b2') % (JOB_POOL.battle.length - 1))) % JOB_POOL.battle.length;
  return [make(JOB_POOL.battle[first], 'b1'), make(JOB_POOL.battle[second], 'b2'), make(pick(JOB_POOL.quiet, 'q'), 'q')];
}

/** The board for today: kept if it is today's, otherwise a fresh one. */
export function boardFor(q: QuestSave, day: string): QuestSave {
  return q.board?.day === day ? q : { ...q, board: { day, n: [0, 0, 0], paid: [] } };
}

function jobsRecord(q: QuestSave, ev: ProgressEvent, day: string, ctx: JobContext & { player?: string }, out: Given) {
  if (!ctx.player) return;
  const fresh = boardFor(q, day);
  q.board = fresh.board;
  const jobs = jobsFor(day, ctx.player, ctx);
  const board = { ...q.board!, n: [...q.board!.n], paid: [...q.board!.paid] };
  jobs.forEach((job, i) => {
    if (board.paid.includes(i) || job.do === 'bring' || !counts(job, ev)) return;
    board.n[i] += 1;
    if (board.n[i] >= countOf(job)) {
      board.paid.push(i);
      out.jobs.push(i);
      give(q, job.reward, out, `job:${day}:${i}`);
    }
  });
  q.board = board;
}

/** Handing bits to the board for today's "bring" job. */
export function bringToBoard(prev: QuestSave, day: string, ctx: JobContext & { player: string }): { q: QuestSave; given: Given } {
  const q = boardFor(prev, day);
  const out = nothingGiven();
  const jobs = jobsFor(day, ctx.player, ctx);
  const i = jobs.findIndex((j) => j.do === 'bring');
  const job = jobs[i];
  if (i < 0 || q.board!.paid.includes(i)) return { q, given: out };
  const need: Bits = { [job.type as TypeId]: countOf(job) };
  if (!hasBits(q.bits, need)) return { q, given: out };
  const next: QuestSave = { ...q, bits: takeBits(q.bits, need), board: { ...q.board!, paid: [...q.board!.paid, i] } };
  out.jobs.push(i);
  give(next, job.reward, out, `job:${day}:${i}`);
  return { q: next, given: out };
}

/** Story steps finished so far and jobs paid today: what the server pays points for (2 and 1, inside the 40 a day). */
export function questPoints(before: QuestSave, after: QuestSave): number {
  const steps = (q: QuestSave) => q.flags.filter((f) => f.startsWith('quest-done:')).reduce((n, f) => n + (questById(f.slice(11))?.steps.length ?? 0), 0) + Object.values(q.quests).reduce((n, s) => n + s.step, 0);
  const paid = (q: QuestSave, day?: string) => (q.board && q.board.day === day ? q.board.paid.length : 0);
  return 2 * Math.max(0, steps(after) - steps(before)) + Math.max(0, paid(after, after.board?.day) - paid(before, after.board?.day));
}

export type { Egg };
