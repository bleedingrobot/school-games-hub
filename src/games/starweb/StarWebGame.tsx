/**
 * Star Web solo (docs/STARWEB-PLAN.md; id starweb): the Star Map, a sky, the end card and How to play, in one full-window
 * layer. The server (or the preview's trial backend) picks each sky's known fact and re-checks every star.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { emptyProgress, type Progress } from '../../../shared/starweb/map';
import type { FinishReply, Loaded, PublicSky, StarWebBackend } from './backend';
import { StarWebError } from './backend';
import { EndScreen } from './EndScreen';
import { HowToPlay } from './HowToPlay';
import { HubButtons } from './HubButtons';
import { MapScreen } from './MapScreen';
import { SkyScreen } from './SkyScreen';
import { useStarWebVoice } from './voice';
import { MAP_WELCOME } from './words';
import './starweb.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'off' }
  | { kind: 'map' }
  | { kind: 'how' }
  | { kind: 'sky'; sky: PublicSky; guided: boolean }
  | { kind: 'end'; reply: FinishReply; sky: PublicSky; before: Progress };

export interface Helpers {
  reload(): void;
}

export function StarWebGame({ backend, onServer = false, extra }: { backend: StarWebBackend; onServer?: boolean; extra?: (h: Helpers) => ReactNode }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [replayGuide, setReplayGuide] = useState(false);
  const voice = useStarWebVoice();
  const progress = loaded?.progress ?? emptyProgress();

  const load = useCallback(async () => {
    try {
      const l = await backend.load();
      setLoaded(l);
      setScreen(l.enabled ? { kind: 'map' } : { kind: 'off' });
      if (l.enabled && !l.progress.guideSeen && l.progress.lit === 0) voice.say(MAP_WELCOME);
    } catch (e) {
      setScreen({ kind: 'error', message: e instanceof StarWebError ? e.message : 'Star Web couldn’t load. Try again soon.' });
    }
  }, [backend]);

  useEffect(() => { void load(); }, [load]);

  const openSky = async (mode: 'map' | 'free', o: { fresh?: boolean; x?: number; y?: number } = {}) => {
    setBusy(true);
    try {
      const r = await backend.open(mode, o);
      if (r.progress) setLoaded((l) => (l ? { ...l, progress: r.progress!, open: null } : l));
      const p = r.progress ?? progress;
      const guided = replayGuide || (!p.guideSeen && p.lit === 0 && r.sky.stars.length === 0);
      setReplayGuide(false);
      setScreen({ kind: 'sky', sky: r.sky, guided });
    } catch (e) {
      setScreen({ kind: 'error', message: e instanceof StarWebError ? e.message : 'That sky couldn’t open. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const toMap = () => {
    setScreen({ kind: 'loading' });
    void load();
  };

  let body: ReactNode;
  switch (screen.kind) {
    case 'loading':
      body = <p className="sw-middle" role="status">Opening the night sky…</p>;
      break;
    case 'error':
      body = (
        <div className="sw-middle">
          <p role="alert">{screen.message}</p>
          <button type="button" className="sw-btn sw-btn--primary" onClick={toMap}>Try again</button>
          <HubButtons />
        </div>
      );
      break;
    case 'off':
      body = (
        <div className="sw-middle">
          <h1 className="sw-title">Star Web</h1>
          <p>Star Web isn’t switched on for your class yet. Ask your teacher!</p>
          <HubButtons />
        </div>
      );
      break;
    case 'how':
      body = <HowToPlay onBack={() => setScreen({ kind: 'map' })} />;
      break;
    case 'map':
      body = (
        <MapScreen
          progress={progress} open={loaded?.open ?? null} pointsLeft={loaded?.pointsLeft ?? 0} busy={busy}
          onNew={() => void openSky('map', { fresh: true })}
          onCarryOn={() => { const o = loaded?.open; if (o) void openSky(o.mode); }}
          onFree={(x, y) => void openSky('free', { fresh: true, x, y })}
          onHow={() => setScreen({ kind: 'how' })}
          onGuide={() => { setReplayGuide(true); void openSky('map', { fresh: !loaded?.open }); }}
          extra={extra?.({ reload: toMap })}
        />
      );
      break;
    case 'sky':
      body = (
        <SkyScreen
          key={screen.sky.seed}
          sky={screen.sky} backend={backend} guided={screen.guided} say={voice.say} voice={voice}
          onGuideDone={() => { if (!progress.guideSeen) void backend.guideSeen().catch(() => undefined); setLoaded((l) => (l ? { ...l, progress: { ...l.progress, guideSeen: true } } : l)); }}
          onFinished={(reply) => setScreen({ kind: 'end', reply, sky: screen.sky, before: progress })}
          onLeave={toMap}
        />
      );
      break;
    case 'end':
      body = (
        <EndScreen
          reply={screen.reply} anchor={screen.sky.anchor} mode={screen.sky.mode} before={screen.before} trial={!onServer}
          onNext={() => { setLoaded((l) => (l ? { ...l, progress: screen.reply.progress } : l)); void openSky('map', { fresh: true }); }}
          onMap={toMap}
        />
      );
      break;
  }
  return <div className="sw-window">{body}</div>;
}
