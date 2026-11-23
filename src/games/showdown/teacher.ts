import { fetchShowdownEnabled } from '../../data/showdown';
import { useSetting } from '../../teacher/useSetting';

/** Class Showdown on the teacher's Games table: the on/off switch. The server checks it on every step. */
export function useShowdownClassSwitch(classId: string) {
  return useSetting(() => fetchShowdownEnabled(classId), [classId]);
}

export const SHOWDOWN_ABOUT = 'A live maths battle for the whole class: you run it on the projector, everyone answers on their own device.';
