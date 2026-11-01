/**
 * Bolt's first-time tips (docs/TRADER-HINTS-PLAN.md, section 4): a short bubble the first time each new thing happens.
 * Each shows once (remembered in memory.ts) and can always be closed. The maths-check tip goes in the question box's own
 * note line, and the first-borrow "Sure?" in the bank, so they aren't bubbles; their words are here too.
 */
import { LOAN_WEEKLY_PCT, MOON_PRICE, SHIPS, SHIPYARD_TECH } from '../../../../shared/trader/config';
import { coordText, type Galaxy } from '../../../../shared/trader/galaxy';
import type { NewsItem } from '../../../../shared/trader/news';
import { hasShipyard, type Trader } from '../../../../shared/trader/state';
import { nearestShipyard, timesInTen } from './advice';

export type TipId =
  | 'maths' | 'junk' | 'trader' | 'pirates' | 'pirates-nolaser' | 'customs' | 'wrecked' | 'robbed'
  | 'shipyard' | 'noyard' | 'bank' | 'borrow' | 'news' | 'jumps' | 'newday';

/** One stop of a tip (the shipyard tour has three). `target` is a `data-coach` name to light up. */
export interface TipStop {
  say: string;
  target?: string;
}

export const MATHS_TIP = 'Get it right for a small discount. Wrong costs nothing, and No thanks skips it.';

export interface TipContext {
  galaxy: Galaxy;
  t: Trader;
  jumpsPerDay: number;
  news: readonly NewsItem[];
}

export function tipStops(id: TipId, c: TipContext): TipStop[] {
  const { galaxy, t } = c;
  const ship = SHIPS[t.ship];
  switch (id) {
    case 'maths':
      return [{ say: MATHS_TIP }];
    case 'junk':
      return [{ say: 'Rocks ahead! Answer the maths check to steer round them. If you bump one, you just lose a little hull. You can mend it at a shipyard.' }];
    case 'trader':
      return [{ say: "A trader wants to do a deal. When you buy, a lower price is good. When you sell, a higher price is good. I'll help you check." }];
    case 'pirates':
      return [{ say: 'Pirates! ⚡ Charge fires your lasers. 🛡️ Shields soak up their shots. 💨 Flee tries to escape. If they win, they take some cargo, never your credits.' }];
    case 'pirates-nolaser':
      return [{ say: `Pirates! Your ${ship.name} has no lasers, so you can't fire. Fleeing works ${timesInTen(ship.fleePct)}. That's your best move. If they win, they take some cargo, never your credits.` }];
    case 'customs':
      return [{ say: "Customs took the banned goods. Each planet's card on the Star chart shows what it bans. From now on I'll warn you before you jump." }];
    case 'wrecked':
      return [{ say: "Your ship was wrecked, but the escape pod worked! You kept every credit, and here's a free Flea. Lots of great traders start again." }];
    case 'robbed':
      return [{ say: 'They got some cargo, but your ship and credits are safe. A laser and shields make pirates easier.' }];
    case 'shipyard':
      return [
        { say: 'Welcome to the shipyard! Fuel and mending are here.', target: 'ship-fuel' },
        { say: 'Bigger ships carry more cargo. Each one shows its holds next to yours.', target: 'ship-list' },
        { say: `And this is the moon you're saving for: ${MOON_PRICE.toLocaleString('en-NZ')} credits.`, target: 'ship-moon' },
      ];
    case 'noyard': {
      const yard = hasShipyard(galaxy, t) ? null : nearestShipyard(galaxy, t);
      return [{ say: `No shipyard here. They're only on planets of tech level ${SHIPYARD_TECH} or more. You can still buy fuel.${yard ? ` ${yard.name} at ${coordText(yard)} has one.` : ''}`, target: 'ship-fuel' }];
    }
    case 'bank':
      return [{ say: `A loan gives you credits now. Once a week the bank adds ${LOAN_WEEKLY_PCT}% of what you borrowed. A loan only helps if you've got a good trade to spend it on.` }];
    case 'borrow':
      return [{ say: 'Sure? A loan costs extra each week.' }];
    case 'news':
      return [{ say: '📰 This is the school news. When lots of traders sell something on a planet, it gets cheap there. Reading the news helps you find bargains.', target: 'news' }];
    case 'jumps':
      return [{ say: `That's all ${c.jumpsPerDay} jumps for today! Your ship, cargo and credits are saved. See you tomorrow.`, target: 'hud-jumps' }];
    case 'newday': {
      const pct = Math.min(100, Math.floor((t.credits * 100) / MOON_PRICE));
      const goal = t.moon ? 'You own a moon! 🌙' : `You're ${pct}% of the way to your moon.`;
      const headline = c.news[0] ? ` 📰 ${c.news[0].text}` : '';
      return [{ say: `Welcome back! A new day: ${t.jumpsLeft} jumps and ${t.credits.toLocaleString('en-NZ')} credits. ${goal}${headline}` }];
    }
  }
}

/** What's happening now that a tip could be about. */
export interface TipMoment {
  /** The encounter waiting, if any. */
  pending: 'junk' | 'deal' | 'fight' | null;
  /** The ship has a laser. */
  armed: boolean;
  /** The result screen after customs, a wreck or a robbery. */
  after: 'customs' | 'wrecked' | 'robbed' | null;
  /** On the planet with its tabs showing, and First Flight's bubble not in the way. */
  planet: boolean;
  tab: 'trade' | 'ship' | 'bank' | 'map';
  shipyard: boolean;
  loans: boolean;
  hasNews: boolean;
  jumpsLeft: number;
  /** A new day's welcome is due. */
  welcome: boolean;
}

/** Every tip that fits this moment, most important first (whether or not it has been seen). */
export function tipsFor(m: TipMoment): TipId[] {
  if (m.pending === 'junk') return ['junk'];
  if (m.pending === 'deal') return ['trader'];
  if (m.pending === 'fight') return [m.armed ? 'pirates' : 'pirates-nolaser'];
  if (m.after) return [m.after];
  if (!m.planet) return [];
  const ids: TipId[] = [];
  if (m.welcome) ids.push('newday');
  if (m.jumpsLeft < 1) ids.push('jumps');
  if (m.tab === 'ship') ids.push(m.shipyard ? 'shipyard' : 'noyard');
  if (m.tab === 'bank' && m.loans) ids.push('bank');
  if (m.tab === 'trade' && m.hasNews) ids.push('news');
  return ids;
}

/** The first tip that fits and hasn't been seen, or null. The new-day welcome isn't a once-ever tip: it comes each day. */
export function nextTip(m: TipMoment, seen: readonly string[]): TipId | null {
  return tipsFor(m).find((id) => id === 'newday' || !seen.includes(id)) ?? null;
}
