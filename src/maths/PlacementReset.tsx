/**
 * On a student's card: where their maths warm-up stands, and a button to offer it again. Clearing the warm-up never moves the
 * furthest place back (that is kept separately, and only ever goes forward). Teacher of that student's class only; the database checks.
 */
import { useEffect, useState } from 'react';
import { skillShortLabel } from '../../shared/maths/focus';
import { NO_LADDER, type LadderInfo } from '../../shared/maths/place';
import { FriendlyError } from '../data/profile';
import { fetchStudentLadder, resetPlacement } from '../data/skillMap';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function PlacementReset({ student, name }: { student: string; name: string }) {
  const [info, setInfo] = useState<LadderInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setInfo(null);
    setConfirming(false);
    setStatus(null);
    fetchStudentLadder(student)
      .then((i) => current && setInfo(i))
      .catch((error) => current && setStatus(errorText(error)));
    return () => {
      current = false;
    };
  }, [student]);

  async function reset() {
    setConfirming(false);
    setStatus('Saving…');
    try {
      const cleared = await resetPlacement(student);
      setInfo((i) => ({ ...(i ?? NO_LADDER), placed: null, placement: null }));
      setStatus(
        cleared
          ? `${name} will be offered the warm-up again the next time they open their maths path.`
          : `${name} had no warm-up to clear.`,
      );
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (!info)
    return status ? (
      <p role="status" className="focus-card__small">
        {status}
      </p>
    ) : null;
  const where =
    info.placed === 'done' && info.placement
      ? `warm-up done, started at ${skillShortLabel(info.placement)}`
      : info.placed === 'skipped'
        ? 'warm-up skipped'
        : 'warm-up not done yet';
  return (
    <div className="placement-reset">
      <h3 className="gk-teacher__heading">Maths warm-up</h3>
      <p>
        {name}: {where}
        {info.furthest && <>. Furthest place: {skillShortLabel(info.furthest)}</>}.
      </p>
      {!info.on && <p className="focus-card__small">Auto is off for their class, so the warm-up isn’t offered.</p>}
      {info.placed !== null && !confirming && (
        <button type="button" className="button button--light-outline" onClick={() => setConfirming(true)}>
          Offer the warm-up again
        </button>
      )}
      {confirming && (
        <div className="chess-confirm" role="group" aria-label="Confirm warm-up reset">
          <p>
            Clear {name}’s warm-up so they are asked to do it again? Their furthest place on the ladder is kept: it never moves back, so the
            games won’t ask anything easier than where they have already been.
          </p>
          <div className="person-panel__actions">
            <button type="button" className="button button--primary" onClick={() => void reset()}>
              Yes, offer it again
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </div>
  );
}
