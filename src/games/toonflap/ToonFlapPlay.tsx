/**
 * Toon Flap in the hub, on the school's `toonflap` server function (src/data/toonflap.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { liveToonFlap } from '../../data/toonflap';
import { ToonFlapGame } from './ToonFlapGame';

export function ToonFlapPlay() {
  return <ToonFlapGame backend={liveToonFlap} onServer />;
}
