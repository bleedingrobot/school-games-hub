/**
 * Weka’s Stepping Stones in the hub, on the school's `weka` server function (src/data/weka.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveWeka } from '../../data/weka';
import { WekaGame } from './WekaGame';

export function WekaPlay() {
  const navigate = useNavigate();
  return <WekaGame backend={liveWeka} onExit={() => navigate('/')} />;
}
