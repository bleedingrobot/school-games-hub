/**
 * Tūī’s Ten Tree in the hub, on the school's `tui` server function (src/data/tui.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveTui } from '../../data/tui';
import { TuiGame } from './TuiGame';

export function TuiPlay() {
  const navigate = useNavigate();
  return <TuiGame backend={liveTui} onExit={() => navigate('/')} onOpenWeka={() => navigate('/weka')} />;
}
