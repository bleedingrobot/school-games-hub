/**
 * Mine Runner: the level picker and a run.
 *
 * The real game talks to the school's server (src/data/mine.ts): a counted dive starts there, every question is marked
 * there, and a finished run is sent there to be replayed and kept. If the server can't be reached the mine can still be
 * flown as practice and nothing counts. The phone preview (`trial`) never calls the server: its question doors and pads
 * use trial questions made in the browser (trialMaths.ts), and best times stay on the device.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { fetchMineMaths, flushRuns, loadServerBests, queuedRuns, startRun, bestKey, type ServerBests, type StartReply } from '../../data/mine';
import { medalFor, MEDALS, type Medal } from '../../../shared/mine/medals';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { LEVELS, PRACTICE, baseOf, formatClock, hardOf, type LevelInfo } from './levels';
import { MineBoard } from './MineBoard';
import { loadBests, loadPrefs, savePrefs, type Bests, type MinePrefs } from './prefs';
import { ControlsHelp, HowToPlayBody, SettingsPanel } from './Settings';
import './mine.css';

// The picture (three.js) and the run screen load only when someone starts a mine.
const MineRun = lazy(() => import('./MineRun').then((m) => ({ default: m.MineRun })));

const MEDAL_WORDS: Record<Medal, string> = { gold: 'gold medal', silver: 'silver medal', bronze: 'bronze medal' };

function Heading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <h2 ref={ref} tabIndex={-1}>{children}</h2>;
}

interface Dive {
  level: LevelInfo;
  round: number;
  /** The server's start for a counted dive; null when nothing is counted (practice, or the server could not be reached). */
  started: StartReply | null;
}

/**
 * `trial` is for the stand-alone preview (no server): question doors and pads use trial questions made and marked in the
 * browser, and nothing is sent anywhere.
 */
function MineRoot({ trial }: { trial: boolean }) {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [prefs, setPrefs] = useState<MinePrefs>(() => loadPrefs(player));
  const [deviceBests, setDeviceBests] = useState<Bests>(() => loadBests(player));
  const [serverBests, setServerBests] = useState<ServerBests | null>(null);
  const [mathsSwitch, setMathsSwitch] = useState<MathsSwitch | null>(null);
  const [run, setRun] = useState<Dive | null>(null);
  const [screen, setScreen] = useState<'picker' | 'howto' | 'controls' | 'board'>('picker');
  const [boardFor, setBoardFor] = useState<LevelInfo>(LEVELS[0]);
  const [hard, setHard] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; practice?: LevelInfo } | null>(null);

  function changePrefs(p: MinePrefs) {
    setPrefs(p);
    savePrefs(p, player);
  }

  const reloadBests = () => {
    void loadServerBests().then((b) => b && setServerBests(b));
  };

  // The real game: the teacher's maths switch, the pupil's saved times, and any finished run still waiting to be sent.
  useEffect(() => {
    if (trial) return;
    let current = true;
    void fetchMineMaths().then((m) => current && setMathsSwitch(m));
    if (player && queuedRuns(player).length) void flushRuns(player).then(() => current && reloadBests());
    else reloadBests();
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial, player]);

  /** Does this pupil fly with maths? The teacher's switch decides, or the pupil does when the teacher lets them. */
  const wantsMaths = mathsSwitch === 'on' ? true : mathsSwitch === 'off' ? false : prefs.maths;
  const flight = prefs.steady ? 'steady' : 'free';

  /** Starts a dive. Anything that isn't practice asks the server first. Returns when the dive screen is up (or the notice is). */
  async function dive(level: LevelInfo, round: number): Promise<void> {
    if (trial || level.practice) {
      setRun({ level, round, started: null });
      return;
    }
    setNotice(null);
    setStarting(level.id);
    let result = await startRun(level.id, flight, wantsMaths);
    if (!result.ok && (result.reason === 'maths-off' || result.reason === 'maths-on')) {
      // The teacher's switch changed under us: follow it.
      setMathsSwitch(result.reason === 'maths-off' ? 'off' : 'on');
      result = await startRun(level.id, flight, result.reason === 'maths-on');
    }
    setStarting(null);
    if (result.ok) {
      setRun({ level, round, started: result.run });
      return;
    }
    setRun(null);
    setNotice(result.reason === 'offline' ? { text: result.message, practice: level } : { text: result.message });
  }

  if (run) {
    const index = LEVELS.findIndex((l) => l.id === baseOf(run.level).id);
    const following = index >= 0 && index < LEVELS.length - 1 ? LEVELS[index + 1] : null;
    const next = following && run.level.hard ? hardOf(following) : following;
    const serverBest = run.started ? (serverBests?.[bestKey(run.level.id, run.started.maths)] ?? null) : null;
    return (
      <Suspense fallback={<p role="status" className="mn-loading">Loading the mine…</p>}>
        <MineRun
          key={`${run.level.id}-${run.round}`}
          level={run.level}
          prefs={prefs}
          onPrefs={changePrefs}
          player={player}
          trial={trial}
          started={run.started}
          serverBest={serverBest}
          onFinish={() => (trial ? setDeviceBests(loadBests(player)) : reloadBests())}
          onAgain={() => dive(run.level, run.round + 1)}
          onNext={next ? () => dive(next, 0) : null}
          onExit={() => setRun(null)}
        />
      </Suspense>
    );
  }

  if (screen === 'howto' || screen === 'controls') {
    return (
      <section className="mn-picker">
        <Heading>{screen === 'howto' ? 'How to play Mine Runner' : 'Controls'}</Heading>
        <div className="mn-card">{screen === 'howto' ? <HowToPlayBody questions /> : <ControlsHelp />}</div>
        <button type="button" className="button button--play mn-btn" onClick={() => setScreen('picker')}>Back to the mines</button>
      </section>
    );
  }

  if (screen === 'board') {
    return <MineBoard level={boardFor} defaultMaths={wantsMaths} showMaths={mathsSwitch !== 'off' && mathsSwitch !== 'on'} onBack={() => setScreen('picker')} />;
  }

  const card = (base: LevelInfo) => {
    const l = hard ? hardOf(base) : base;
    const bestSteps = trial ? deviceBests[l.id] : serverBests?.[bestKey(l.id, wantsMaths)];
    const medal = bestSteps !== undefined ? medalFor(l.id, bestSteps) : null;
    const goals = MEDALS[l.id];
    return (
      <li key={l.id} className="mn-level">
        <div className="mn-level__head">
          <h3>{l.name}</h3>
          {!l.practice && (
            <span className="mn-level__dots" role="img" aria-label={`Difficulty ${l.difficulty} out of 6`}>
              {'●'.repeat(l.difficulty)}
              <span aria-hidden="true">{'○'.repeat(6 - l.difficulty)}</span>
            </span>
          )}
        </div>
        <p>{l.blurb}</p>
        {!l.practice && (
          <p className="mn-level__best">
            {bestSteps !== undefined ? `${trial ? 'Best on this device' : 'Your best'}: ${formatClock(bestSteps)}${medal ? ` (${MEDAL_WORDS[medal]})` : ''}` : 'No time yet'}
          </p>
        )}
        {goals && <p className="mn-hint">Medals: gold {formatClock(goals.gold * 30)}, silver {formatClock(goals.silver * 30)}, bronze {formatClock(goals.bronze * 30)}</p>}
        <div className="mn-level__actions">
          <button type="button" className="button button--play mn-btn" disabled={starting !== null} onClick={() => void dive(l, 0)}>
            {starting === l.id ? 'Starting…' : `Play ${l.name}`}
          </button>
          {!trial && !l.practice && (
            <button type="button" className="button button--light mn-btn" onClick={() => { setBoardFor(l); setScreen('board'); }}>
              School board
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="mn-picker">
      <div className="mn-picker__top">
        <Heading>Mine Runner</Heading>
        <div className="mn-row">
          <button type="button" className="button button--light mn-btn" onClick={() => setScreen('howto')}>How to play</button>
          <button type="button" className="button button--light mn-btn" onClick={() => setScreen('controls')}>Controls</button>
        </div>
      </div>
      <div className="mn-card">
        <p className="mn-intro">Fly your ship down the mine, find the keys, blow up the reactor and race back to the exit. A wrecked ship is rebuilt a little way back. It never means game over.</p>
        {trial && <p className="mn-trialnote">Preview: question doors use trial questions, and nothing is sent to the school. Best times stay on this device.</p>}
        {!trial && mathsSwitch === 'choose' && (
          <label className="mn-check">
            <input type="checkbox" checked={prefs.maths} onChange={(e) => changePrefs({ ...prefs, maths: e.target.checked })} />
            <span>Fly with maths questions <small>Question doors and power-up pads ask a maths question. Flights with and without maths have their own boards.</small></span>
          </label>
        )}
        {!trial && mathsSwitch === 'on' && <p className="mn-hint">Your class flies with maths questions at the doors and pads.</p>}
        {!trial && mathsSwitch === 'off' && <p className="mn-hint">Maths questions are switched off for your class, so the question doors are open.</p>}
        {notice && (
          <div className="mn-notice" role="alert">
            <p>{notice.text}</p>
            {notice.practice && (
              <button
                type="button"
                className="button button--light mn-btn"
                onClick={() => {
                  setNotice(null);
                  setRun({ level: notice.practice as LevelInfo, round: 0, started: null });
                }}
              >
                Fly it as practice (nothing is saved)
              </button>
            )}
          </div>
        )}
        <details className="mn-more">
          <summary>Settings</summary>
          <SettingsPanel prefs={prefs} onChange={changePrefs} />
        </details>
      </div>
      <h3 className="mn-subhead">Start here</h3>
      <ul className="mn-levels">{card(PRACTICE)}</ul>
      <h3 className="mn-subhead">The mines</h3>
      <div className="mn-card">
        <label className="mn-check">
          <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} />
          <span>Hard mode: more and tougher robots, fewer pick-ups, a shorter escape. It has its own times.</span>
        </label>
      </div>
      <ul className="mn-levels">{LEVELS.map(card)}</ul>
    </section>
  );
}

export const MinePlay = () => <MineRoot trial={false} />;
/** The stand-alone preview: question doors and pads use trial questions made and marked in the browser. */
export const MinePreview = () => <MineRoot trial />;
