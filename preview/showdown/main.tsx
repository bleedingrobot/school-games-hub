/**
 * The Class Showdown test page: the real projector and one pupil's controller, wired to the real server steps on a
 * pretend class (shared/showdown/server.ts, memoryServices.ts). Nothing is saved. ?pretend=N pupils (default 30),
 * ?mode=class|teams2|teams4|solo, ?view=ipad to start on the controller, ?view=test for the bare stage 2 screens.
 * The floating button swaps between the big screen and "your" iPad (both keep running).
 * Run it: npx vite --config vite.showdown-preview.config.ts
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { makeShowdownSound } from '../../src/games/showdown/audio';
import { Controller } from '../../src/games/showdown/Controller';
import { pretendLink } from '../../src/games/showdown/link';
import { Projector } from '../../src/games/showdown/Projector';
import { TestController, TestProjector } from '../../src/games/showdown/TestScreens';
import '../../src/styles.css';

const ME = '00000000-0000-4000-8000-0000000000aa';
const params = new URLSearchParams(location.search);
const size = Math.max(0, Math.floor(Number(params.get('pretend') ?? 30)) || 0);
const m = params.get('mode');
const mode = m === 'teams2' || m === 'teams4' || m === 'solo' ? m : 'class';
const { teacher, pupil, classId, db } = pretendLink({ size, mode, me: { id: ME, name: 'You' } });
// ?beaten=N pretends the class has already beaten the first N bosses (in order), to try the roster and the boss picker.
const beatenN = Math.max(0, Math.min(4, Math.floor(Number(params.get('beaten') ?? 0)) || 0));
if (beatenN) db.roster.set(classId, Object.fromEntries(['river-titan', 'storm-kraken', 'clockwork-colossus', 'comet-wyrm'].slice(0, beatenN).map((b, i) => [b, 95000 + i * 31000])));
// ?health=N gives the boss (or the mountain) N health, so a test run can reach the win and seams run dry quickly.
const health = Math.max(0, Math.floor(Number(params.get('health') ?? 0)) || 0);
if (health) {
  const set = db.rooms.set.bind(db.rooms);
  db.rooms.set = (id, row) => {
    if (row.round.state === 'lobby') row.round.bossOverride = health;
    return set(id, row);
  };
}

function Page() {
  const [view, setView] = useState(params.get('view') === 'ipad' ? 'ipad' : 'big');
  const sound = useMemo(() => makeShowdownSound(), []);
  if (params.get('view') === 'test') {
    return (
      <main style={{ padding: 16 }}>
        <p>Bare test screens: nothing is saved. Open a room, join as You, press Start; {size} pretend pupils play through the real server steps.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: '2 1 360px', minWidth: 0 }}><TestProjector link={teacher} classId={classId} /></div>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}><TestController link={pupil} me={ME} /></div>
        </div>
      </main>
    );
  }
  return (
    <>
      <div style={{ display: view === 'big' ? 'contents' : 'none' }}>
        <Projector link={teacher} classId={classId} className="Room 4 (pretend)" sound={sound} />
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
