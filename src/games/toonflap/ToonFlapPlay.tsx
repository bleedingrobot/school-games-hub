/**
 * Toon Flap in the hub, on the school's `toonflap` server function (src/data/toonflap.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveToonFlap } from '../../data/toonflap';
import { ToonFlapGame } from './ToonFlapGame';

export function ToonFlapPlay() {
  const navigate = useNavigate();
  return <ToonFlapGame backend={liveToonFlap} onExit={() => navigate('/')} />;
}
