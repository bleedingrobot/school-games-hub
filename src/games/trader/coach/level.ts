/**
 * How much Bolt helps (docs/TRADER-HINTS-PLAN.md, section 6). Bolt picks for the pupil from how far along they are (the
 * server's jump count, so it's the same on every device) until the pupil picks for themselves.
 *
 * - Lots: everything: the next step, first-time tips, every helper open, the ⭐ best buy, trip ideas and guide lines.
 * - Some: the next step and first-time tips; Bolt's suggestions wait behind "Ask Bolt"; no ⭐, trip ideas or guide lines.
 * - Off: nothing but the help button.
 */
export type HelpLevel = 'lots' | 'some' | 'off';

export const HELP_LEVELS: readonly { id: HelpLevel; name: string; about: string }[] = [
  { id: 'lots', name: 'Lots', about: 'Bolt shows his ideas everywhere.' },
  { id: 'some', name: 'Some', about: 'A next step and tips. Ask Bolt for more.' },
  { id: 'off', name: 'Off', about: 'No help unless you press 🤖 Help.' },
];

/** Lots of help for the first this-many jumps (about 3 days), then Some. */
export const LOTS_UNTIL_JUMPS = 30;

/** Bolt's pick from how many jumps the pupil has made. (To switch help off for everyone, return 'off' here.) */
export const autoLevel = (jumps: number): HelpLevel => (jumps < LOTS_UNTIL_JUMPS ? 'lots' : 'some');

/** The level in use: the pupil's own pick wins. */
export const helpLevel = (picked: HelpLevel | null, jumps: number): HelpLevel => picked ?? autoLevel(jumps);

export const isLevel = (v: unknown): v is HelpLevel => v === 'lots' || v === 'some' || v === 'off';
