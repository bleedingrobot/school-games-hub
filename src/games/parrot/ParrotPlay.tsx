/**
 * Parrot’s See-saw in the hub, on the school's `parrot` server function (src/data/parrot.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveParrot } from '../../data/parrot';
import { ParrotGame } from './ParrotGame';

export function ParrotPlay() {
  const navigate = useNavigate();
  return <ParrotGame backend={liveParrot} onExit={() => navigate('/')} />;
}
