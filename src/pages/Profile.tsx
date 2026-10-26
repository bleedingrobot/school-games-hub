import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  AVATAR_OPTIONS,
  PART_LABELS,
  THEMES,
  avatarToSave,
  normaliseAvatar,
  randomAvatar,
  themeOf,
  type Avatar,
  type AvatarPart,
  type HubTheme,
} from '../avatar/avatarParts';
import { RecentList, recentGamesFrom, SpaceStatsLine, StatsTable, statsFrom, type MyStats, type RecentGame } from '../components/MyGames';
import { AchievementList, LevelBar, RankBadge } from '../components/Progress';
import { fetchMyHomePage } from '../data/homePage';
import { chooseMyName, fetchNameWords, FriendlyError, saveMyAvatar, type NameWords } from '../data/profile';
import { nextRankText, type MyProgress } from '../data/progress';
import { ALL_GAMES, gameLabel } from '../games/registry';
import { useThemeTrial } from '../theme/hubTheme';

/** How many recent games the profile's My stats shows. */
const RECENT_SHOWN = 10;

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
  // The theme: picking one shows it straight away (a trial); Save keeps it. Leaving without saving goes back to the saved one.
  const savedTheme = themeOf(profile?.avatar);
  const [theme, setTheme] = useState<HubTheme>(savedTheme);
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const { setTrial } = useThemeTrial();
  useEffect(() => {
    return () => {
      setTrial(null);
    };
  }, [setTrial]);

  // Saving replaces the whole avatar, so the avatar's save keeps the saved theme and the theme's save keeps the saved avatar.
  async function handleSaveAvatar() {
    setAvatarStatus('Saving…');
    try {
      await saveMyAvatar(avatarToSave(avatar, savedTheme));
      await refreshProfile();
      setAvatarStatus('Saved! Looking good.');
    } catch (error) {
      setAvatarStatus(errorText(error));
    }
  }

  async function handleSaveTheme() {
    setThemeStatus('Saving…');
    try {
      await saveMyAvatar(avatarToSave(savedAvatar, theme));
      await refreshProfile();
      setThemeStatus('Saved! Enjoy your new look.');
    } catch (error) {
      setThemeStatus(errorText(error));
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
          <fieldset className="choice-group theme-picker">
            <legend>My theme</legend>
            <p className="theme-picker__help">How the home page and your other hub pages look. Games keep their own look.</p>
            <div className="theme-picker__tiles">
              {THEMES.map((t) => (
                <label key={t.id} className="theme-tile">
                  <input
                    type="radio"
                    name="hub-theme"
                    value={t.id}
                    checked={theme === t.id}
                    onChange={() => {
                      setTheme(t.id);
                      setTrial(t.id);
                      setThemeStatus(null);
                    }}
                  />
                  <span className="theme-tile__body">
                    <span className="theme-tile__preview" data-hub-theme={t.id} aria-hidden="true">
                      <span className="theme-tile__bar" />
                      <span className="theme-tile__card" />
                      <span className="theme-tile__card" />
                      <span className="theme-tile__box" />
                    </span>
                    <span className="theme-tile__name">{t.label}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="theme-picker__save">
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleSaveTheme()}
                disabled={theme === savedTheme}
              >
                Save theme
              </button>
              <p className="avatar-maker__status" role="status">
                {themeStatus}
              </p>
            </div>
          </fieldset>
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

/**
 * My progress, My stats and My achievements, from the home page's one request (my_home_page): it has the points and achievements
 * the profile used to ask for on their own, and the stats tables that moved here from the home page.
 */
function MyProgressPanels() {
  const { profile } = useAuth();
  const me = profile?.id;
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [recent, setRecent] = useState<RecentGame[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!me) return;
    let current = true;
    fetchMyHomePage().then(
      (home) => {
        if (!current) return;
        if (home.progress) setProgress(home.progress);
        else setFailed(true);
        setStats(statsFrom(home));
        setRecent(recentGamesFrom(home, me).slice(0, RECENT_SHOWN));
      },
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [me]);

  const pointsFor = new Map(progress?.recent.map((r) => [r.id, r.points]));
  const myStats = (
    <section className="panel my-stats" id="stats" aria-labelledby="stats-title">
      <h2 id="stats-title" className="panel__title">
        My stats
      </h2>
      <div className="my-stats__columns">
        <div>
          <h3>Recent games</h3>
          {!recent ? (
            <p className="panel__empty">{failed ? 'We couldn’t load your games just now.' : 'Loading…'}</p>
          ) : recent.length === 0 ? (
            <p className="panel__empty">No games yet.</p>
          ) : (
            <RecentList games={recent} pointsFor={pointsFor} />
          )}
        </div>
        <div>
          <StatsTable caption="Against bots" stats={stats?.bots ?? null} />
          <StatsTable caption="Against friends" stats={stats?.friends ?? null} />
          <SpaceStatsLine stats={stats?.bots ?? null} classmates={stats?.spaceClassmates ?? null} />
        </div>
      </div>
    </section>
  );

  if (!progress)
    return (
      <>
        {failed && <p className="panel__empty">We couldn’t load your points just now.</p>}
        {myStats}
      </>
    );

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

      {myStats}

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
