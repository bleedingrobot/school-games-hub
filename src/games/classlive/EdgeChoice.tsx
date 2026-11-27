/**
 * The "Run it on" choice on a Class Live card (shared/classlive/edge.ts): only EDGE_TEACHERS see it, for a game that can
 * run on Cloudflare, so James can play the same game on both and compare. Everyone else gets the default (Cloudflare
 * once a game is live there, else the school server).
 */
import { useContext, useState } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import { edgeChoice } from '../../../shared/classlive/edge';

/** `extra` goes into the card's open body: `{ edge: false }` when the teacher picked the school server. */
export function useEdgeChoice(activity: string) {
  const me = useContext(AuthContext)?.profile?.id ?? '';
  const shown = edgeChoice(me, activity);
  const [edge, setEdge] = useState(true);
  const node = shown ? (
    <div className="cl-opt">
      <span className="cl-opt__label">Run it on (trial)</span>
      <div className="cl-chips" role="group" aria-label="Run it on">
        <button type="button" className={`cl-choice ${edge ? 'cl-choice--on' : ''}`} aria-pressed={edge} onClick={() => setEdge(true)}>Cloudflare</button>
        <button type="button" className={`cl-choice ${!edge ? 'cl-choice--on' : ''}`} aria-pressed={!edge} onClick={() => setEdge(false)}>School server</button>
      </div>
    </div>
  ) : null;
  return { node, extra: shown && !edge ? { edge: false as const } : {} };
}
