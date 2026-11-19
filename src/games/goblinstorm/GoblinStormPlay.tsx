/**
 * Goblin Storm in the hub, on the school's `goblinstorm` server function (./liveBackend.ts). The preview plays the same
 * screens on the browser-only `standInBackend` instead, with `onServer` off.
 */
import { GoblinStormGame } from './GoblinStormGame';
import { liveGoblinStorm } from './liveBackend';

export function GoblinStormPlay() {
  return <GoblinStormGame backend={liveGoblinStorm} onServer />;
}
