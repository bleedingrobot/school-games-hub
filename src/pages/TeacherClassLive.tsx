/** Class Live's projector page for teachers: /teacher/:classId/classlive (the class comes from the teacher header). */
import { Projector } from '../games/classlive/Projector';
import { liveClassLiveLink } from '../games/classlive/liveLink';
import { makeClassLiveSound } from '../games/classlive/audio';
import { useMemo } from 'react';
import { useTeacherClass } from '../teacher/TeacherClass';

export function TeacherClassLive() {
  const { classId, current } = useTeacherClass();
  const sound = useMemo(() => makeClassLiveSound(), []);
  if (!classId) return null;
  return <Projector key={classId} link={liveClassLiveLink} classId={classId} className={current?.name} sound={sound} />;
}
