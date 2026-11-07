/**
 * Hop's Glow-worm Pond in the hub, on the school's `hop` server function (src/data/hop.ts). The preview plays the same
 * screens on the browser-only trial backend instead. Once the twos are secure the finish screen points on to Penguin Pairs,
 * when the class has it on (maths review R8).
 */
import { useNavigate } from 'react-router';
import { liveHop } from '../../data/hop';
import { penguinPairs } from '../korora';
import { useKororaEnabled } from '../korora/switch';
import { HopGame } from './HopGame';
import { WORDS } from './words';

export function HopPlay() {
  const navigate = useNavigate();
  const kororaOn = useKororaEnabled();
  const nextGame = kororaOn ? { name: WORDS.signpostGame, Icon: penguinPairs.Icon, open: () => navigate('/korora') } : null;
  return <HopGame backend={liveHop} onExit={() => navigate('/')} nextGame={nextGame} />;
}
