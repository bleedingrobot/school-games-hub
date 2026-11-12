import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
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
import { nextRankText, type Achievement, type MyProgress } from '../data/progress';
import { pictureOf } from '../avatar/earnedPictures';
import type { MyTrophy } from '../data/trophies';
import { ALL_GAMES, gameLabel } from '../games/registry';
import { useThemeTrial } from '../theme/hubTheme';
import { TrophyCabinet, useMyTrophies } from '../trophies/TrophyCabinet';
import './profile.css';

/** How many recent games the profile's My stats shows. */
const RECENT_SHOWN = 10;
/** How many not-yet-earned achievements My achievements shows before "See all". */
const NEAREST_SHOWN = 3;

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

/** The folds, top to bottom. Their ids are also the page's anchors (/profile#stats, /profile#achievements). */
type FoldId = 'trophies' | 'achievements' | 'stats' | 'theme';
const FOLD_IDS: FoldId[] = ['trophies', 'achievements', 'stats', 'theme'];

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
}

/** True once the pupil has saved an avatar of their own (a saved theme alone doesn't count). */
function hasSavedAvatar(saved: unknown): boolean {
  return !!saved && typeof saved === 'object' && PARTS.some((part) => part in (saved as object));
}

/** What to save: the built avatar and theme, plus the earned picture worn over them (the server checks it and adds the ring). */
function lookToSave(avatar: Avatar, theme: HubTheme, pic: string | null) {
  return pic ? { ...avatarToSave(avatar, theme), pic } : avatarToSave(avatar, theme);
}

/**
 * My profile: the pupil first (avatar, name, Sign out), then folds that start closed. The avatar maker and the name picker
 * open from the top card's buttons, one at a time.
 */
export function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { hash } = useLocation();
  const home = useMyHome(profile?.id);
  const savedAvatar = normaliseAvatar(profile?.avatar);
  const savedTheme = themeOf(profile?.avatar);
  const madeAvatar = hasSavedAvatar(profile?.avatar);
  const savedPic = pictureOf(profile?.avatar)?.id ?? null;
  const cabinet = useMyTrophies(profile?.id);
  const trophyCount = cabinet.data?.trophies.length;

  const [editing, setEditing] = useState<'look' | 'name' | null>(null);
  // My trophies starts open: they are the hub's top rewards.
  const [open, setOpen] = useState<ReadonlySet<FoldId>>(() => new Set(['trophies']));
  const toggle = (id: FoldId) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // A link to a fold (the home page's "See more" goes to /profile#stats) opens it and brings it into view.
  useEffect(() => {
    const id = FOLD_IDS.find((fold) => `#${fold}` === hash);
    if (!id) return;
    setOpen((was) => new Set(was).add(id));
    document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
  }, [hash]);

  // The theme: picking one shows it straight away and saves it. Each save carries the avatar and the theme together.
  const [theme, setTheme] = useState<HubTheme>(savedTheme);
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const { setTrial } = useThemeTrial();
  useEffect(() => {
    return () => {
      setTrial(null);
    };
  }, [setTrial]);

  async function pickTheme(next: HubTheme) {
    setTheme(next);
    setTrial(next);
    setThemeStatus('Saving…');
    try {
      await saveMyAvatar(lookToSave(savedAvatar, next, savedPic));
      await refreshProfile();
      setThemeStatus('Saved! Enjoy your new look.');
    } catch (error) {
      setTheme(savedTheme);
      setTrial(null);
      setThemeStatus(errorText(error));
    }
  }

  const progress = home.progress;
  const earnedCount = progress?.achievements.filter((a) => a.earnedAt).length ?? 0;

  return (
    <div className="profile">
      <h1 className="page-title">My profile</h1>

      <section className="panel profile-top" aria-label="Me">
        <AvatarImage avatar={profile?.avatar} size={112} label="Your avatar" />
        <div className="profile-top__who">
          <h2 className="profile-top__name">{profile?.display_name}</h2>
          {!madeAvatar && <p className="profile-top__nudge">You haven’t made your avatar yet. Pick a face, hair and colours!</p>}
          <div className="profile-top__buttons">
            <button
              type="button"
              className={`button ${madeAvatar ? 'button--light-outline' : 'button--primary'}`}
              aria-expanded={editing === 'look'}
              onClick={() => setEditing(editing === 'look' ? null : 'look')}
            >
              {madeAvatar ? '🎨 Change my look' : '✨ Make your avatar'}
            </button>
            <button
              type="button"
              className="button button--light-outline"
              aria-expanded={editing === 'name'}
              onClick={() => setEditing(editing === 'name' ? null : 'name')}
            >
              ✏️ Change my name
            </button>
          </div>
        </div>
        <div className="profile-top__out">
          <button type="button" className="button button--light-outline" onClick={() => void signOut()}>
            Sign out
          </button>
          <p>On a shared computer? Sign out when you’re finished.</p>
        </div>
      </section>

      {editing === 'look' && (
        <LookMaker pictures={cabinet.data?.trophies.filter((t) => t.kind === 'picture') ?? null} onClose={() => setEditing(null)} />
      )}
      {editing === 'name' && <NamePicker onClose={() => setEditing(null)} />}

      <Fold
        id="trophies"
        title="🏆 My trophies"
        count={trophyCount === undefined ? undefined : `${trophyCount} ${trophyCount === 1 ? 'trophy' : 'trophies'}`}
        open={open.has('trophies')}
        onToggle={toggle}
      >
        <TrophyCabinet cabinet={cabinet} />
      </Fold>

      <Fold
        id="achievements"
        title="⭐ My achievements"
        count={progress ? `${earnedCount} of ${progress.achievements.length}` : undefined}
        open={open.has('achievements')}
        onToggle={toggle}
      >
        {progress ? <MyAchievements achievements={progress.achievements} /> : <p className="panel__empty">{home.failed ? 'We couldn’t load your achievements just now.' : 'Loading…'}</p>}
      </Fold>

      <Fold
        id="stats"
        title="📊 My stats"
        count={progress ? `${progress.points} points` : undefined}
        open={open.has('stats')}
        onToggle={toggle}
      >
        <MyStatsBody home={home} />
      </Fold>

      <Fold id="theme" title="🖌️ Page theme" count={THEMES.find((t) => t.id === theme)?.label} open={open.has('theme')} onToggle={toggle}>
        <fieldset className="choice-group theme-picker">
          <legend className="sr-only">Page theme</legend>
          <p className="theme-picker__help">How the home page and your other hub pages look. Games keep their own look. Tap one to keep it.</p>
          <div className="theme-picker__tiles">
            {THEMES.map((t) => (
              <label key={t.id} className="theme-tile">
                <input type="radio" name="hub-theme" value={t.id} checked={theme === t.id} onChange={() => void pickTheme(t.id)} />
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
          <p className="avatar-maker__status" role="status">
            {themeStatus}
          </p>
        </fieldset>
      </Fold>
    </div>
  );
}

/** One fold: a heading that is a button, and its body only while open. */
function Fold({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: FoldId;
  title: string;
  count?: string;
  open: boolean;
  onToggle: (id: FoldId) => void;
  children: ReactNode;
}) {
  return (
    <section className="panel profile-fold" id={id}>
      <h2 className="profile-fold__heading">
        <button type="button" className="profile-fold__button" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => onToggle(id)}>
          <span className="profile-fold__title">{title}</span>
          {count && <span className="panel__count">{count}</span>}
          <span className="profile-fold__arrow" aria-hidden="true">
            ▾
          </span>
        </button>
      </h2>
      {open && (
        <div id={`${id}-body`} className="profile-fold__body">
          {children}
        </div>
      )}
    </section>
  );
}

/** The avatar maker, opened by "Change my look": one Save, which keeps the saved theme with the new avatar. */
function LookMaker({ pictures, onClose }: { pictures: MyTrophy[] | null; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const savedAvatar = normaliseAvatar(profile?.avatar);
  const savedPic = pictureOf(profile?.avatar)?.id ?? null;
  const [avatar, setAvatar] = useState<Avatar>(savedAvatar);
  const [pic, setPic] = useState<string | null>(savedPic);
  const [status, setStatus] = useState<string | null>(null);
  // A pupil with no avatar yet can save the starting one as it is.
  const canSave = !hasSavedAvatar(profile?.avatar) || JSON.stringify(avatar) !== JSON.stringify(savedAvatar) || pic !== savedPic;
  const wearing = pictures?.find((p) => p.id === pic);
  // Picking any part of the built avatar takes the earned picture off.
  const build = (change: (prev: Avatar) => Avatar) => {
    setAvatar(change);
    setPic(null);
    setStatus(null);
  };

  async function save() {
    setStatus('Saving…');
    try {
      await saveMyAvatar(lookToSave(avatar, themeOf(profile?.avatar), pic));
      await refreshProfile();
      setStatus('Saved! Looking good.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel avatar-maker" aria-labelledby="avatar-title">
      <div className="avatar-maker__preview">
        <AvatarImage avatar={wearing ? { pic: wearing.id, picTier: wearing.tier } : avatar} size={180} label="Your new look" />
        <div className="avatar-maker__buttons">
          <button
            type="button"
            className="button button--light-outline"
            onClick={() => build(() => randomAvatar())}
          >
            🎲 Surprise me
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()} disabled={!canSave}>
            Save
          </button>
          <button type="button" className="button button--light-outline" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="avatar-maker__status" role="status">
          {status}
        </p>
      </div>
      <div className="avatar-maker__parts">
        <fieldset className="choice-group earned-pics">
          <legend>My earned pictures</legend>
          {pictures && pictures.length > 0 ? (
            <div className="earned-pics__row">
              <label className="earned-pic">
                <input type="radio" name="earned-pic" checked={pic === null} onChange={() => setPic(null)} />
                <AvatarImage avatar={avatar} size={64} />
                <span>My own avatar</span>
              </label>
              {pictures.map((p) => (
                <label key={p.id} className="earned-pic">
                  <input
                    type="radio"
                    name="earned-pic"
                    checked={pic === p.id}
                    onChange={() => {
                      setPic(p.id);
                      setStatus(null);
                    }}
                  />
                  <AvatarImage avatar={{ pic: p.id, picTier: p.tier }} size={64} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="earned-pics__none">
              {pictures ? 'Win a picture trophy in a game and you can wear it here, with a bronze, silver or gold ring.' : 'Loading…'}
            </p>
          )}
        </fieldset>
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
                      onChange={() => build((prev) => ({ ...prev, [part]: option }))}
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
  );
}

function NamePicker({ onClose }: { onClose: () => void }) {
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
      <p>Pick two words. We'll add a number so nobody else has the same name.</p>
      <div className="name-picker__row">
        {words && (
          <>
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
          </>
        )}
        <button type="button" className="button button--light-outline" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="name-picker__status" role="status">
        {status}
      </p>
    </section>
  );
}

interface MyHome {
  progress: MyProgress | null;
  stats: MyStats | null;
  recent: RecentGame[] | null;
  failed: boolean;
}

/**
 * Points, achievements and the stats tables, from the home page's one request (my_home_page): asked once for the whole page,
 * so the folds can show their counts while closed.
 */
function useMyHome(me: string | undefined): MyHome {
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

  return { progress, stats, recent, failed };
}

/** What the pupil has earned, the three they are closest to, then each game's full list behind its own "See all". */
function MyAchievements({ achievements }: { achievements: Achievement[] }) {
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const earned = achievements.filter((a) => a.earnedAt).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const nearest = achievements
    .filter((a) => !a.earnedAt)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)
    .slice(0, NEAREST_SHOWN);
  const games = ALL_GAMES.filter((game) => achievements.some((a) => a.game === game.id));

  return (
    <div className="profile-achievements">
      <div>
        <h3>Earned</h3>
        {earned.length === 0 ? (
          <p className="panel__empty">None yet. Play a game to win your first!</p>
        ) : (
          <AchievementList achievements={earned} showGame compact />
        )}
      </div>
      {nearest.length > 0 && (
        <div>
          <h3>Nearly there</h3>
          <AchievementList achievements={nearest} showGame />
        </div>
      )}
      <div>
        <h3>Every game</h3>
        <ul className="profile-achievements__games">
          {games.map((game) => {
            const mine = achievements.filter((a) => a.game === game.id);
            const isShown = shown.has(game.id);
            return (
              <li key={game.id}>
                <div className="profile-achievements__game">
                  <strong>{game.name}</strong>
                  <span className="panel__count">
                    {mine.filter((a) => a.earnedAt).length} of {mine.length}
                  </span>
                  <button
                    type="button"
                    className="button button--light-outline profile-achievements__all"
                    aria-expanded={isShown}
                    aria-label={`${isShown ? 'Hide' : 'See all'}: ${game.name}`}
                    onClick={() =>
                      setShown((was) => {
                        const next = new Set(was);
                        if (!next.delete(game.id)) next.add(game.id);
                        return next;
                      })
                    }
                  >
                    {isShown ? 'Hide' : 'See all'}
                  </button>
                </div>
                {isShown && <AchievementList achievements={mine} />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Inside My stats: points, the level bar and badges, then recent games and the tables for bots and friends. */
function MyStatsBody({ home }: { home: MyHome }) {
  const { progress, stats, recent, failed } = home;
  const pointsFor = new Map(progress?.recent.map((r) => [r.id, r.points]));
  return (
    <div className="profile-stats">
      {progress ? (
        <div className="my-progress">
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
                  <progress max={1} value={g.rank.progress ?? 0} aria-label={`${gameLabel(g.game)}: ${nextRankText(g.rank)}`} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        failed && <p className="panel__empty">We couldn’t load your points just now.</p>
      )}
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
    </div>
  );
}
