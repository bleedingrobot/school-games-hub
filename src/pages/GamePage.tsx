import { Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { ComingSoon } from '../components/ComingSoon';
import type { GameDefinition } from '../games/types';
import { BOT_LEVELS, isBotLevel } from '../games/types';
import { GameGate } from '../training/TrainFirst';

const EMOJI: Record<string, string> = { chess: '♟️', checkers: '🔴', space: '🚀', '101': '🃏' };

/** Every game's page. In a class with Training before games on, a student who hasn't trained lately sees "Training first" instead. */
export function GamePage({ game }: { game: GameDefinition }) {
  return (
    <GameGate>
      <GameScreen game={game} />
    </GameGate>
  );
}

function GameScreen({ game }: { game: GameDefinition }) {
  const [params] = useSearchParams();
  const requested = params.get('bot');
  const level = BOT_LEVELS.find((l) => l.id === (isBotLevel(requested) ? requested : 'easy'))!;

  if (game.Play) {
    return (
      <Suspense fallback={<p className="loading">Setting up the board…</p>}>
        <game.Play level={level.id} />
      </Suspense>
    );
  }

  return (
    <ComingSoon emoji={EMOJI[game.id] ?? '🎮'} title={game.name}>
      <p>
        You picked the <strong>{level.label}</strong> bot. Good choice!
      </p>
      <p>
        The {game.name.toLowerCase()} board is still being built. Check back soon.
      </p>
    </ComingSoon>
  );
}
