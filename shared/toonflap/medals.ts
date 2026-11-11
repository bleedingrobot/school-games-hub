/**
 * Medal times for each level, in seconds. Written by the sim: npm run toonflap:sim -- --write-medals
 * (scripts/toonflap-sim.mjs). Don't edit by hand.
 */
import type { LevelMedals } from './levels';

export const MEDALS: Readonly<Record<string, LevelMedals>> = {
  garden: { gold: 28, silver: 40, goldPlain: 31, silverPlain: 40 },
  mesa: { gold: 35, silver: 47, goldPlain: 41, silverPlain: 50 },
  reef: { gold: 38, silver: 49, goldPlain: 46, silverPlain: 55 },
  kitchen: { gold: 41, silver: 52, goldPlain: 51, silverPlain: 60 },
  donut: { gold: 42, silver: 53, goldPlain: 55, silverPlain: 64 },
  manor: { gold: 48, silver: 59, goldPlain: 61, silverPlain: 70 },
  peaks: { gold: 45, silver: 56, goldPlain: 60, silverPlain: 69 },
  volcano: { gold: 50, silver: 61, goldPlain: 65, silverPlain: 74 },
  robot: { gold: 53, silver: 63, goldPlain: 71, silverPlain: 79 },
  cosmic: { gold: 61, silver: 71, goldPlain: 81, silverPlain: 89 },
};
