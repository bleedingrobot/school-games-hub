/** Words for a focus, shared by the Set focus screen and the history. */
import type { FocusBatch } from '../data/focus';

/** Who a focus is for, in words. */
export function whoFor(b: Pick<FocusBatch, 'scope' | 'targets'>): string {
  if (b.scope === 'class') return 'Whole class';
  const names = b.targets.map((t) => t.name);
  if (b.scope === 'group') return names.length === 1 ? `Group ${names[0]}` : `Groups ${names.join(', ')}`;
  return names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} and ${names.length - 4} more`;
}

/** "Mon 19 Oct", New Zealand time. */
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
