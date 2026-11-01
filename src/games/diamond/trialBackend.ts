/**
 * A browser-only stand-in for Diamond Drop's server, so the preview (and the tests) can play the whole game with no
 * sign-in. It runs the shared rules exactly as the Stage 3 server function will: it checks the level may start today,
 * charges boosts, makes and keeps the Hold on! questions (from a fixed pretend focus), marks each answer once, and
 * replays the level from its seed and drops before saving. Nothing leaves the browser.
 */
import { AUTO_FOCUS, makeFocusPack, type MathsFocus } from '../../../shared/maths/focus';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { LAST_LEVEL, questionCap, type BoostId } from '../../../shared/diamond/config';
import { playLevel } from '../../../shared/diamond/engine';
import { applyResult, canStart, needsStarter, newPlayer, takeBoosts, type Player } from '../../../shared/diamond/progress';
import { buy, wear } from '../../../shared/diamond/workshop';
import type { DiamondBackend, Reply } from './backend';

/** The preview's pretend pupil works on times tables (with a little review), whatever the real class does. */
export const PREVIEW_FOCUS: MathsFocus = { ...AUTO_FOCUS, source: 'teacher-class', skills: ['times-tables'], onlyThese: false };

interface OpenLevel {
  level: number;
  boosts: BoostId[];
  starter: boolean;
  questions: Question[];
  marks: (boolean | undefined)[];
  ended: boolean;
}

export interface TrialOptions {
  /** A fixed clock for tests (milliseconds); the preview uses the real one plus any "pretend tomorrow". */
  now?: () => number;
  /** Keep the pretend pupil in this browser's storage under this key, so the preview remembers them. */
  storageKey?: string;
  /** Seeds for new levels (tests pass a fixed list). */
  seeds?: () => number;
}

export interface Trial {
  backend: DiamondBackend;
  /** Every request, for tests. */
  log: { type: string; body: unknown }[];
  /** Preview tools (never in the real game). Reload the game after each. */
  tools: {
    give(coins: number): void;
    /** Pretend it is tomorrow, so the next level opens now. */
    nextDay(): void;
    /** Pretend every level above this one is passed (and today's new level not yet used). */
    jumpTo(level: number): void;
    restart(): void;
  };
}

const ok = <T,>(value: T): Reply<T> => ({ ok: true, value });
const no = (message: string): Reply<never> => ({ ok: false, message });

export function trialBackend(options: TrialOptions = {}): Trial {
  const read = (): { player: Player; skippedDays: number } => {
    try {
      const raw = options.storageKey ? localStorage.getItem(options.storageKey) : null;
      if (raw) return JSON.parse(raw) as { player: Player; skippedDays: number };
    } catch {
      // Start fresh.
    }
    return { player: newPlayer(), skippedDays: 0 };
  };
  const data = read();
  const save = () => {
    try {
      if (options.storageKey) localStorage.setItem(options.storageKey, JSON.stringify(data));
    } catch {
      // Not remembered, that's all.
    }
  };
  const open = new Map<number, OpenLevel>();
  const log: Trial['log'] = [];
  const clock = options.now ?? (() => Date.now());
  const now = () => new Date(clock() + data.skippedDays * 86_400_000);
  const newSeed = options.seeds ?? (() => crypto.getRandomValues(new Uint32Array(1))[0]);
  const copy = () => structuredClone(data.player);

  const backend: DiamondBackend = {
    async load() {
      log.push({ type: 'load', body: null });
      return ok({ player: copy(), now: now().getTime() });
    },
    async levelStart(level, boosts) {
      log.push({ type: 'levelStart', body: { level, boosts } });
      if (!canStart(data.player, level, now())) return no(level > data.player.deepest + 1 ? 'That level is still locked.' : 'That level opens tomorrow.');
      const paid = takeBoosts(data.player, level, boosts);
      if (!paid.ok) return no(paid.reason === 'coins' ? 'Not enough coins for those boosts.' : 'Those boosts can’t be used.');
      const seed = newSeed();
      const starter = level === 1 && needsStarter(data.player);
      // The server's way A: questions from the pupil's focus, made from a seed and kept here, sent without answers.
      const pack = makeFocusPack([], PREVIEW_FOCUS, {}, seededRandom(`diamond-${seed}`));
      const questions: Question[] = [];
      for (let i = 0; i < questionCap(level) * 3 && questions.length < questionCap(level); i++) {
        const q = pack.nextQuestion({ multipleChoice: false });
        if (q) questions.push(q);
      }
      data.player = paid.player;
      save();
      open.set(seed, { level, boosts: [...boosts], starter, questions, marks: [], ended: false });
      return ok({ seed, level, boosts: [...boosts], starter, questions: questions.map((q, slot) => publicQuestion(q, slot)), player: copy() });
    },
    async answer(seed, slot, value) {
      log.push({ type: 'answer', body: { seed, slot, value } });
      const lvl = open.get(seed);
      const q = lvl?.questions[slot];
      if (!lvl || lvl.ended || !q) return no('That question isn’t open.');
      const correct = value === q.answer;
      // Marked once: a second answer to the same slot gets the first mark.
      if (lvl.marks[slot] === undefined) lvl.marks[slot] = correct;
      return ok({ correct: lvl.marks[slot]!, answer: q.answer });
    },
    async levelEnd(seed, drops, finish) {
      log.push({ type: 'levelEnd', body: { seed, drops, finish } });
      const lvl = open.get(seed);
      if (!lvl || lvl.ended) return no('That level has already ended.');
      lvl.ended = true;
      const result = playLevel({ level: lvl.level, seed, drops, finish, boosts: lvl.boosts, marks: lvl.marks.map((m) => m === true), starter: lvl.starter });
      const applied = applyResult(data.player, result, now());
      data.player = applied.player;
      save();
      return ok({ result, coins: applied.coins, points: applied.points, newLevel: applied.newLevel, earned: applied.earned, player: copy() });
    },
    async buy(id) {
      log.push({ type: 'buy', body: { id } });
      const next = buy(data.player, id, now());
      if (!next) return no('You can’t buy that one yet.');
      data.player = next;
      save();
      return ok(copy());
    },
    async wear(slot, id) {
      log.push({ type: 'wear', body: { slot, id } });
      const next = wear(data.player, slot, id);
      if (!next) return no('That upgrade isn’t yours yet.');
      data.player = next;
      save();
      return ok(copy());
    },
  };

  return {
    backend,
    log,
    tools: {
      give(coins) {
        data.player.coins += coins;
        save();
      },
      nextDay() {
        data.skippedDays++;
        save();
      },
      jumpTo(level) {
        const p = data.player;
        p.deepest = Math.max(0, Math.min(LAST_LEVEL, level - 1));
        p.newLevelDate = null;
        p.stars = p.stars.map((s, i) => (i < p.deepest ? Math.max(s, 1) : 0));
        p.lifetime.plays = Math.max(p.lifetime.plays, 1);
        save();
      },
      restart() {
        data.player = newPlayer();
        data.skippedDays = 0;
        open.clear();
        save();
      },
    },
  };
}
