/**
 * Sky Isles' database jobs kept in memory, doing what the migration's functions do (one island a pupil, a turn played
 * once, a question marked once, one open race at a time, a race finished once). The server function's tests use it in
 * place of the database; the preview's trial backend (stage S.3) will save it in the browser.
 */
import type { FactAnswer } from '../maths/leitner';
import type { MathsContext } from '../maths/serverQuestions';
import type { Island } from './engine';
import { GIFTS_RECEIVED_PER_DAY, GIFTS_SENT_PER_DAY, NEWS_SHOWN } from './config';
import type { IslesServices, IslesSettings, NewsKind, Post, PostToSend, QuestionSet, SavedIsland, StoredRace, TurnRecord } from './server';

export interface MemoryData {
  islands: Record<string, SavedIsland>;
  turns: (TurnRecord & { player: string; season: number })[];
  questions: (QuestionSet & { player: string })[];
  races: (StoredRace & { player: string; day: number; turn: number })[];
  nextRace: number;
  /** The pretend class's names (everyone in memory is in one class). Anyone not named is "A classmate". */
  names?: Record<string, string>;
  /** Gifts and races' "well raced" coins waiting in each pupil's post (opened: in their island). */
  post?: (PostToSend & { id: number; from: string; to: string; day: number; opened: boolean })[];
  news?: (NewsKind & { player: string; day: number })[];
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
  data.names ??= {};
  data.post ??= [];
  data.news ??= [];
  const post = data.post;
  const news = data.news;
  const nameOf = (player: string) => data.names?.[player] ?? 'A classmate';
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
      const waiting: Post[] = post
        .filter((p) => p.to === player && !p.opened)
        .map(({ to: _t, day: _d, opened: _o, ...p }) => ({ ...copy(p), fromName: nameOf(p.from) }) as Post);
      return { saved: mine ? copy(mine) : null, classMiddle, openRace: open ? strip(open) : null, racesThisSeason: seasonRaces, post: waiting };
    },
    async openPost(player, expectedVersion, island, day, ids) {
      const mine = data.islands[player];
      const letters = post.filter((p) => p.to === player && ids.includes(p.id));
      if (!mine || mine.version !== expectedVersion || letters.length !== ids.length || letters.some((p) => p.opened)) return false;
      letters.forEach((p) => (p.opened = true));
      Object.assign(mine, { island: copy(island), day, version: mine.version + 1 });
      saved();
      return true;
    },
    async classSky(player, day) {
      const classmates = Object.entries(data.islands)
        .filter(([id, s]) => id !== player && s.island)
        .map(([id, s]) => ({
          id,
          name: nameOf(id),
          keeper: s.keeper,
          day: s.day,
          island: copy(s.island!),
          challengedToday: data.races.filter((r) => r.opponent === id && r.day === day).length,
          giftsToday: post.filter((p) => p.to === id && p.kind === 'gift' && p.day === day).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const giftsSentToday = post.filter((p) => p.from === player && p.kind === 'gift' && p.day === day).length;
      return { classmates, giftsSentToday };
    },
    async sendGift(player, to, gift, day) {
      if (to === player || !data.islands[to]?.island) return 'not-classmate';
      if (post.filter((p) => p.from === player && p.kind === 'gift' && p.day === day).length >= GIFTS_SENT_PER_DAY) return 'sent-today';
      if (post.filter((p) => p.to === to && p.kind === 'gift' && p.day === day).length >= GIFTS_RECEIVED_PER_DAY) return 'given-enough';
      post.push({ ...copy(gift), id: post.length + 1, from: player, to, day, opened: false });
      saved();
      return 'sent';
    },
    async addNews(player, day, items) {
      news.push(...items.map((n) => ({ ...copy(n), player, day })));
      saved();
    },
    async news(me, since) {
      return news
        .filter((n) => n.day >= since && data.islands[n.player]?.island)
        .slice(-NEWS_SHOWN)
        .reverse()
        .map(({ player, ...n }) => ({ ...n, name: nameOf(player), me: player === me }));
    },
    async start(player, seed, island: Island, day) {
      const mine = data.islands[player];
      if (mine?.island) return false;
      data.islands[player] = {
        seed, season: mine?.season ?? 1, version: (mine?.version ?? 0) + 1, day, island: copy(island), guideDone: mine?.guideDone ?? false, keeper: mine?.keeper ?? null,
      };
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
    async raceFinish(player, id, expectedVersion, island, day, result, prize, letter) {
      const mine = data.islands[player];
      const r = data.races.find((x) => x.player === player && x.id === id && x.status === 'open');
      if (!mine || !r || mine.version !== expectedVersion) return false;
      Object.assign(r, { status: 'done', result: copy(result), prize: copy(prize) });
      Object.assign(mine, { island: copy(island), day, version: mine.version + 1 });
      if (letter) post.push({ ...copy(letter.post), id: post.length + 1, from: player, to: letter.to, day, opened: false });
      saved();
      return true;
    },
    async guideDone(player) {
      const mine = data.islands[player];
      if (mine) mine.guideDone = true;
      saved();
      return true;
    },
    async keeper(player, keeper) {
      const mine = data.islands[player];
      if (!mine) return false;
      mine.keeper = keeper;
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
