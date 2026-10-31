/**
 * The school news (docs/TRADER-PLAN.md, section 8): computer-written lines from the day's biggest price moves and the
 * planets' events. It explains the market ("Lots of traders sold Water on Mars, so it's cheap there today") and never
 * names a pupil: the database only knows how far a price moved, not who moved it.
 */
import { EVENTS, GOODS, GOOD_RULES, MARKET_NEWS_BP } from './config';
import type { Galaxy } from './galaxy';
import { eventOn, standardPrice } from './market';
import { priceMove, type SchoolView } from './schoolMarket';

/** The most lines the server sends (the reply stays small). */
export const NEWS_SENT = 30;

export type NewsKind = 'sold' | 'bought' | 'still-cheap' | 'still-dear' | 'event';

export interface NewsItem {
  planet: number;
  /** The good it's about (an event about two goods gives the first). */
  good: number;
  kind: NewsKind;
  text: string;
}

/** What made a price jump (kid-worded). `goods` is already joined: "Water" or "Ore and Fireworks". */
export const EVENT_WORDS: Record<string, (goods: string, dear: string) => string> = {
  war: (g, d) => `There is a war on, so ${g} ${d} dear.`,
  plague: (g, d) => `A sickness is going round, so ${g} ${d} dear.`,
  drought: (g, d) => `A drought has dried things up, so ${g} ${d} dear.`,
  boredom: (g, d) => `Everyone is bored, so ${g} ${d} dear.`,
  cold: (g, d) => `A big freeze has hit, so ${g} ${d} dear.`,
  'crop failure': (g, d) => `The crops failed, so ${g} ${d} dear.`,
  'lack of workers': (g, d) => `There are not enough workers, so ${g} ${d} dear.`,
};

/** Goods whose names are plural ("Robots are dear", "Water is dear"). */
const PLURAL = new Set(['Furs', 'Games', 'Fireworks', 'Machines', 'Lollies', 'Robots']);
const isAre = (good: number): string => (PLURAL.has(GOODS[good]) ? 'are' : 'is');
const itThey = (good: number): string => (PLURAL.has(GOODS[good]) ? "they're" : "it's");

/** The goods an event makes dear at a planet (only ones traded there). */
export function eventGoods(galaxy: Galaxy, planet: number, day: number): number[] {
  const p = galaxy.planets[planet];
  const event = eventOn(galaxy, p, day);
  if (!event) return [];
  return GOOD_RULES.map((r, good) => (r.event === event && standardPrice(p, good) > 0 ? good : -1)).filter((g) => g >= 0);
}

/** "There is a war on, so Ore and Fireworks are dear." (without the planet's name) */
export function eventLine(galaxy: Galaxy, planet: number, day: number): string | null {
  const goods = eventGoods(galaxy, planet, day);
  if (!goods.length) return null;
  const event = EVENTS[eventOn(galaxy, galaxy.planets[planet], day)];
  const names = goods.map((g) => GOODS[g]).join(' and ');
  return EVENT_WORDS[event](names, goods.length > 1 ? 'are' : isAre(goods[0]));
}

/**
 * Today's news for the school, biggest first: today's big moves, then prices still far from normal after yesterday's
 * trading, then events. At most `max` lines (the screens show the first NEWS_MAX as headlines, and a planet's own lines
 * on its card).
 */
export function newsFor(galaxy: Galaxy, day: number, view: SchoolView, max = NEWS_SENT): NewsItem[] {
  const name = (planet: number): string => galaxy.planets[planet]?.name ?? '';
  const moves: { size: number; item: NewsItem }[] = [];
  const seen = new Set<string>();
  const pushAt = new Map(view.pushes.map(([p, g, push, moved]) => [`${p}:${g}`, { push, moved }]));
  // Today's big moves, then yesterday's that are still showing.
  for (const [d, planet, good, direction] of view.news) {
    const key = `${planet}:${good}`;
    if (seen.has(key) || !galaxy.planets[planet] || !GOODS[good]) continue;
    const now = pushAt.get(key);
    const push = priceMove(now?.push ?? 0);
    if (d === day) {
      const sold = direction < 0;
      seen.add(key);
      moves.push({
        size: Math.abs(now?.moved ?? MARKET_NEWS_BP) + 100_000,
        item: { planet, good, kind: sold ? 'sold' : 'bought', text: `Lots of traders ${sold ? 'sold' : 'bought'} ${GOODS[good]} on ${name(planet)}, so ${itThey(good)} ${sold ? 'cheap' : 'dear'} there today.` },
      });
    } else if (d === day - 1 && Math.abs(push) * 2 >= MARKET_NEWS_BP && Math.sign(push) === Math.sign(direction)) {
      const cheap = push < 0;
      seen.add(key);
      moves.push({
        size: Math.abs(push),
        item: { planet, good, kind: cheap ? 'still-cheap' : 'still-dear', text: `${GOODS[good]} ${isAre(good)} still ${cheap ? 'cheap' : 'dear'} on ${name(planet)} after lots of ${cheap ? 'selling' : 'buying'} yesterday.` },
      });
    }
  }
  moves.sort((a, b) => b.size - a.size || a.item.planet - b.item.planet || a.item.good - b.item.good);
  const out = moves.map((m) => m.item);
  for (const p of galaxy.planets) {
    const line = eventLine(galaxy, p.id, day);
    if (line) out.push({ planet: p.id, good: eventGoods(galaxy, p.id, day)[0], kind: 'event', text: `${p.name}: ${line}` });
  }
  return out.slice(0, max);
}

/** The news about one planet (for its star chart card and the landing screen). */
export const newsAbout = (news: readonly NewsItem[], planet: number): NewsItem[] => news.filter((n) => n.planet === planet);
