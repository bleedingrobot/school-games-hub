/** Which kinds of go a child has surely met, from how far they have played (a go's kind is not in the maths records). */
import { beachAfter } from './progress';

/**
 * Altogether goes come on silver and gold days, two tides on gold days only (shared/pipi/round.ts), so a child who has
 * finished a silver day has had altogether, and one who has finished a gold day has had both. Every finished round has had
 * ordinary hiding goes.
 */
export function kindsFromDays(daysDone: number, played: number): string[] {
  const beach = beachAfter(daysDone);
  const kinds: string[] = played > 0 ? ['hiding'] : [];
  if (beach.pearls > 0 || beach.day >= 11) kinds.push('altogether');
  if (beach.pearls > 0 || beach.day >= 21) kinds.push('twoTides');
  return kinds.sort();
}
