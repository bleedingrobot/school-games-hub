/**
 * A Class Showdown arena's options on the Class Live page (James, 26 Nov 2026 NZ: each arena is its own tile on the
 * picker, and its options are on the page that follows). The teacher picks who plays (whole class, teams or solo) and
 * how long, and the page swaps to the Showdown projector, which opens the room at once.
 */
import { useState } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { Arena, Mode } from '../../../shared/showdown/types';
import type { ShowdownStart } from '../showdown/Projector';
import { liveGame, showdownPick } from './gameList';

const ABOUT: Record<Arena, string> = {
  boss: 'The whole class battles a boss with maths. Strikers hit, guards hold the shield, healers wake dazed friends.',
  goldrush: 'Dig the gold out of the mountain before the cave falls in. Prop-holders keep the roof up.',
  skyclimb: 'Climb to the summit together. Every right answer lifts the class higher.',
  island: 'The sea is rising! Build the rescue raft before the island goes under.',
  hill: 'Build the hilltop castle and take the crown.',
  auction: 'Earn coins with maths, then bid for treasure to fill the royal treasury.',
};
const MODES: { id: Mode; label: string }[] = [
  { id: 'class', label: 'Whole class' }, { id: 'teams2', label: '2 teams' }, { id: 'teams4', label: '4 teams' }, { id: 'solo', label: 'Everyone for themselves' },
];

const KEY = 'classlive.showdown';
function kept(): Partial<ShowdownStart> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<ShowdownStart>; } catch { return {}; }
}

export function ShowdownCard({ arena, busy, locked = false, onOpen }: { arena: Arena; busy: boolean; locked?: boolean; onOpen: (s: ShowdownStart) => void }) {
  const was = kept();
  const game = liveGame(showdownPick(arena));
  const pic = game?.pic() ?? null;
  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.id === was.mode) ? (was.mode as Mode) : 'class');
  const [length, setLength] = useState<number>((SHOWDOWN.lengths as readonly number[]).includes(was.length ?? -1) ? (was.length as number) : SHOWDOWN.defaultLength);
  const go = () => {
    const s = { arena, mode, length };
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not kept */ }
    onOpen(s);
  };
  return (
    <section className="cl-card cl-card--active cl-card--sd" aria-label={game?.name ?? 'Class Showdown'}>
      <div className="cl-card__art" aria-hidden="true">{pic ? <img src={pic} alt="" loading="eager" /> : null}</div>
      <h2 className="cl-card__name">{game?.emoji} {game?.name}</h2>
      <p className="cl-card__kicker">⚔️ Class Showdown</p>
      <p className="cl-card__blurb">{ABOUT[arena]}</p>
      <div className="cl-opt">
        <span className="cl-opt__label">Who plays?</span>
        <div className="cl-chips" role="group" aria-label="Who plays">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`cl-choice ${mode === m.id ? 'cl-choice--on' : ''}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">How long?</span>
        <div className="cl-chips" role="group" aria-label="Minutes">
          {SHOWDOWN.lengths.map((l) => (
            <button key={l} type="button" className={`cl-choice ${length === l ? 'cl-choice--on' : ''}`} aria-pressed={length === l} onClick={() => setLength(l)}>{l} min</button>
          ))}
        </div>
      </div>
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || locked} onClick={go}>{busy ? 'Opening…' : 'Open the battle'}</button>
      <p className="cl-sd__note">For your class only.</p>
    </section>
  );
}
