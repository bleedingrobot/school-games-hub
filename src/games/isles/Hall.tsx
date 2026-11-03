/**
 * The Hall of the Skies (docs/ISLES-PLAN.md, section 6.2): each season's top 3 islands in the class by island worth,
 * and everyone who lit their Sky Lighthouse, kept for good. "This season so far" shows who is ahead now, worked out
 * from the class sky. Island worth is never anything about maths (islandWorth in shared/isles/engine.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { LIGHTHOUSE } from '../../../shared/isles/config';
import type { HallEntry, HallSeason } from '../../../shared/isles/server';
import { keeperArt } from './art';
import type { ClassSkyView, IslesBackend } from './backend';
import { Art } from './Island';
import { n } from './words';

const PLACE = ['', '🥇 1st', '🥈 2nd', '🥉 3rd'];

/** The pupil's own island, for "this season so far". */
export interface MyHallIsland {
  islandName: string | null;
  keeper: string | null;
  worth: number;
  lighthouse: number;
}

function Row({ entry }: { entry: Pick<HallEntry, 'name' | 'islandName' | 'keeper' | 'worth' | 'place' | 'lit' | 'me'> }) {
  return (
    <li className={`si-hall__row${entry.me ? ' si-hall__row--me' : ''}`}>
      <span className="si-hall__place">{entry.place ? PLACE[entry.place] : '🗼'}</span>
      <span className="si-mate__keeper">
        <Art src={entry.keeper ? keeperArt(entry.keeper, true) : undefined} fallback={<span className="si-keeper__drawn" aria-hidden="true">{entry.name.slice(0, 1)}</span>} />
      </span>
      <span className="si-hall__words">
        <strong>{entry.islandName ?? `${entry.name}'s island`}</strong>
        <span className="si-note">
          {entry.islandName ? `${entry.me ? 'You' : entry.name}, ` : entry.me ? 'You, ' : ''}worth {n(entry.worth)}{entry.lit ? ', Sky Lighthouse lit' : ''}
        </span>
      </span>
    </li>
  );
}

const when = (ended: string) => new Date(`${ended}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function HallOfSkies({ backend, mine, onBack }: { backend: IslesBackend; mine: MyHallIsland; onBack: () => void }) {
  const [hall, setHall] = useState<HallSeason[] | null>(null);
  const [sky, setSky] = useState<ClassSkyView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    Promise.all([backend.send({ action: 'hall' }), backend.send({ action: 'sky' })]).then(
      ([h, s]) => {
        setHall(h.hall as HallSeason[]);
        setSky(s as unknown as ClassSkyView);
      },
      (e: Error) => setProblem(e.message),
    );
  }, [backend]);

  const lit = mine.lighthouse >= LIGHTHOUSE.length;
  const soFar = sky
    ? [
        ...sky.classmates.map((c) => ({ name: c.name, islandName: c.islandName, keeper: c.keeper, worth: c.worth, lit: c.lighthouse >= LIGHTHOUSE.length, me: false })),
        { name: 'You', ...mine, lit, me: true },
      ]
        .sort((a, b) => b.worth - a.worth)
        .slice(0, 3)
        .map((e, i) => ({ ...e, place: i + 1 }))
    : [];
  const meInTop = soFar.some((e) => e.me);

  return (
    <section className="si-hall" aria-labelledby="si-hall-title">
      <div className="si-top">
        <h2 id="si-hall-title" ref={heading} tabIndex={-1}>Hall of the Skies</h2>
        <button type="button" className="button button--light" onClick={onBack}>Back to the class sky</button>
      </div>
      {problem && <p className="si-problem" role="alert">{problem}</p>}
      {!hall && !problem && <p>Opening the Hall…</p>}
      {hall && (
        <div className="si-sky__main">
          <section className="si-panel" aria-labelledby="si-hall-now">
            <h3 id="si-hall-now">This season so far</h3>
            <p className="si-note">Island worth: 10 for each building spot, 5 for each building level, 1 for every 5 islanders, a little for each decoration, and 50 for each Lighthouse stage.</p>
            <ol className="si-hall__list">{soFar.map((e) => <Row key={e.name} entry={e} />)}</ol>
            {!meInTop && <p>Your island is worth {n(mine.worth)}. Keep growing!</p>}
            <p className="si-note">At the end of the season, the top 3 islands and everyone who lit their Sky Lighthouse go in the Hall for good.</p>
          </section>
          <section className="si-panel" aria-labelledby="si-hall-past">
            <h3 id="si-hall-past">Past seasons</h3>
            {hall.length ? (
              hall.map((season) => (
                <section key={season.ended} className="si-hall__season" aria-label={`Season ending ${when(season.ended)}`}>
                  <h4>Season ending {when(season.ended)}</h4>
                  <ol className="si-hall__list">{season.entries.map((e, i) => <Row key={i} entry={e} />)}</ol>
                </section>
              ))
            ) : (
              <p>The first Hall of the Skies is made at the end of this season. Could your island be in it?</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
