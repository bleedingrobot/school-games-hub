/**
 * Circuit Racer for one student, on their student page (docs/CIRCUIT-PLAN.md, section 5): starting them again from road 1.
 * The switch, maths and "Roads finished" are on the Games table and the Progress tab.
 */
import { useState } from 'react';
import { resetCircuitStudent } from '../data/circuit';
import { FriendlyError } from '../data/profile';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function CircuitStudentPanel({ student }: { student: string }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function reset() {
    setStatus('Starting again…');
    try {
      await resetCircuitStudent(student);
      setConfirming(false);
      setStatus('Done. They start again at road 1, with Volt’s guided first go.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }
  return (
    <section aria-label="Circuit Racer">
      <h3>Circuit Racer</h3>
      {confirming ? (
        <p>
          Start this student again from road 1? They lose their roads, medals and stars, their racer goes back to Spark and Volt’s
          tips show again. Their points and achievements stay.{' '}
          <button type="button" className="button button--danger" onClick={() => void reset()}>
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
