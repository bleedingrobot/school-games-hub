/**
 * Pipi's Hidden Shells in the hub, on the school's `pipi` server function (src/data/pipi.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { livePipi } from '../../data/pipi';
import { PipiGame } from './PipiGame';

export function PipiPlay() {
  const navigate = useNavigate();
  return <PipiGame backend={livePipi} onExit={() => navigate('/')} onOpenBeanstalk={() => navigate('/beanstalk')} />;
}
