/**
 * Robin’s Berry Basket in the hub, on the school's `robin` server function (src/data/robin.ts). The preview plays the same
 * screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveRobin } from '../../data/robin';
import { RobinGame } from './RobinGame';

export function RobinPlay() {
  const navigate = useNavigate();
  return <RobinGame backend={liveRobin} onExit={() => navigate('/')} />;
}
