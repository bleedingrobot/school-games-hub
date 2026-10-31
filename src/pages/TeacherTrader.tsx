/**
 * Star Trader's settings drawer on the Games table (docs/TRADER-PLAN.md, section 11). The on/off switch and who gets the maths
 * checks are in the table row; here are how many jumps a day and whether the bank is open. And (for one pupil, on their student
 * page) putting their ship back at the start. Per class, like the other game switches. The server checks every setting on every
 * request, so nothing can be done while it is off.
 */
import { useState } from 'react';
import { FriendlyError } from '../data/profile';
import { resetTraderShip } from '../data/trader';
import { saveTraderJumps, saveTraderLoans, useTraderClassSettings } from '../games/trader/teacher';
import { SettingNumber, SettingToggle } from '../teacher/Settings';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function TraderSettings({ classId }: { classId: string }) {
  const settings = useTraderClassSettings(classId);
  return (
    <div className="panel teacher__switch">
      <SettingNumber
        label="Jumps a day"
        about="How many jumps between planets each student gets a day."
        value={settings.value?.jumps ?? null}
        loadFailed={settings.failed}
        min={1}
        max={30}
        save={(n) => saveTraderJumps(n, classId)}
      />
      <SettingToggle
        label="Bank"
        about="Open: students can borrow up to 500 credits at 10% a week, and nothing bad happens if they take a while to pay it back."
        value={settings.value?.loans ?? null}
        loadFailed={settings.failed}
        save={(on) => saveTraderLoans(on, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Star Trader is off for this class, so these only matter once it’s on.</p>}
    </div>
  );
}

/** One student's part of the page: put their ship back at the start (a fresh Flea and 100 credits). */
export function TraderStudentPanel({ student }: { student: string }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  async function reset() {
    setStatus('Resetting…');
    try {
      await resetTraderShip(student);
      setConfirming(false);
      setStatus('Done. They start again with a Flea and 100 credits next time they play.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }
  return (
    <section aria-label="Star Trader">
      <h3>Star Trader</h3>
      {confirming ? (
        <p>
          Put this student’s ship back at the start? They lose their ship, cargo and money.{' '}
          <button type="button" className="button button--danger" onClick={() => void reset()}>
            Yes, reset it
          </button>{' '}
          <button type="button" className="button button--light" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </p>
      ) : (
        <button type="button" className="button button--light" onClick={() => setConfirming(true)}>
          Reset this student’s ship…
        </button>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
