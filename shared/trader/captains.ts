/**
 * The starship captains a pupil can pick (docs/prompts/trader-captains-pickup.md): 20 men (m01..m20) and 20 women
 * (f01..f20), painted on James's PC by scripts/trader-captains-art-gen.py. The choice is only a look: it changes nothing
 * in the game. It is kept in the pupil's game, so it follows them to any Chromebook; a New Season is a fresh game, so they
 * pick again then.
 */
const keys = (p: 'm' | 'f') => Array.from({ length: 20 }, (_, i) => `${p}${String(i + 1).padStart(2, '0')}`);

export const CAPTAINS_MEN: readonly string[] = keys('m');
export const CAPTAINS_WOMEN: readonly string[] = keys('f');
export const CAPTAINS: readonly string[] = [...CAPTAINS_MEN, ...CAPTAINS_WOMEN];

export const isCaptain = (id: unknown): id is string => typeof id === 'string' && CAPTAINS.includes(id);
