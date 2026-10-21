/**
 * The Archery Challenge preview (Stage 2): pick a world and a bot, then fight. No sign-in, and it never
 * talks to the school's server: the fight runs in this browser, the bot thinks in a Web Worker, and the
 * best scores stay on this device. A fixed starter bag of a few Steel Arrows.
 * Run it: npx vite --config vite.archery-preview.config.ts. One file: see vite.archery-preview.config.ts.
 */
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MuteButton } from '../../src/components/MuteButton';
import { FightScreen, STARTER_QUIVER } from '../../src/games/archery/FightScreen';
import { loadBests } from '../../src/games/archery/prefs';
import { BOT_NAME, LEVEL_NAMES, WORLD_HINTS, WORLD_NAMES } from '../../src/games/archery/text';
import { SoundProvider } from '../../src/sound';
import { BOT_LEVELS, type BotLevel } from '../../shared/archery/bot';
import { WORLD_IDS, type WorldId } from '../../shared/archery/types';
import '../../src/styles.css';
import './preview.css';

const LEVEL_HINTS: Record<BotLevel, string> = {
  easy: 'Guesses, then walks its shots towards you. Ignores the wind.',
  medium: 'Works out a good shot, but forgets the wind at first.',
  hard: 'Thinks about the wind too. Still misses sometimes!',
};

function Picker({ onFight }: { onFight: (world: WorldId, level: BotLevel) => void }) {
  const [world, setWorld] = useState<WorldId>('forest');
  const [level, setLevel] = useState<BotLevel>('easy');
  const heading = useRef<HTMLHeadingElement>(null);
  const bests = loadBests();
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="arp-page">
      <header className="arp-head">
        <h1 ref={heading} tabIndex={-1}>Archery Challenge <small>(preview)</small></h1>
        <MuteButton />
      </header>
      <section className="arp-card" aria-labelledby="arp-world">
        <h2 id="arp-world">1. Pick a world</h2>
        <div className="arp-grid">
          {WORLD_IDS.map((w) => (
            <button key={w} type="button" className={`arp-choice arp-choice--${w}`} aria-pressed={world === w} onClick={() => setWorld(w)}>
              <b>{WORLD_NAMES[w]}</b>
              <span>{WORLD_HINTS[w]}</span>
              {bests[w] !== undefined && <small>Best here: {bests[w]}</small>}
            </button>
          ))}
        </div>
      </section>
      <section className="arp-card" aria-labelledby="arp-bot">
        <h2 id="arp-bot">2. Pick a bot to fight</h2>
        <div className="arp-grid arp-grid--three">
          {BOT_LEVELS.map((l) => (
            <button key={l} type="button" className="arp-choice" aria-pressed={level === l} onClick={() => setLevel(l)}>
              <b>{BOT_NAME} ({LEVEL_NAMES[l]})</b>
              <span>{LEVEL_HINTS[l]}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="arp-go">
        <button type="button" className="button button--play arp-fight" onClick={() => onFight(world, level)}>Fight!</button>
        <p>Best of 3 rounds. You have {STARTER_QUIVER.steel} Steel Arrows (a bigger blast) and as many Plain Arrows as you like. No aiming line: try an angle and a power, watch where it lands, and adjust.</p>
      </div>
    </main>
  );
}

function Preview() {
  const [fight, setFight] = useState<{ world: WorldId; level: BotLevel; key: number } | null>(null);
  if (fight) return <FightScreen key={fight.key} world={fight.world} level={fight.level} onExit={() => setFight(null)} />;
  return <Picker onFight={(world, level) => setFight({ world, level, key: Date.now() })} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <Preview />
    </SoundProvider>
  </StrictMode>,
);
