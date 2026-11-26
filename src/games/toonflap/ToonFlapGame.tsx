/**
 * Toon Flap: the map, the Hangar, How to play, the run and the results (docs/TOON-FLAP-PLAN.md). The game only talks to the
 * backend it is given: the trial one in the preview, the school's server in stage F.3.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useGameKeys } from '../../kit';
import { speak, stopSpeaking, useReadAloud } from '../../speech';
import { guideSkipped, readHelp, saveHelp, setGuideSkipped, showTip, voiceLine, VOICE_FOLDER, type HelpSetting } from './guide';
import { levelByN, LEVELS } from '../../../shared/toonflap/levels';
import { nzDate } from '../../../shared/kit/dayArc';
import { ToonFlapError, type DashFinishReply, type FinishReply, type Loaded, type Picks, type StartReply, type ToonFlapBackend } from './backend';
import { DashScreen } from './DashScreen';
import { DashResults } from './DashResults';
import { Hangar } from './Hangar';
import { HowToPlay } from './HowToPlay';
import { MapScreen } from './MapScreen';
import { PlayScreen } from './PlayScreen';
import { ResultsScreen } from './ResultsScreen';
import { TrophyWonLine } from '../../trophies/TrophyWonLine';
import { AchievementPop } from '../../achievements/AchievementPop';
import { HubButtons } from './HubButtons';
import './toonflap.css';

type Screen = 'map' | 'hangar' | 'howto' | 'play' | 'results' | 'dash' | 'dash-results';

const GENTLE_KEY = 'toonflap-gentle';
const readGentle = (): boolean => {
  try {
    return localStorage.getItem(GENTLE_KEY) === '1';
  } catch {
    return false;
  }
};

export function ToonFlapGame({ backend, extra, onServer = false }: { backend: ToonFlapBackend; /** The school's server is behind `backend`, so trophies can be won. */ onServer?: boolean; extra?: (h: { reload(): void }) => ReactNode }) {
  const [screen, setScreen] = useState<Screen>('map');
  const rootRef = useRef<HTMLDivElement>(null);
  // Keys press the on-screen buttons; off while flying (Space/arrows and the Go sign's Enter are the run's own).
  useGameKeys(rootRef, screen !== 'play' && screen !== 'dash');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [gentle, setGentle] = useState(readGentle);
  const [run, setRun] = useState<StartReply | null>(null);
  const [level, setLevel] = useState(1);
  const [reply, setReply] = useState<FinishReply | null>(null);
  const [dashReply, setDashReply] = useState<DashFinishReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpSetting>(readHelp);
  const [guide, setGuide] = useState(false);
  const [tip, setTip] = useState(false);
  const voice = useReadAloud({ defaultOn: true });
  const talk = useCallback((text: string) => {
    const line = voiceLine(text);
    if (voice.on && line) speak(line, VOICE_FOLDER);
  }, [voice.on]);
  useEffect(() => stopSpeaking, []);

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

  const chooseHelp = (h: HelpSetting) => {
    setHelp(h);
    saveHelp(h);
  };

  const begin = async (n: number, replayGuide = false) => {
    setBusy(true);
    setError(null);
    try {
      const def = levelByN(n) ?? LEVELS[0];
      const r = await backend.start(def.id, gentle);
      const p = loaded?.progress;
      const finishes = (p?.levels[def.id] ?? p?.seasonal?.[def.id])?.finishes ?? 0;
      const never = !p || Object.values(p.levels).every((l) => !l || l.finishes === 0);
      if (replayGuide) setGuideSkipped(false);
      setGuide(n === 1 && (replayGuide || (never && !guideSkipped())));
      setTip(showTip(help, finishes));
      setLoaded((l) => (l ? { ...l, winsLeft: r.winsLeft, dashesLeft: r.dashesLeft } : l));
      setRun(r);
      setLevel(n);
      setScreen('play');
    } catch (e) {
      setError(e instanceof ToonFlapError ? e.message : "Couldn't start that flight. Please try again.");
      setScreen('map');
    }
    setBusy(false);
  };

  const beginDash = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await backend.dashStart();
      setLoaded((l) => (l ? { ...l, winsLeft: r.winsLeft, dashesLeft: r.dashesLeft } : l));
      setRun(r);
      setScreen('dash');
    } catch (e) {
      setError(e instanceof ToonFlapError ? e.message : "Couldn't start Sky Dash. Please try again.");
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
      <Window rootRef={rootRef}>
        <div className="tf-root">
          <p className="tf-error" role="alert">Toon Flap couldn't load.</p>
          <div className="tf-row"><button type="button" className="tf-btn" data-key="enter" onClick={reload}>Try again</button><HubButtons /></div>
        </div>
      </Window>
    );
  }
  if (!loaded) return <Window rootRef={rootRef}><div className="tf-root"><p className="tf-loading" role="status">Loading Toon Flap…</p></div></Window>;
  if (!loaded.enabled) {
    return (
      <Window rootRef={rootRef}>
        <div className="tf-root">
          <p className="tf-error" role="status">Toon Flap isn’t switched on for your class yet.</p>
          <HubButtons />
        </div>
      </Window>
    );
  }

  return (
    <Window rootRef={rootRef}>
    <div className="tf-root" data-screen={screen}>
      {screen === 'map' && (
        <>
          <MapScreen
            progress={loaded.progress} today={loaded.today ?? nzDate(new Date())} winsLeft={loaded.winsLeft} dashesLeft={loaded.dashesLeft} maths={loaded.maths} gentle={gentle} onGentle={chooseGentle} onPlay={(n) => void begin(n)} onDash={() => void beginDash()}
            onHangar={() => setScreen('hangar')} onHowTo={() => setScreen('howto')} busy={busy} error={error}
            help={help} onHelp={chooseHelp} onReplayGuide={() => void begin(1, true)} voice={voice} talk={talk}
          />
          {extra?.({ reload })}
        </>
      )}
      {screen === 'hangar' && <Hangar progress={loaded.progress} today={loaded.today ?? nzDate(new Date())} picks={loaded.picks} onPick={pick} onBack={() => setScreen('map')} />}
      {screen === 'howto' && <HowToPlay onBack={() => setScreen('map')} />}
      {screen === 'play' && run && (
        <PlayScreen
          key={run.seed}
          backend={backend}
          start={run}
          progress={loaded.progress}
          picks={loaded.picks}
          guide={guide}
          tip={tip}
          talk={talk}
          onSkipGuide={() => setGuideSkipped(true)}
          onLeave={() => {
            setRun(null);
            setScreen('map');
          }}
          onFinished={(r) => {
            setReply(r);
            // A win uses one of today's wins (the start said how many were left before it).
            if (r.valid) setLoaded((l) => (l ? { ...l, progress: r.progress, winsLeft: typeof l.winsLeft === 'number' ? Math.max(0, l.winsLeft - 1) : l.winsLeft } : l));
            setScreen('results');
          }}
        />
      )}
      {screen === 'dash' && run && (
        <DashScreen
          key={run.seed}
          backend={backend}
          start={run}
          progress={loaded.progress}
          picks={loaded.picks}
          today={loaded.today ?? nzDate(new Date())}
          talk={talk}
          onLeave={() => {
            setRun(null);
            setScreen('map');
          }}
          onFinished={(r) => {
            setDashReply(r);
            if (r) setLoaded((l) => (l ? { ...l, progress: r.progress } : l));
            setScreen('dash-results');
          }}
        />
      )}
      {screen === 'dash-results' && (
        <DashResults talk={talk} reply={dashReply} onAgain={loaded.dashesLeft === 0 ? undefined : () => void beginDash()} onMap={() => setScreen('map')} />
      )}
      {screen === 'results' && reply && run && (
        <ResultsScreen talk={talk} today={loaded.today ?? nzDate(new Date())} reply={reply} level={level} gentle={run.gentle} maths={run.maths} onNext={(n) => void begin(n)} onAgain={() => void begin(level)} onMap={() => setScreen('map')} />
      )}
      <TrophyWonLine games={['toonflap']} watch={reply ?? dashReply} off={!onServer} />
      <AchievementPop games={['toonflap']} watch={reply ?? dashReply} off={!onServer} />
    </div>
    </Window>
  );
}

/** Toon Flap covers the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader). */
function Window({ children, rootRef }: { children: ReactNode; rootRef?: Ref<HTMLDivElement> }) {
  return <div className="tf-window" ref={rootRef}>{children}</div>;
}
