import { useState } from 'react';
import type { BondSet } from '../../../shared/bond-match/bonds';
import { MAX_SEED, type BoardSize } from '../../../shared/bond-match/deck';
import type { BotLevel } from '../types';
import { BondMatchGame, type FinishedGame } from './BondMatchGame';
import { BondPicker } from './BondPicker';
import { recordGame, type RecordedGame } from './bests';
import { Finish } from './Finish';
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
}

type Screen =
  | { name: 'pick' }
  | { name: 'play'; set: BondSet; size: BoardSize; seed: number }
  | { name: 'done'; set: BondSet; size: BoardSize; game: FinishedGame; recorded: RecordedGame };

/** Picker, board and finish. Nothing is sent to a server: bests live in this browser. */
export function BondMatchPlay({ makeSeed = randomSeed, mismatchMs, finishMs }: Props) {
  const [screen, setScreen] = useState<Screen>({ name: 'pick' });

  const start = (set: BondSet, size: BoardSize) => setScreen({ name: 'play', set, size, seed: makeSeed() });

  return (
    <div className="bm">
      <h1 className="bm-title">{TEXT.name}</h1>
      {screen.name === 'pick' && <BondPicker onPick={start} />}
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
          }}
        />
      )}
      {screen.name === 'done' && (
        <Finish
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
