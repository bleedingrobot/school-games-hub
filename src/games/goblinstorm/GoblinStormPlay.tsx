/**
 * Goblin Storm in the hub, on the school's `goblinstorm` server function (./liveBackend.ts). The preview plays the same
 * screens on the browser-only `standInBackend` instead, with `onServer` off.
 */
import { fetchUnlimitedToday } from '../../data/unlimitedTurns';
import { GoblinStormGame } from './GoblinStormGame';
import { liveGoblinStorm } from './liveBackend';

/** The pupil's own class: is Unlimited today on for Goblin Storm? (The server checks it again at each start.) */
const unlimitedToday = async () => (await fetchUnlimitedToday()).goblinstorm;

export function GoblinStormPlay() {
  return <GoblinStormGame backend={liveGoblinStorm} onServer unlimitedToday={unlimitedToday} />;
}
