/**
 * The new Lobby's parts (docs/plans/play-anyone/PLAN.md, section D, stage 3): challenges waiting for me, the game tiles
 * (greyed with a reason and a fix when I can't play yet), and who's here with what we can play together: the live games'
 * challenges, and invites by name to the board games (stage 4).
 * Lobby.tsx puts them together with the start-a-game form, the open games and the code box.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AvatarImage } from '../avatar/AvatarImage';
import { ClassTag, SchoolPlayerList, StarButton, useStars, type SchoolPlayer } from '../components/SchoolPlayerList';
import { GAME_NAMES, STAR_HINT, STAR_HINT_SPOKEN, VOICE_FOLDER, askLine } from '../components/challengeWords';
import { starPlayer } from '../data/lobbyStars';
import { speak } from '../speech';
import { isInviteGame, type AskGame, type LobbyGame, type HubAsk, type InviteGame, type LiveGame } from '../data/hubAsks';
import type { HerePlayer, MyGame, MyState, StarAway, WithThem } from '../data/lobbyHere';
import './lobbyFriends.css';

/** The teacher has paused a game (or friends' games, or non-maths games in maths time). */
export const PAUSED = 'Your teacher has paused this.';

/** Why I can't use a tile yet, with the button that fixes it (James's words, 20 Nov). */
export const FIRST: Record<MyGame, { why: string; fix: string; to: string }> = {
  archery: { why: 'Choose your archer first', fix: 'Choose my archer', to: '/archery' },
  'dragon-maths': { why: 'Make your hero first to battle your friends', fix: 'Make my hero', to: '/dragon-maths' },
  'clan-quest': { why: 'Start your clan first', fix: 'Start my clan', to: '/clan-quest' },
  isles: { why: 'Build your island first', fix: 'Build my island', to: '/isles' },
  raid: { why: 'Start your clan first', fix: 'Start my clan', to: '/clan-quest' },
};

/** The one-word button for each game. */
const SEND: Record<LobbyGame, string> = {
  archery: 'Archery fight',
  'dragon-maths': 'Dragon Maths clash',
  'clan-quest': 'Clan duel',
  chess: 'Chess',
  checkers: 'Checkers',
  '101': '101',
  space: 'Wormholes',
  'power-clash': 'Power Clash',
};
export const EMOJI: Record<AskGame, string> = {
  archery: '🏹',
  'dragon-maths': '🐉',
  'clan-quest': '🛡️',
  chess: '♟️',
  checkers: '🔴',
  '101': '🃏',
  space: '🚀',
  'power-clash': '⚡',
  showdown: '⚔️',
  classlive: '🌟',
};

/** Can I play this game with them, and if not, why (in words for the pupil). Board games are always 'ready' for me here. */
export function withThemWords(game: LobbyGame, mine: MyState, them: HerePlayer): { ok: boolean; text: string } {
  if (mine === 'off') return { ok: false, text: PAUSED };
  if (mine === 'none' && !isInviteGame(game)) return { ok: false, text: FIRST[game].why };
  const state: WithThem | undefined = them.games[game];
  const name = them.name;
  switch (state) {
    case 'ok':
      return { ok: true, text: SEND[game] };
    case 'none':
      return { ok: false, text: game === 'clan-quest' ? `${name} hasn’t started a clan yet` : game === 'dragon-maths' ? `${name} hasn’t made a Dragon Maths hero yet` : `${name} hasn’t chosen an archer yet` };
    case 'off':
      return { ok: false, text: `${name}’s class has paused ${GAME_NAMES[game]}` };
    case 'busy':
      return { ok: false, text: isInviteGame(game) ? `${name} has another invite waiting` : `${name} is busy in a game right now` };
    default:
      return { ok: false, text: `${name} can’t play this right now` };
  }
}

// ---------------------------------------------------------------------------
// Challenges for you (D2)
// ---------------------------------------------------------------------------

export function ChallengesForYou({ asks, serverNow, onYes, onNo }: {
  asks: HubAsk[];
  serverNow: () => number;
  onYes: (ask: HubAsk) => void;
  onNo: (ask: HubAsk) => void;
}) {
  if (asks.length === 0) return null;
  return (
    <section className="panel lobby-asks" aria-labelledby="asks-title">
      <h2 id="asks-title" className="panel__title">
        <span>
          <span aria-hidden="true">⚔️ </span>Challenges for you
        </span>
      </h2>
      <ul className="lobby-list">
        {asks.map((a) => {
          const left = Math.max(0, Math.ceil((Date.parse(a.deadline) - serverNow()) / 1000));
          return (
            <li key={`${a.game}:${a.id}`}>
              <span className="lobby-list__emoji" aria-hidden="true">{EMOJI[a.game]}</span>
              <span className="lobby-list__what">
                <strong>{askLine(a.game, a.from)}</strong>
                <span>{GAME_NAMES[a.game]} · {left}s to answer</span>
              </span>
              <span className="lobby-asks__buttons">
                <button type="button" className="button button--primary" onClick={() => onYes(a)}>Yes!</button>
                <button type="button" className="button button--light" onClick={() => onNo(a)}>No</button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pick a game (D3)
// ---------------------------------------------------------------------------

export interface Tile {
  id: string;
  name: string;
  emoji: string;
  /** What tapping it does, when it can be used. */
  blurb: string;
  /** Why it's greyed, or null when it can be used. */
  why: string | null;
  /** The button that fixes it (make a hero, start a clan…). */
  fix?: { label: string; to: string };
  /** Shown as picked (its start form or its who's-here list is open). */
  picked?: boolean;
  onPick?: () => void;
}

export function GameTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="lobby-tiles" aria-label="Games">
      {tiles.map((t) => (
        <li key={t.id} className={`lobby-tile${t.why ? ' lobby-tile--grey' : ''}${t.picked ? ' lobby-tile--picked' : ''}`}>
          {t.why ? (
            <div className="lobby-tile__face" role="group" aria-label={t.name}>
              <span className="lobby-tile__emoji" aria-hidden="true">{t.emoji}</span>
              <strong>{t.name}</strong>
              <span className="lobby-tile__why">{t.why}</span>
              {t.fix && (
                <Link to={t.fix.to} className="button button--light lobby-tile__fix">
                  {t.fix.label}
                </Link>
              )}
            </div>
          ) : (
            <button type="button" className="lobby-tile__face" aria-pressed={!!t.picked} onClick={t.onPick}>
              <span className="lobby-tile__emoji" aria-hidden="true">{t.emoji}</span>
              <strong>{t.name}</strong>
              <span className="lobby-tile__blurb">{t.blurb}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Who's here (D4)
// ---------------------------------------------------------------------------

/** Remembered on this device once the stars hint has shown. */
export const STAR_HINT_KEY = 'lobby-star-hint-seen';

/** The one-time hint "Tap ☆ to keep your friends at the top", read aloud by Bella the first time it shows. */
function StarHint() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(STAR_HINT_KEY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!show) return;
    try {
      localStorage.setItem(STAR_HINT_KEY, '1');
    } catch {
      /* private window: it may show again next time */
    }
    speak(STAR_HINT_SPOKEN, VOICE_FOLDER);
  }, [show]);
  if (!show) return null;
  return (
    <p className="lobby-here__hint" role="status">
      <span>{STAR_HINT}</span>
      <button type="button" className="button button--light" onClick={() => setShow(false)}>
        Got it
      </button>
    </p>
  );
}

export function WhosHere({ online, starsAway = [], recent = [], me, games, boards, focus, onClearFocus, sending, problem, onSend }: {
  /** null while loading. */
  online: HerePlayer[] | null;
  /** My stars who aren't here (stage 8). */
  starsAway?: StarAway[];
  /** Played recently (stage 8). */
  recent?: HerePlayer[];
  me: Record<MyGame, MyState> | null;
  /** The live games shown (their code switches are on). */
  games: LiveGame[];
  /** The board games I can invite a kid to (friends' games on, not paused for me). */
  boards: InviteGame[];
  /** A live game picked from its tile: each kid shows only that game. */
  focus: LiveGame | null;
  onClearFocus: () => void;
  sending: boolean;
  problem: string;
  onSend: (game: LobbyGame, them: HerePlayer) => void;
}) {
  const [openKid, setOpenKid] = useState<string | null>(null);
  const played = useStars(recent, starPlayer);
  // A game I can't play myself shows only on its tile (with the reason and the fix), not on every kid.
  const shownGames: LobbyGame[] = focus ? [focus] : [...games.filter((g) => !me || me[g] === 'ready'), ...boards];

  /** The board games that can't be played with them, one line per reason (not five "has paused" lines). */
  const boardsNot = (p: HerePlayer) => {
    const why = new Map<string, InviteGame[]>();
    for (const g of shownGames) {
      if (!isInviteGame(g) || p.games[g] === 'ok') continue;
      const key = p.games[g] ?? 'unknown';
      why.set(key, [...(why.get(key) ?? []), g]);
    }
    return [...why].map(([state, games]) => {
      const names = games.map((g) => GAME_NAMES[g]);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      const text = state === 'off' ? `${p.name}’s class has paused ${list}` : state === 'busy' ? `${p.name} has another invite waiting` : `${p.name} can’t play ${list} right now`;
      return (
        <span key={state} className="lobby-here__no">
          <span aria-hidden="true">{games.length > 1 ? '🎲' : EMOJI[games[0]]} </span>
          {text}
        </span>
      );
    });
  };

  const choices = (p: HerePlayer) => (
    <span className="lobby-here__games">
      {shownGames.length === 0 && <span className="lobby-here__no">Look at the games above to see what to do first.</span>}
      {shownGames.map((g) => {
        if (isInviteGame(g) && p.games[g] !== 'ok') return null;
        const w = isInviteGame(g) ? withThemWords(g, 'ready', p) : me ? withThemWords(g, me[g], p) : { ok: false, text: 'Checking…' };
        return w.ok ? (
          <button key={g} type="button" className="button button--primary" disabled={sending} onClick={() => onSend(g, p)}>
            <span aria-hidden="true">{EMOJI[g]} </span>
            {w.text}
          </button>
        ) : (
          <span key={g} className="lobby-here__no">
            <span aria-hidden="true">{EMOJI[g]} </span>
            {w.text}
          </span>
        );
      })}
      {boardsNot(p)}
    </span>
  );

  /** One kid here now: avatar, name and class, and what we can play together once opened. */
  const kid = (p: HerePlayer) => {
    const open = focus !== null || openKid === p.id;
    return (
      <>
        <AvatarImage avatar={p.avatar} size={44} />
        <span className="lobby-list__what">
          <strong>
            {p.name} <ClassTag player={p} />
          </strong>
          {open && choices(p)}
        </span>
        {!focus && (
          <button
            type="button"
            className="button button--light"
            aria-expanded={open}
            onClick={() => setOpenKid(open ? null : p.id)}
            aria-label={open ? `Close ${p.name}` : `Play with ${p.name}`}
          >
            {open ? 'Close' : 'Play'}
          </button>
        )}
      </>
    );
  };

  return (
    <section className="panel lobby-here" aria-labelledby="here-title" id="whos-here">
      <h2 id="here-title" className="panel__title">
        Who’s here
      </h2>
      {focus && (
        <p className="lobby-here__focus">
          Pick someone for a {SEND[focus]}.{' '}
          <button type="button" className="lobby-here__all" onClick={onClearFocus}>
            Show every game
          </button>
        </p>
      )}
      {problem && (
        <p className="chess-note" role="alert">
          {problem}
        </p>
      )}
      {!online ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <>
          {(online.length > 0 || starsAway.length > 0 || recent.length > 0) && <StarHint />}
          {online.length === 0 && starsAway.length === 0 ? (
            <p className="panel__empty">Nobody else is here right now. Friends show up here when they open the Games Hub.</p>
          ) : (
            <SchoolPlayerList
              people={online}
              label="Kids here now"
              listClassName="lobby-list lobby-here__list"
              onStar={starPlayer}
              away={starsAway}
              awayRow={(p: SchoolPlayer) => (
                <>
                  <AvatarImage avatar={(p as StarAway).avatar} size={44} />
                  <span className="lobby-list__what">
                    <strong>
                      {p.name} <ClassTag player={p} />
                    </strong>
                  </span>
                </>
              )}
              row={kid}
            />
          )}
          {played.people.length > 0 && (
            <div className="lobby-recent">
              <h3 className="lobby-recent__title">Played recently</h3>
              {played.problem && <p className="school-list__problem" role="alert">{played.problem}</p>}
              <ul className="lobby-recent__row" aria-label="Played recently">
                {played.people.map((p) => (
                  <li key={p.id} className={`lobby-recent__kid${p.here ? '' : ' lobby-recent__kid--away'}`}>
                    <AvatarImage avatar={p.avatar} size={44} />
                    <span className="lobby-recent__name">
                      {p.here && <span className="school-list__dot" role="img" aria-label="here now" title="Here now" />}
                      {p.name}
                      <ClassTag player={p} />
                      {!p.here && <span className="lobby-recent__gone">Not here right now</span>}
                    </span>
                    {p.here && (
                      !focus && (
                        <button type="button" className="button button--light lobby-recent__play" aria-expanded={openKid === p.id}
                          onClick={() => setOpenKid(openKid === p.id ? null : p.id)} aria-label={openKid === p.id ? `Close ${p.name}` : `Play with ${p.name}`}>
                          {openKid === p.id ? 'Close' : 'Play'}
                        </button>
                      )
                    )}
                    <StarButton player={p} onToggle={() => played.toggle(p)} />
                    {p.here && (focus !== null || openKid === p.id) && <div className="lobby-recent__choices">{choices(p)}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
