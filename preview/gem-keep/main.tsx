/**
 * A stand-alone copy of Gem Keep, for trying it without signing in (and for browser test
 * scripts, which get the engine as window.gemKeep), plus a maths practice tab for the
 * question box and number pad. Nothing is saved.
 * Build: npm run gem-keep:preview. Or run it: npx vite --config vite.gem-keep-preview.config.ts
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { spawnEnemy } from '../../shared/gem-keep/engine';
import { MuteButton } from '../../src/components/MuteButton';
import type { GameEngine } from '../../src/games/gem-keep/engine/GameEngine';
import { DEFAULT_SETTINGS, type GemKeepSettings } from '../../src/games/gem-keep/settings';
import { GemKeepCampaign } from '../../src/games/gem-keep/ui/GemKeepCampaign';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import '../space/preview.css';
import { MathsPractice } from './MathsPractice';
import './practice.css';

declare global {
  interface Window {
    gemKeep?: { engine: GameEngine; spawnEnemy: typeof spawnEnemy };
  }
}

const expose = (engine: GameEngine) => (window.gemKeep = { engine, spawnEnemy });

/** Preview only: the teacher settings that Phase 5 puts on the teacher page. Changing one goes back to the map. */
function SettingsBar({ settings, onChange }: { settings: GemKeepSettings; onChange: (s: GemKeepSettings) => void }) {
  return (
    <div className="preview-settings" role="group" aria-label="Teacher settings (preview)">
      <strong>Teacher settings:</strong>
      <label>
        <input
          type="checkbox"
          checked={settings.mode === 'challenge'}
          onChange={(e) => onChange({ ...settings, mode: e.target.checked ? 'challenge' : 'calm' })}
        />{' '}
        Challenge mode (game keeps going during questions)
      </label>
      <label>
        <input type="checkbox" checked={settings.multipleChoice} onChange={(e) => onChange({ ...settings, multipleChoice: e.target.checked })} />{' '}
        Multiple choice
      </label>
      <label>
        <input type="checkbox" checked={settings.division} onChange={(e) => onChange({ ...settings, division: e.target.checked })} /> Division
      </label>
    </div>
  );
}

function Preview() {
  const [tab, setTab] = useState<'game' | 'maths'>('game');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  return (
    <SoundProvider>
      <header className="preview-bar">
        <span>
          <strong>Preview</strong> · not the live site, nothing is saved
        </span>
        <nav className="preview-tabs" aria-label="Preview">
          <button type="button" aria-pressed={tab === 'game'} onClick={() => setTab('game')}>
            Game
          </button>
          <button type="button" aria-pressed={tab === 'maths'} onClick={() => setTab('maths')}>
            Maths practice
          </button>
        </nav>
        <MuteButton />
      </header>
      <main id="main">
        {tab === 'game' ? (
          <>
            <SettingsBar settings={settings} onChange={setSettings} />
            <GemKeepCampaign key={JSON.stringify(settings)} settings={settings} onEngine={expose} />
          </>
        ) : (
          <MathsPractice />
        )}
      </main>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
