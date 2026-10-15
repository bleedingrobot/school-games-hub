import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { askCard, fetchMySeat, watchCardGame, type CardAction, type SeatRow } from '../data/cardGames';
import { fetchClockOffset, fetchPlayerCards, MultiplayerError, type LiveStatus, type PlayerCard } from '../data/multiplayer';
import { CHECK_EVERY_MS } from '../multiplayer/useFriendGame';

export interface CardSession {
  /** My seat row: the public info, and my own view of the cards. */
  seat: SeatRow;
  me: string;
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
  act: (request: CardAction) => Promise<boolean>;
  /** Loads my seat again (after a refusal, or when something looks out of date). */
  reload: () => Promise<void>;
}

export type CardGameState =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; session: CardSession };

/** How many events the log keeps (the database keeps the same number). */
const LOG_LENGTH = 40;

/**
 * Keeps my seat in one 101 game up to date: loads it, listens for live changes, checks now
 * and then in case live updates drop, and keeps track of who's here. Like useSpaceGame, but
 * for a seat row: everything I may know, and nothing I mayn't.
 */
export function useCardGame(id: string): CardGameState {
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [seat, setSeat] = useState<SeatRow | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [present, setPresent] = useState<string[] | null>(null);
  const [cards, setCards] = useState<Map<string, PlayerCard>>(new Map());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const offset = useRef(0);

  // Newer versions win, so a late live message can't take the game backwards. A reply from
  // the server has no log (the page keeps its own): add its events to the one we have.
  const accept = useCallback((next: SeatRow | null | undefined) => {
    if (!next?.game) return;
    setSeat((prev) => {
      if (prev && prev.game === next.game && next.version <= prev.version) return prev;
      if (prev && prev.game === next.game && !next.log?.length) {
        return { ...next, log: [...prev.log, ...next.events].slice(-LOG_LENGTH) };
      }
      return { ...next, log: next.log ?? [] };
    });
  }, []);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const found = await fetchMySeat(id, me);
      if (found) {
        // A fresh read is the whole truth (it has the database's log).
        setSeat((prev) => (prev && prev.game === found.game && found.version < prev.version ? prev : found));
        setLoadState('ready');
      } else {
        setLoadState((s) => (s === 'ready' ? s : 'missing'));
      }
    } catch {
      setLoadState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [id, me]);

  useEffect(() => {
    setSeat(null);
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
    const watch = watchCardGame(id, me, { onSeat: accept, onLive: setLive, onPresent: setPresent });
    return () => watch.stop();
  }, [id, me, accept]);

  const status = seat?.status;
  const active = status === 'waiting' || status === 'playing' || (status === 'finished' && !seat?.info.rematchGame);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void load(), live === 'live' ? CHECK_EVERY_MS.live : CHECK_EVERY_MS.down);
    return () => clearInterval(timer);
  }, [active, live, load]);

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
  const playerKey = seat ? seat.info.players.filter(Boolean).sort().join(',') : '';
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
    async (request: CardAction) => {
      setBusy(true);
      setMessage('');
      try {
        accept(await askCard(request));
        return true;
      } catch (error) {
        if (error instanceof MultiplayerError && error.problem === 'changed') {
          await load();
        } else if (!(error instanceof MultiplayerError && error.problem === 'not-yet')) {
          setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
          if (error instanceof MultiplayerError && error.problem === 'illegal') void load();
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accept, load],
  );

  if (loadState !== 'ready' || !seat) return { state: loadState === 'ready' ? 'loading' : loadState };
  return {
    state: 'ready',
    session: {
      seat,
      me,
      cards,
      live,
      present,
      serverNow: () => Date.now() + offset.current,
      busy,
      message,
      clearMessage: () => setMessage(''),
      act,
      reload: load,
    },
  };
}
