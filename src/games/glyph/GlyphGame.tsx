/**
 * Glyph Gates: the map, the guide, the temple walls, the results and How to play (docs/GLYPH-PLAN.md). The game only talks to
 * the backend it is given: the trial one in the preview, the school's server in the hub.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TEMPLES, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import type { TempleResult, WallPlay } from '../../../shared/glyph/play';
import { GlyphError, type GlyphBackend, type Loaded, type StartReply } from './backend';
import { guideWall } from './guide';
import { HowToPlay } from './HowToPlay';
import { MapScreen } from './MapScreen';
import { useGlyphVoice, type Say } from './voice';
import { ResultsScreen } from './ResultsScreen';
import { WallScreen } from './WallScreen';
import './glyph.css';

type Screen = 'map' | 'howto' | 'guide' | 'play' | 'results';

function TempleRun({ start, onFinish, onLeave, say }: { start: StartReply; onFinish: (plays: WallPlay[]) => void; onLeave: (plays: WallPlay[]) => void; say: Say }) {
  const [plays, setPlays] = useState<WallPlay[]>([]);
  const name = TEMPLES.find((t) => t.id === start.temple)?.name ?? '';
  const marks = plays.map((p) => (p.goes.length === 1 && p.goes[0].pick !== null ? 'first' : 'help') as 'first' | 'help');
  const idx = plays.length;
  return (
    <WallScreen
      key={idx}
      wall={start.walls[idx]}
      index={idx}
      templeName={name}
      help={start.help}
      marks={marks}
      onDone={(play) => {
        const all = [...plays, play as WallPlay];
        setPlays(all);
        if (all.length >= WALLS_PER_TEMPLE) onFinish(all);
      }}
      onLeave={() => onLeave(plays)}
      say={say}
    />
  );
}

export function GlyphGame({ backend, extra, onExit }: { backend: GlyphBackend; extra?: (h: { reload(): void }) => ReactNode; onExit?: () => void }) {
  const [screen, setScreen] = useState<Screen>('map');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<StartReply | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [res, setRes] = useState<{ temple: number; result: TempleResult; points: number } | null>(null);
  const gwall = useMemo(guideWall, []);
  const voice = useGlyphVoice();

  const reload = useCallback(() => {
    setFailed(false);
    backend.load().then(setLoaded, () => setFailed(true));
  }, [backend]);
  useEffect(reload, [reload]);

  const begin = async (temple: number) => {
    setBusy(true);
    setError(null);
    try {
      setRun(await backend.start(temple));
      setScreen('play');
    } catch (e) {
      setError(e instanceof GlyphError ? e.message : "Couldn't open that temple. Please try again.");
      setScreen('map');
    }
    setBusy(false);
  };

  const play = (temple: number) => {
    if (temple === 1 && loaded && !loaded.progress.guideSeen) {
      setAfter(1);
      setScreen('guide');
    } else void begin(temple);
  };

  const guideDone = () => {
    const next = after;
    setAfter(null);
    setLoaded((l) => (l ? { ...l, progress: { ...l.progress, guideSeen: true } } : l));
    void backend.guideSeen().catch(() => undefined);
    if (next) void begin(next);
    else setScreen('map');
  };

  const finish = async (plays: WallPlay[]) => {
    if (!run) return;
    if (!plays.length) {
      setRun(null);
      return setScreen('map');
    }
    setBusy(true);
    try {
      const r = await backend.finish(run.seed, plays);
      if ('already' in r && r.already) setScreen('map');
      else if ('result' in r) {
        setLoaded((l) => (l ? { ...l, progress: r.progress } : l));
        if (r.result.finished) {
          setRes({ temple: run.temple, result: r.result, points: r.points });
          setScreen('results');
        } else setScreen('map');
      }
    } catch (e) {
      setError(e instanceof GlyphError ? e.message : "Couldn't save that go. Please try again.");
      setScreen('map');
    }
    setBusy(false);
  };

  if (failed) {
    return (
      <div className="gg-root">
        <p className="gg-error" role="alert">Glyph Gates couldn't load.</p>
        <button type="button" className="gg-btn" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (!loaded) return <div className="gg-root"><p className="gg-loading" role="status">Loading Glyph Gates…</p></div>;
  if (!loaded.enabled) {
    return (
      <div className="gg-root">
        <p className="gg-error" role="status">Glyph Gates isn’t switched on for your class yet.</p>
        {onExit && <button type="button" className="gg-btn" onClick={onExit}>Back to games</button>}
      </div>
    );
  }

  return (
    <div className="gg-root" data-screen={screen}>
      {voice.available && (
        <button type="button" className="gg-btn gg-voice" aria-label="Read aloud" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
          <span aria-hidden="true">{voice.on ? '🔊' : '🔇'}</span><span aria-hidden="true"> {voice.on ? 'Voice on' : 'Voice off'}</span>
        </button>
      )}
      {screen === 'map' && (
        <>
          <MapScreen
            progress={loaded.progress}
            busy={busy}
            error={error}
            onPlay={play}
            onHowTo={() => setScreen('howto')}
            onReplayGuide={() => { setAfter(null); setScreen('guide'); }}
            onExit={onExit}
          />
          {extra?.({ reload })}
        </>
      )}
      {screen === 'howto' && <HowToPlay onBack={() => setScreen('map')} />}
      {screen === 'guide' && (
        <WallScreen key="guide" wall={gwall} index={0} templeName="" help={0} guide onDone={guideDone} onSkipGuide={guideDone} onLeave={guideDone} say={voice.say} />
      )}
      {screen === 'play' && run && <TempleRun key={run.seed} start={run} onFinish={(p) => void finish(p)} onLeave={(p) => void finish(p)} say={voice.say} />}
      {screen === 'results' && res && (
        <ResultsScreen
          temple={res.temple}
          result={res.result}
          points={res.points}
          say={voice.say}
          onNext={() => play(res.temple + 1)}
          onAgain={() => play(res.temple)}
          onMap={() => setScreen('map')}
        />
      )}
    </div>
  );
}
