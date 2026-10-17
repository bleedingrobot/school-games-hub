import type { MathsMode } from './prefs';

/**
 * What the teacher allows for Mission Control maths. Not switched on for students yet: the
 * teacher's switch comes in stage M.5 (docs/SPACE-MATHS-PLAN.md). Until then only a local
 * development build can turn it on, with ?maths=choose or ?maths=on in the address.
 * Wormholes & Black Holes against bots and the classmates lobby both ask here.
 */
export function mathsModeFromParam(param: string | null): MathsMode {
  if (!import.meta.env.DEV) return 'off';
  return param === 'choose' || param === 'on' ? param : 'off';
}
