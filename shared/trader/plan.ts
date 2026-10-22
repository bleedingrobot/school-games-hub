/**
 * A trade plan is how many of each good the pupil wants to buy (positive) or sell (negative) on this visit. Selling goes
 * first, so the money from a sale can pay for a purchase. The screen and the server both use this, so what the pupil sees
 * is what the server works out.
 */
import { BIG_TRADE_CREDITS, DISCOUNT_BIG_BP, DISCOUNT_BP, GOODS } from './config';
import { buy, sell, type Trader } from './state';

export const emptyPlan = (): number[] => GOODS.map(() => 0);

export interface PlanOutcome {
  state: Trader;
  spent: number;
  earned: number;
}

/** Apply the plan. `sellBp` and `buyBp` are sharp-trader discounts in hundredths of a percent (0 for none). */
export function runPlan(t: Trader, plan: readonly number[], sellBp = 0, buyBp = 0): { ok: true; out: PlanOutcome } | { ok: false; reason: string } {
  let state = t;
  let spent = 0;
  let earned = 0;
  for (let good = 0; good < plan.length; good++) {
    if (plan[good] < 0) {
      const r = sell(state, good, -plan[good], sellBp);
      if (!r.ok) return { ok: false, reason: r.reason };
      earned += r.info ?? 0;
      state = r.state;
    }
  }
  for (let good = 0; good < plan.length; good++) {
    if (plan[good] > 0) {
      const r = buy(state, good, plan[good], -buyBp);
      if (!r.ok) return { ok: false, reason: r.reason };
      spent += r.info ?? 0;
      state = r.state;
    }
  }
  return { ok: true, out: { state, spent, earned } };
}

/** The sharp-trader discount a right answer earns on a trade this big (in hundredths of a percent). */
export const discountFor = (worth: number): number => (worth >= BIG_TRADE_CREDITS ? DISCOUNT_BIG_BP : DISCOUNT_BP);
