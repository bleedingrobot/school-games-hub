import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { tryFetchMyFocus } from '../../data/focus';
import { enqueue, flushQueue, loadGemKeep, saveCopy, type GemKeepData } from '../../data/gemKeep';
import { groupByPack } from '../../../shared/maths/focus';
import type { FactAnswer, FactStats } from '../../../shared/maths/leitner';
import type { CampaignProgress } from './progress';
import { TEXT } from './strings';
import { GemKeepCampaign, type FinishedLevel } from './ui/GemKeepCampaign';

/**
 * Gem Keep for the signed-in student: their saved progress, maths records and the teacher's
 * settings are loaded first, and everything they do is queued and saved to their account.
 */
export function GemKeepPlay() {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [data, setData] = useState<(GemKeepData & { offline: boolean }) | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let current = true;
    void loadGemKeep(player).then((loaded) => {
      if (!current) return;
      setData(loaded);
      setOffline(loaded.offline);
    });
    return () => {
      current = false;
    };
  }, [player]);

  // Sends the queue now; says on the map whether it got through.
  const flush = useCallback(
    (keepalive = false) => void flushQueue(player, keepalive).then((done) => setOffline(!done)),
    [player],
  );

  // The copy kept in this browser follows along, so Gem Keep opens offline with the latest.
  const keepCopy = useCallback(
    (change: Partial<GemKeepData>) =>
      setData((d) => {
        if (!d) return d;
        const next = { ...d, ...change };
        saveCopy(player, next);
        return next;
      }),
    [player],
  );

  const onProgress = useCallback((progress: CampaignProgress) => keepCopy({ progress }), [keepCopy]);
  const onLevelEnd = useCallback(
    (level: FinishedLevel) => {
      enqueue(player, { type: 'run', runId: crypto.randomUUID(), ...level });
      flush();
    },
    [player, flush],
  );
  const onKey = useCallback(
    (levelId: string, right: number) => {
      enqueue(player, { type: 'key', levelId, right });
      flush();
    },
    [player, flush],
  );
  const onAnswers = useCallback(
    (answers: FactAnswer[], facts: FactStats[]) => {
      keepCopy({ facts });
      // A maths focus can ask for early facts, adding or division as well as times tables: each pack keeps its own records.
      for (const [pack, group] of groupByPack(answers)) {
        enqueue(player, { type: 'answers', pack, batchId: crypto.randomUUID(), answers: group });
      }
      // The page may be closing: keepalive lets the request finish anyway.
      flush(document.visibilityState === 'hidden');
    },
    [player, flush, keepCopy],
  );

  if (!data) {
    return (
      <p className="panel__empty" role="status">
        {TEXT.loading}
      </p>
    );
  }
  return (
    <GemKeepCampaign
      settings={data.settings}
      focus={data.focus}
      loadFocus={offline ? undefined : tryFetchMyFocus}
      initialProgress={data.progress}
      initialFacts={data.facts}
      note={offline ? TEXT.savingLater : TEXT.savedAccount}
      onProgress={onProgress}
      onLevelEnd={onLevelEnd}
      onKey={onKey}
      onAnswers={onAnswers}
      // Local browser checks drive the game through this. Left out of the real site.
      onEngine={import.meta.env.DEV ? (engine) => Object.assign(window, { gemKeepEngine: engine }) : undefined}
    />
  );
}
