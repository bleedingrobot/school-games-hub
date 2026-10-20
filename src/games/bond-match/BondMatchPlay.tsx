import { useEffect, useState } from 'react';
import type { BondSet } from '../../../shared/bond-match/bonds';
import { MAX_SEED, type BoardSize } from '../../../shared/bond-match/deck';
import type { BotLevel } from '../types';
import { BondMatchGame, type FinishedGame } from './BondMatchGame';
import type { BondMatchSaver, ServerBest } from '../../data/bondMatch';
import { BondPicker, type StarsBySet } from './BondPicker';
import { recordGame, type RecordedGame } from './bests';
import { Finish, type SaveState } from './Finish';
import { TEXT } from './strings';
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
}

const newRunId = (): string => crypto.randomUUID();

const starsBySet = (bests: readonly ServerBest[]): StarsBySet => {
  const out: StarsBySet = {};
  for (const b of bests) (out[b.bondId] ??= {})[b.size as BoardSize] = b.stars;
  return out;
};

type Screen =
  | { name: 'pick' }
  | { name: 'play'; set: BondSet; size: BoardSize; seed: number; runId: string }
  | { name: 'done'; set: BondSet; size: BoardSize; game: FinishedGame; recorded: RecordedGame };

/** Picker, board and finish. Nothing is sent to a server: bests live in this browser. */
export function BondMatchPlay({ makeSeed = randomSeed, mismatchMs, finishMs, saver, makeRunId = newRunId }: Props) {
  const [screen, setScreen] = useState<Screen>({ name: 'pick' });
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
    setScreen({ name: 'play', set, size, seed: makeSeed(), runId: makeRunId() });
  };

  function save(set: BondSet, size: BoardSize, seed: number, runId: string, game: FinishedGame) {
    if (!saver) return;
    setSaved({ status: 'saving' });
    void saver.save({ runId, seed, bondId: set.id, size, flips: [...game.state.log], seconds: game.score.seconds }).then((result) => {
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
      {screen.name === 'pick' && <BondPicker onPick={start} stars={saver ? stars : undefined} />}
      {screen.name === 'play' && (
        <BondMatchGame
          set={screen.set}
          size={screen.size}
          seed={screen.seed}
          mismatchMs={mismatchMs}
          finishMs={finishMs}
          onQuit={() => setScreen({ name: 'pick' })}
          onFinish={(game) => {
            const recorded = recordGame(screen.set.id, screen.size, game.score.flips, game.score.seconds);
            setScreen({ name: 'done', set: screen.set, size: screen.size, game, recorded });
            save(screen.set, screen.size, screen.seed, screen.runId, game);
          }}
        />
      )}
      {screen.name === 'done' && (
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
