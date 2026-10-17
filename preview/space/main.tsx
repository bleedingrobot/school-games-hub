/**
 * A stand-alone copy of Wormholes & Black Holes against bots, for trying it on a phone.
 * No sign-in, no saving and nothing from Supabase: just the game. Build: npm run space:preview
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BotLevel } from '../../shared/botGame';
import { DEFAULT_AVATAR } from '../../src/avatar/avatarParts';
import { MuteButton } from '../../src/components/MuteButton';
import { SpaceSolo } from '../../src/games/space/SpaceSolo';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

function Preview() {
  const [level, setLevel] = useState<BotLevel>('easy');
  return (
    <SoundProvider>
      <header className="preview-bar">
        <span>
          <strong>Preview</strong> · not the live site, nothing is saved
        </span>
        <MuteButton />
      </header>
      <main id="main">
        <SpaceSolo
          player={{ name: 'Captain Kiwi', avatar: DEFAULT_AVATAR }}
          level={level}
          onLevelChange={setLevel}
          maths={{ mode: 'choose', enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], division: false, multipleChoice: false, facts: [] }}
        />
      </main>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
