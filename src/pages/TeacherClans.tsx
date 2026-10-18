/**
 * Clan Quest on the teacher page: the switch for the class, and on each pupil's page their clan at a glance with a
 * button to reset it. Loaded only when the teacher page opens.
 */
import { useEffect, useState } from 'react';
import { fetchClanInfo, fetchClansEnabled, resetClan, saveClansEnabled, type ClanInfo } from '../data/clans';
import { FriendlyError } from '../data/profile';
import { whenPlayed } from './Dashboard';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

export function ClansTeacherPanels() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchClansEnabled().then(setEnabled, (error) => setStatus(errorText(error)));
  }, []);

  async function save(next: boolean, message: string) {
    setStatus('Saving…');
    try {
      setEnabled(await saveClansEnabled(next));
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="cq-settings-title">
      <h2 id="cq-settings-title" className="panel__title">
        Clan Quest
      </h2>
      <p>
        Pupils make a clan of four, fight in the Mines (maths helps), shop, train and build an empire. Each pupil has their own clan, kept on the
        school’s server. Switched off, the card is hidden from the pupils and nothing can be played; you can still open it yourself to try it.
        Everyone’s mine fights come back at midnight.
      </p>
      {enabled !== null && (
        <>
          <p>{enabled ? 'On: pupils can play it.' : 'Off: pupils can’t see it yet.'}</p>
          {enabled ? (
            <button type="button" className="button button--danger" onClick={() => void save(false, 'Clan Quest is off. Clans are kept for when you switch it on.')}>
              Switch Clan Quest off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void save(true, 'Clan Quest is on. Pupils will see the card.')}>
              Switch Clan Quest on
            </button>
          )}
        </>
      )}
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}

export function ClansStudentPanel({ student }: { student: string }) {
  const [info, setInfo] = useState<ClanInfo | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setInfo(undefined);
    fetchClanInfo(student).then((d) => current && setInfo(d), (error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [student]);

  async function reset() {
    setStatus('Resetting…');
    try {
      await resetClan(student);
      setConfirming(false);
      setInfo(null);
      setStatus('Done. They will make a new clan next time they open Clan Quest.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (info === undefined) return null;
  return (
    <section className="gk-teacher" aria-label="Clan Quest">
      <h3>Clan Quest</h3>
      {info ? (
        <>
          <p>
            <strong>{info.name}</strong>: day {info.day}, average level {info.averageLevel}, {info.gold} gold, {info.followers} followers,{' '}
            {info.fightsLeft} mine fights left today{info.inFight ? ' (in the middle of a fight)' : ''}. Last played {whenPlayed(info.lastPlayed)}.
          </p>
          {confirming ? (
            <p>
              Delete this clan so they can make a new one? Their points and achievements stay.{' '}
              <button type="button" className="button button--danger" onClick={() => void reset()}>
                Yes, reset the clan
              </button>{' '}
              <button type="button" className="button button--light-outline" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </p>
          ) : (
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(true)}>
              Reset this clan…
            </button>
          )}
        </>
      ) : (
        <p className="panel__empty">No clan yet.</p>
      )}
      {status && (
        <p role="status" className="gk-teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}
