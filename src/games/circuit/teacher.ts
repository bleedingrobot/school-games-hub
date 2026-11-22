import { FINISHES_A_DAY, ROADS } from '../../../shared/circuit/game';
import { fetchCircuitEnabled } from '../../data/circuit';
import { useSetting } from '../../teacher/useSetting';

/**
 * Circuit Racer on the teacher's Games table (docs/CIRCUIT-PLAN.md): the on/off switch. The server checks it on every
 * request. The maths switch comes with the maths in Stage 3.
 */
export function useCircuitClassSwitch(classId: string) {
  return useSetting(() => fetchCircuitEnabled(classId), [classId]);
}

export const CIRCUIT_ABOUT = `A neon racing game: students steer a spark along glowing circuit-board roads, jumping gaps and diving into the port at the end before the battery or signal runs out. ${ROADS.length} roads in the first world, opening in order; medals for time, stars for no crash and battery left. Crashes just restart the road. ${FINISHES_A_DAY} finished roads a day, then the game stops until tomorrow (Unlimited today lifts it; extra roads earn medals but no points). The server replays every finish, so times can't be faked. Off hides it from students.`;
