import { useEffect, useState } from 'react';
import type { ClanSeasonSummary, HallRow } from '../../data/clans';
import { MONSTER_LOOKS, monsterOf } from '../../../shared/clans/monster';
import { bannerArt } from './art';

/** "2026-11-03" as "3 Nov" (no time zones: the date is read as written). */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''}`.trim();
}

/** Newest season first. */
export function bySeason(rows: HallRow[]): { season: number; rows: HallRow[] }[] {
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => b - a);
  return seasons.map((season) => ({ season, rows: rows.filter((r) => r.season === season) }));
}

/** The seasons to show, with `extra` (the season the fame top 10 is for) added if it has no builders or slayers. */
export function withSeason(seasons: { season: number; rows: HallRow[] }[], extra?: number): { season: number; rows: HallRow[] }[] {
  if (!extra || seasons.some((s) => s.season === extra)) return seasons;
  return [...seasons, { season: extra, rows: [] }].sort((a, b) => b.season - a.season);
}

/** A finished season's top 10 clans by fame (pupils only), the champions first. Clan names only. */
function FameTop({ past }: { past: ClanSeasonSummary }) {
  const monster = MONSTER_LOOKS[monsterOf(past.season)].short;
  return (
    <>
      <h4>Most fame</h4>
      <ol className="cq-hall__fame">
        {past.top.map((c, i) => {
          const banner = bannerArt(c.clanName);
          return (
            <li key={`f-${c.clanName}-${i}`} className={c.isMe ? 'cq-me' : undefined}>
              {banner && <img src={banner} alt="" width={24} height={24} />}
              {i === 0 && <span title={`Season ${past.season} Champions`} aria-label={`Season ${past.season} Champions`}>👑 </span>}
              {c.clanName}{c.isMe && <span className="cq-soft"> (you)</span>} <span className="cq-soft">{c.fame.toLocaleString()} fame</span>
              {c.monster && <span title={`Beat ${monster}`}> 🦷</span>}{c.village && <span title="Finished the whole village"> 🏰</span>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * The Hall of Legends: the clans that finished their whole village (and, later, beat the monster), one list for each season.
 * Clan names and dates only.
 */
export function Hall({ load, past, onWatch, onBack }: {
  load: () => Promise<HallRow[] | null>;
  /** My last finished season: its fame top 10 shows under that season's builders and slayers. */
  past?: ClanSeasonSummary;
  /** Watch that season's ceremony again. */
  onWatch?: () => void;
  onBack: () => void;
}) {
  const [rows, setRows] = useState<HallRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    load().then((r) => current && setRows(r ?? []), () => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [load]);
  const seasons = rows ? bySeason(rows) : [];
  return (
    <section className="cq-hall" aria-label="Hall of Legends">
      <h2>Hall of Legends</h2>
      <p className="cq-soft">Clans that finished their whole village, beat the monster or won the most fame. They stay here forever, even after a new season starts.</p>
      {past && onWatch && <div className="cq-actions"><button type="button" className="cq-btn" onClick={onWatch}>🎺 Watch the Season {past.season} ceremony</button></div>}
      {failed ? (
        <p className="cq-note" role="alert">We couldn't load the Hall of Legends just now.</p>
      ) : !rows ? (
        <p role="status">Loading the Hall of Legends…</p>
      ) : seasons.length === 0 && !past?.top.length ? (
        <p className="cq-panel" role="status">No legends yet. Be the first to finish your whole village!</p>
      ) : (
        withSeason(seasons, past?.season).map(({ season, rows: list }) => {
          const builders = list.filter((r) => r.villageDoneOn);
          const slayers = list.filter((r) => r.monsterDoneOn);
          return (
            <section key={season} className="cq-panel" aria-label={`Season ${season}`}>
              <h3>Season {season}</h3>
              {builders.length > 0 && (
                <>
                  <h4>Village builders</h4>
                  <ul>
                    {builders.map((r) => (
                      <li key={`b-${r.clanName}`} className={r.isMe ? 'cq-me' : undefined}>
                        {r.clanName}{r.isMe && <span className="cq-soft"> (you)</span>} <span className="cq-soft">{shortDate(r.villageDoneOn!)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {slayers.length > 0 && (
                <>
                  <h4>Monster slayers</h4>
                  <ul>
                    {slayers.map((r) => (
                      <li key={`m-${r.clanName}`} className={r.isMe ? 'cq-me' : undefined}>
                        {r.clanName}{r.isMe && <span className="cq-soft"> (you)</span>} <span className="cq-soft">{shortDate(r.monsterDoneOn!)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {past?.season === season && past.top.length > 0 && <FameTop past={past} />}
            </section>
          );
        })
      )}
      <div className="cq-actions"><button data-key="esc" type="button" className="cq-btn" onClick={onBack}>Back to the scoreboard</button></div>
    </section>
  );
}
