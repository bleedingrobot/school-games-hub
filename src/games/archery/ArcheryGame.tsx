/**
 * The whole Archery Challenge game (docs/ARCHERY-PLAN.md, section 1): home, picking a fight, packing the quiver,
 * the fight, the speed round, the Armory and How to play. Everything that counts goes through `api` (the school's
 * server, or the preview's trial one): coins, gear, every purchase, every fight's seed and result.
 */
import { useEffect, useState } from 'react';
import type { BotLevel } from '../../../shared/archery/bot';
import { EARNING_ROUNDS_PER_DAY } from '../../../shared/archery/speed';
import type { PlayerSetup, WorldId } from '../../../shared/archery/types';
import type { ArcheryApi, ArmoryState, FightStart } from '../../data/archery';
import { ArmoryScreen, type Shelf } from './ArmoryScreen';
import { PackScreen, PickScreen, trimPack } from './FightSetup';
import { FightScreen, type FightSaved } from './FightScreen';
import { HomeScreen } from './HomeScreen';
import { HowToPlay } from './HowToPlay';
import { loadChoices, loadPrefs, saveChoices, wantsLessMotion } from './prefs';
import { SpeedRound } from './SpeedRound';
import './archery.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'off'; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'home' }
  | { kind: 'pick' }
  | { kind: 'pack' }
  | { kind: 'fight'; fight: FightStart }
  | { kind: 'speed'; from: 'home' | 'armory' }
  | { kind: 'armory'; shelf: Shelf }
  | { kind: 'how' };

export function ArcheryGame({ api, onExit, extra }: {
  api: ArcheryApi;
  /** Back to the hub (left out in the preview). */
  onExit?: () => void;
  /** Something extra on the home screen (the preview's test tools). */
  extra?: (refresh: () => void) => React.ReactNode;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [state, setState] = useState<ArmoryState | null>(null);
  const [roundsLeft, setRoundsLeft] = useState(EARNING_ROUNDS_PER_DAY);
  const choices = loadChoices();
  const [world, setWorld] = useState<WorldId>(choices.world);
  const [level, setLevel] = useState<BotLevel>(choices.level);
  const [lastPack, setLastPack] = useState<PlayerSetup | null>(choices.pack);
  const [starting, setStarting] = useState(false);
  const [packProblem, setPackProblem] = useState('');
  // A speed round between rounds of a fight, shown over it.
  const [midSpeed, setMidSpeed] = useState(false);
  const lessMotion = wantsLessMotion(loadPrefs());

  async function load() {
    setScreen({ kind: 'loading' });
    await api.flush();
    const r = await api.load();
    if (!r.ok) {
      setScreen(r.why === 'game-off' ? { kind: 'off', message: r.message } : { kind: 'offline', message: r.message });
      return;
    }
    setState(r.value.state);
    setRoundsLeft(r.value.roundsLeft);
    setScreen({ kind: 'home' });
  }

  useEffect(() => {
    void load();
    // Once, when the game opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => saveChoices({ world, level, pack: lastPack }), [world, level, lastPack]);

  const setCoins = (coins: number) => setState((s) => (s ? { ...s, coins } : s));

  async function startFight(pack: PlayerSetup) {
    setStarting(true);
    setPackProblem('');
    setLastPack(pack);
    const r = await api.fightStart(world, level, pack);
    setStarting(false);
    if (!r.ok) {
      setPackProblem(r.message);
      return;
    }
    setState(r.value.state);
    setScreen({ kind: 'fight', fight: r.value });
  }

  async function finished(fight: FightStart, shots: Parameters<ArcheryApi['fightFinish']>[1]): Promise<FightSaved> {
    const r = await api.fightFinish(fight.fight, shots);
    if (!r.ok) return { line: r.message };
    setState(r.value.state);
    const pts = r.value.points;
    return {
      best: r.value.best,
      bestScore: r.value.state.best[fight.world],
      line: r.value.result === 'duplicate' ? 'Saved.' : `Saved: +${pts} point${pts === 1 ? '' : 's'}. Any arrows you didn't use are back in your bag.`,
    };
  }

  async function leaveFight(fight: FightStart, shots: Parameters<ArcheryApi['fightFinish']>[1]) {
    const r = await api.fightFinish(fight.fight, shots, true);
    if (r.ok) setState(r.value.state);
    setScreen({ kind: 'home' });
  }

  if (screen.kind === 'loading') return <div className="ar-shell"><p className="ar-wait" role="status">Opening the Armory…</p></div>;
  if (screen.kind === 'off' || screen.kind === 'offline' || !state) {
    const message = screen.kind === 'off' || screen.kind === 'offline' ? screen.message : '';
    return (
      <div className="ar-shell">
        <section className="ar-page" aria-labelledby="ar-closed-title">
          <h2 id="ar-closed-title">{screen.kind === 'off' ? 'Archery Challenge is closed' : "Archery Challenge can't open just now"}</h2>
          <p>{message}</p>
          <div className="ar-row">
            {screen.kind !== 'off' && <button type="button" className="button button--play ar-btn" onClick={() => void load()}>Try again</button>}
            {onExit && <button type="button" className="button button--light ar-btn" onClick={onExit}>Back</button>}
          </div>
        </section>
      </div>
    );
  }

  const home = () => setScreen({ kind: 'home' });
  const speed = (from: 'home' | 'armory' = 'home') => setScreen({ kind: 'speed', from });

  let body: React.ReactNode = null;
  switch (screen.kind) {
    case 'home':
      body = (
        <>
          <HomeScreen
            coins={state.coins} world={world} bow={lastPack?.bow ?? 'starter'} lessMotion={lessMotion}
            onPlay={() => setScreen({ kind: 'pick' })}
            onWorld={(w) => {
              setWorld(w);
              setScreen({ kind: 'pick' });
            }}
            onArmory={() => setScreen({ kind: 'armory', shelf: 'arrows' })}
            onBows={() => setScreen({ kind: 'armory', shelf: 'bows' })}
            onSpeed={() => speed('home')}
            onHowTo={() => setScreen({ kind: 'how' })}
            onExit={onExit}
          />
          {extra?.(() => void load())}
        </>
      );
      break;
    case 'pick':
      body = <PickScreen world={world} level={level} onWorld={setWorld} onLevel={setLevel} onBack={home} onNext={() => setScreen({ kind: 'pack' })} />;
      break;
    case 'pack':
      body = (
        <PackScreen
          state={state} world={world} level={level} initial={trimPack(lastPack, state)} busy={starting} problem={packProblem}
          onFight={(p) => void startFight(p)} onArmory={() => setScreen({ kind: 'armory', shelf: 'arrows' })} onBack={() => setScreen({ kind: 'pick' })}
        />
      );
      break;
    case 'fight': {
      const f = screen.fight;
      body = (
        <>
          <FightScreen
            key={f.fight} world={f.world} level={f.opponent} seed={f.seed} pack={f.pack} best={state.best[f.world] ?? 0}
            onExit={home}
            onFinished={(shots) => finished(f, shots)}
            onLeave={(shots) => void leaveFight(f, shots)}
            onPlayAgain={() => setScreen({ kind: 'pack' })}
            onSpeedRound={() => setMidSpeed(true)}
          />
          {midSpeed && (
            <div className="ar-over">
              <SpeedRound api={api} coins={state.coins} roundsLeft={roundsLeft} onCoins={setCoins} onRoundsLeft={setRoundsLeft} onExit={() => setMidSpeed(false)} exitLabel="Back to the fight" />
            </div>
          )}
        </>
      );
      break;
    }
    case 'speed':
      body = (
        <SpeedRound
          api={api} coins={state.coins} roundsLeft={roundsLeft} onCoins={setCoins} onRoundsLeft={setRoundsLeft}
          onExit={() => (screen.from === 'armory' ? setScreen({ kind: 'armory', shelf: 'arrows' }) : home())}
        />
      );
      break;
    case 'armory':
      body = <ArmoryScreen api={api} state={state} onState={setState} startShelf={screen.shelf} onExit={home} onEarn={() => speed('armory')} />;
      break;
    case 'how':
      body = <HowToPlay onBack={home} />;
      break;
  }
  return <div className="ar-shell" data-screen={screen.kind}>{body}</div>;
}
