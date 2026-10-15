/**
 * A stand-alone copy of 101 against bots, for trying it on a phone.
 * No sign-in, no saving and nothing from Supabase: just the game. Build: npm run 101:preview
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BotLevel } from '../../shared/botGame';
import { DEFAULT_AVATAR } from '../../src/avatar/avatarParts';
import { MuteButton } from '../../src/components/MuteButton';
import { Card101Solo } from '../../src/games/card101/Card101Solo';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import '../space/preview.css';

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
        <Card101Solo player={{ name: 'Captain Kiwi', avatar: DEFAULT_AVATAR }} level={level} onLevelChange={setLevel} />
      </main>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
