/**
 * Toon Flap: the map, the Hangar, How to play, the run and the results (docs/TOON-FLAP-PLAN.md). The game only talks to the
 * backend it is given: the trial one in the preview, the school's server in stage F.3.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LEVELS } from '../../../shared/toonflap/levels';
import type { FinishReply, Loaded, Picks, StartReply, ToonFlapBackend } from './backend';
import { Hangar } from './Hangar';
import { HowToPlay } from './HowToPlay';
import { MapScreen } from './MapScreen';
import { PlayScreen } from './PlayScreen';
import { ResultsScreen } from './ResultsScreen';
import './toonflap.css';

type Screen = 'map' | 'hangar' | 'howto' | 'play' | 'results';

const GENTLE_KEY = 'toonflap-gentle';
const readGentle = (): boolean => {
  try {
    return localStorage.getItem(GENTLE_KEY) === '1';
  } catch {
    return false;
  }
};

export function ToonFlapGame({ backend, extra }: { backend: ToonFlapBackend; extra?: (h: { reload(): void }) => ReactNode }) {
  const [screen, setScreen] = useState<Screen>('map');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [gentle, setGentle] = useState(readGentle);
  const [run, setRun] = useState<StartReply | null>(null);
  const [level, setLevel] = useState(1);
  const [reply, setReply] = useState<FinishReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    backend.load().then(setLoaded, () => setFailed(true));
  }, [backend]);
  useEffect(reload, [reload]);

  const chooseGentle = (on: boolean) => {
    setGentle(on);
    try {
      localStorage.setItem(GENTLE_KEY, on ? '1' : '0');
    } catch {
      // Not remembered on this computer; that's fine.
    }
  };

  const begin = async (n: number) => {
    setBusy(true);
    setError(null);
    try {
      const r = await backend.start(LEVELS[n - 1].id, gentle);
      setRun(r);
      setLevel(n);
      setScreen('play');
    } catch {
      setError("Couldn't start that flight. Please try again.");
      setScreen('map');
    }
    setBusy(false);
  };

  const pick = (picks: Picks) => {
    setLoaded((l) => (l ? { ...l, picks } : l));
    void backend.savePicks(picks);
  };

  if (failed) {
    return (
      <div className="tf-root">
        <p className="tf-error" role="alert">Toon Flap couldn't load.</p>
        <button type="button" className="tf-btn" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (!loaded) return <div className="tf-root"><p className="tf-loading" role="status">Loading Toon Flap…</p></div>;

  return (
    <div className="tf-root" data-screen={screen}>
      {screen === 'map' && (
        <>
          <MapScreen progress={loaded.progress} maths={loaded.maths} gentle={gentle} onGentle={chooseGentle} onPlay={begin} onHangar={() => setScreen('hangar')} onHowTo={() => setScreen('howto')} busy={busy} error={error} />
          {extra?.({ reload })}
        </>
      )}
      {screen === 'hangar' && <Hangar progress={loaded.progress} picks={loaded.picks} onPick={pick} onBack={() => setScreen('map')} />}
      {screen === 'howto' && <HowToPlay onBack={() => setScreen('map')} />}
      {screen === 'play' && run && (
        <PlayScreen
          key={run.seed}
          backend={backend}
          start={run}
          progress={loaded.progress}
          picks={loaded.picks}
          onLeave={() => {
            setRun(null);
            setScreen('map');
          }}
          onFinished={(r) => {
            setReply(r);
            if (r.valid) setLoaded((l) => (l ? { ...l, progress: r.progress } : l));
            setScreen('results');
          }}
        />
      )}
      {screen === 'results' && reply && run && (
        <ResultsScreen reply={reply} level={level} gentle={run.gentle} maths={run.maths} onNext={(n) => void begin(n)} onAgain={() => void begin(level)} onMap={() => setScreen('map')} />
      )}
    </div>
  );
}
