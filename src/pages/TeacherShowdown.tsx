/** Class Showdown's projector page for teachers: /teacher/:classId/showdown (the class comes from the teacher header). */
import { Projector } from '../games/showdown/Projector';
import { liveShowdownLink } from '../games/showdown/liveLink';
import { makeShowdownSound } from '../games/showdown/audio';
import { useMemo } from 'react';
import { useTeacherClass } from '../teacher/TeacherClass';

export function TeacherShowdown() {
  const { classId, current } = useTeacherClass();
  const sound = useMemo(() => makeShowdownSound(), []);
  if (!classId) return null;
  return <Projector key={classId} link={liveShowdownLink} classId={classId} className={current?.name} sound={sound} />;
}
