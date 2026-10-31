/**
 * Medal times for the six mines, in seconds (docs/MINE-PLAN.md, Stage 3).
 *
 * Set from the pretend pilot's runs: its time minus the 20 seconds each rebuild cost it (a careful person who
 * dodges doesn't pay those), then gold = about 1.15 times that, silver about 1.6 times, bronze about 2.4 times,
 * rounded to 5 seconds. `medals.test.ts` keeps them honest (the pilot must still win at least bronze everywhere).
 */
export type Medal = 'gold' | 'silver' | 'bronze';
export interface MedalTimes {
  gold: number;
  silver: number;
  bronze: number;
}

export const MEDALS: Record<string, MedalTimes> = {
  l1: { gold: 95, silver: 130, bronze: 200 },
  l2: { gold: 100, silver: 140, bronze: 210 },
  l3: { gold: 165, silver: 230, bronze: 350 },
  l4: { gold: 230, silver: 320, bronze: 480 },
  l5: { gold: 310, silver: 430, bronze: 650 },
  l6: { gold: 450, silver: 630, bronze: 950 },
  'l1:hard': { gold: 105, silver: 145, bronze: 215 },
  'l2:hard': { gold: 125, silver: 170, bronze: 260 },
  'l3:hard': { gold: 185, silver: 255, bronze: 385 },
  'l4:hard': { gold: 250, silver: 350, bronze: 520 },
  'l5:hard': { gold: 330, silver: 455, bronze: 685 },
  'l6:hard': { gold: 475, silver: 665, bronze: 1000 },
};

/** The medal for a finish time in clock steps (30 a second), or null if it's slower than bronze. */
export function medalFor(levelId: string, finishSteps: number): Medal | null {
  const m = MEDALS[levelId];
  if (!m) return null;
  const seconds = finishSteps / 30;
  if (seconds <= m.gold) return 'gold';
  if (seconds <= m.silver) return 'silver';
  if (seconds <= m.bronze) return 'bronze';
  return null;
}
