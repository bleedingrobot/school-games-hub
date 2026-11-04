/**
 * The strong and weak chart, shown in How to play and from Settings. The picture is made by
 * scripts/monsters-type-chart.py from the type wheel in shared/monsters/types.ts; if the wheel changes,
 * run it again. The words for screen readers come from the rules themselves.
 */
import { STRONG_MULTIPLIER, TYPE_LABEL, TYPES, WEAK_MULTIPLIER, strongAgainst } from '../../../shared/monsters/types';
import chart from './art/type-chart.webp';

export const TYPE_CHART_WORDS = `${TYPES.map((t) => `${TYPE_LABEL[t]} is strong against ${TYPE_LABEL[strongAgainst(t)]}.`).join(' ')} A strong attack does ${STRONG_MULTIPLIER} times the damage. A weak attack, going the other way, does ${WEAK_MULTIPLIER} times the damage. Other attacks are normal.`;

export function TypeChart() {
  return <img className="mm-typechart" src={chart} width={1200} height={1200} alt={TYPE_CHART_WORDS} />;
}
