/**
 * Star Trader in the hub: the whole game, talking to the school's `trader` server function as the signed-in pupil.
 * (The preview runs the same game on a pretend server in the browser.)
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { serverTransport, traderApi } from '../../data/trader';
import { TraderGame } from './TraderGame';

export function TraderPlay() {
  const navigate = useNavigate();
  const api = useMemo(() => traderApi(serverTransport), []);
  return <TraderGame api={api} onExit={() => navigate('/')} />;
}
