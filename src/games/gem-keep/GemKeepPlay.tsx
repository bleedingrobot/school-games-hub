import { PROTOTYPE_LEVEL } from '../../../shared/gem-keep/levels/prototype';
import { GemKeepGame } from './ui/GemKeepGame';

/** Gem Keep for the signed-in student. Phase 1: the one prototype level, nothing saved yet. */
export function GemKeepPlay() {
  return <GemKeepGame level={PROTOTYPE_LEVEL} />;
}
