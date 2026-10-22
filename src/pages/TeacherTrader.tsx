/**
 * Star Trader on the teacher page (docs/TRADER-PLAN.md, section 11): the class's switch, how many jumps a day, whether the
 * bank is open and who gets the maths checks, and (for one pupil) putting their ship back at the start. Per class, like
 * the other game switches. The server checks every setting on every request, so nothing can be done while it is off.
 */
import { useEffect, useState } from 'react';
import { fetchTraderSettings, resetTraderShip, saveTraderSettings, type TraderSettings } from '../data/trader';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

const MATHS: { value: TraderSettings['maths']; label: string; detail: string }[] = [
  { value: 'off', label: 'Off', detail: 'No maths checks. Lasers always fire at full power and space junk is always steered safely.' },
  { value: 'choose', label: 'Students choose', detail: 'Treated as on for now (students get their own switch in a later update).' },
  { value: 'on', label: 'On for everyone', detail: 'Maths checks on trades, laser rounds and space junk, from each student’s maths focus.' },
];

export function TraderTeacherPanel() {
  const { classId, ready } = useTeacherClass();
  const [settings, setSettings] = useState<TraderSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setSettings(null);
    setStatus(null);
    fetchTraderSettings(classId).then(setSettings, () => setStatus('We couldn’t load these settings.'));
  }, [ready, classId]);

  async function save(next: TraderSettings, message: string) {
    setStatus('Saving…');
    try {
      await saveTraderSettings(next, classId);
      setSettings(next);
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel teacher__switch" aria-labelledby="trader-title">
      <h2 id="trader-title" className="panel__title">
        Star Trader
      </h2>
      <p>
        A trading game: students fly a small ship between planets, buy cargo cheap and sell it dear, upgrade their ship, deal with pirates and save up to buy a moon.
        They type the coordinates of the planet they want to visit. The maths checks come from each student’s maths focus.
      </p>
      {settings && (
        <>
          <p>
            <strong>Star Trader is {settings.enabled ? 'on' : 'off'} for this class.</strong>
          </p>
          {settings.enabled ? (
            <button type="button" className="button button--danger" onClick={() => void save({ ...settings, enabled: false }, 'Star Trader is off.')}>
              Switch Star Trader off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void save({ ...settings, enabled: true }, 'Star Trader is on.')}>
              Switch Star Trader on
            </button>
          )}
          <div className="level-picker">
            <label htmlFor="trader-jumps">
              <strong>Jumps a day:</strong>{' '}
              <input
                id="trader-jumps"
                type="number"
                min={1}
                max={30}
                value={settings.jumps}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1)));
                  void save({ ...settings, jumps: n }, `Jumps a day: ${n}.`);
                }}
              />
            </label>
          </div>
          <p>
            <strong>Bank:</strong> {settings.loans ? 'open (loans up to 500 credits, 10% a week, nothing bad if they take a while).' : 'closed.'}{' '}
            <button type="button" className="button button--light" onClick={() => void save({ ...settings, loans: !settings.loans }, `The bank is ${settings.loans ? 'closed' : 'open'}.`)}>
              {settings.loans ? 'Close the bank' : 'Open the bank'}
            </button>
          </p>
          <fieldset className="level-picker">
            <legend>Who gets the maths checks</legend>
            <div className="level-picker__options">
              {MATHS.map((choice) => (
                <label key={choice.value} className="level-picker__option">
                  <input type="radio" name="trader-maths" checked={settings.maths === choice.value} onChange={() => void save({ ...settings, maths: choice.value }, `Maths checks: ${choice.label}.`)} />
                  <span>
                    <strong>{choice.label}:</strong> {choice.detail}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
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
