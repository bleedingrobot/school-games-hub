/**
 * Penguin Pairs in the hub, on the school's `korora` server function (src/data/korora.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveKorora } from '../../data/korora';
import { KororaGame } from './KororaGame';

export function KororaPlay() {
  const navigate = useNavigate();
  return <KororaGame backend={liveKorora} onExit={() => navigate('/')} onOpenWeka={() => navigate('/weka')} />;
}
