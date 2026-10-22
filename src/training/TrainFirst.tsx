/**
 * Training before games (James, 22 Oct 2026): what a student sees when their class wants a Training session before the
 * games. The rule is in shared/training/gate.ts and the server's answer in src/data/trainingGate.ts.
 *
 * - GameGate wraps a game page (and the Lobby): it decides once, when the page opens, so a game that is already going is
 *   never closed by the lock.
 * - TrainingGateBanner is the home page's line: locked, or open until when.
 * - GamesGateNote is the line on the Training screens.
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { TRAINING_CONFIG } from '../../shared/training/config';
import { clockTime } from '../../shared/training/gate';
import { usePlacementGate } from '../data/placementGate';
import { useTrainingGate } from '../data/trainingGate';
import { PlacementFirstScreen } from './PlacementFirst';
import { trainingOn } from './switch';
import './gate.css';

/** The two ways to train, as buttons. */
function TrainButtons() {
  return (
    <div className="train-first__buttons">
      <Link className="button button--primary" to="/training">
        <span aria-hidden="true">🧮</span> Today’s session
      </Link>
      <Link className="button button--primary" to="/training?quick=1">
        <span aria-hidden="true">👀</span> Quick looks
      </Link>
    </div>
  );
}

export function TrainFirstScreen() {
  return (
    <section className="coming-soon train-first" aria-labelledby="train-first-title">
      <div className="coming-soon__emoji" aria-hidden="true">
        🧮
      </div>
      <h1 id="train-first-title">Training first!</h1>
      <div className="coming-soon__text">
        <p>Do one training session to open the games. Pick whichever you like.</p>
        <p>After that, the games stay open for {hoursText()}.</p>
      </div>
      <TrainButtons />
      <Link className="train-first__home" to="/">
        Back to home
      </Link>
    </section>
  );
}

const hoursText = () => `${TRAINING_CONFIG.gate.gamesOpenHours} hours`;

/**
 * Shows the page only if the games are open for this student: the maths warm-up done (in a class whose games pick the maths),
 * then Training before games.
 */
export function GameGate({ children }: { children: ReactNode }) {
  const gate = useTrainingGate({ live: false });
  const placement = usePlacementGate();
  const location = useLocation();
  if (!placement.ready) {
    return (
      <p className="loading" role="status">
        Loading…
      </p>
    );
  }
  if (placement.needed) return <PlacementFirstScreen back={location.pathname + location.search} />;
  if (!trainingOn()) return <>{children}</>;
  if (!gate.ready) {
    return (
      <p className="loading" role="status">
        Loading…
      </p>
    );
  }
  return gate.locked ? <TrainFirstScreen /> : <>{children}</>;
}

/** The home page's line. Nothing at all when the lock doesn't apply. */
export function TrainingGateBanner() {
  const gate = useTrainingGate();
  if (!trainingOn() || !gate.ready) return null;
  if (gate.locked) {
    return (
      <section className="train-banner" aria-labelledby="train-banner-title">
        <p>
          <strong id="train-banner-title">Training first!</strong> Do one training session to open the games.
        </p>
        <TrainButtons />
      </section>
    );
  }
  if (gate.openUntil === null) return null;
  return (
    <p className="train-open" role="status">
      <span aria-hidden="true">✅</span> Games open until {clockTime(gate.openUntil)}
    </p>
  );
}

/** The line on the Training screens. Nothing at all when the lock doesn't apply. */
export function GamesGateNote() {
  const gate = useTrainingGate();
  if (!gate.ready) return null;
  if (gate.locked) return <p className="train-note">Finish a session to open the games.</p>;
  if (gate.openUntil === null) return null;
  return (
    <p className="train-note train-note--open">
      Games are open until {clockTime(gate.openUntil)}. <Link to="/">Back to games</Link>
    </p>
  );
}
