/**
 * The whole Archery Challenge game (docs/ARCHERY-PLAN.md, section 1): home, picking a fight, packing the quiver,
 * the fight, the speed round, the Armory and How to play. Everything that counts goes through `api` (the school's
 * server, or the preview's trial one): coins, gear, every purchase, every fight's seed and result.
 *
 * Fights against classmates (Stage 6): with a `duels` link, the game says "I'm here" while it's open, shows the
 * classmates who are too, pops up challenges over any screen, and plays the fight one turn at a time through `api`.
 * While the teacher has classmate fights switched off (Stage 7), none of that shows.
 */
import { useCallback, useEffect, useState } from 'react';
import type { BotLevel } from '../../../shared/archery/bot';
import { PACK_MS } from '../../../shared/archery/config';
import { duelOpen, seatOf, type Classmate, type DuelRow } from '../../../shared/archery/duel';
import { nextGoal } from '../../../shared/archery/shop';
import { DAILY_COINS } from '../../../shared/archery/speed';
import type { PlayerSetup, WorldId } from '../../../shared/archery/types';
import type { ArcheryApi, ArmoryState, DuelLink, DuelResult, FightStart, SetRequest } from '../../data/archery';
import { ArmoryScreen, type Shelf } from './ArmoryScreen';
import { ChallengeAsk, ClassmatesScreen, DuelNotStarted, DuelWait } from './Classmates';
import { DuelScreen } from './DuelScreen';
import { PackScreen, PickScreen, trimPack } from './FightSetup';
import { FightScreen, type FightSaved } from './FightScreen';
import { HomeScreen } from './HomeScreen';
import { HowToPlay } from './HowToPlay';
import { loadChoices, loadPrefs, saveChoices, wantsLessMotion } from './prefs';
import { WORLD_NAMES as WORLD_NAMES_FOR } from './text';
import { SpeedRound } from './SpeedRound';
import { useDuels } from './useDuels';
import './archery.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'off'; message: string }
  | { kind: 'offline'; message: string }
  | { kind: 'home' }
  | { kind: 'pick' }
  | { kind: 'pack' }
  /** The supply chest before a bot fight (then packing). */
  | { kind: 'supply' }
  | { kind: 'fight'; fight: FightStart }
  | { kind: 'speed'; from: 'home' | 'armory' }
  /** The loot chest after a classmate fight. */
  | { kind: 'chest'; duel: number; won: boolean }
  | { kind: 'armory'; shelf: Shelf }
  | { kind: 'how' }
  | { kind: 'classmates' }
  | { kind: 'duel' };

export function ArcheryGame({ api, onExit, extra, duels: link, me = '' }: {
  api: ArcheryApi;
  /** Back to the hub (left out in the preview). */
  onExit?: () => void;
  /** Something extra on the home screen (the preview's test tools). */
  extra?: (refresh: () => void) => React.ReactNode;
  /** Classmate fights: "I'm here", reading a fight, Realtime (left out: no classmate fights). */
  duels?: DuelLink;
  /** The signed-in pupil's id (for classmate fights). */
  me?: string;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [state, setState] = useState<ArmoryState | null>(null);
  const [coinsLeft, setCoinsLeft] = useState(DAILY_COINS);
  const choices = loadChoices();
  const [world, setWorld] = useState<WorldId>(choices.world);
  const [level, setLevel] = useState<BotLevel>(choices.level);
  const [lastPack, setLastPack] = useState<PlayerSetup | null>(choices.pack);
  const [starting, setStarting] = useState(false);
  const [packProblem, setPackProblem] = useState('');
  // Maths over a bot fight: a restock between rounds, or the loot chest at the end.
  const [overFight, setOverFight] = useState<{ set: SetRequest; won?: boolean } | null>(null);
  const prefs = loadPrefs();
  const lessMotion = wantsLessMotion(prefs);
  const [mateWorld, setMateWorld] = useState<WorldId>(choices.world);
  const [duelBusy, setDuelBusy] = useState(false);
  const [duelProblem, setDuelProblem] = useState('');
  const [askProblem, setAskProblem] = useState('');
  // "I'm here" rests during a classmate fight (the fight checks itself, and the pupil shows as busy anyway).
  const [inFight, setInFight] = useState(false);
  const duels = useDuels(link, me, inFight);
  const duel = duels.duel;
  useEffect(() => setInFight(screen.kind === 'duel' && duel?.status === 'playing'), [screen.kind, duel?.status]);

  async function load() {
    setScreen({ kind: 'loading' });
    await api.flush();
    const r = await api.load();
    if (!r.ok) {
      setScreen(r.why === 'game-off' ? { kind: 'off', message: r.message } : { kind: 'offline', message: r.message });
      return;
    }
    setState(r.value.state);
    setCoinsLeft(r.value.coinsLeft);
    setScreen({ kind: 'home' });
  }

  useEffect(() => {
    void load();
    // Once, when the game opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => saveChoices({ world, level, pack: lastPack }), [world, level, lastPack]);

  const setCoins = (coins: number) => setState((s) => (s ? { ...s, coins } : s));

  // An open classmate fight (one I asked for, packing or playing) always takes over the screen, wherever the pupil is:
  // accepting a challenge, a classmate saying yes, or opening the game again part-way through.
  const openDuel = duel && duelOpen(duel) ? duel.id : null;
  useEffect(() => {
    if (openDuel !== null && screen.kind !== 'loading' && screen.kind !== 'off' && screen.kind !== 'offline') setScreen({ kind: 'duel' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDuel]);
  useEffect(() => {
    if (duels.off) setScreen({ kind: 'off', message: 'Archery Challenge is not switched on for your class.' });
  }, [duels.off]);
  // Classmate fights switched off while the list was open: back home (an open fight shows how it ended instead).
  const matesOn = !!link && duels.duelsOn;
  useEffect(() => {
    if (!matesOn && link) setScreen((s) => (s.kind === 'classmates' ? { kind: 'home' } : s));
  }, [matesOn, link]);

  /** Shows what a classmate-fight request came to: the fight as it now is, and the Armory if it changed. */
  const took = useCallback((r: DuelResult) => {
    if (r.duel) duels.accept(r.duel);
    if (r.state) setState(r.state);
    if (!r.ok && r.why === 'game-off' && !r.duel) setScreen({ kind: 'off', message: r.message });
    // Classmate fights were switched off: "I'm here" says so, and the buttons go.
    if (!r.ok && r.code === 'duels-off') void duels.refresh();
  }, [duels]);

  async function challenge(who: Classmate) {
    setDuelBusy(true);
    setDuelProblem('');
    setWorld(mateWorld);
    const r = await api.duelChallenge(who.id, mateWorld);
    setDuelBusy(false);
    took(r);
    if (!r.ok) {
      setDuelProblem(r.message);
      void duels.refresh();
    }
  }

  async function answer(id: number, accept: boolean) {
    setDuelBusy(true);
    setAskProblem('');
    const r = await api.duelAnswer(id, accept);
    setDuelBusy(false);
    if (!accept || (!r.ok && (r.code === 'late' || r.code === 'busy'))) {
      duels.forget(id);
      if (!r.ok && accept) setDuelProblem(r.message);
      return;
    }
    took(r);
    if (!r.ok) setAskProblem(r.message);
  }

  async function packForDuel(d: DuelRow, pack: PlayerSetup) {
    setStarting(true);
    setPackProblem('');
    setLastPack(pack);
    const r = await api.duelPack(d.id, pack);
    setStarting(false);
    took(r);
    if (!r.ok) setPackProblem(r.message);
  }

  async function leaveDuel(d: DuelRow) {
    const r = await api.duelLeave(d.id);
    took(r);
  }

  /** Puts an ended classmate fight away and goes home (with the gear that came back). */
  function doneWithDuel(d: DuelRow) {
    duels.forget(d.id);
    setDuelProblem('');
    // The loot chest, unless the fight never really happened or this pupil left it (the server checks again).
    const seat = seatOf(d, me);
    const chest = d.status === 'done' && (seat === 0 || seat === 1) && ['finished', 'left', 'timeouts'].includes(d.ending ?? '') && d.leaver !== seat;
    setScreen(chest ? { kind: 'chest', duel: d.id, won: d.winner === seat } : { kind: 'home' });
    void api.load().then((r) => {
      if (r.ok) setState(r.value.state);
    });
  }

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
    setOverFight(null);
    setScreen({ kind: 'fight', fight: r.value });
  }

  async function finished(fight: FightStart, shots: Parameters<ArcheryApi['fightFinish']>[1]): Promise<FightSaved> {
    const r = await api.fightFinish(fight.fight, shots);
    if (!r.ok) return { line: r.message };
    setState(r.value.state);
    if (r.value.result === 'ok') setOverFight({ set: { kind: 'chest', fight: fight.fight }, won: r.value.winner === 0 });
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
            coins={state.coins} goal={goalWords(state)} world={world} bow={lastPack?.bow ?? 'starter'} lessMotion={lessMotion} simple={prefs.simple}
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
            onClassmate={matesOn ? () => setScreen({ kind: 'classmates' }) : undefined}
          />
          {extra?.(() => void load())}
        </>
      );
      break;
    case 'pick':
      body = (
        <PickScreen
          world={world} level={level} onWorld={setWorld} onLevel={setLevel} onBack={home} onNext={() => setScreen({ kind: 'supply' })}
          onClassmate={matesOn ? () => { setMateWorld(world); setScreen({ kind: 'classmates' }); } : undefined}
        />
      );
      break;
    case 'supply':
      body = (
        <SpeedRound
          key="supply" api={api} coins={state.coins} coinsLeft={coinsLeft} set={{ kind: 'supply' }}
          onCoins={setCoins} onCoinsLeft={setCoinsLeft} onExit={() => setScreen({ kind: 'pack' })} exitLabel="Pack your quiver"
        />
      );
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
            onPlayAgain={() => setScreen({ kind: 'supply' })}
            onRoundOver={(played) => setOverFight({ set: { kind: 'restock', fight: f.fight, step: played } })}
          />
          {overFight && (
            <div className="ar-over">
              <SpeedRound
                key={JSON.stringify(overFight.set)} api={api} coins={state.coins} coinsLeft={coinsLeft} set={overFight.set} won={overFight.won}
                onCoins={setCoins} onCoinsLeft={setCoinsLeft} onExit={() => setOverFight(null)}
                exitLabel={overFight.set.kind === 'chest' ? 'See how the fight ended' : 'Back to the fight'}
              />
            </div>
          )}
        </>
      );
      break;
    }
    case 'speed':
      body = (
        <SpeedRound
          api={api} coins={state.coins} coinsLeft={coinsLeft} onCoins={setCoins} onCoinsLeft={setCoinsLeft}
          onExit={() => (screen.from === 'armory' ? setScreen({ kind: 'armory', shelf: 'arrows' }) : home())}
        />
      );
      break;
    case 'chest':
      body = (
        <SpeedRound
          key={screen.duel} api={api} coins={state.coins} coinsLeft={coinsLeft} set={{ kind: 'chest', duel: screen.duel }} won={screen.won}
          onCoins={setCoins} onCoinsLeft={setCoinsLeft} onExit={home} exitLabel="Home"
        />
      );
      break;
    case 'armory':
      body = <ArmoryScreen api={api} state={state} onState={setState} startShelf={screen.shelf} onExit={home} onEarn={() => speed('armory')} />;
      break;
    case 'how':
      body = <HowToPlay onBack={home} />;
      break;
    case 'classmates':
      body = (
        <ClassmatesScreen
          online={duels.online} offline={duels.offline} world={mateWorld} sending={duelBusy} problem={duelProblem}
          onWorld={setMateWorld} onChallenge={(c) => void challenge(c)} onRefresh={() => void duels.refresh()} onBack={home}
        />
      );
      break;
    case 'duel':
      body = duel ? duelBody(duel) : null;
      break;
  }

  /** The classmate fight's screen: waiting for an answer, packing, waiting for them to pack, the fight, or why it didn't happen. */
  function duelBody(d: DuelRow): React.ReactNode {
    const seat: number = Math.max(0, seatOf(d, me));
    const them = seat === 0 ? d.name_b : d.name_a;
    if (d.status === 'asked') {
      return (
        <DuelWait
          title={`Waiting for ${them} to say yes…`} words={`You challenged ${them} to a fight in the ${WORLD_NAMES_FOR[d.world]}.`}
          deadline={d.deadline} serverNow={duels.serverNow} cancelLabel="Call it off" onCancel={() => void leaveDuel(d)}
          onTimeUp={() => void duels.refresh()}
        />
      );
    }
    if (d.status === 'packing') {
      if (!d.packs[seat]) {
        return (
          <PackScreen
            state={state!} world={d.world} vs={them} initial={trimPack(lastPack, state!)} busy={starting} problem={packProblem}
            note={`${them} is packing too. You both have ${Math.round(PACK_MS / 60_000)} minutes.`}
            onFight={(p) => void packForDuel(d, p)} onBack={() => void leaveDuel(d)} backLabel="Leave"
          />
        );
      }
      return (
        <DuelWait
          title={`Waiting for ${them} to pack…`} words="The fight starts as soon as you've both packed."
          deadline={d.deadline} serverNow={duels.serverNow} cancelLabel="Leave" onCancel={() => void leaveDuel(d)}
          onTimeUp={() => void duels.refresh()}
        />
      );
    }
    if (d.status === 'playing' || d.status === 'done') {
      return (
        <DuelScreen
          key={d.id} duel={d} me={me} serverNow={duels.serverNow}
          onShot={(version, shot) => api.duelShot(d.id, version, shot)}
          onTimesUp={() => api.duelTimesUp(d.id)}
          onLeave={() => api.duelLeave(d.id)}
          onReply={took}
          onDone={() => doneWithDuel(d)}
        />
      );
    }
    const [title, words] = d.status === 'declined'
      ? seat === 0 ? [`${them} said no`, 'Maybe next time! Try another classmate, or a bot.'] : ['Challenge turned down', 'Maybe next time!']
      : d.status === 'expired'
        ? ['The challenge ran out', seat === 0 ? `${them} didn't answer in time.` : 'It wasn\'t answered in time.']
        : ['The fight was called off', "It didn't start, so any arrows you packed are back in your bag."];
    return <DuelNotStarted title={title} words={words} onBack={() => doneWithDuel(d)} />;
  }

  // A challenge pops up over any screen except a classmate fight (answered from the keyboard too), never while classmate
  // fights are switched off.
  const ask = screen.kind !== 'duel' && matesOn ? duels.asks[0] : undefined;
  return (
    <div className="ar-shell" data-screen={screen.kind}>
      {body}
      {ask && (
        <ChallengeAsk
          key={ask.duel} ask={ask} serverNow={duels.serverNow} busy={duelBusy} problem={askProblem}
          onAccept={() => void answer(ask.duel, true)} onDecline={() => void answer(ask.duel, false)} onGone={() => duels.forget(ask.duel)}
        />
      )}
    </div>
  );
}

/** Home's "something to save up for" line. */
function goalWords(a: ArmoryState): string | undefined {
  const g = nextGoal(a);
  if (!g) return undefined;
  return g.need > 0 ? `${g.need} more coins for the ${g.item.name}` : `You can buy the ${g.item.name}!`;
}
