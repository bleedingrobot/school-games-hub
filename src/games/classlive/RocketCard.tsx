/**
 * Rocket Relay on the Class Live picker page and in the lobby (docs/ROCKET-PLAN.md). Kept out of Projector.tsx so other
 * Class Live games built at the same time don't clash with it there.
 */
import { useState, type ComponentType } from 'react';
import { DEFAULT_PER_RUN, DEFAULT_TEAMS, PER_RUN, TEAM_COUNTS, type PerRun } from '../../../shared/classlive/rocket';
import type { RocketPublic } from '../../../shared/classlive/rocketServer';
import { painted } from './paintedArt';
import './rocket.css';

export const rocketPic = () => painted('pick', 'rocket', true) ?? painted('pick', 'relay', true) ?? painted('back', 'star-sky', true);

export function RocketCard({ busy, hostOk, onOpen, Timer, Art }: {
  busy: boolean;
  hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  Timer: ComponentType<{ length: number; setLength: (m: number) => void }>;
  Art: ComponentType<{ pic: string | null }>;
}) {
  const [teams, setTeams] = useState<number>(DEFAULT_TEAMS);
  const [perRun, setPerRun] = useState<PerRun>(DEFAULT_PER_RUN);
  const [length, setLength] = useState(0);
  return (
    <section className="cl-card cl-card--active" aria-label="Rocket Relay">
      <Art pic={rocketPic()} />
      <h2 className="cl-card__name">🚀 Rocket Relay</h2>
      <p className="cl-card__blurb">A real running relay. Every right answer boosts your team's rocket. First to the Moon wins!</p>
      <ul className="rk-card-how">
        <li>Teams line up at one end. Each team's iPad sits at the other end (pupils sign in and join, then pick a team on it).</li>
        <li>The big screen shows the running order. Run, tap "I'm here", answer, run back and tag the next runner.</li>
        <li>Wrong? One more try. The site makes the teams, and everyone gets questions at their own level.</li>
      </ul>
      <div className="cl-opt">
        <span className="cl-opt__label">Teams</span>
        <div className="cl-chips" role="group" aria-label="Teams">
          {TEAM_COUNTS.map((n) => (
            <button key={n} type="button" className={`cl-choice ${teams === n ? 'cl-choice--on' : ''}`} aria-pressed={teams === n} onClick={() => setTeams(n)}>{n}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Questions per run</span>
        <div className="cl-chips" role="group" aria-label="Questions per run">
          {PER_RUN.map((n) => (
            <button key={n} type="button" className={`cl-choice ${perRun === n ? 'cl-choice--on' : ''}`} aria-pressed={perRun === n} onClick={() => setPerRun(n)}>{n}</button>
          ))}
        </div>
      </div>
      <Timer length={length} setLength={setLength} />
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, teams, perRun })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function RocketLobbyHead({ game, showNames }: { game: RocketPublic; showNames: boolean }) {
  return (
    <>
      <h1 className="cl-lobby__title">Rocket Relay</h1>
      <div className="cl-lobby__fact">{game.teams.length} teams</div>
      <div className="rk-lobby-teams">
        {game.teams.map((t) => (
          <div key={t.name} className="rk-lobby-team" style={{ borderColor: t.colour }}>
            <b style={{ color: t.colour }}>{t.name}</b>
            <span>{showNames ? t.order.map((p) => p.name).join(', ') : `${t.size} runners`}</span>
          </div>
        ))}
      </div>
      <p className="cl-lobby__ask">Line up in your team. Join on an iPad, pick your team on it, and put it at the far end.</p>
    </>
  );
}
