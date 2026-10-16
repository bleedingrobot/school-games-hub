/**
 * The campaign map: ten levels along a trail, with stars, the times tables each one
 * practises, and locks until the level before's Level Key is passed.
 */
import { CAMPAIGN } from '../../../../shared/gem-keep/levels';
import { campaignTables } from '../../../../shared/maths/selector';
import { isUnlocked, totalStars, type CampaignProgress } from '../progress';
import { TEXT } from '../strings';

const IDS = CAMPAIGN.map((l) => l.id);

export function CampaignMap({
  progress,
  note = TEXT.savedHere,
  onPlay,
}: {
  progress: CampaignProgress;
  /** The line under the map, about saving. */
  note?: string;
  onPlay: (index: number) => void;
}) {
  const open = CAMPAIGN.map((_, i) => isUnlocked(progress, IDS, i));
  // The furthest open level that hasn't been won yet glows.
  const next = open.lastIndexOf(true);
  return (
    <section className="gk-campaign" aria-labelledby="gk-map-title">
      <header className="gk-campaign__head">
        <div>
          <h1 id="gk-map-title">{TEXT.mapTitle}</h1>
          <p>{TEXT.mapIntro}</p>
        </div>
        <span className="gk-campaign__total">★ {TEXT.totalStars(totalStars(progress), CAMPAIGN.length * 3)}</span>
      </header>
      <ol className="gk-trail">
        {CAMPAIGN.map((level, i) => {
          const stars = progress[level.id]?.stars ?? 0;
          const tables = campaignTables(i + 1);
          return (
            <li key={level.id}>
              <button
                type="button"
                className="gk-stop"
                disabled={!open[i]}
                data-next={(i === next && !progress[level.id]?.keyPassed) || undefined}
                aria-label={`${TEXT.levelLabel(i + 1, level.name)}. ${TEXT.levelStars(stars)}. ${TEXT.tablesLabel(tables)}.${open[i] ? '' : ` ${TEXT.locked(i)}.`}`}
                title={open[i] ? level.intro : TEXT.locked(i)}
                onClick={() => onPlay(i)}
              >
                <span className="gk-stop__number" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="gk-stop__name">{level.name}</span>
                <span className="gk-stop__tables">{TEXT.tables(tables)}</span>
                <span className="gk-stop__stars" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} data-on={n <= stars || undefined}>
                      ★
                    </span>
                  ))}
                </span>
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
      <p className="gk-campaign__note" role="status">
        {note}
      </p>
    </section>
  );
}
