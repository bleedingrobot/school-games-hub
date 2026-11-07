/**
 * Swamp Hen’s Reed Rows in the hub, on the school's `swamphen` server function (src/data/swamphen.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveSwamphen } from '../../data/swamphen';
import { SwamphenGame } from './SwamphenGame';

export function SwamphenPlay() {
  const navigate = useNavigate();
  return <SwamphenGame backend={liveSwamphen} onExit={() => navigate('/')} />;
}
