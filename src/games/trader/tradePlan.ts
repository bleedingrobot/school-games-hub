/**
 * A trade plan is how many of each good the pupil wants to buy (positive) or sell (negative) on this visit. Selling
 * goes first, so the money from a sale can pay for a purchase. Applying a plan uses the shared rules, so what the
 * screen shows is exactly what the server will work out.
 */
import { GOODS } from '../../../shared/trader/config';
import { buy, sell, type Trader } from '../../../shared/trader/state';

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
