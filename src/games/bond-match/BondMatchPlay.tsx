import { useEffect, useState } from 'react';
import type { BondSet } from '../../../shared/bond-match/bonds';
import { MAX_SEED, type BoardSize } from '../../../shared/bond-match/deck';
import type { BotLevel } from '../types';
import { BondMatchGame, type FinishedGame } from './BondMatchGame';
import type { BondMatchSaver, ServerBest } from '../../data/bondMatch';
import { BondPicker, type StarsBySet } from './BondPicker';
import { recordGame, type RecordedGame } from './bests';
import { Finish, VersusFinish, type SaveState } from './Finish';
import { TEXT, type Players } from './strings';
import type { BondSuggestion } from './suggest';
import './bond-match.css';

/** A new seed for each game. It is picked here, in the screen: the engine in shared/ never picks one. */
export const randomSeed = (): number => Math.floor(Math.random() * (MAX_SEED + 1));

interface Props {
  /** The hub passes a bot level to every game; Bond Match has no bots yet. */
  level?: BotLevel;
  /** Where seeds come from. The preview and the tests pass their own to get the same deck every time. */
  makeSeed?: () => number;
  mismatchMs?: number;
  finishMs?: number;
  /** Saves finished games to the server. Without one nothing is sent and bests live in this browser only. */
  saver?: BondMatchSaver;
  /** Where run ids come from (made when a game starts, so a save sent twice is kept once). Tests pass their own. */
  makeRunId?: () => string;
  /** The computer's dice and speed. Tests pass their own. */
  random?: () => number;
  botMs?: number;
  botAfterMismatchMs?: number;
  /** The bond the student's maths focus or ladder place points to (suggest.ts). Left out or null: no suggestion. */
  suggested?: BondSuggestion | null;
}

const newRunId = (): string => crypto.randomUUID();

const starsBySet = (bests: readonly ServerBest[]): StarsBySet => {
  const out: StarsBySet = {};
  for (const b of bests) (out[b.bondId] ??= {})[b.size as BoardSize] = b.stars;
  return out;
};

type Screen =
  | { name: 'pick' }
  | { name: 'play'; set: BondSet; size: BoardSize; seed: number; runId: string; players: Players }
  | { name: 'done'; set: BondSet; size: BoardSize; game: FinishedGame; recorded: RecordedGame | null; players: Players };

/** Picker, board and finish. With a saver, finished games go to the server; bests are also kept in this browser. */
export function BondMatchPlay({ makeSeed = randomSeed, mismatchMs, finishMs, saver, makeRunId = newRunId, random, botMs, botAfterMismatchMs, suggested }: Props) {
  const [screen, setScreen] = useState<Screen>({ name: 'pick' });
  const [players, setPlayers] = useState<Players>({ mode: 'solo' });
  // The board size last played, so the picker opens on it again.
  const [lastSize, setLastSize] = useState<BoardSize>('medium');
  const [saved, setSaved] = useState<SaveState | undefined>();
  const [stars, setStars] = useState<StarsBySet>({});

  // The student's saved stars, for the picker. Anything waiting to be sent goes first.
  useEffect(() => {
    let live = true;
    void saver?.loadBests().then((bests) => { if (live && bests) setStars(starsBySet(bests)); });
    return () => { live = false; };
  }, [saver]);

  const start = (set: BondSet, size: BoardSize) => {
    setSaved(undefined);
    setLastSize(size);
    setScreen({ name: 'play', set, size, seed: makeSeed(), runId: makeRunId(), players });
  };

  function save(set: BondSet, size: BoardSize, seed: number, runId: string, game: FinishedGame, mode: Players['mode']) {
    if (!saver) return;
    setSaved({ status: 'saving' });
    void saver.save({ runId, seed, bondId: set.id, size, flips: [...game.state.log], seconds: game.score.seconds, mode }).then((result) => {
      if (result === null) {
        // Out of reach: the game is kept and goes later.
        setSaved({ status: 'later' });
      } else if (result.status === 'invalid') {
        // The server will never take this one; the queue has dropped it. Nothing more to say to a child.
        setSaved(undefined);
      } else {
        setSaved({ status: 'saved', points: result.points });
        const best = result.best;
        if (best) setStars((was) => ({ ...was, [set.id]: { ...was[set.id], [size]: best.stars } }));
      }
    }, () => setSaved({ status: 'later' }));
  }

  return (
    <div className="bm">
      <h1 className="bm-title">{TEXT.name}</h1>
      {screen.name === 'pick' && <BondPicker initialSize={lastSize} onPick={start} stars={saver ? stars : undefined} players={players} onPlayers={setPlayers} suggested={suggested} />}
      {screen.name === 'play' && (
        <BondMatchGame
          set={screen.set}
          size={screen.size}
          seed={screen.seed}
          players={screen.players}
          random={random}
          botMs={botMs}
          botAfterMismatchMs={botAfterMismatchMs}
          mismatchMs={mismatchMs}
          finishMs={finishMs}
          onQuit={() => setScreen({ name: 'pick' })}
          onFinish={(game) => {
            // Only solo games are bests: a shared board's flips aren't one person's memory.
            const recorded = screen.players.mode === 'solo' ? recordGame(screen.set.id, screen.size, game.score.flips, game.score.seconds) : null;
            setScreen({ name: 'done', set: screen.set, size: screen.size, game, recorded, players: screen.players });
            save(screen.set, screen.size, screen.seed, screen.runId, game, screen.players.mode);
          }}
        />
      )}
      {screen.name === 'done' && screen.game.versus && (
        <VersusFinish
          save={saved}
          setLabel={screen.set.label}
          players={screen.players}
          pairs={screen.game.versus.pairs}
          winner={screen.game.versus.winner}
          onAgain={() => start(screen.set, screen.size)}
          onAnother={() => setScreen({ name: 'pick' })}
        />
      )}
      {screen.name === 'done' && !screen.game.versus && screen.recorded && (
        <Finish
          save={saved}
          setLabel={screen.set.label}
          score={screen.game.score}
          recorded={screen.recorded}
          onAgain={() => start(screen.set, screen.size)}
          onAnother={() => setScreen({ name: 'pick' })}
        />
      )}
    </div>
  );
}
