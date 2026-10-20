import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchClockOffset, fetchPlayerCards, MultiplayerError, type LiveStatus, type PlayerCard } from '../data/multiplayer';
import { askSpace, askSpaceFull, fetchSpaceGame, seatsOf, watchSpaceGame, type SpaceAction, type SpaceGame, type SpaceMathsReply } from '../data/spaceGames';
import { useGameChecks } from '../multiplayer/useGameChecks';

export interface SpaceSession {
  game: SpaceGame;
  me: string;
  /** My seat (0–3), or -1 if I'm not in this game (e.g. I left the waiting room). */
  mySeat: number;
  /** Names and avatars of the students in the game. Hidden students are left out. */
  cards: Map<string, PlayerCard>;
  live: LiveStatus;
  /** Who has the game open right now, or null while we can't tell. */
  present: string[] | null;
  /** Now, by the server's clock, in milliseconds. */
  serverNow: () => number;
  busy: boolean;
  message: string;
  clearMessage: () => void;
  /** Asks the server to do something. True if it worked. */
  act: (request: SpaceAction) => Promise<boolean>;
  /**
   * Like act, for Mission Control questions: returns what the server said (the question, or how
   * the answer went), or throws with a message for the student. The game it sends back is
   * kept up to date as usual.
   */
  ask: (request: SpaceAction) => Promise<SpaceMathsReply>;
  /** Loads the game again (after a refusal, or when something looks out of date). */
  reload: () => Promise<void>;
}

export type SpaceGameState =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; session: SpaceSession };

/** A live update that leaves out the big columns (it can happen with very big rows) isn't enough to show. */
const complete = (g: SpaceGame) => g.status === 'waiting' || g.status === 'cancelled' || g.status === 'expired' || !!g.state;

/**
 * Keeps one classmates game up to date: loads it, listens for live changes, checks now and
 * then in case live updates drop, and keeps track of who's here. The same approach as
 * useFriendGame (chess and checkers), which is left as it is.
 */
export function useSpaceGame(id: string): SpaceGameState {
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [game, setGame] = useState<SpaceGame | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [present, setPresent] = useState<string[] | null>(null);
  const [cards, setCards] = useState<Map<string, PlayerCard>>(new Map());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const offset = useRef(0);
  const acceptRef = useRef<(next: SpaceGame) => void>(() => {});

  const load = useCallback(async () => {
    try {
      const found = await fetchSpaceGame(id);
      if (found) {
        acceptRef.current(found);
        setLoadState('ready');
      } else {
        setLoadState((s) => (s === 'ready' ? s : 'missing'));
      }
    } catch {
      setLoadState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [id]);

  // Newer versions win, so a late live message can't take the game backwards. The same
  // version with a new reaction only brings the reaction.
  const accept = useCallback(
    (next: SpaceGame | null | undefined) => {
      if (!next?.id) return;
      if (!complete(next)) {
        void load();
        return;
      }
      setGame((prev) => {
        if (!prev || prev.id !== next.id || next.version > prev.version) return next;
        if (next.version === prev.version && (next.reactions?.last?.id ?? 0) > (prev.reactions?.last?.id ?? 0)) {
          return { ...prev, reactions: next.reactions };
        }
        return prev;
      });
    },
    [load],
  );
  acceptRef.current = accept;

  useEffect(() => {
    setGame(null);
    setLoadState('loading');
    setMessage('');
    setPresent(null);
    void load();
  }, [load]);

  useEffect(() => {
    void fetchClockOffset().then((ms) => (offset.current = ms));
  }, []);

  useEffect(() => {
    if (!me) return;
    const watch = watchSpaceGame(id, me, { onGame: accept, onLive: setLive, onPresent: setPresent });
    return () => watch.stop();
  }, [id, me, accept]);

  const active = game?.status === 'waiting' || game?.status === 'playing' || (game?.status === 'finished' && !game.rematch_game);
  useGameChecks(active, live, load);

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

  // Names and avatars: look again whenever someone new sits down.
  const playerKey = game ? seatsOf(game).filter(Boolean).sort().join(',') : '';
  useEffect(() => {
    const ids = playerKey ? playerKey.split(',') : [];
    if (ids.length === 0) return;
    let current = true;
    void fetchPlayerCards(ids).then((found) => current && setCards(found));
    return () => {
      current = false;
    };
  }, [playerKey]);

  const act = useCallback(
    async (request: SpaceAction) => {
      setBusy(true);
      setMessage('');
      try {
        accept(await askSpace(request));
        return true;
      } catch (error) {
        if (error instanceof MultiplayerError && (error.problem === 'changed' || error.problem === 'not-your-turn')) {
          await load();
        } else if (!(error instanceof MultiplayerError && error.problem === 'not-yet')) {
          setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accept, load],
  );

  const ask = useCallback(
    async (request: SpaceAction) => {
      try {
        const reply = await askSpaceFull(request);
        accept(reply.game);
        return reply;
      } catch (error) {
        if (error instanceof MultiplayerError && (error.problem === 'changed' || error.problem === 'not-your-turn')) void load();
        throw error;
      }
    },
    [accept, load],
  );

  if (loadState !== 'ready' || !game) return { state: loadState === 'ready' ? 'loading' : loadState };
  return {
    state: 'ready',
    session: {
      game,
      me,
      mySeat: seatsOf(game).indexOf(me),
      cards,
      live,
      present,
      serverNow: () => Date.now() + offset.current,
      busy,
      message,
      clearMessage: () => setMessage(''),
      act,
      ask,
      reload: load,
    },
  };
}
