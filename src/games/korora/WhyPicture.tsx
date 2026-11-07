/**
 * The picture for the first wrong tap of a go (maths review R5): what the mistake looks like, small, under the question.
 * Doubles: the rock's fish and the water's (the same again), with the fish a slip adds shown dashed and empty, or every
 * fish counted. Halves: the pile shared between two chicks, with one chick's share lit, both shares equal, or counted.
 */
import type { ReactNode } from 'react';
import type { Go, WrongKind } from '../../../shared/korora/round';
import { Chick, Fish } from './KororaArt';

type Tone = 'lit' | 'dim' | 'ghost';
interface Group {
  count: number;
  tone?: Tone;
  /** Numbers 1, 2, 3... on the fish. */
  counted?: boolean;
  /** The fish arrive one after another. */
  arrive?: boolean;
  chick?: boolean;
  /** A short label under the group: "rock", "water". */
  label?: string;
}

/** What each mistake shows, as groups of fish with a sign between (= or an arrow). */
function groupsFor(go: Go, kind: WrongKind): { groups: Group[]; sign: string } {
  const n = go.n;
  const half = go.answer;
  switch (kind) {
    case 'same':
      return { groups: [{ count: n, tone: 'lit', label: 'rock' }, { count: n, tone: 'lit', arrive: true, label: 'water' }], sign: '+' };
    case 'plus1':
      return { groups: [{ count: n, tone: 'lit', label: 'rock' }, { count: 1, tone: 'ghost', label: 'too many' }, { count: n, tone: 'lit', label: 'water' }], sign: '+' };
    case 'plus2':
      return { groups: [{ count: n, tone: 'lit', label: 'rock' }, { count: n, tone: 'lit', label: 'water' }, { count: 2, tone: 'ghost', label: 'not these' }], sign: '=' };
    case 'all':
      return { groups: [{ count: n, tone: 'dim', label: 'all' }, { count: half, tone: 'lit', chick: true, label: 'one share' }, { count: half, tone: 'dim', chick: true }], sign: '→' };
    case 'minus2':
      return { groups: [{ count: half, tone: 'lit', chick: true }, { count: half, tone: 'lit', chick: true }], sign: '=' };
    case 'double':
      return { groups: [{ count: n, tone: 'dim', label: 'the pile' }, { count: half, tone: 'lit', chick: true }, { count: half, tone: 'dim', chick: true }], sign: '→' };
    case 'miscount':
      return go.kind === 'double'
        ? { groups: [{ count: 2 * n, tone: 'lit', counted: true }], sign: '' }
        : { groups: [{ count: half, tone: 'lit', chick: true, counted: true }, { count: half, tone: 'dim', chick: true }], sign: '' };
  }
}

export function WhyPicture({ go, kind }: { go: Go; kind: WrongKind }) {
  const { groups, sign } = groupsFor(go, kind);
  const parts: ReactNode[] = [];
  groups.forEach((g, i) => {
    if (i > 0 && sign) parts.push(<span key={`s${i}`} className="kr-wp__sign" aria-hidden="true">{i === 1 || sign !== '→' ? sign : ''}</span>);
    parts.push(
      <div key={i} className={`kr-wp__group kr-wp__group--${g.tone ?? 'lit'}`}>
        {g.chick && <span className="kr-wp__chick"><Chick happy={g.tone === 'lit'} /></span>}
        <div className="kr-wp__fish" style={{ '--cols': g.count <= 5 ? g.count : g.count <= 12 ? Math.ceil(g.count / 2) : 10 } as React.CSSProperties}>
          {Array.from({ length: g.count }, (_, f) => (
            <span key={f} className={`kr-wp__f${g.arrive ? ' kr-wp__f--arrive' : ''}`} style={{ '--i': f } as React.CSSProperties}>
              <Fish />
              {g.counted && <span className="kr-wp__count">{f + 1}</span>}
            </span>
          ))}
        </div>
        {g.label && <span className="kr-wp__label">{g.label}</span>}
      </div>,
    );
  });
  // Many fish (halves of 14 to 20, a double of 7 to 10 counted): smaller, so the picture stays low.
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return <div className={`kr-wp${total > 12 ? ' kr-wp--small' : ''}`} aria-hidden="true">{parts}</div>;
}
