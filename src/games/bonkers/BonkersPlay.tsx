/**
 * Smash Quest in the hub, on the school's `bonkers` server function (./data.ts). The preview plays the same screens on
 * the browser-only trial backend instead.
 */
import { liveBonkers } from './data';
import { BonkersGame } from './BonkersGame';

export function BonkersPlay() {
  return <BonkersGame backend={liveBonkers} />;
}
