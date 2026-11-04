/**
 * Hop's Glow-worm Pond in the hub, on the school's `hop` server function (src/data/hop.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveHop } from '../../data/hop';
import { HopGame } from './HopGame';

export function HopPlay() {
  const navigate = useNavigate();
  return <HopGame backend={liveHop} onExit={() => navigate('/')} />;
}
