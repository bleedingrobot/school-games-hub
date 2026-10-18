/**
 * Best times, kept on this device until saving to the server comes in (stage M.4).
 * Times are clock steps (1/60 of a second). `up` is count-up, `down` is hard mode.
 */
export interface CourseBests {
  up?: number;
  down?: number;
}
export type Bests = Record<string, CourseBests>;

const KEY = 'marble-rush-bests-v1';

export function loadBests(): Bests {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Bests = {};
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 1_000_000;
      out[id] = { ...(ok(r.up) ? { up: r.up } : {}), ...(ok(r.down) ? { down: r.down } : {}) };
    }
    return out;
  } catch {
    return {};
  }
}

/** Records a finish. Returns the new bests and whether this was a personal best. */
export function withFinish(bests: Bests, courseId: string, mode: 'up' | 'down', steps: number): { bests: Bests; isBest: boolean } {
  const old = bests[courseId]?.[mode];
  const isBest = old === undefined || steps < old;
  if (!isBest) return { bests, isBest };
  return { bests: { ...bests, [courseId]: { ...bests[courseId], [mode]: steps } }, isBest };
}

export function saveBests(bests: Bests): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bests));
  } catch {
    // Storage blocked: bests just won't be remembered.
  }
}

/** 4.5 seconds → "0:04.50"; for a clock in steps. */
export function formatSteps(steps: number): string {
  const total = Math.max(0, Math.floor((steps * 100) / 60));
  const cs = total % 100;
  const sec = Math.floor(total / 100) % 60;
  const min = Math.floor(total / 6000);
  return `${min}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
