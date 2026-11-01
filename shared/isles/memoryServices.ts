/**
 * Sky Isles' database jobs kept in memory, doing what the migration's functions do (one island a pupil, a turn played
 * once, a question marked once, one open race at a time, a race finished once). The server function's tests use it in
 * place of the database; the preview's trial backend (stage S.3) will save it in the browser.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { Island } from './engine';
import type { IslesServices, IslesSettings, QuestionSet, SavedIsland, StoredRace, TurnRecord } from './server';

export interface MemoryData {
  islands: Record<string, SavedIsland>;
  turns: (TurnRecord & { player: string; season: number })[];
  questions: (QuestionSet & { player: string })[];
  races: (StoredRace & { player: string; day: number; turn: number })[];
  nextRace: number;
}

export interface MemoryOptions {
  data?: MemoryData;
  settings?: () => IslesSettings;
  /** The pupil's maths (null: it can't be read). */
  maths?: (player: string) => MathsContext | null;
  now?: () => number;
  random?: () => number;
  /** Called after every change (the trial backend saves here). */
  changed?: (data: MemoryData) => void;
  /** Everything recorded or awarded, for tests. */
  log?: { answers: { player: string; once: string; answers: FactAnswer[] }[]; points: { player: string; points: number; once: string }[] };
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function memoryServices(options: MemoryOptions = {}): IslesServices & { data: MemoryData } {
  const data: MemoryData = options.data ?? { islands: {}, turns: [], questions: [], races: [], nextRace: 1 };
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const saved = () => options.changed?.(data);
  const givenPoints = new Set<string>();
  const strip = ({ player: _p, day: _d, turn: _t, ...race }: MemoryData['races'][number]): StoredRace => copy(race);

  return {
    data,
    now,
    random,
    randomHex: (bytes) => Array.from({ length: bytes }, () => Math.floor(random() * 256).toString(16).padStart(2, '0')).join(''),
    settings: async () => options.settings?.() ?? { enabled: true, races: true },
    mathsContext: async (player) => options.maths?.(player) ?? null,
    async load(player) {
      const mine = data.islands[player] ?? null;
      const open = data.races.find((r) => r.player === player && r.status === 'open');
      // A New Season clears the races, so every finished race is this season's.
      const seasonRaces = data.races.filter((r) => r.player === player && r.status === 'done').length;
      // The pretend class is everyone in memory.
      const sizes = Object.values(data.islands).flatMap((s) => (s.island ? [s.island.spots.length] : [])).sort((a, b) => a - b);
      const classMiddle = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
      return { saved: mine ? copy(mine) : null, classMiddle, openRace: open ? strip(open) : null, racesThisSeason: seasonRaces };
    },
    async start(player, seed, island: Island, day) {
      const mine = data.islands[player];
      if (mine?.island) return false;
      data.islands[player] = { seed, season: mine?.season ?? 1, version: (mine?.version ?? 0) + 1, day, island: copy(island), guideDone: mine?.guideDone ?? false };
      saved();
      return true;
    },
    async saveTurn(player, expectedVersion, island, day, turn) {
      const mine = data.islands[player];
      if (!mine || mine.version !== expectedVersion) return false;
      if (data.turns.some((t) => t.player === player && t.season === mine.season && t.turn === turn.turn)) return false;
      Object.assign(mine, { island: copy(island), day, version: mine.version + 1 });
      data.turns.push({ ...copy(turn), player, season: mine.season });
      saved();
      return true;
    },
    async storeQuestions(player, set) {
      const there = data.questions.find((q) => q.player === player && q.ref === set.ref);
      if (there) return copy(there);
      const kept = { ...copy(set), answered: {}, player };
      data.questions.push(kept);
      saved();
      return copy(kept);
    },
    async questions(player, by) {
      const found = data.questions.find((q) => q.player === player && ('id' in by ? q.id === by.id : q.ref === by.ref));
      if (!found) return null;
      const { player: _p, ...set } = found;
      return copy(set);
    },
    async claimAnswer(player, setId, slot, value, right) {
      const set = data.questions.find((q) => q.player === player && q.id === setId);
      if (!set || slot < 0 || slot >= set.questions.length || set.answered[String(slot)]) return false;
      set.answered[String(slot)] = { value, right };
      saved();
      return true;
    },
    async raceStart(player, race, day, turn) {
      if (data.races.some((r) => r.player === player && r.status === 'open')) return null;
      const id = data.nextRace++;
      data.races.push({ ...copy(race), id, status: 'open', result: null, prize: null, player, day, turn });
      saved();
      return id;
    },
    async race(player, id) {
      const r = data.races.find((x) => x.player === player && x.id === id);
      return r ? strip(r) : null;
    },
    async raceFinish(player, id, expectedVersion, island, day, result, prize) {
      const mine = data.islands[player];
      const r = data.races.find((x) => x.player === player && x.id === id && x.status === 'open');
      if (!mine || !r || mine.version !== expectedVersion) return false;
      Object.assign(r, { status: 'done', result: copy(result), prize: copy(prize) });
      Object.assign(mine, { island: copy(island), day, version: mine.version + 1 });
      saved();
      return true;
    },
    async guideDone(player) {
      const mine = data.islands[player];
      if (mine) mine.guideDone = true;
      saved();
      return true;
    },
    async recordAnswers(player, once, answers) {
      options.log?.answers.push({ player, once, answers });
    },
    async awardPoints(player, points, once) {
      if (givenPoints.has(once)) return;
      givenPoints.add(once);
      options.log?.points.push({ player, points, once });
    },
  };
}
