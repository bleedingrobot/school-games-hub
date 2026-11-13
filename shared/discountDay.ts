/**
 * Discount day (James, 13 Nov 2026; migration 20261113000500_discount_day.sql): one class switch per game, on the
 * teacher's Today page. For the rest of that New Zealand day the game's shop is cheaper; at midnight it turns itself off.
 * Only the Archery Challenge has one: every arrow is half price (shared/archery/shop.ts, `onDiscount`).
 */
import { nzToday } from './unlimited';

/** The games with a switch, and what it does (for the teacher's Today page). */
export const DISCOUNT_GAMES = [{ id: 'archery', name: 'Archery Challenge', does: 'Every arrow is half price today.' }] as const;

export type DiscountGame = (typeof DISCOUNT_GAMES)[number]['id'];

/** Is this game's switch on today? `days` is the settings row's `discount_days` ({ game id: NZ date }). */
export function isDiscountFor(days: unknown, game: DiscountGame, now: Date = new Date()): boolean {
  if (!days || typeof days !== 'object') return false;
  return (days as Record<string, unknown>)[game] === nzToday(now);
}
