/**
 * A pirate fight: turn-based, 3 to 6 rounds, no timers. Each round the pupil chooses to charge the lasers (a maths
 * check: right = a full shot, wrong = half), raise the shields, or flee. It is a fight, not a test: a good ship can win
 * without a single right answer and a poor one can lose with all of them right.
 * The browser plays it; the server plays the same rounds again from the same seed to check.
 */
import { seededRandom } from '../maths/serverQuestions';
import {
  FIGHT_ROUNDS,
  GOODS,
  LASER_DAMAGE_MULT,
  PIRATE_DAMAGE_PCT,
  PIRATE_LOOT_PCT,
  PIRATE_TIERS,
  SHIELDS,
  SHIELD_UP_CUT_PCT,
  SHIPS,
  START_CREDITS,
  WEAPONS,
  WRONG_SHOT_PCT,
} from './config';
import type { Trader } from './state';

export type FightAction = 'charge' | 'shield' | 'flee';
export type FightOutcome = 'going' | 'won' | 'fled' | 'robbed' | 'destroyed';

export interface Fight {
  seed: string;
  tier: number;
  round: number;
  pirateHull: number;
  pirateShield: number;
  /** The player's hull and the strength left in their shields. */
  hull: number;
  shield: number;
  outcome: FightOutcome;
  /** What happened in the last round, for the log. */
  log: string[];
}

export const laserPower = (t: Trader): number => t.weapons.reduce((a, w) => a + WEAPONS[w].power, 0);
export const shieldPower = (t: Trader): number => t.shields.reduce((a, s) => a + SHIELDS[s].power, 0);

export function startFight(t: Trader, tier: number, seed: string): Fight {
  const pirate = PIRATE_TIERS[tier];
  return { seed, tier, round: 0, pirateHull: pirate.hull, pirateShield: pirate.shield, hull: t.hull, shield: shieldPower(t), outcome: 'going', log: [] };
}

/** Play one round. `right` says whether the maths check for a laser round was answered correctly. */
export function fightRound(t: Trader, fight: Fight, action: FightAction, right: boolean): Fight {
  if (fight.outcome !== 'going') return fight;
  const random = seededRandom(`trader-fight:${fight.seed}:${fight.round}`);
  const pirate = PIRATE_TIERS[fight.tier];
  const next: Fight = { ...fight, round: fight.round + 1, log: [] };

  if (action === 'flee') {
    if (Math.floor(random() * 100) < SHIPS[t.ship].fleePct) {
      next.outcome = 'fled';
      next.log.push('You got away!');
      return next;
    }
    next.log.push('They cut you off.');
  }

  if (action === 'charge') {
    const power = laserPower(t);
    if (power <= 0) {
      next.log.push('Your ship has no lasers.');
    } else {
      const full = power * LASER_DAMAGE_MULT;
      const shot = right ? full : Math.floor((full * WRONG_SHOT_PCT) / 100);
      // Their shield soaks up the shot first.
      const soaked = Math.min(next.pirateShield, shot);
      next.pirateShield -= soaked;
      next.pirateHull -= shot - soaked;
      next.log.push(right ? 'Full-power shot!' : 'A weak shot. The lasers were not fully charged.');
      if (next.pirateHull <= 0) {
        next.pirateHull = 0;
        next.outcome = 'won';
        next.log.push('The pirates are beaten!');
        return next;
      }
    }
  }

  // Their shot back: 50 to 100 percent of their power, cut in half if you raised the shields.
  let hit = Math.floor((pirate.power * PIRATE_DAMAGE_PCT * (50 + Math.floor(random() * 51))) / 10_000);
  hit = Math.max(1, hit);
  if (action === 'shield') hit = Math.floor((hit * (100 - SHIELD_UP_CUT_PCT)) / 100);
  const soaked = Math.min(next.shield, hit);
  next.shield -= soaked;
  next.hull -= hit - soaked;
  next.log.push(`They hit you for ${hit}.`);
  if (next.hull <= 0) {
    next.hull = 0;
    next.outcome = 'destroyed';
    next.log.push('Your ship is wrecked. The escape pod works!');
    return next;
  }
  if (next.round >= FIGHT_ROUNDS) {
    next.outcome = 'robbed';
    next.log.push('The pirates grab some cargo and go.');
  }
  return next;
}

/** After a fight: bounty for a win, cargo lost for a robbery, a new Flea after a wreck (money kept, nothing lost forever). */
export function settleFight(t: Trader, fight: Fight): Trader {
  const state: Trader = { ...t, cargo: [...t.cargo], weapons: [...t.weapons], shields: [...t.shields], hull: Math.max(1, fight.hull) };
  switch (fight.outcome) {
    case 'won':
      state.credits += PIRATE_TIERS[fight.tier].bounty;
      break;
    case 'robbed':
      state.cargo = state.cargo.map((q) => q - Math.floor((q * PIRATE_LOOT_PCT) / 100));
      break;
    case 'destroyed': {
      // Escape pod: the cargo, ship and gear are lost, the credits are kept, and a Flea is waiting.
      state.cargo = GOODS.map(() => 0);
      state.ship = 0;
      state.hull = SHIPS[0].hull;
      state.weapons = [];
      state.shields = [];
      state.pods = 0;
      state.fuel = SHIPS[0].fuelTank;
      state.credits = Math.max(state.credits, START_CREDITS);
      break;
    }
    default:
      break;
  }
  return state;
}
