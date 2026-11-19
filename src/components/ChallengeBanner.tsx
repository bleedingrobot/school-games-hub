/**
 * A friend's challenge, anywhere in the hub (docs/plans/play-anyone/PLAN.md, section D1): Archery fights, Dragon Maths
 * clashes and Clan Quest duels. Yes opens that game at the challenge (the game says yes through its own pop-up step),
 * No says no through that game's own server step, and Not now hides it until the next new challenge.
 *
 * Never inside the game the challenge is from: that game has its own pop-up. On hub pages it sits at the bottom; inside
 * a game it sits at the top, and on a phone it starts as a small "Challenge!" tab, so it never covers a game's buttons.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { serverHubAskLink, type HubAsk, type HubAskLink } from '../data/hubAsks';
import { ALL_GAMES } from '../games/registry';
import { useHubAsks } from '../multiplayer/useHubAsks';
import { readSaved, speak } from '../speech';
import { askLine, GAME_NAMES, SPOKEN, VOICE_FOLDER } from './challengeWords';
import './challengeBanner.css';

/** Pages that are a game being played (the hub's own pages aren't). */
const PLAY_PAGES = new Set(['play', 'space-game', 'card-game', 'power-game', ...ALL_GAMES.map((g) => g.id)]);

const keyOf = (a: HubAsk) => `${a.game}:${a.id}`;

/** In the hub shell: pupils only. */
export function HubChallengeBanner() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  if (profile?.role !== 'student') return null;
  const page = pathname.split('/')[1] ?? '';
  return <ChallengeBanner link={serverHubAskLink} me={profile.id} page={page} inGame={PLAY_PAGES.has(page)} />;
}

export function ChallengeBanner({ link, me, page, inGame }: { link: HubAskLink; me: string; page: string; inGame: boolean }) {
  const navigate = useNavigate();
  const { asks, serverNow, drop } = useHubAsks(link, me);
  /** "Not now": every challenge known then stays hidden; a newer one shows. */
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  const shown = asks.find((a) => a.game !== page && !hidden.has(keyOf(a)) && Date.parse(a.deadline) > serverNow());
  const shownKey = shown ? keyOf(shown) : null;

  // Seconds left, each second while one shows.
  useEffect(() => {
    if (!shownKey) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [shownKey]);

  // Read aloud once per new challenge, if read-aloud is on. A new one starts as the small tab again.
  const said = useRef<string | null>(null);
  useEffect(() => {
    setOpen(false);
    if (!shown || said.current === shownKey) return;
    said.current = shownKey;
    if (readSaved()) speak(SPOKEN[shown.game], VOICE_FOLDER);
    // Only when a different challenge shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  if (!shown) return null;
  const left = Math.max(0, Math.ceil((Date.parse(shown.deadline) - serverNow()) / 1000));
  const line = askLine(shown.game, shown.from);

  const yes = () => {
    drop(shown);
    navigate(`/${shown.game}?ask=${shown.id}`);
  };
  const no = () => {
    drop(shown);
    void link.decline(shown);
  };
  const notNow = () => setHidden(new Set([...hidden, ...asks.map(keyOf)]));

  return (
    <div className={`hub-ask${inGame ? ' hub-ask--in-game' : ''}${open ? ' hub-ask--open' : ''}`} role="alertdialog" aria-label={line}>
      {inGame && (
        <button type="button" className="hub-ask__tab" aria-expanded={open} onClick={() => setOpen(true)}>
          ⚔️ Challenge! <span className="hub-ask__secs">{left}s</span>
        </button>
      )}
      <div className="hub-ask__card">
        <p className="hub-ask__line">
          <span aria-hidden="true">⚔️ </span>
          {line}
          <small>{GAME_NAMES[shown.game]} · {left}s to answer</small>
        </p>
        <div className="hub-ask__buttons">
          <button type="button" className="hub-ask__yes" onClick={yes}>Yes!</button>
          <button type="button" className="hub-ask__no" onClick={no}>No</button>
          <button type="button" className="hub-ask__later" onClick={notNow}>Not now</button>
        </div>
      </div>
    </div>
  );
}
