/**
 * Order Up! in the hub, on the school's `orderup` server function (src/data/orderup.ts). Back goes to the Activities page.
 */
import { useNavigate } from 'react-router';
import { liveOrderUp } from '../../data/orderup';
import { OrderUpGame } from './OrderUpGame';

export function OrderUpPlay() {
  const navigate = useNavigate();
  return <OrderUpGame backend={liveOrderUp} onExit={() => navigate('/activities')} />;
}
