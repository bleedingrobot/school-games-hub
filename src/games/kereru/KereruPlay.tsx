/**
 * Kererū’s Number Line in the hub, on the school's `kereru` server function (src/data/kereru.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveKereru } from '../../data/kereru';
import { KereruGame } from './KereruGame';

export function KereruPlay() {
  const navigate = useNavigate();
  return <KereruGame backend={liveKereru} onExit={() => navigate('/')} />;
}
