import { useEffect, useState } from 'react';
import type { HallRow } from '../../data/clans';

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

/**
 * The Hall of Legends: the clans that finished their whole village (and, later, beat the monster), one list for each season.
 * Clan names and dates only.
 */
export function Hall({ load, onBack }: { load: () => Promise<HallRow[] | null>; onBack: () => void }) {
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
      <p className="cq-soft">Clans that finished their whole village. They stay here forever, even after a new season starts.</p>
      {failed ? (
        <p className="cq-note" role="alert">We couldn't load the Hall of Legends just now.</p>
      ) : !rows ? (
        <p role="status">Loading the Hall of Legends…</p>
      ) : seasons.length === 0 ? (
        <p className="cq-panel" role="status">No legends yet. Be the first to finish your whole village!</p>
      ) : (
        seasons.map(({ season, rows: list }) => {
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
            </section>
          );
        })
      )}
      <div className="cq-actions"><button type="button" className="cq-btn" onClick={onBack}>Back to the scoreboard</button></div>
    </section>
  );
}
