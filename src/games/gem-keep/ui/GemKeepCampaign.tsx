/**
 * The whole of Gem Keep: the campaign map, and a level once one is picked.
 *
 * It doesn't save anything itself: it reports levels, Level Keys and maths records through
 * the `on…` props (GemKeepPlay saves them to the student's account). Without those props
 * (the stand-alone preview, tests), progress is kept in this browser as in the class trial.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CAMPAIGN } from '../../../../shared/gem-keep/levels';
import { AUTO_FOCUS, currentFocus, focusKey, focusNote, makeFocusPack, type MathsFocus } from '../../../../shared/maths/focus';
import { showingPack, type ShowingPack, type ShownAnswer } from '../../../../shared/maths/claim';
import type { FactStats } from '../../../../shared/maths/leitner';
import type { SkillPack } from '../../../../shared/maths/skillPack';
import { StoryBook, StoryShelf, useGameKeys, useStories, useStoryOnce } from '../../../kit';
import type { Story } from '../../../../shared/kit/stories';
import { TALE_GOALS, taleMet, taleWords } from '../../../../shared/gem-keep/tale';
import { ENDING, OPENING, chapterStory, taleId, taleShelf, taleStory } from '../stories';
import { boardUrl, campaignUrl } from '../art';
import type { GameEngine } from '../engine/GameEngine';
import { isUnlocked, keyPassedToday, loadProgress, saveProgress, withKey, withWin, type CampaignProgress } from '../progress';
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
  focus = AUTO_FOCUS,
  loadFocus,
  after,
}: {
  settings?: GemKeepSettings;
  /** The maths focus when Gem Keep opened. Auto (the default) is the campaign's own tables, as always. */
  focus?: MathsFocus;
  /**
   * Asks for the focus again. It is asked when a level is about to start, so a change (a teacher sets or ends a focus) shows up
   * in the next level, never halfway through one.
   */
  loadFocus?: () => Promise<MathsFocus>;
  /** Saved progress. Default: what this browser kept. */
  initialProgress?: CampaignProgress;
  /** Saved maths records. */
  initialFacts?: FactStats[];
  /** The line under the map (about saving). */
  note?: string;
  /** The progress changed (stars or a Level Key). */
  onProgress?: (progress: CampaignProgress) => void;
  onLevelEnd?: (level: FinishedLevel) => void;
  /** A Level Key round finished: right answers out of 5. */
  onKey?: (levelId: string, right: number) => void;
  /**
   * The answers given since the last report (oldest first), and the records they make.
   * Called after each level, Level Key and when leaving.
   */
  onAnswers?: (answers: ShownAnswer[], facts: FactStats[]) => void;
  onEngine?: (engine: GameEngine) => void;
  /** Shown under the map or level, inside the full-window layer (the trophy line). */
  after?: ReactNode;
}) {
  const [progress, setProgress] = useState<CampaignProgress>(() => initialProgress ?? loadProgress());
  const [playing, setPlaying] = useState<number | null>(null);
  // One set of maths records for the whole visit, so mastery carries from level to level. The pack follows the maths focus:
  // the campaign's times tables with none, the focus with one. It changes only between levels.
  const packOptions = { enabledTables: settings.enabledTables, division: settings.division };
  const [packFocus, setPackFocus] = useState<MathsFocus>(() => currentFocus(focus));
  // Answers carry the question as shown, so the server marks them itself.
  const [pack, setPack] = useState<ShowingPack>(() => showingPack(makeFocusPack(initialFacts, packFocus, packOptions)));
  // The answer totals when this attempt at the level began, to count the answers in it.
  const startTotals = useRef(totals(pack));
  const begin = useCallback((from: SkillPack = pack) => {
    startTotals.current = totals(from);
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
  const unreported = useRef<ShownAnswer[]>([]);
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

  /** The focus for the level about to start. A slow or failed lookup never holds up a level: the last one is kept. */
  async function freshFocus(): Promise<MathsFocus> {
    if (!loadFocus) return currentFocus(focus);
    const answer = await Promise.race([loadFocus().catch(() => null), new Promise<null>((done) => window.setTimeout(() => done(null), 1500))]);
    return currentFocus(answer ?? packFocus);
  }

  // The Keeper's Tale (docs/plans/stories/PLAN.md, ST.4): the opening on the map once, a chapter page before each level the
  // first time, a Tale page for winning a level's Tale challenge (seen = the Tale star), the ending once all ten are won.
  const stories = useStories();
  const taleWon = CAMPAIGN.map((_, i) => stories.hasSeen(taleId(i)));
  const opening = useStoryOnce(OPENING.id, playing === null);
  const ending = useStoryOnce(ENDING.id, playing === null && !opening.open && taleWon.every(Boolean));
  const [book, setBook] = useState<{ story: Story; then?: () => void } | null>(null);
  const [shelf, setShelf] = useState(false);
  const storyOpen = opening.open || ending.open || book !== null || shelf;
  useEffect(() => {
    if (!shelf || book) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.kit-story')) setShelf(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shelf, book]);

  /** Starts a level, after its chapter page the first time. */
  function start(index: number | null) {
    const chapter = index === null ? null : chapterStory(index);
    if (chapter && stories.shouldShow(chapter.id)) setBook({ story: chapter, then: () => void play(index) });
    else void play(index);
  }

  async function play(index: number | null) {
    let next = pack;
    if (index !== null) {
      const latest = await freshFocus();
      if (focusKey(latest) !== focusKey(packFocus)) {
        // The answers so far are reported before the pack changes; its records carry over to the new one.
        reportFacts();
        // The old pack may hold only some of the records (times tables), so the records Gem Keep opened with fill the rest.
        const records = new Map(initialFacts.map((f) => [f.key, f]));
        for (const s of pack.stats()) records.set(s.key, s);
        next = showingPack(makeFocusPack([...records.values()], latest, packOptions));
        setPackFocus(latest);
        setPack(next);
      }
    }
    begin(next);
    if (playing !== null) reportFacts();
    setPlaying(index);
  }

  // Gem Keep fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader). The painting of the map or
  // level shows blurred behind everything, so no hub colour shows round the edges.
  const level = playing === null ? null : CAMPAIGN[playing];
  const root = useRef<HTMLDivElement>(null);
  useGameKeys(root, !storyOpen);
  const backdrop = level ? boardUrl(level.id, true) : campaignUrl(true);
  const windowStyle = backdrop ? ({ '--gk-backdrop': `url(${backdrop})` } as CSSProperties) : undefined;
  return (
    <div ref={root} className="gk-window" style={windowStyle}>
      {playing === null || !level ? (
        <CampaignMap
          progress={progress} note={note} focusNote={focusNote(packFocus)} onPlay={start}
          taleWon={taleWon} taleWords={(i) => taleWords(TALE_GOALS[i])}
          taleButton={<button type="button" className="button gk-tale-button" onClick={() => setShelf(true)}>📜 The Keeper's Tale {taleWon.filter(Boolean).length}/{CAMPAIGN.length}</button>}
        />
      ) : (
        <GemKeepGame
          key={level.id}
          level={level}
          levelNumber={playing + 1}
          settings={settings}
          pack={pack}
          onEngine={onEngine}
          keyDone={!!progress[level.id]?.keyPassed}
          keyWaits={!progress[level.id]?.keyPassed && keyPassedToday(progress)}
          tale={{ words: taleWords(TALE_GOALS[playing]), won: taleWon[playing] }}
          onWin={(stars, state) => {
            update((p) => withWin(p, level.id, stars));
            const tale = taleStory(playing);
            if (taleMet(TALE_GOALS[playing], state) && stories.shouldShow(tale.id)) setBook({ story: tale });
          }}
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
          onNext={playing + 1 < CAMPAIGN.length ? () => start(playing + 1) : undefined}
          onMap={() => void play(null)}
        />
      )}
      {opening.open && <StoryBook story={OPENING} onClose={opening.close} endLabel="Let's go!" className="gk-storybook" />}
      {ending.open && <StoryBook story={ENDING} onClose={ending.close} className="gk-storybook" />}
      {book && (
        <StoryBook
          story={book.story}
          endLabel={book.then ? "Let's go!" : 'The end'}
          className="gk-storybook"
          onClose={() => { const then = book.then; setBook(null); then?.(); }}
        />
      )}
      {shelf && (
        <div className="gk-tale-shelf" role="dialog" aria-modal="true" aria-label="The Keeper's Tale">
          <div className="gk-tale-shelf__box">
            <h2>📜 The Keeper's Tale</h2>
            <p>Win a level's Tale challenge to read what happens next. Win all ten to finish the story.</p>
            <StoryShelf
              stories={taleShelf((i) => isUnlocked(progress, CAMPAIGN.map((l) => l.id), i), (i) => taleWon[i])}
              book={{ className: 'gk-storybook' }}
            />
            <button type="button" className="button" data-key="esc" onClick={() => setShelf(false)}>Close</button>
          </div>
        </div>
      )}
      {after}
    </div>
  );
}
