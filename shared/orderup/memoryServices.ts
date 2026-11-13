/**
 * Order Up!'s database jobs kept in memory, doing what the migration's functions do (a seed used once per pupil, bags
 * saved in order and once each, progress saved only if its version matches). The server's tests and the preview use it.
 */
import { memorySeen } from '../kit/seen';
import type { FactAnswer } from '../maths/leitner';
import { ORDERUP } from './config';
import type { BagEvent, BagResult } from './play';
import { unsaved, type KeptSet, type OrderUpServices, type Saved, type Settings } from './server';

export interface MemoryData {
  players: Record<string, Saved>;
  sets: { player: string; set: KeptSet; open: boolean; bags: { events: BagEvent[]; result: BagResult }[] }[];
  answers: { player: string; once: string; answers: FactAnswer[] }[];
  changed: string[];
}

export const emptyData = (): MemoryData => ({ players: {}, sets: [], answers: [], changed: [] });

export function memoryServices(
  data: MemoryData = emptyData(),
  options: { settings?: Settings; random?: () => number; now?: () => number } = {},
): OrderUpServices & { data: MemoryData } {
  const seen = memorySeen();
  const find = (player: string, seed: number) => data.sets.find((s) => s.player === player && s.set.seed === seed);
  return {
    data,
    ...seen,
    settings: async () => options.settings ?? { enabled: true, help: 'fade' },
    load: async (player) => structuredClone(data.players[player] ?? unsaved()),
    async start(player, set) {
      if (find(player, set.seed)) return false;
      for (const s of data.sets) if (s.player === player) s.open = false;
      data.sets.push({ player, set: structuredClone(set), open: true, bags: [] });
      return true;
    },
    async set(player, seed) {
      const s = find(player, seed);
      if (!s) return null;
      return { open: s.open, done: s.bags.length, good: s.bags.filter((b) => b.result.good).length, set: structuredClone(s.set) };
    },
    async saveBag(player, seed, slot, events, result) {
      const s = find(player, seed);
      if (!s || !s.open || s.bags.length !== slot) return null;
      s.bags.push({ events, result });
      if (s.bags.length >= ORDERUP.setSize) s.open = false;
      return { done: s.bags.length, good: s.bags.filter((b) => b.result.good).length };
    },
    async saveProgress(player, version, progress) {
      const now = data.players[player] ?? unsaved();
      if (now.version !== version) return false;
      data.players[player] = { ...structuredClone(progress), version: version + 1 };
      return true;
    },
    async recordAnswers(player, once, answers) {
      if (!data.answers.some((a) => a.player === player && a.once === once)) data.answers.push({ player, once, answers });
    },
    async progressChanged(player) {
      data.changed.push(player);
    },
    random: options.random ?? Math.random,
    now: options.now ?? Date.now,
  };
}
