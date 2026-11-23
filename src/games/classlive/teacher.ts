import { fetchClassLiveEnabled } from '../../data/classlive';
import { useSetting } from '../../teacher/useSetting';

/** Class Live on the teacher's Games table: the on/off switch. The server checks it on every step. */
export function useClassLiveClassSwitch(classId: string) {
  return useSetting(() => fetchClassLiveEnabled(classId), [classId]);
}

export const CLASSLIVE_ABOUT = 'Whole-class games for the big screen (Star Web and more): you run them on the projector, everyone plays on their own device.';
