/**
 * Diamond Drop in the hub, on the school's `diamond` server function (src/data/diamond.ts). The preview plays the same
 * screens on the browser-only trial backend instead. The way back to the hub is the map's ⌂ Hub button.
 */
import { liveDiamond } from '../../data/diamond';
import { DiamondGame } from './DiamondGame';

export function DiamondPlay() {
  return <DiamondGame backend={liveDiamond} onServer />;
}
