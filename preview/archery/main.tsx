/**
 * The Archery Challenge preview (Stage 3): pick a world and a bot, pack your quiver from a bag of pretend
 * coins (the real Armory prices), then fight. No sign-in, and it never talks to the school's server: the
 * fight runs in this browser, the bot thinks in a Web Worker, and the bag and best scores stay on this device.
 * Run it: npx vite --config vite.archery-preview.config.ts. One file: see vite.archery-preview.config.ts.
 */
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MuteButton } from '../../src/components/MuteButton';
import { FightScreen } from '../../src/games/archery/FightScreen';
import { loadBests } from '../../src/games/archery/prefs';
import { BOT_NAMES, LEVEL_NAMES, WORLD_HINTS, WORLD_NAMES } from '../../src/games/archery/text';
import { SoundProvider } from '../../src/sound';
import { armoryArrows, arrowKind } from '../../shared/archery/arrows';
import { BOT_KITS, BOT_LEVELS, BOT_SHIELDS, type BotLevel } from '../../shared/archery/bot';
import { BOWS, HELPERS, SHIELDS, shieldKind } from '../../shared/archery/gear';
import { WORLD_IDS, type BowId, type ItemId, type PlayerSetup, type ShieldId, type WorldId } from '../../shared/archery/types';
import '../../src/styles.css';
import './preview.css';

const LEVEL_HINTS: Record<BotLevel, string> = {
  easy: 'Guesses, then walks its shots towards you. Ignores the wind.',
  medium: 'Works out a good shot, but forgets the wind at first.',
  hard: 'Thinks about the wind too. Still misses sometimes!',
};

/** Pretend coins to spend in the preview (a perfect speed round will earn 100). */
const PRETEND_COINS = 2000;
/** You can carry at most this many of each thing (docs/ARCHERY-PLAN.md, section 4). */
const MOST = 5;
const PACK_KEY = 'archery-preview-pack-v1';

const DEFAULT_PACK: PlayerSetup = { quiver: { steel: 2, log: 1, rain: 1, glass: 1, apple: 1, umbrella: 1 }, shield: 'wood', bow: 'starter' };

function loadPack(): PlayerSetup {
  try {
    const raw = JSON.parse(localStorage.getItem(PACK_KEY) ?? 'null') as PlayerSetup | null;
    if (raw && typeof raw === 'object' && raw.quiver && typeof raw.quiver === 'object') return { quiver: { ...raw.quiver }, shield: raw.shield ?? null, bow: raw.bow ?? 'starter' };
  } catch {
    // Storage blocked: start from the default bag.
  }
  return { ...DEFAULT_PACK, quiver: { ...DEFAULT_PACK.quiver } };
}

function savePack(p: PlayerSetup) {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(p));
  } catch {
    // Not remembered, that's all.
  }
}

/** What one of an item costs (arrows sold in twos cost half a purchase each, rounded up). */
function unitPrice(id: ItemId): number {
  const h = HELPERS.find((x) => x.id === id);
  if (h) return h.price;
  const a = arrowKind(id as Parameters<typeof arrowKind>[0]);
  return Math.ceil(a.price / (a.perPurchase ?? 1));
}

function spent(p: PlayerSetup): number {
  let n = 0;
  for (const [id, count] of Object.entries(p.quiver)) n += unitPrice(id as ItemId) * (count ?? 0);
  if (p.shield) n += shieldKind(p.shield).price;
  n += BOWS.find((b) => b.id === p.bow)?.price ?? 0;
  return n;
}

function Packer({ pack, setPack }: { pack: PlayerSetup; setPack: (p: PlayerSetup) => void }) {
  const left = PRETEND_COINS - spent(pack);
  const step = (id: ItemId, by: number) => {
    const have = pack.quiver[id] ?? 0;
    const next = Math.max(0, Math.min(MOST, have + by));
    const p: PlayerSetup = { ...pack, quiver: { ...pack.quiver, [id]: next } };
    if (spent(p) <= PRETEND_COINS) setPack(p);
  };
  const choose = (p: PlayerSetup) => {
    if (spent(p) <= PRETEND_COINS) setPack(p);
  };
  const row = (id: ItemId, name: string, does: string) => {
    const have = pack.quiver[id] ?? 0;
    return (
      <li key={id} className="arp-item">
        <span className="arp-item__text"><b>{name}</b> <small>{unitPrice(id)} coins each</small><br /><span>{does}</span></span>
        <span className="arp-item__count">
          <button type="button" className="button button--light arp-step" aria-label={`One less ${name}`} disabled={have <= 0} onClick={() => step(id, -1)}>−</button>
          <output aria-label={`${name}: ${have}`}>{have}</output>
          <button type="button" className="button button--light arp-step" aria-label={`One more ${name}`} disabled={have >= MOST || unitPrice(id) > left} onClick={() => step(id, 1)}>+</button>
        </span>
      </li>
    );
  };
  return (
    <section className="arp-card" aria-labelledby="arp-pack">
      <h2 id="arp-pack">3. Pack your quiver</h2>
      <p className="arp-coins">Pretend coins left: <b>{left}</b> of {PRETEND_COINS} <small>(in the real game, coins come from maths speed rounds)</small></p>
      <h3>Arrows <small>(Plain Arrows are free and never run out; up to {MOST} of each)</small></h3>
      <ul className="arp-items">{armoryArrows().map((a) => row(a.id, a.name, a.does))}</ul>
      <h3>Helpers</h3>
      <ul className="arp-items">{HELPERS.map((h) => row(h.id, h.name, h.does))}</ul>
      <h3>Shield</h3>
      <div className="arp-grid arp-grid--three">
        <button type="button" className="arp-choice" aria-pressed={!pack.shield} onClick={() => choose({ ...pack, shield: null })}><b>No shield</b><span>Free.</span></button>
        {SHIELDS.map((sh) => (
          <button key={sh.id} type="button" className="arp-choice" aria-pressed={pack.shield === sh.id} onClick={() => choose({ ...pack, shield: sh.id as ShieldId })}>
            <b>{sh.name}</b><span>{sh.does}</span><small>{sh.price} coins</small>
          </button>
        ))}
      </div>
      <h3>Bow</h3>
      <div className="arp-grid arp-grid--three">
        {BOWS.map((b) => (
          <button key={b.id} type="button" className="arp-choice" aria-pressed={(pack.bow ?? 'starter') === b.id} onClick={() => choose({ ...pack, bow: b.id as BowId })}>
            <b>{b.name}</b><span>{b.does}</span><small>{b.price ? `${b.price} coins` : 'Free'}</small>
          </button>
        ))}
      </div>
      <div className="arp-row">
        <button type="button" className="button button--light arp-small" onClick={() => setPack({ quiver: {}, shield: null, bow: 'starter' })}>Empty the bag</button>
        <button type="button" className="button button--light arp-small" onClick={() => setPack({ ...DEFAULT_PACK, quiver: { ...DEFAULT_PACK.quiver } })}>A bit of everything</button>
      </div>
    </section>
  );
}

function Picker({ onFight }: { onFight: (world: WorldId, level: BotLevel, pack: PlayerSetup) => void }) {
  const [world, setWorld] = useState<WorldId>('forest');
  const [level, setLevel] = useState<BotLevel>('easy');
  const [pack, setPackState] = useState<PlayerSetup>(loadPack);
  const setPack = (p: PlayerSetup) => {
    setPackState(p);
    savePack(p);
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const bests = loadBests();
  useEffect(() => heading.current?.focus(), []);
  const kit = (l: BotLevel) => {
    const parts = Object.entries(BOT_KITS[l]).map(([id, n]) => `${n} ${arrowKind(id as Parameters<typeof arrowKind>[0]).name}${(n ?? 0) > 1 ? 's' : ''}`);
    const sh = BOT_SHIELDS[l];
    return `Brings ${parts.join(', ')}${sh ? ` and a ${shieldKind(sh).name}` : ''}.`;
  };
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
              <b>{BOT_NAMES[l]} ({LEVEL_NAMES[l]})</b>
              <span>{LEVEL_HINTS[l]}</span>
              <small>{kit(l)}</small>
            </button>
          ))}
        </div>
      </section>
      <Packer pack={pack} setPack={setPack} />
      <div className="arp-go">
        <button type="button" className="button button--play arp-fight" onClick={() => onFight(world, level, pack)}>Fight!</button>
        <p>Best of 3 rounds. Arrows you shoot are used up; anything you don't shoot comes back. No aiming line: try an angle and a power, watch where it lands, and adjust.</p>
      </div>
    </main>
  );
}

function Preview() {
  const [fight, setFight] = useState<{ world: WorldId; level: BotLevel; pack: PlayerSetup; key: number } | null>(null);
  if (fight) return <FightScreen key={fight.key} world={fight.world} level={fight.level} pack={fight.pack} onExit={() => setFight(null)} />;
  return <Picker onFight={(world, level, pack) => setFight({ world, level, pack, key: Date.now() })} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <Preview />
    </SoundProvider>
  </StrictMode>,
);
