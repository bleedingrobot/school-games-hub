/**
 * Smash Quest's screens (docs/BONKERS-PLAN.md), on any backend: the school's server (BonkersPlay) or the preview's
 * trial in the browser. The path is fixed, like a Sky Isles turn: the Wobbly Inn > pick 1 of 2 quests > the fights > the
 * trainer (when the star bar is full) > the chest > back to the inn. Drawn stand-ins (emoji) until the paintings (B.6).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Progress } from '../../../shared/bonkers/engine';
import type { HeroClass, Look } from '../../../shared/bonkers/content';
import { BonkersError, type AdventureView, type BonkersBackend, type FinishReply, type LoadReply } from './backend';
import { Fight } from './Fight';
import { HeroPick, Inn, Results } from './Screens';
import { HubButtons } from './HubButtons';
import './bonkers.css';

type View =
  | { at: 'loading' }
  | { at: 'error'; message: string }
  | { at: 'inn'; loaded: LoadReply }
  | { at: 'hero'; loaded: LoadReply }
  | { at: 'fight'; loaded: LoadReply; current: AdventureView }
  | { at: 'results'; loaded: LoadReply; before: Progress; result: FinishReply; current: AdventureView };

const words = (e: unknown) => (e instanceof BonkersError || e instanceof Error ? e.message : 'Something went wrong. Please try again soon.');

export function BonkersGame({ backend, extra }: { backend: BonkersBackend; extra?: (h: { reload: () => void }) => React.ReactNode }) {
  const [view, setView] = useState<View>({ at: 'loading' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setView({ at: 'loading' });
    try {
      const loaded = await backend.load();
      if (loaded.current) setView({ at: 'fight', loaded, current: loaded.current });
      else setView({ at: loaded.progress.hero ? 'inn' : 'hero', loaded });
    } catch (e) {
      setView({ at: 'error', message: words(e) });
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickHero = async (loaded: LoadReply, cls: HeroClass, look: Look) => {
    setBusy(true);
    try {
      const progress = await backend.hero(cls, look);
      setView({ at: 'inn', loaded: { ...loaded, progress } });
    } catch (e) {
      setNote(words(e));
    } finally {
      setBusy(false);
    }
  };

  const startQuest = async (loaded: LoadReply, quest: string) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await backend.start(quest);
      const next = { ...loaded, ...(r.progress ? { progress: r.progress } : {}), ...(r.waiting !== undefined ? { waiting: r.waiting } : {}) };
      setView({ at: 'fight', loaded: next, current: r.current });
    } catch (e) {
      if (e instanceof BonkersError && e.code === 'stale') {
        void load();
        return;
      }
      setNote(words(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (loaded: LoadReply, current: AdventureView) => {
    try {
      const result = await backend.finish(current.seed);
      setView({ at: 'results', loaded, before: loaded.progress, result, current });
    } catch (e) {
      if (e instanceof BonkersError && e.code === 'ended') {
        void load();
        return;
      }
      throw e;
    }
  };

  const backToInn = (loaded: LoadReply, result: FinishReply) =>
    setView({ at: 'inn', loaded: { ...loaded, progress: result.progress, waiting: result.waiting, quests: result.quests, current: null } });

  return (
    <div className="bq-layer" data-testid="bonkers">
      <header className="bq-top">
        <span className="bq-title"><span aria-hidden="true">🥄</span> Smash Quest</span>
        <HubButtons />
      </header>
      <main className="bq-main">
        {view.at === 'loading' && <p className="bq-loading" role="status">Polishing the rolling pins…</p>}
        {view.at === 'error' && (
          <div className="bq-card bq-center">
            <p>{view.message}</p>
            <button type="button" className="bq-btn" onClick={() => void load()}>Try again</button>
          </div>
        )}
        {(view.at === 'inn' || view.at === 'hero') && !view.loaded.enabled && (
          <div className="bq-card bq-center"><p>Smash Quest isn’t switched on for your class yet.</p></div>
        )}
        {view.at === 'hero' && view.loaded.enabled && (
          <HeroPick busy={busy} hero={view.loaded.progress.hero} onPick={(cls, look) => void pickHero(view.loaded, cls, look)} />
        )}
        {view.at === 'inn' && view.loaded.enabled && (
          <Inn
            loaded={view.loaded}
            busy={busy}
            note={note}
            onQuest={(id) => void startQuest(view.loaded, id)}
            onChangeLook={() => setView({ at: 'hero', loaded: view.loaded })}
          />
        )}
        {view.at === 'fight' && (
          <Fight backend={backend} progress={view.loaded.progress} start={view.current} onDone={(current) => finish(view.loaded, current)} />
        )}
        {view.at === 'results' && (
          <Results before={view.before} result={view.result} current={view.current} onInn={() => backToInn(view.loaded, view.result)} />
        )}
        {extra?.({ reload: () => void load() })}
      </main>
    </div>
  );
}
