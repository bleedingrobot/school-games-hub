/**
 * Musical Thrones on the Class Live picker page and in the lobby (docs/THRONES-PLAN.md). Kept out of Projector.tsx so
 * the other Class Live games built at the same time don't clash with it there.
 */
import { useState, type ComponentType } from 'react';
import { HALLS, HALL_WORDS, type Hall } from '../../../shared/classlive/thrones';
import { painted } from './paintedArt';
import { ThronesGuide } from './ThronesGuide';
import './thrones-shell.css';

export function ThronesCard({ busy, hostOk, onOpen, Timer, Art }: {
  busy: boolean;
  hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  Timer: ComponentType<{ length: number; setLength: (m: number) => void }>;
  Art: ComponentType<{ pic: string | null }>;
}) {
  const [hall, setHall] = useState<Hall | 'any'>('any');
  const [length, setLength] = useState(5);
  const [guide, setGuide] = useState(false);
  return (
    <section className="cl-card cl-card--active cl-card--thrones" aria-label="Musical Thrones">
      <Art pic={painted('pick', 'thrones', true) ?? painted('thrones', 'hall-castle', true)} />
      <h2 className="cl-card__name">👑 Musical Thrones</h2>
      <p className="cl-card__blurb">Dance while the music plays. When it stops, grab a throne! Fewer every round.</p>
      <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
      {guide && <ThronesGuide hall={hall === 'any' ? HALLS[0] : hall} onClose={() => setGuide(false)} />}
      <div className="cl-opt">
        <span className="cl-opt__label">Which hall?</span>
        <div className="cl-chips" role="group" aria-label="Hall">
          <button type="button" className={`cl-choice ${hall === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={hall === 'any'} onClick={() => setHall('any')}>Surprise me</button>
          {HALLS.map((h) => (
            <button key={h} type="button" className={`cl-choice ${hall === h ? 'cl-choice--on' : ''}`} aria-pressed={hall === h} onClick={() => setHall(h)}>{HALL_WORDS[h].name}</button>
          ))}
        </div>
      </div>
      <Timer length={length} setLength={setLength} />
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, ...(hall === 'any' ? {} : { hall }) })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function ThronesLobbyHead({ hall }: { hall: Hall }) {
  const [guide, setGuide] = useState(false);
  return (
    <>
      {guide && <ThronesGuide hall={hall} onClose={() => setGuide(false)} />}
      <h1 className="cl-lobby__title">Musical Thrones</h1>
      <div className="cl-lobby__fact">{HALL_WORDS[hall].name}</div>
      <div className="mt-lobby-thrones" aria-hidden="true">{['🪑', '👑', '🪑', '🎵', '🪑'].map((x, i) => <i key={i} style={{ animationDelay: `${i * 0.18}s` }}>{x}</i>)}</div>
      <p className="cl-lobby__ask">Dance while the music plays. When it stops, sit on a throne! Who will be left standing?</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
    </>
  );
}
