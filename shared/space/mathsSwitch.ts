/**
 * What the teacher allows for Mission Control maths, school-wide (docs/SPACE-MATHS-PLAN.md section 3):
 * 'off' (no maths), 'choose' (students choose, the default) or 'on' (maths in every game).
 */
export type MathsSwitch = 'off' | 'choose' | 'on';

export const MATHS_SWITCHES: readonly MathsSwitch[] = ['off', 'choose', 'on'];

/** Reads the setting from the database. Anything unexpected counts as Off: nobody gets maths by accident. */
export function parseMathsSwitch(value: unknown): MathsSwitch {
  return MATHS_SWITCHES.includes(value as MathsSwitch) ? (value as MathsSwitch) : 'off';
}
