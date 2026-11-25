/** Star Web in the hub, on the school's `starweb` server function (src/data/starweb.ts). */
import { liveStarWeb } from '../../data/starweb';
import { StarWebGame } from './StarWebGame';

export function StarWebPlay() {
  return <StarWebGame backend={liveStarWeb} onServer />;
}
