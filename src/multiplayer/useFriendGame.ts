import { useCallback, useEffect, useRef, useState } from 'react';
import { otherSide, type Side } from '../../shared/multiplayer';
import { useAuth } from '../auth/AuthContext';
import {
  ask,
  fetchClockOffset,
  fetchFriendGame,
  fetchPlayerCards,
  MultiplayerError,
  watchGame,
  type Action,
  type FriendGame,
  type LiveStatus,
  type PlayerCard,
} from '../data/multiplayer';
import { useGameChecks } from './useGameChecks';

/** The opponent counts as away once they've been missing from the game for this long. */
export const AWAY_AFTER_MS = 8_000;

export interface FriendSession {
  game: FriendGame;
  mySide: Side;
  opponentSide: Side;
  /** The opponent's name and avatar. Null if they're hidden or haven't joined yet. */
  opponent: PlayerCard | null;
  live: LiveStatus;
  /** True once the opponent seems to have left the page (closed it, lost Wi-Fi...). */
  opponentAway: boolean;
  /** Now, by the server's clock, in milliseconds. */
  serverNow: () => number;
  busy: boolean;
  /** A friendly message after something was refused, or ''. */
  message: string;
  clearMessage: () => void;
  /** Asks the server to do something. True if it worked. */
  act: (request: Action) => Promise<boolean>;
}

export type FriendGameState =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; session: FriendSession };

/**
 * Keeps one game between students up to date: loads it, listens for live changes, checks
 * now and then in case live updates drop, and keeps track of whether the opponent is here.
 */
export function useFriendGame(id: string): FriendGameState {
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [game, setGame] = useState<FriendGame | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [present, setPresent] = useState<string[] | null>(null);
  const [away, setAway] = useState(false);
  const [opponent, setOpponent] = useState<PlayerCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const offset = useRef(0);

  // Newer versions win, so a late live message can't take the game backwards.
  const accept = useCallback((next: FriendGame | null | undefined) => {
    if (!next?.id) return;
    setGame((prev) => (!prev || prev.id !== next.id || next.version >= prev.version ? next : prev));
  }, []);

  const load = useCallback(async () => {
    try {
      const found = await fetchFriendGame(id);
      if (found) {
        accept(found);
        setLoadState('ready');
      } else {
        setLoadState((s) => (s === 'ready' ? s : 'missing'));
      }
    } catch {
      setLoadState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [id, accept]);

  // A new game (e.g. a rematch) starts fresh.
  useEffect(() => {
    setGame(null);
    setLoadState('loading');
    setOpponent(null);
    setMessage('');
    setPresent(null);
    void load();
  }, [load]);

  useEffect(() => {
    void fetchClockOffset().then((ms) => (offset.current = ms));
  }, []);

  // Live updates.
  useEffect(() => {
    if (!me) return;
    const watch = watchGame(id, me, { onGame: accept, onLive: setLive, onPresent: setPresent });
    return () => watch.stop();
  }, [id, me, accept]);

  // Check now and then anyway: rarely if live updates are fine, soon and then less and less often if they're down.
  const active = game?.status === 'waiting' || game?.status === 'playing' || (game?.status === 'finished' && !game.rematch_game);
  useGameChecks(active, live, load);

  // Coming back to the tab, or the Wi-Fi coming back: look again straight away.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('online', again);
    };
  }, [load]);

  const mySide: Side = game?.second_player === me ? 'second' : 'first';
  const opponentId = game ? (mySide === 'first' ? game.second_player : game.first_player) : null;

  useEffect(() => {
    if (!opponentId) return;
    let current = true;
    void fetchPlayerCards([opponentId]).then((cards) => current && setOpponent(cards.get(opponentId) ?? null));
    return () => {
      current = false;
    };
  }, [opponentId]);

  // Away: the opponent has been missing from the game's channel for a few seconds.
  const opponentHere = present === null || !opponentId ? null : present.includes(opponentId);
  useEffect(() => {
    if (opponentHere !== false) {
      setAway(false);
      return;
    }
    const timer = setTimeout(() => setAway(true), AWAY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [opponentHere]);

  const act = useCallback(
    async (request: Action) => {
      setBusy(true);
      setMessage('');
      try {
        accept(await ask(request));
        return true;
      } catch (error) {
        if (error instanceof MultiplayerError && error.problem === 'changed') {
          await load();
        } else {
          setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accept, load],
  );

  if (loadState !== 'ready' || !game) {
    return { state: loadState === 'ready' ? 'loading' : loadState };
  }
  return {
    state: 'ready',
    session: {
      game,
      mySide,
      opponentSide: otherSide(mySide),
      opponent,
      live,
      opponentAway: away && game.status === 'playing',
      serverNow: () => Date.now() + offset.current,
      busy,
      message,
      clearMessage: () => setMessage(''),
      act,
    },
  };
}
