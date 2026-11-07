/**
 * Lizard’s Bundles in the hub, on the school's `lizard` server function (src/data/lizard.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveLizard } from '../../data/lizard';
import { LizardGame } from './LizardGame';

export function LizardPlay() {
  const navigate = useNavigate();
  return <LizardGame backend={liveLizard} onExit={() => navigate('/')} />;
}
