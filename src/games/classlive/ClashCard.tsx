/**
 * Colour Clash's card on the Class Live picker (docs/CLASH-PLAN.md): teams (2, 3 or 4, James 25 Nov 2026 NZ), paint time
 * per round, map and the game's length.
 */
import { useState } from 'react';
import { CLASH_MAPS, MAP_WORDS, PAINT_DEFAULT_S, PAINT_S, TEAM_COUNTS, type ClashMap } from '../../../shared/classlive/clash';
import { ClashGuide } from './ClashGuide';
import { useEdgeChoice } from './EdgeChoice';
import { painted } from './paintedArt';
import { CardArt, TimerChips } from './Projector';

export function ClashCard({ busy, disabled, onOpen }: { busy: boolean; disabled: boolean; onOpen: (body: Record<string, unknown>) => void }) {
  const clashRun = useEdgeChoice('clash');
  const [map, setMap] = useState<ClashMap | 'any'>('any');
  const [teams, setTeams] = useState<number>(4);
  const [paint, setPaint] = useState<number>(PAINT_DEFAULT_S);
  const [length, setLength] = useState(10);
  const [guide, setGuide] = useState(false);
  return (
    <section className="cl-card cl-card--active cl-card--clash" aria-label="Colour Clash">
      <CardArt pic={painted('pick', 'clash', true) ?? painted('clash', 'map-park', true)} />
      <h2 className="cl-card__name">🎨 Colour Clash</h2>
      <p className="cl-card__blurb">Teams paint the floor by running over it. Maths drops paint bombs. Biggest colour wins!</p>
      <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
      {guide && <ClashGuide map={map === 'any' ? CLASH_MAPS[0] : map} onClose={() => setGuide(false)} />}
      <div className="cl-opt">
        <span className="cl-opt__label">Teams</span>
        <div className="cl-chips" role="group" aria-label="Teams">
          {TEAM_COUNTS.map((n) => (
            <button key={n} type="button" className={`cl-choice ${teams === n ? 'cl-choice--on' : ''}`} aria-pressed={teams === n} onClick={() => setTeams(n)}>{n} teams</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Which map?</span>
        <div className="cl-chips" role="group" aria-label="Map">
          <button type="button" className={`cl-choice ${map === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={map === 'any'} onClick={() => setMap('any')}>Surprise me</button>
          {CLASH_MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${map === m ? 'cl-choice--on' : ''}`} aria-pressed={map === m} onClick={() => setMap(m)}>{MAP_WORDS[m].name}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Painting time each round</span>
        <div className="cl-chips" role="group" aria-label="Painting time each round">
          {PAINT_S.map((n) => (
            <button key={n} type="button" className={`cl-choice ${paint === n ? 'cl-choice--on' : ''}`} aria-pressed={paint === n} onClick={() => setPaint(n)}>{n} s</button>
          ))}
        </div>
      </div>
      <TimerChips length={length} setLength={setLength} />
      {clashRun.node}
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || disabled} onClick={() => onOpen({ length, teams, paint, ...(map === 'any' ? {} : { map }), ...clashRun.extra })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}
