/** Circuit Racer in the hub, on the school's `circuit` server function. The preview plays the same screens on a pretend server. */
import { CircuitGame } from './CircuitGame';
import { liveCircuit } from './liveBackend';

export function CircuitPlay() {
  return <CircuitGame backend={liveCircuit} />;
}
