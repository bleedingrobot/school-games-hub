/**
 * Mine Runner: the level picker and a run. In this stage there is no server: nothing is saved except best times on this
 * device, and the question doors and pads use trial questions that exist only in the phone preview (see trialMaths.ts).
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { LEVELS, PRACTICE, formatClock, type LevelInfo } from './levels';
import { loadBests, loadPrefs, savePrefs, type Bests, type MinePrefs } from './prefs';
import { ControlsHelp, HowToPlayBody, SettingsPanel } from './Settings';
import './mine.css';

// The picture (three.js) and the run screen load only when someone starts a mine.
const MineRun = lazy(() => import('./MineRun').then((m) => ({ default: m.MineRun })));

function Heading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <h2 ref={ref} tabIndex={-1}>{children}</h2>;
}

/**
 * `trial` is for the stand-alone preview (no server): question doors and pads use trial questions made and marked in the
 * browser. The real game will not use it; Stage 4 brings the server-made questions.
 */
function MineRoot({ trial }: { trial: boolean }) {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [prefs, setPrefs] = useState<MinePrefs>(() => loadPrefs(player));
  const [bests, setBests] = useState<Bests>(() => loadBests(player));
  const [run, setRun] = useState<{ level: LevelInfo; round: number } | null>(null);
  const [screen, setScreen] = useState<'picker' | 'howto' | 'controls'>('picker');

  function changePrefs(p: MinePrefs) {
    setPrefs(p);
    savePrefs(p, player);
  }

  if (run) {
    const index = LEVELS.findIndex((l) => l.id === run.level.id);
    const next = index >= 0 && index < LEVELS.length - 1 && (trial || !LEVELS[index + 1].needsQuestions) ? LEVELS[index + 1] : null;
    return (
      <Suspense fallback={<p role="status" className="mn-loading">Loading the mine…</p>}>
        <MineRun
          key={`${run.level.id}-${run.round}`}
          level={run.level}
          prefs={prefs}
          onPrefs={changePrefs}
          player={player}
          trial={trial}
          onFinish={() => setBests(loadBests(player))}
          onAgain={() => setRun({ level: run.level, round: run.round + 1 })}
          onNext={next ? () => setRun({ level: next, round: 0 }) : null}
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

  const card = (l: LevelInfo) => {
    const locked = l.needsQuestions && !trial;
    const best = bests[l.id];
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
        {!l.practice && <p className="mn-level__best">{best !== undefined ? `Best on this device: ${formatClock(best)}` : 'No time yet'}</p>}
        <button type="button" className="button button--play mn-btn" disabled={locked} onClick={() => setRun({ level: l, round: 0 })}>
          Play {l.name}
        </button>
        {locked && <p className="mn-hint">Needs the school’s question server (coming soon).</p>}
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
        <details className="mn-more">
          <summary>Settings</summary>
          <SettingsPanel prefs={prefs} onChange={changePrefs} />
        </details>
      </div>
      <h3 className="mn-subhead">Start here</h3>
      <ul className="mn-levels">{card(PRACTICE)}</ul>
      <h3 className="mn-subhead">The mines</h3>
      <ul className="mn-levels">{LEVELS.map(card)}</ul>
    </section>
  );
}

export const MinePlay = () => <MineRoot trial={false} />;
/** The stand-alone preview: question doors and pads use trial questions made and marked in the browser. */
export const MinePreview = () => <MineRoot trial />;
