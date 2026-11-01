/**
 * Diamond Drop: the whole game, talking to a backend (the trial one in the browser for the preview and tests; the
 * `diamond` server function from Stage 3). It keeps which screen is showing and the pupil's saved progress as the
 * backend last sent it. Every rule is the shared one (shared/diamond/).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type BoostId, type Slot } from '../../../shared/diamond/config';
import { nextStep } from '../../../shared/diamond/nextStep';
import { canStart, levelsOpen, type Player } from '../../../shared/diamond/progress';
import type { DiamondBackend, Ended, Started } from './backend';
import { LevelMap, type MapButton } from './LevelMap';
import { GemBook, HowToPlay, LevelEnd, Shop } from './Pages';
import { PlayLevel } from './PlayLevel';
import { loadPrefs, savePrefs, wantsLessMotion, type DiamondPrefs } from './prefs';
import { Workshop } from './Workshop';
import './diamond.css';

type Screen = 'map' | 'play' | 'end' | 'shop' | 'workshop' | 'book' | 'how';

export interface GameHandle {
  /** Load the pupil again from the backend (after a preview tool changed it). */
  reload(): void;
}

/** The level a pupil most likely wants next: today's new level if it's open, else their deepest. */
function bestLevel(p: Player, now: Date): number {
  const open = levelsOpen(p, now);
  if (open.next !== null && open.nextOpen) return open.next;
  return Math.max(1, p.deepest);
}

export function DiamondGame({ backend, onExit, extra }: { backend: DiamondBackend; onExit?: () => void; extra?: (h: GameHandle) => ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [clock, setClock] = useState<{ server: number; at: number }>({ server: Date.now(), at: Date.now() });
  const [screen, setScreen] = useState<Screen>('map');
  const [selected, setSelected] = useState(1);
  const [basket, setBasket] = useState<BoostId[]>([]);
  const [started, setStarted] = useState<Started | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [trouble, setTrouble] = useState('');
  const [glow, setGlow] = useState<MapButton | null>(null);
  const [prefs, setPrefsState] = useState<DiamondPrefs>(loadPrefs);
  const [busy, setBusy] = useState(false);
  const still = wantsLessMotion(prefs);
  const glowTimer = useRef(0);

  const now = useCallback(() => new Date(clock.server + (Date.now() - clock.at)), [clock]);

  const load = useCallback(async () => {
    const r = await backend.load();
    if (!r.ok) { setTrouble(r.message); return; }
    setPlayer(r.value.player);
    setClock({ server: r.value.now, at: Date.now() });
    setSelected(bestLevel(r.value.player, new Date(r.value.now)));
    setScreen((s) => (s === 'play' ? s : 'map'));
  }, [backend]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => window.clearTimeout(glowTimer.current), []);

  const setPrefs = (p: DiamondPrefs) => { setPrefsState(p); savePrefs(p); };

  const step = useMemo(() => (player ? nextStep(player, now()) : null), [player, now]);

  if (!player || !step) {
    return (
      <div className="dd-root">
        <p className="dd-loading" role="status">{trouble || 'Lowering the claw…'}</p>
      </div>
    );
  }

  const go = (s: Screen) => { setTrouble(''); setGlow(null); setScreen(s); };

  const start = async (level: number) => {
    if (busy) return;
    setBusy(true);
    const r = await backend.levelStart(level, basket);
    setBusy(false);
    if (!r.ok) { setTrouble(r.message); return; }
    setPlayer(r.value.player);
    setBasket([]);
    setStarted(r.value);
    setEnded(null);
    go('play');
  };

  const onEnd = (e: Ended) => {
    setPlayer(e.player);
    setEnded(e);
    const p = e.player;
    // After a level, the shop and "again" offer the same level if it wasn't passed, else the best next one.
    setSelected(e.result.passed ? bestLevel(p, now()) : e.result.level);
    go('end');
  };

  const showMe = () => {
    const b: MapButton = step.button === 'workshop' ? 'workshop' : 'play';
    if (step.level) setSelected(step.level);
    setGlow(b);
    window.clearTimeout(glowTimer.current);
    glowTimer.current = window.setTimeout(() => setGlow(null), 4000);
  };

  const buy = async (id: string) => {
    const r = await backend.buy(id);
    if (r.ok) setPlayer(r.value); else setTrouble(r.message);
  };
  const wear = async (slot: Slot, id: string | null) => {
    const r = await backend.wear(slot, id);
    if (r.ok) setPlayer(r.value); else setTrouble(r.message);
  };

  const today = now();
  const startable = canStart(player, selected, today);
  const why = startable ? '' : selected === levelsOpen(player, today).next ? `Level ${selected} opens tomorrow.` : `Level ${selected} is still locked.`;
  const againLabel = ended && ended.result.passed && selected !== ended.result.level ? `Play level ${selected}` : `Play level ${ended?.result.level ?? selected} again`;

  return (
    <div className={`dd-root${screen === 'play' ? ' dd-root--play' : ''}${still ? ' dd-still' : ''}`}>
      {onExit && screen !== 'play' && (
        <button type="button" className="button button--light-outline dd-btn dd-exit" onClick={onExit}>Leave Diamond Drop</button>
      )}
      {trouble && <p className="dd-trouble" role="alert">{trouble}</p>}
      {screen === 'map' && (
        <LevelMap
          player={player}
          now={today}
          selected={selected}
          onSelect={setSelected}
          onOpen={(b) => (b === 'play' ? void start(selected) : go(b === 'book' ? 'book' : b))}
          step={step}
          glow={glow}
          onShowMe={showMe}
          still={still}
          prefs={prefs}
          onPrefs={setPrefs}
        />
      )}
      {screen === 'play' && started && (
        <PlayLevel key={started.seed} started={started} backend={backend} prefs={prefs} still={still} worn={player.worn} onEnd={onEnd} onTrouble={setTrouble} />
      )}
      {screen === 'end' && ended && (
        <LevelEnd
          ended={ended}
          againLabel={againLabel}
          onShop={() => go('shop')}
          onAgain={() => void start(canStart(player, selected, today) ? selected : ended.result.level)}
          onMap={() => go('map')}
        />
      )}
      {screen === 'shop' && (
        <Shop
          player={player}
          level={selected}
          basket={basket}
          onToggle={(id) => setBasket((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]))}
          onStart={() => void start(selected)}
          canStart={startable && !busy}
          why={why}
          onBack={() => go('map')}
        />
      )}
      {screen === 'workshop' && <Workshop player={player} now={today} still={still} onBuy={buy} onWear={wear} onBack={() => go('map')} />}
      {screen === 'book' && <GemBook player={player} onBack={() => go('map')} />}
      {screen === 'how' && <HowToPlay onBack={() => go('map')} />}
      {extra && screen !== 'play' && extra({ reload: () => void load() })}
    </div>
  );
}
