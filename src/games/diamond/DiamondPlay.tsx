/**
 * Diamond Drop in the hub, on the school's `diamond` server function (src/data/diamond.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveDiamond } from '../../data/diamond';
import { DiamondGame } from './DiamondGame';

export function DiamondPlay() {
  const navigate = useNavigate();
  return <DiamondGame backend={liveDiamond} onExit={() => navigate('/')} />;
}
