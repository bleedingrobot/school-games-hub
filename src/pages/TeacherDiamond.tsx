/**
 * Diamond Drop for one student, on their student page (docs/DIAMOND-PLAN.md, section 6): one line on how deep they
 * are, and starting them again from level 1. The switch and the class line are in the Games table row.
 */
import { useState } from 'react';
import { LAST_LEVEL } from '../../shared/diamond/config';
import { fetchDiamondStudent, restartDiamondStudent } from '../data/diamond';
import { FriendlyError } from '../data/profile';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/** "Level 6 · 7 gems found · found the diamond", or null if they haven't played. */
export async function diamondStudentSummary(student: string): Promise<string | null> {
  const s = await fetchDiamondStudent(student);
  if (!s) return null;
  const level = s.deepest ? `Passed level ${s.deepest} of ${LAST_LEVEL}` : 'Not past level 1 yet';
  return [level, `${s.kinds} of 10 gems found`, ...(s.found ? ['found the diamond'] : [])].join(' · ');
}

export function DiamondStudentPanel({ student }: { student: string }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function restart() {
    setStatus('Starting again…');
    try {
      await restartDiamondStudent(student);
      setConfirming(false);
      setStatus('Done. They start again at level 1 next time they play, with their claw upgrades kept.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }
  return (
    <section aria-label="Diamond Drop">
      <h3>Diamond Drop</h3>
      {confirming ? (
        <p>
          Send this student back to level 1? They lose their levels, stars, coins and Gem Book this season. Their claw upgrades,
          achievements and any place in the Hall stay.{' '}
          <button type="button" className="button button--danger" onClick={() => void restart()}>
            Yes, start again
          </button>{' '}
          <button type="button" className="button button--light" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </p>
      ) : (
        <button type="button" className="button button--light" onClick={() => setConfirming(true)}>
          Start this student again…
        </button>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
