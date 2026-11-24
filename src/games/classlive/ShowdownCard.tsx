/**
 * Class Showdown on the Class Live page's picker (James, 24 Nov 2026: one page, called Class Live, for every class game).
 * The teacher picks an arena (painted), who plays (whole class, teams or solo) and how long, and the page swaps to the
 * Showdown projector, which opens the room at once.
 */
import { useState } from 'react';
import { SHOWDOWN } from '../../../shared/showdown/config';
import type { Arena, Mode } from '../../../shared/showdown/types';
import { ARENA_CHOICES } from '../showdown/arenaWords';
import type { ShowdownStart } from '../showdown/Projector';

const ART = import.meta.glob('../showdown/art/paint/back/*-800.webp', { eager: true, import: 'default' }) as Record<string, string>;
const BACKS: Record<Arena, string> = {
  boss: 'river-valley', goldrush: 'gold-rush', skyclimb: 'sky-climb', island: 'shrinking-island', hill: 'king-hill', auction: 'auction-house',
};
const artOf = (a: Arena): string | undefined => ART[`../showdown/art/paint/back/${BACKS[a]}-800.webp`];

const ABOUT: Record<Arena, string> = {
  boss: 'Beat the boss together',
  goldrush: 'Dig gold before the cave falls in',
  skyclimb: 'Climb to the summit',
  island: 'Build a raft before the sea rises',
  hill: 'Build the castle, take the crown',
  auction: 'Earn coins, bid for treasure',
};

const MODES: { id: Mode; label: string }[] = [
  { id: 'class', label: 'Whole class' }, { id: 'teams2', label: '2 teams' }, { id: 'teams4', label: '4 teams' }, { id: 'solo', label: 'Everyone for themselves' },
];

const KEY = 'classlive.showdown';
function kept(): Partial<ShowdownStart> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<ShowdownStart>; } catch { return {}; }
}

export function ShowdownCard({ busy, onOpen }: { busy: boolean; onOpen: (s: ShowdownStart) => void }) {
  const was = kept();
  const [arena, setArena] = useState<Arena>(ARENA_CHOICES.some((a) => a.id === was.arena) ? (was.arena as Arena) : 'boss');
  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.id === was.mode) ? (was.mode as Mode) : 'class');
  const [length, setLength] = useState<number>((SHOWDOWN.lengths as readonly number[]).includes(was.length ?? -1) ? (was.length as number) : SHOWDOWN.defaultLength);
  const go = () => {
    const s = { arena, mode, length };
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not kept */ }
    onOpen(s);
  };
  return (
    <section className="cl-card cl-card--active cl-card--showdown" aria-label="Class Showdown">
      <div className="cl-sd__head">
        <h2 className="cl-card__name">⚔️ Class Showdown</h2>
        <p className="cl-card__blurb">A live maths battle. Pick an arena.</p>
      </div>
      <div className="cl-sd__arenas" role="group" aria-label="Arena">
        {ARENA_CHOICES.map((a) => (
          <button key={a.id} type="button" className={`cl-sd__arena${arena === a.id ? ' is-on' : ''}`} aria-pressed={arena === a.id} onClick={() => setArena(a.id)}>
            {artOf(a.id) ? <img src={artOf(a.id)} alt="" loading="lazy" /> : null}
            <b>{a.name}</b>
            <small>{ABOUT[a.id]}</small>
          </button>
        ))}
      </div>
      <div className="cl-sd__opts">
        <div className="cl-chips" role="group" aria-label="Who plays">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`cl-choice ${mode === m.id ? 'cl-choice--on' : ''}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
        <div className="cl-chips" role="group" aria-label="Minutes">
          {SHOWDOWN.lengths.map((l) => (
            <button key={l} type="button" className={`cl-choice ${length === l ? 'cl-choice--on' : ''}`} aria-pressed={length === l} onClick={() => setLength(l)}>{l} min</button>
          ))}
        </div>
        <button type="button" className="cl-btn cl-btn--go cl-sd__go" disabled={busy} onClick={go}>Open the battle</button>
      </div>
      <p className="cl-sd__note">For your class only.</p>
    </section>
  );
}
