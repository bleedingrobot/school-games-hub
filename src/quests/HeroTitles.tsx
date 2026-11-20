/**
 * Hero Titles (docs/QUEST-REWARDS-PLAN.md, stage 2). `HeroTitleLine` shows the title a player wears under their name (the
 * profile header and every leaderboard row). `TitlePicker` either spends a Hero Title reward (pick a new title from the
 * list) or changes which of my titles I wear. The server checks both.
 */
import { useEffect, useState } from 'react';
import { HERO_TITLES, SPECIAL_TITLES, heroTitle, titleOf } from '../../shared/quests/titles';
import { FriendlyError } from '../data/profile';
import { fetchMyTitles, setMyTitle, spendQuestReward, type MyTitles } from '../data/quests';
import './heroTitles.css';

/** The worn title, or nothing. Reads the avatar, so any screen with an avatar can show it. */
export function HeroTitleLine({ avatar }: { avatar: unknown }) {
  const title = titleOf(avatar);
  if (!title) return null;
  return (
    <small className={`hero-title${title.special ? ' hero-title--special' : ''}`}>
      <span aria-hidden="true">{title.emoji} </span>
      {title.name}
    </small>
  );
}

export function useMyTitles(key: unknown) {
  const [titles, setTitles] = useState<MyTitles | null>(null);
  useEffect(() => {
    let live = true;
    fetchMyTitles()
      .then((t) => live && setTitles(t))
      .catch(() => live && setTitles(null));
    return () => {
      live = false;
    };
  }, [key]);
  return titles;
}

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');

/**
 * rewardId: spending a Hero Title reward, so every title is shown and the ones I own are greyed out.
 * No rewardId: wearing one of my titles, or none.
 */
export function TitlePicker({ rewardId, onDone, onClose }: { rewardId?: string; onDone: () => void; onClose: () => void }) {
  const titles = useMyTitles(rewardId);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const owned = new Set(titles?.owned ?? []);
  const choosing = rewardId !== undefined;
  // Special titles are never on the quest list; they only show once given, in My titles.
  const shown = choosing ? HERO_TITLES : [...SPECIAL_TITLES, ...HERO_TITLES].filter((t) => owned.has(t.id));

  useEffect(() => {
    if (!choosing && titles) setPicked(titles.wearing);
  }, [choosing, titles]);

  async function save() {
    setBusy(true);
    setStatus('Saving…');
    try {
      if (choosing) {
        if (!picked) return;
        await spendQuestReward(rewardId, { title: picked });
      } else {
        await setMyTitle(picked);
      }
      setStatus(null);
      onDone();
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  const pickedName = heroTitle(picked)?.name;
  return (
    <section className="panel title-picker" aria-labelledby="title-picker-title">
      <h2 id="title-picker-title" className="panel__title">
        {choosing ? '🏷️ Pick your Hero Title' : '🏷️ My titles'}
      </h2>
      <p>
        {choosing
          ? 'You earned a Hero Title! Pick one to show under your name. It’s yours to keep.'
          : 'Pick which title shows under your name. Win more from class quests.'}
      </p>
      {!titles && <p className="panel__empty">Loading…</p>}
      {titles && (
        <div className="title-picker__grid" role="radiogroup" aria-label="Titles">
          {!choosing && (
            <button type="button" role="radio" aria-checked={picked === null} className={`title-picker__chip${picked === null ? ' is-picked' : ''}`} onClick={() => setPicked(null)}>
              No title
            </button>
          )}
          {shown.map((t) => {
            const have = choosing && owned.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={picked === t.id}
                disabled={have}
                className={`title-picker__chip${picked === t.id ? ' is-picked' : ''}${t.special ? ' title-picker__chip--special' : ''}`}
                onClick={() => setPicked(t.id)}
              >
                <span aria-hidden="true">{t.emoji}</span> {t.name}
                {have && <small> (yours)</small>}
              </button>
            );
          })}
        </div>
      )}
      <div className="title-picker__bar">
        <button type="button" className="button button--primary" disabled={busy || !titles || (choosing && !picked)} onClick={() => void save()}>
          {choosing ? (pickedName ? `Keep “${pickedName}”` : 'Pick a title') : 'Wear this'}
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
