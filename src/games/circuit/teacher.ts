import { FINISHES_A_DAY, ROADS } from '../../../shared/circuit/game';
import { fetchCircuitEnabled, fetchCircuitMaths } from '../../data/circuit';
import { useSetting } from '../../teacher/useSetting';

/**
 * Circuit Racer on the teacher's Games table (docs/CIRCUIT-PLAN.md): the on/off switch. The server checks it on every
 * request, and the maths switch (Stage 3) at the start of every road.
 */
export function useCircuitClassSwitch(classId: string) {
  return useSetting(() => fetchCircuitEnabled(classId), [classId]);
}

export const CIRCUIT_ABOUT = `A neon racing game: students steer a spark along glowing circuit-board roads, jumping gaps and diving into the port at the end before the battery or signal runs out. ${ROADS.length} roads in the first world, opening in order; medals for time, stars for no crash and battery left. Crashes just restart the road. ${FINISHES_A_DAY} finished roads a day, then the game stops until tomorrow (Unlimited today lifts it; extra roads earn medals but no points). The server replays every finish, so times can't be faked. Off hides it from students.`;

/** The class's maths (the Maths column of the teacher's Games table). */
export function useCircuitMaths(classId: string) {
  return useSetting(() => fetchCircuitMaths(classId), [classId]);
}

export const CIRCUIT_MATHS_ABOUT =
  'Recharge ports pause the race for one question: right fills the battery and signal, wrong fills half and shows the right answer. Data gates (from world 2) split the road into lanes signed with answers: the right lane is an overclock shortcut, a wrong lane is just the normal road. The questions follow each student’s maths focus and their own records, and what they answer goes into those records. With maths off, ports just refill and every gate lane is overclock.';
