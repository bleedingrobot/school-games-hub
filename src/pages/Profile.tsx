import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  AVATAR_OPTIONS,
  PART_LABELS,
  normaliseAvatar,
  randomAvatar,
  type Avatar,
  type AvatarPart,
} from '../avatar/avatarParts';
import { AchievementList, LevelBar, RankBadge } from '../components/Progress';
import { chooseMyName, fetchNameWords, FriendlyError, saveMyAvatar, type NameWords } from '../data/profile';
import { fetchMyProgress, nextRankText, type MyProgress } from '../data/progress';
import { ALL_GAMES, gameLabel } from '../games/registry';

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];
const COLOUR_PARTS: AvatarPart[] = ['colour', 'topColour', 'bg'];

const OPTION_LABELS: Record<string, string> = {
  kid: 'Kid', bear: 'Bear', cat: 'Cat', robot: 'Robot', alien: 'Alien',
  round: 'Round', happy: 'Happy', sleepy: 'Sleepy', wink: 'Wink', star: 'Stars',
  smile: 'Smile', grin: 'Grin', open: 'Wow', tongue: 'Silly',
  none: 'None', short: 'Short hair', curly: 'Curly hair', long: 'Long hair', cap: 'Cap',
  beanie: 'Beanie', crown: 'Crown', bow: 'Bow', antenna: 'Antenna',
  glasses: 'Glasses', freckles: 'Freckles', blush: 'Rosy cheeks', headphones: 'Headphones',
};

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
}

export function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [avatar, setAvatar] = useState<Avatar>(() => normaliseAvatar(profile?.avatar));
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const savedAvatar = normaliseAvatar(profile?.avatar);
  const avatarChanged = JSON.stringify(avatar) !== JSON.stringify(savedAvatar);

  async function handleSaveAvatar() {
    setAvatarStatus('Saving…');
    try {
      await saveMyAvatar(avatar);
      await refreshProfile();
      setAvatarStatus('Saved! Looking good.');
    } catch (error) {
      setAvatarStatus(errorText(error));
    }
  }

  return (
    <div className="profile">
      <h1 className="page-title">My profile</h1>

      <MyProgressPanels />

      <section className="panel avatar-maker" aria-labelledby="avatar-title">
        <div className="avatar-maker__preview">
          <AvatarImage avatar={avatar} size={180} label="Your avatar" />
          <div className="avatar-maker__buttons">
            <button type="button" className="button button--light-outline" onClick={() => setAvatar(randomAvatar())}>
              🎲 Surprise me
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void handleSaveAvatar()}
              disabled={!avatarChanged}
            >
              Save avatar
            </button>
          </div>
          <p className="avatar-maker__status" role="status">
            {avatarStatus}
          </p>
        </div>
        <div className="avatar-maker__parts">
          <h2 id="avatar-title" className="panel__title">
            Build your avatar
          </h2>
          {PARTS.map((part) => (
            <fieldset key={part} className="choice-group">
              <legend>{PART_LABELS[part]}</legend>
              <div className={COLOUR_PARTS.includes(part) ? 'choice-group__swatches' : 'choice-group__chips'}>
                {(AVATAR_OPTIONS[part] as readonly string[]).map((option) => {
                  const isColour = COLOUR_PARTS.includes(part);
                  return (
                    <label key={option} className={isColour ? 'swatch' : 'chip'}>
                      <input
                        type="radio"
                        name={`avatar-${part}`}
                        value={option}
                        checked={avatar[part] === option}
                        onChange={() => {
                          setAvatar((prev) => ({ ...prev, [part]: option }));
                          setAvatarStatus(null);
                        }}
                        aria-label={isColour ? `${PART_LABELS[part]} ${AVATAR_OPTIONS[part].indexOf(option as never) + 1}` : undefined}
                      />
                      {isColour ? <span style={{ background: option }} /> : <span>{OPTION_LABELS[option] ?? option}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <NamePicker />

      <section className="panel" aria-labelledby="account-title">
        <h2 id="account-title" className="panel__title">
          Signing out
        </h2>
        <p>On a shared computer? Sign out when you're finished.</p>
        <button type="button" className="button button--light-outline" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </div>
  );
}

function NamePicker() {
  const { profile, refreshProfile } = useAuth();
  const [words, setWords] = useState<NameWords | null>(null);
  const [adjective, setAdjective] = useState('');
  const [animal, setAnimal] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNameWords()
      .then((loaded) => {
        if (cancelled) return;
        setWords(loaded);
        const [currentAdjective, currentAnimal] = (profile?.display_name ?? '').split(' ');
        setAdjective(loaded.adjectives.includes(currentAdjective) ? currentAdjective : loaded.adjectives[0]);
        setAnimal(loaded.animals.includes(currentAnimal) ? currentAnimal : loaded.animals[0]);
      })
      .catch((error) => !cancelled && setStatus(errorText(error)));
    return () => {
      cancelled = true;
    };
    // Only load the word lists once; the current name just sets the starting words.
  }, []);

  function shuffle() {
    if (!words) return;
    setAdjective(words.adjectives[Math.floor(Math.random() * words.adjectives.length)]);
    setAnimal(words.animals[Math.floor(Math.random() * words.animals.length)]);
    setStatus(null);
  }

  async function save() {
    setStatus('Saving…');
    try {
      const name = await chooseMyName(adjective, animal);
      await refreshProfile();
      setStatus(`You're now ${name}!`);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel name-picker" aria-labelledby="name-title">
      <h2 id="name-title" className="panel__title">
        My player name
      </h2>
      <p className="name-picker__current">
        You're <strong>{profile?.display_name}</strong>
      </p>
      <p>Pick two words. We'll add a number so nobody else has the same name.</p>
      {words && (
        <div className="name-picker__row">
          <label>
            <span>First word</span>
            <select value={adjective} onChange={(e) => setAdjective(e.target.value)}>
              {words.adjectives.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Second word</span>
            <select value={animal} onChange={(e) => setAnimal(e.target.value)}>
              {words.animals.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <button type="button" className="button button--light-outline" onClick={shuffle}>
            🔀 Shuffle
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()}>
            Use this name
          </button>
        </div>
      )}
      <p className="name-picker__status" role="status">
        {status}
      </p>
    </section>
  );
}

function MyProgressPanels() {
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchMyProgress()
      .then((p) => current && setProgress(p))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, []);

  if (failed) return <p className="panel__empty">We couldn’t load your points just now.</p>;
  if (!progress) return null;

  return (
    <>
      <section className="panel my-progress" aria-labelledby="progress-title">
        <h2 id="progress-title" className="panel__title">
          My progress
        </h2>
        <p className="my-progress__points">
          <strong>{progress.points}</strong> points · <strong>{progress.weekPoints}</strong> this week
        </p>
        <LevelBar progress={progress} />
        <ul className="my-progress__ranks">
          {progress.games.map((g) => (
            <li key={g.game}>
              <RankBadge rank={g.rank.rank} game={g.game} />
              <span>{nextRankText(g.rank)}</span>
              {g.rank.next && g.rank.ratedGames > 0 && (
                <progress
                  max={1}
                  value={g.rank.progress ?? 0}
                  aria-label={`${gameLabel(g.game)}: ${nextRankText(g.rank)}`}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" id="achievements" aria-labelledby="all-achievements-title">
        <h2 id="all-achievements-title" className="panel__title">
          My achievements
          <span className="panel__count">
            {progress.achievements.filter((a) => a.earnedAt).length} of {progress.achievements.length}
          </span>
        </h2>
        <div className="achievement-columns">
          {ALL_GAMES.filter((game) => progress.achievements.some((a) => a.game === game.id)).map((game) => (
            <div key={game.id}>
              <h3>{game.name}</h3>
              <AchievementList achievements={progress.achievements.filter((a) => a.game === game.id)} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
