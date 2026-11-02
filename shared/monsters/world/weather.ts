/**
 * Today's weather in each area, and the "rare monster spotted today" note (docs/MONSTERS-QUESTS-PLAN.md
 * section 8). Both come from the New Zealand date only, so the whole class sees the same weather and
 * the same rare monster on the same day, and the server can work them out too. No clock: pass the day in.
 */
import { RARE_FAMILIES, UNCOMMON } from '../monsterBook';
import type { TypeId } from '../types';

export type Weather = 'sunny' | 'rain' | 'wind' | 'fog' | 'snow';

/** EASY TO EDIT: which weathers each area can have (a name twice is twice as likely), and which type each brings out. */
export const WEATHER = {
  byArea: {
    1: ['sunny', 'sunny', 'rain', 'wind', 'fog'],
    2: ['sunny', 'sunny', 'rain', 'wind'],
    3: ['sunny', 'sunny', 'wind', 'fog'],
    4: ['sunny', 'snow', 'snow', 'wind', 'fog'],
    5: ['fog', 'fog', 'rain', 'sunny'],
    6: ['sunny', 'rain', 'wind', 'fog'],
  } as Record<number, Weather[]>,
  /** The type that turns up more in this weather, and how much more. */
  brings: { sunny: 'fire', rain: 'water', wind: 'leaf', fog: 'spark', snow: 'ice' } as Record<Weather, TypeId>,
  boost: 2,
  /** The spotted family is this many times as likely in its area today. */
  spottedBoost: 2,
};

export const WEATHER_LABEL: Record<Weather, string> = { sunny: 'Sunny', rain: 'Rain', wind: 'Windy', fog: 'Foggy', snow: 'Snow' };

/** A small, steady number from a string (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The weather in an area (1 to 6, or a bonus area's main area) on a NZ day ("2026-11-02"). Towns are always sunny. */
export function weatherFor(day: string, area: number): Weather {
  const list = WEATHER.byArea[area];
  if (!list) return 'sunny';
  return list[hash(`${day}:weather:${area}`) % list.length];
}

/** Today's spotted monster: one uncommon or rare family, and the area where it is twice as likely. */
export function spottedToday(day: string, areas: Readonly<Record<string, number>>): { family: string; area: number } {
  const families = [...UNCOMMON, ...Object.keys(RARE_FAMILIES).filter((f) => !RARE_FAMILIES[f].giant)].filter((f) => areas[f] !== undefined);
  const family = families[hash(`${day}:spotted`) % families.length];
  return { family, area: areas[family] };
}

/** What changes the wild odds today in one area: its weather and the spotted family, if it lives here. */
export interface Today {
  weather: Weather;
  spotted?: string;
}
