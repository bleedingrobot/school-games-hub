/**
 * Diamond Drop in the hub. Until Stage 3 builds the `diamond` server function this plays on the trial backend in the
 * browser (nothing saved to the school), and the game stays switched off (./switch.ts) and out of the registry.
 * Stage 3 swaps `trialBackend` for the server, with the same requests.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { DiamondGame } from './DiamondGame';
import { trialBackend } from './trialBackend';

export function DiamondPlay() {
  const navigate = useNavigate();
  const backend = useMemo(() => trialBackend().backend, []);
  return <DiamondGame backend={backend} onExit={() => navigate('/')} />;
}
