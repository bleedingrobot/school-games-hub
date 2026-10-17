/**
 * Preview only: the Maths Monsters test page. A monster book of all 54 monsters and a battle
 * playground. Nothing is saved: reloading starts fresh. Build: npm run monsters:preview
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SoundProvider } from '../../src/sound';
import { MuteButton } from '../../src/components/MuteButton';
import '../../src/styles.css';
import '../../src/games/monsters/monsters.css';
import './monsters-preview.css';
import { MonsterBookPage } from './MonsterBookPage';
import { PlaygroundPage } from './PlaygroundPage';
import { WalkPage } from './WalkPage';

function Preview() {
  const [tab, setTab] = useState<'book' | 'battle' | 'walk'>('book');
  const [battling, setBattling] = useState(false);
  return (
    <SoundProvider>
      <header className="preview-bar" hidden={battling}>
        <span>
          <strong>Maths Monsters test page</strong> · not the live site, nothing is saved
        </span>
        <MuteButton />
      </header>
      <nav className="mp-tabs" aria-label="Test page sections" hidden={battling}>
        <button type="button" aria-pressed={tab === 'book'} onClick={() => setTab('book')}>Monster book</button>
        <button type="button" aria-pressed={tab === 'battle'} onClick={() => setTab('battle')}>Battle playground</button>
        <button type="button" aria-pressed={tab === 'walk'} onClick={() => setTab('walk')}>Walk around</button>
      </nav>
      <main id="main">{tab === 'book' ? <MonsterBookPage /> : tab === 'battle' ? <PlaygroundPage onBattling={setBattling} /> : <WalkPage onBattling={setBattling} />}</main>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
