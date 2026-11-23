/**
 * The Class Showdown test page: a teacher projector and one pupil controller side by side, wired to the real server steps on a
 * pretend class (shared/showdown/server.ts, memoryServices.ts). Nothing is saved. ?pretend=N pupils (default 30),
 * ?mode=class|teams2|teams4|solo. Run it: npx vite --config vite.showdown-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { pretendLink } from '../../src/games/showdown/link';
import { TestController, TestProjector } from '../../src/games/showdown/TestScreens';
import '../../src/styles.css';

const ME = '00000000-0000-4000-8000-0000000000aa';
const params = new URLSearchParams(location.search);
const size = Math.max(0, Math.floor(Number(params.get('pretend') ?? 30)) || 0);
const m = params.get('mode');
const mode = m === 'teams2' || m === 'teams4' || m === 'solo' ? m : 'class';
const { teacher, pupil, classId } = pretendLink({ size, mode, me: { id: ME, name: 'You' } });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <main style={{ padding: 16 }}>
      <p>Test page: nothing is saved. Open a room, join as You, press Start; {size} pretend pupils play through the real server steps.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 360px', minWidth: 0 }}><TestProjector link={teacher} classId={classId} /></div>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}><TestController link={pupil} me={ME} /></div>
      </div>
    </main>
  </StrictMode>,
);
