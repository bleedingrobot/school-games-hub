/**
 * Class Live for teachers: /teacher/:classId/classlive (the class comes from the teacher header). One page for every class
 * game (James, 24 Nov 2026): Star Web, Serpent Chain, Mystery Mural and Class Showdown share one picker; Showdown's own
 * projector takes over once one of its arenas is opened, and goes back to the picker when it is done.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Projector } from '../games/classlive/Projector';
import { liveClassLiveLink } from '../games/classlive/liveLink';
import { makeClassLiveSound } from '../games/classlive/audio';
import { keptShowdownRoom, type ShowdownStart } from '../games/showdown/Projector';
import { showdownOn } from '../games/showdown/switch';
import { useShowdownClassSwitch } from '../games/showdown/teacher';
import { useTeacherClass } from '../teacher/TeacherClass';

const TeacherShowdown = lazy(() => import('./TeacherShowdown').then((m) => ({ default: m.TeacherShowdown })));

export function TeacherClassLive() {
  const { classId, current } = useTeacherClass();
  const sound = useMemo(() => makeClassLiveSound(), []);
  const [params] = useSearchParams();
  const showdownSwitch = useShowdownClassSwitch(classId ?? '');
  const showdown = showdownOn() && showdownSwitch.value !== false;
  // A Showdown room still running in this tab, or a link to /showdown, opens on Showdown.
  const [battle, setBattle] = useState<{ start?: ShowdownStart } | null>(() => (showdownOn() && (params.get('game') === 'showdown' || keptShowdownRoom()) ? {} : null));
  if (!classId) return null;
  if (battle) {
    return (
      <Suspense fallback={null}>
        <TeacherShowdown key={classId} start={battle.start} onLeave={() => setBattle(null)} />
      </Suspense>
    );
  }
  return (
    <Projector key={classId} link={liveClassLiveLink} classId={classId} className={current?.name} sound={sound}
      onShowdown={showdown ? (start) => setBattle({ start }) : null} />
  );
}
