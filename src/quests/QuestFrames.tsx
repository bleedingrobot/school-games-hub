/**
 * Quest Frames (docs/QUEST-REWARDS-PLAN.md, stage 4). `FramePicker` either spends a Quest Frame reward (pick a new frame
 * from the list) or changes which of my frames I wear. Each choice shows my own avatar in that frame. The server checks both.
 */
import { useEffect, useState } from 'react';
import { QUEST_FRAMES } from '../../shared/quests/frames';
import { AvatarImage } from '../avatar/AvatarImage';
import { FriendlyError } from '../data/profile';
import { fetchMyFrames, setMyFrame, spendQuestReward, type MyFrames } from '../data/quests';
import './questFrames.css';

export function useMyFrames(key: unknown) {
  const [frames, setFrames] = useState<MyFrames | null>(null);
  useEffect(() => {
    let live = true;
    fetchMyFrames()
      .then((f) => live && setFrames(f))
      .catch(() => live && setFrames(null));
    return () => {
      live = false;
    };
  }, [key]);
  return frames;
}

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

const wearing = (avatar: unknown, frame: string | null) => {
  const { frame: _old, ...rest } = avatar && typeof avatar === 'object' ? (avatar as Record<string, unknown>) : {};
  return frame ? { ...rest, frame } : rest;
};

/**
 * rewardId: spending a Quest Frame reward, so every frame is shown and the ones I own are greyed out.
 * No rewardId: wearing one of my frames, or none.
 */
export function FramePicker({ avatar, rewardId, onDone, onClose }: { avatar: unknown; rewardId?: string; onDone: () => void; onClose: () => void }) {
  const frames = useMyFrames(rewardId);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const owned = new Set(frames?.owned ?? []);
  const choosing = rewardId !== undefined;
  const shown = choosing ? QUEST_FRAMES : QUEST_FRAMES.filter((f) => owned.has(f.id));

  useEffect(() => {
    if (!choosing && frames) setPicked(frames.wearing);
  }, [choosing, frames]);

  async function save() {
    setBusy(true);
    setStatus('Saving…');
    try {
      if (choosing) {
        if (!picked) return;
        await spendQuestReward(rewardId, { frame: picked });
      } else {
        await setMyFrame(picked);
      }
      setStatus(null);
      onDone();
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const pickedName = QUEST_FRAMES.find((f) => f.id === picked)?.name;
  return (
    <section className="panel frame-picker" aria-labelledby="frame-picker-title">
      <h2 id="frame-picker-title" className="panel__title">
        {choosing ? '🖼️ Pick your Quest Frame' : '🖼️ My frames'}
      </h2>
      <p>
        {choosing
          ? 'You earned a Quest Frame! Pick one to go around your avatar. It’s yours to keep.'
          : 'Pick which frame goes around your avatar. Win more from class quests.'}
      </p>
      {!frames && <p className="panel__empty">Loading…</p>}
      {frames && (
        <div className="frame-picker__grid" role="radiogroup" aria-label="Frames">
          {!choosing && (
            <button type="button" role="radio" aria-checked={picked === null} className={`frame-picker__choice${picked === null ? ' is-picked' : ''}`} onClick={() => setPicked(null)}>
              <AvatarImage avatar={wearing(avatar, null)} size={72} />
              <span>No frame</span>
            </button>
          )}
          {shown.map((f) => {
            const have = choosing && owned.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={picked === f.id}
                disabled={have}
                className={`frame-picker__choice${picked === f.id ? ' is-picked' : ''}`}
                onClick={() => setPicked(f.id)}
              >
                <AvatarImage avatar={wearing(avatar, f.id)} size={72} />
                <span>
                  {f.name}
                  {have && <small> (yours)</small>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="frame-picker__bar">
        <button type="button" className="button button--primary" disabled={busy || !frames || (choosing && !picked)} onClick={() => void save()}>
          {choosing ? (pickedName ? `Keep the ${pickedName} frame` : 'Pick a frame') : 'Wear this'}
        </button>
        <button type="button" className="button button--light-outline" onClick={onClose}>
          {choosing ? 'Later' : 'Close'}
        </button>
      </div>
      <p className="avatar-maker__status" role="status">
        {status}
      </p>
    </section>
  );
}
