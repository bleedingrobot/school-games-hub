/**
 * The Class Live test page: the real projector and one pupil's controller, wired to the real server steps on a pretend
 * class (shared/classlive/server.ts, memoryServices.ts). Nothing is saved. ?pretend=N pupils (default 30), ?view=ipad to
 * start on the controller. The floating button swaps between the big screen and "your" device (both keep running).
 * Run it: npx vite --config vite.classlive-preview.config.ts
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { makeClassLiveSound } from '../../src/games/classlive/audio';
import { Controller } from '../../src/games/classlive/Controller';
import { pretendLink } from '../../src/games/classlive/link';
import { Projector } from '../../src/games/classlive/Projector';
import '../../src/styles.css';

const ME = '00000000-0000-4000-8000-0000000000aa';
const params = new URLSearchParams(location.search);
const size = Math.max(0, Math.floor(Number(params.get('pretend') ?? 30)) || 0);
const { teacher, pupil, classId } = pretendLink({ size, me: { id: ME, name: 'You' } });

function Page() {
  const [view, setView] = useState(params.get('view') === 'ipad' ? 'ipad' : 'big');
  const sound = useMemo(() => makeClassLiveSound(), []);
  return (
    <>
      <div style={{ display: view === 'big' ? 'contents' : 'none' }}>
        <Projector link={teacher} classId={classId} className="Room 4 (pretend)" sound={sound} onShowdown={(s) => console.log("showdown", JSON.stringify(s))} />
      </div>
      <div style={{ display: view === 'ipad' ? 'contents' : 'none' }}>
        <Controller link={pupil} me={ME} />
      </div>
      <button
        type="button"
        onClick={() => setView(view === 'big' ? 'ipad' : 'big')}
        style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 100, padding: '10px 14px', borderRadius: 999, border: 0, background: '#ffd54a', color: '#1b1b1b', fontWeight: 700, minHeight: 44 }}
      >
        {view === 'big' ? '📱 Be a pupil' : '🖥️ Big screen'}
      </button>
    </>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
