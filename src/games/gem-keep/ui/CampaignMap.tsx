/**
 * The campaign map: ten levels along a trail, with stars, the times tables each one
 * practises, and locks until the level before's Level Key is passed.
 *
 * With the painted night map (art.ts), wide screens get the painting with a small gem button for each
 * level on its trail, joined by a glowing dotted route, and one card that tells about the level being
 * pointed at, focused or picked. Narrow screens (and no painting) get the list of stops.
 */
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CAMPAIGN } from "../../../../shared/gem-keep/levels";
import { campaignTables } from "../../../../shared/maths/selector";
import { KeyBadge } from "../../../kit";
import { CAMPAIGN_MARKERS, campaignUrl } from "../art";
import { isUnlocked, totalStars, type CampaignProgress } from "../progress";
import { TEXT } from "../strings";
import { HubButtons } from "./HubButtons";

const IDS = CAMPAIGN.map((l) => l.id);

/** Wide enough for the painting with stops on it (narrower screens get the list). */
const WIDE = "(min-width: 761px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.(WIDE);
      query?.addEventListener("change", notify);
      return () => query?.removeEventListener("change", notify);
    },
    () => window.matchMedia?.(WIDE).matches ?? false,
  );
}

export function CampaignMap({
  progress,
  note = TEXT.savedHere,
  focusNote = null,
  onPlay,
  taleWon = [],
  taleWords,
  taleButton,
}: {
  progress: CampaignProgress;
  /** Which levels' Tale challenges are won (docs/plans/stories/PLAN.md, ST.4). */
  taleWon?: boolean[];
  /** A level's Tale challenge, in words. */
  taleWords?: (index: number) => string;
  /** The Keeper's Tale button, in the header. */
  taleButton?: ReactNode;
  /** The line under the map, about saving. */
  note?: string;
  /** Why the maths isn't the level's tables: "Your teacher picked ×6 until Friday". Null when nothing changes them. */
  focusNote?: string | null;
  onPlay: (index: number) => void;
}) {
  const open = CAMPAIGN.map((_, i) => isUnlocked(progress, IDS, i));
  // The furthest open level that hasn't been won yet glows.
  const next = open.lastIndexOf(true);
  const painting = campaignUrl(false);
  const wide = useWide();
  const trailStyle = painting
    ? ({ "--gk-map-small": `url(${campaignUrl(true)})` } as React.CSSProperties)
    : undefined;
  return (
    <section
      className="gk-campaign"
      data-night={painting ? true : undefined}
      data-world={(painting && wide) || undefined}
      aria-labelledby="gk-map-title"
    >
      <header className="gk-campaign__head">
        <div>
          <h1 id="gk-map-title">{TEXT.mapTitle}</h1>
          <p>{TEXT.mapIntro}</p>
        </div>
        <span className="gk-campaign__side">
          <span className="gk-campaign__total">
            ★ {TEXT.totalStars(totalStars(progress), CAMPAIGN.length * 3)}
          </span>
          {taleButton}
          <HubButtons />
        </span>
      </header>
      {focusNote && (
        <p className="gk-campaign__focus" role="status">
          <span aria-hidden="true">🎯</span> {focusNote}. {TEXT.focusAllLevels}
        </p>
      )}
      {painting && wide ? (
        <PaintedWorld
          painting={painting}
          progress={progress}
          open={open}
          next={next}
          onPlay={onPlay}
          taleWon={taleWon}
          taleWords={taleWords}
        />
      ) : (
        <ol
          className="gk-trail"
          data-painted={painting ? true : undefined}
          style={trailStyle}
        >
          {CAMPAIGN.map((level, i) => {
            const stars = progress[level.id]?.stars ?? 0;
            const tables = campaignTables(i + 1);
            return (
              <li key={level.id}>
                <button
                  type="button"
                  className="gk-stop"
                  data-key={i < 9 ? String(i + 1) : undefined}
                  disabled={!open[i]}
                  data-next={
                    (i === next && !progress[level.id]?.keyPassed) || undefined
                  }
                  aria-label={`${TEXT.levelLabel(i + 1, level.name)}. ${TEXT.levelStars(stars)}. ${TEXT.tablesLabel(tables)}.${open[i] ? "" : ` ${TEXT.locked(i)}.`}`}
                  title={open[i] ? level.intro : TEXT.locked(i)}
                  onClick={() => onPlay(i)}
                >
                  {i < 9 && <KeyBadge k={String(i + 1)} />}
                  <span className="gk-stop__number" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="gk-stop__name">{level.name}</span>
                  <span className="gk-stop__tables">{TEXT.tables(tables)}</span>
                  <Stars stars={stars} className="gk-stop__stars" />
                  {taleWon[i] && <span className="gk-stop__tale" title="Tale challenge won">📜</span>}
                  {!open[i] && (
                    <span className="gk-stop__lock">
                      <span aria-hidden="true">🔒</span> {TEXT.locked(i)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="gk-campaign__note" role="status">
        {note}
      </p>
    </section>
  );
}

function Stars({ stars, className }: { stars: number; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} data-on={n <= stars || undefined}>
          ★
        </span>
      ))}
    </span>
  );
}

/** The painting with a gem button per level on its trail, and one card about the level shown. */
function PaintedWorld({
  painting,
  progress,
  open,
  next,
  onPlay,
  taleWon,
  taleWords,
}: {
  painting: string;
  progress: CampaignProgress;
  open: boolean[];
  next: number;
  onPlay: (index: number) => void;
  taleWon: boolean[];
  taleWords?: (index: number) => string;
}) {
  // The card shows the level pointed at, otherwise the one focused or picked (the next level to start with).
  const [picked, setPicked] = useState(Math.max(0, next));
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? picked;
  const level = CAMPAIGN[shown];
  const stars = progress[level.id]?.stars ?? 0;
  const route = CAMPAIGN_MARKERS.slice(0, CAMPAIGN.length)
    .map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`)
    .join(" ");
  return (
    <div className="gk-world">
      <div
        className="gk-world__paper"
        style={{ backgroundImage: `url(${painting})` }}
      >
        <svg
          className="gk-world__route"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline className="gk-world__route-glow" points={route} />
          <polyline className="gk-world__route-dots" points={route} />
        </svg>
        <ol className="gk-world__stops">
          {CAMPAIGN.map((l, i) => {
            const [x, y] = CAMPAIGN_MARKERS[i] ?? [0.5, 0.5];
            const s = progress[l.id]?.stars ?? 0;
            return (
              <li
                key={l.id}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              >
                <button
                  type="button"
                  className="gk-gemstop"
                  data-key={i < 9 ? String(i + 1) : undefined}
                  aria-label={TEXT.stopLabel(i + 1, l.name, s, !open[i])}
                  aria-describedby="gk-world-card"
                  aria-pressed={i === picked}
                  data-locked={!open[i] || undefined}
                  data-next={
                    (i === next && !progress[l.id]?.keyPassed) || undefined
                  }
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setPicked(i)}
                  onClick={() =>
                    i === picked && open[i] ? onPlay(i) : setPicked(i)
                  }
                >
                  <span aria-hidden="true">{open[i] ? i + 1 : "🔒"}</span>
                </button>
                <span className="gk-gemstop__pips" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <i key={n} data-on={n <= s || undefined} />
                  ))}
                  {taleWon[i] && <b className="gk-gemstop__tale">📜</b>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="gk-world__card" id="gk-world-card" aria-live="polite">
        <p className="gk-world__level">Level {shown + 1}</p>
        <h2>{level.name}</h2>
        {level.intro && <p>{level.intro}</p>}
        <p className="gk-world__meta">
          <span className="gk-stop__tables">
            {TEXT.tables(campaignTables(shown + 1))}
          </span>
          <Stars stars={stars} className="gk-world__stars" />
        </p>
        {taleWords && open[shown] && (
          <p className="gk-world__tale" data-won={taleWon[shown] || undefined}>
            <span aria-hidden="true">📜</span> {taleWords(shown)}{taleWon[shown] ? ' ✓' : ''}
          </p>
        )}
        {open[shown] ? (
          <button
            type="button"
            className="button button--play gk-world__play"
            data-key="enter"
            onClick={() => onPlay(shown)}
          >
            {TEXT.playLevel(shown + 1)}
          </button>
        ) : (
          <p className="gk-world__lock">
            <span aria-hidden="true">🔒</span> {TEXT.locked(shown)}
          </p>
        )}
      </div>
    </div>
  );
}
