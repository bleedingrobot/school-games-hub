/**
 * A STAND-IN for the real server's classmate fights, for the Archery Challenge preview. NOT the real thing.
 *
 * Two pretend classmates, Ana and Ben (same class), share one pretend server in this browser tab: the very same
 * server-function logic the real `archery` function runs (supabase/functions/archery/handler.ts) on the trial
 * backend's pretend database, with "Realtime" as a list of listeners in this page. Nothing ever leaves the device.
 * The preview shows one pupil at a time with a switch to swap, so James can play both sides on one phone.
 */
import { archeryApi, type DuelLink, type Transport } from '../../src/data/archery';
import { emptyTrialData, trialHub, type TrialData, type TrialPupil } from '../../src/games/archery/trialBackend';
import type { DuelRow } from '../../shared/archery/duel';

export const ANA = 'a0a0a0a0-0000-4000-8000-00000000000a';
export const BEN = 'b0b0b0b0-0000-4000-8000-00000000000b';
export const DUO_PUPILS: Record<string, TrialPupil> = {
  [ANA]: { name: 'Speedy Otter 7', classId: 'room-1', school: 1 },
  [BEN]: { name: 'Brave Kiwi 12', classId: 'room-1', school: 1 },
};
/** What the switch calls them (their display names are the hub's usual made-up ones). */
export const DUO_LABELS: Record<string, string> = { [ANA]: 'Ana', [BEN]: 'Ben' };

const DATA_KEY = 'archery-preview-duo-v1';
const DUELS_KEY = 'archery-preview-duo-duels';

/** The pretend teacher's Classmate fights switch for Ana and Ben's class (Stage 7), remembered on this device. */
function loadDuelsOn(): boolean {
  try {
    return localStorage.getItem(DUELS_KEY) !== 'off';
  } catch {
    return true;
  }
}

function loadData(): TrialData {
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_KEY) ?? 'null') as TrialData | null;
    if (raw && typeof raw === 'object' && raw.pupils && raw.duels) return raw;
  } catch {
    // Storage blocked or broken: start fresh.
  }
  const data = emptyTrialData();
  // Both start with a little to pack, so a classmate fight has something special in it.
  for (const id of [ANA, BEN]) data.pupils[id] = { coins: 300, gear: { steel: 2, log: 1, apple: 1 }, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
  return data;
}

function saveData(data: TrialData) {
  try {
    const rounds = Object.fromEntries(Object.entries(data.rounds).slice(-3));
    const duels = Object.fromEntries(Object.entries(data.duels ?? {}).slice(-10));
    localStorage.setItem(DATA_KEY, JSON.stringify({ ...data, rounds, duels, answers: data.answers.slice(-50), requests: {} }));
  } catch {
    // Not remembered, that's all.
  }
}

export function forgetDuoData() {
  try {
    localStorage.removeItem(DATA_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** The shared pretend server and, for each pupil, the same calls the real game makes. */
export function makeDuo() {
  const listeners = new Set<(d: DuelRow) => void>();
  const switches = { duels: loadDuelsOn() };
  const hub = trialHub({ data: loadData(), pupils: DUO_PUPILS, duels: () => switches.duels, onDuel: (d) => queueMicrotask(() => listeners.forEach((l) => l(d))) });
  // Both have the game open from the start, so each sees the other straight away.
  hub.here(ANA);
  hub.here(BEN);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function forPupil(player: string) {
    const send: Transport = async (body) => {
      // A pretend network: a little wait, like school Wi-Fi.
      await sleep(120 + Math.random() * 120);
      const r = await hub.sendAs(player, body);
      saveData(hub.data);
      return r;
    };
    const link: DuelLink = {
      async here() {
        await sleep(60);
        const r = hub.here(player);
        saveData(hub.data);
        return r;
      },
      read: async (id) => hub.readDuel(player, id),
      watch(me, onDuel, onLive) {
        const heard = (d: DuelRow) => {
          if (d.seat_a === me || d.seat_b === me) onDuel(d, d.id);
        };
        listeners.add(heard);
        onLive('live');
        return () => listeners.delete(heard);
      },
      clockOffset: async () => 0,
    };
    return { api: archeryApi(send, player), link };
  }

  return {
    hub,
    pupils: { [ANA]: forPupil(ANA), [BEN]: forPupil(BEN) } as Record<string, ReturnType<typeof forPupil>>,
    duelsOn: () => switches.duels,
    /**
     * The pretend teacher switches classmate fights on or off. Both games hear it at their next "I'm here" (asked for
     * straight away here); a fight being played stops at its next turn, as in the real thing.
     */
    setDuels(on: boolean) {
      switches.duels = on;
      try {
        localStorage.setItem(DUELS_KEY, on ? 'on' : 'off');
      } catch {
        // Not remembered, that's all.
      }
      document.dispatchEvent(new Event('visibilitychange'));
    },
    addCoins(player: string, coins: number) {
      hub.data.pupils[player] ??= { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
      hub.data.pupils[player].coins += coins;
      saveData(hub.data);
    },
  };
}
