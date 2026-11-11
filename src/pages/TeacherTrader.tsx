/**
 * Star Trader's settings drawer on the Games table (docs/TRADER-PLAN.md, section 11). The on/off switch and who gets the maths
 * checks are in the table row; here are how many jumps a day and whether the bank is open. And (for one pupil, on their student
 * page) putting their ship back at the start. Per class, like the other game switches. The server checks every setting on every
 * request, so nothing can be done while it is off.
 */
import { lazy, Suspense, useRef, useState } from 'react';
import { FriendlyError } from '../data/profile';
import { clearTraderForgeNames, resetTraderShip } from '../data/trader';
import { FORGE_TYPING_ABOUT, saveForge, saveForgeTyping, saveTraderJumps, saveTraderLoans, useTraderClassSettings, useTraderForge, useTraderForgeTyping } from '../games/trader/teacher';
import { SettingNumber, SettingToggle } from '../teacher/Settings';

// The tour brings three.js and Star Trader's look, so it loads only when opened.
const ProjectorTour = lazy(() => import('../games/trader/forge/ProjectorTour').then((m) => ({ default: m.ProjectorTour })));

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function TraderSettings({ classId }: { classId: string }) {
  const settings = useTraderClassSettings(classId);
  const forge = useTraderForge(classId);
  const typing = useTraderForgeTyping(classId);
  const [touring, setTouring] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
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
      <SettingToggle
        label="Star Forge"
        about="Off hides the Forge for this class. Ships already made are kept."
        value={forge.value ?? null}
        loadFailed={forge.failed}
        save={(on) => saveForge(on, classId)}
      />
      <SettingToggle
        label="Pupils can type names in the Forge"
        about={FORGE_TYPING_ABOUT}
        value={typing.value ?? null}
        loadFailed={typing.failed}
        save={(on) => saveForgeTyping(on, classId)}
      />
      <div>
        <p>
          <strong>Projector tour.</strong> Fly through each student’s solar system in turn, full screen, about a minute each. It shows each system’s name, never the student’s.
        </p>
        <button ref={opener} type="button" className="button button--light" onClick={() => setTouring(true)}>
          🌌 Show the class’s systems
        </button>
      </div>
      {touring && (
        <Suspense fallback={<p role="status">Opening the tour…</p>}>
          <ProjectorTour classId={classId} onClose={() => { setTouring(false); window.setTimeout(() => opener.current?.focus(), 0); }} />
        </Suspense>
      )}
      {settings.value?.enabled === false && <p className="panel__empty">Star Trader is off for this class, so these only matter once it’s on.</p>}
    </div>
  );
}

/** One student's part of the page: put their ship back at the start (a fresh Flea and 100 credits). */
export function TraderStudentPanel({ student }: { student: string }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  async function clearNames() {
    setClearStatus('Clearing…');
    try {
      await clearTraderForgeNames(student);
      setClearing(false);
      setClearStatus('Done. Their sun, planets and system go back to word-list names.');
    } catch (error) {
      setClearStatus(errorText(error));
    }
  }
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
      {clearing ? (
        <p>
          Clear every name this student typed in the Star Forge?{' '}
          <button type="button" className="button button--danger" onClick={() => void clearNames()}>
            Yes, clear them
          </button>{' '}
          <button type="button" className="button button--light" onClick={() => setClearing(false)}>
            Cancel
          </button>
        </p>
      ) : (
        <button type="button" className="button button--light" onClick={() => setClearing(true)}>
          Clear Forge names…
        </button>
      )}
      {clearStatus && <p role="status">{clearStatus}</p>}
    </section>
  );
}
