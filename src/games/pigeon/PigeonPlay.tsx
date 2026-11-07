/**
 * Pigeon’s Number Line in the hub, on the school's `pigeon` server function (src/data/pigeon.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { livePigeon } from '../../data/pigeon';
import { PigeonGame } from './PigeonGame';

export function PigeonPlay() {
  const navigate = useNavigate();
  return <PigeonGame backend={livePigeon} onExit={() => navigate('/')} />;
}
