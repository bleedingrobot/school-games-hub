/**
 * The whole of Gem Keep: the campaign map, and a level once one is picked.
 *
 * It doesn't save anything itself: it reports levels, Level Keys and maths records through
 * the `on…` props (GemKeepPlay saves them to the student's account). Without those props
 * (the stand-alone preview, tests), progress is kept in this browser as in the class trial.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMPAIGN } from '../../../../shared/gem-keep/levels';
import type { FactAnswer, FactStats } from '../../../../shared/maths/leitner';
import type { SkillPack } from '../../../../shared/maths/skillPack';
import { TimesTables } from '../../../../shared/maths/skillPacks/timesTables';
import type { GameEngine } from '../engine/GameEngine';
import { loadProgress, saveProgress, withKey, withWin, type CampaignProgress } from '../progress';
import { DEFAULT_SETTINGS, type GemKeepSettings } from '../settings';
import { TEXT } from '../strings';
import { CampaignMap } from './CampaignMap';
import { GemKeepGame, type LevelEnd } from './GemKeepGame';

/** A finished level, with the maths answered during it. */
export interface FinishedLevel extends LevelEnd {
  levelId: string;
  asked: number;
  right: number;
}

/** Answers and right answers in all the records so far. */
function totals(pack: SkillPack) {
  let asked = 0;
  let right = 0;
  for (const s of pack.stats()) {
    asked += s.attempts;
    right += s.correct;
  }
  return { asked, right };
}

export function GemKeepCampaign({
  settings = DEFAULT_SETTINGS,
  initialProgress,
  initialFacts = [],
  note = TEXT.savedHere,
  onProgress = saveProgress,
  onLevelEnd,
  onKey,
  onAnswers,
  onEngine,
}: {
  settings?: GemKeepSettings;
  /** Saved progress. Default: what this browser kept. */
  initialProgress?: CampaignProgress;
  /** Saved maths records. */
  initialFacts?: FactStats[];
  /** The line under the map (about saving). */
  note?: string;
  /** The progress changed (stars or a Level Key). */
  onProgress?: (progress: CampaignProgress) => void;
  onLevelEnd?: (level: FinishedLevel) => void;
  /** A Level Key round finished: right answers out of 10. */
  onKey?: (levelId: string, right: number) => void;
  /**
   * The answers given since the last report (oldest first), and the records they make.
   * Called after each level, Level Key and when leaving.
   */
  onAnswers?: (answers: FactAnswer[], facts: FactStats[]) => void;
  onEngine?: (engine: GameEngine) => void;
}) {
  const [progress, setProgress] = useState<CampaignProgress>(() => initialProgress ?? loadProgress());
  const [playing, setPlaying] = useState<number | null>(null);
  // One set of maths records for the whole visit, so mastery carries from level to level.
  const [pack] = useState<SkillPack>(() => new TimesTables(initialFacts));
  // The answer totals when this attempt at the level began, to count the answers in it.
  const startTotals = useRef(totals(pack));
  const begin = useCallback(() => {
    startTotals.current = totals(pack);
  }, [pack]);

  function update(change: (p: CampaignProgress) => CampaignProgress) {
    setProgress(change);
  }

  // Tell the page after the change has happened (never while drawing).
  const shown = useRef(progress);
  useEffect(() => {
    if (shown.current === progress) return;
    shown.current = progress;
    onProgress(progress);
  }, [progress, onProgress]);

  // Every answer, kept until it's reported.
  const unreported = useRef<FactAnswer[]>([]);
  useEffect(() => pack.onAnswer((answer) => unreported.current.push(answer)), [pack]);
  const reportFacts = useCallback(() => {
    if (unreported.current.length === 0) return;
    const answers = unreported.current;
    unreported.current = [];
    onAnswers?.(answers, pack.stats());
  }, [onAnswers, pack]);

  // Leaving the game (or the tab going to the background) saves the maths records too.
  useEffect(() => {
    const hidden = () => document.visibilityState === 'hidden' && reportFacts();
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      reportFacts();
    };
  }, [reportFacts]);

  function play(index: number | null) {
    begin();
    if (playing !== null) reportFacts();
    setPlaying(index);
  }

  if (playing === null) return <CampaignMap progress={progress} note={note} onPlay={play} />;
  const level = CAMPAIGN[playing];
  return (
    <GemKeepGame
      key={level.id}
      level={level}
      levelNumber={playing + 1}
      settings={settings}
      pack={pack}
      onEngine={onEngine}
      keyDone={!!progress[level.id]?.keyPassed}
      onWin={(stars) => update((p) => withWin(p, level.id, stars))}
      onEnd={(end) => {
        const now = totals(pack);
        onLevelEnd?.({
          ...end,
          levelId: level.id,
          asked: now.asked - startTotals.current.asked,
          right: now.right - startTotals.current.right,
        });
        begin();
        reportFacts();
      }}
      onKeyResult={(right) => {
        onKey?.(level.id, right);
        begin();
        reportFacts();
      }}
      onKeyPassed={() => update((p) => withKey(p, level.id))}
      onNext={playing + 1 < CAMPAIGN.length ? () => play(playing + 1) : undefined}
      onMap={() => play(null)}
    />
  );
}
