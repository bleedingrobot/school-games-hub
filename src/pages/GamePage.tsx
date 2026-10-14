import { Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { ComingSoon } from '../components/ComingSoon';
import type { GameDefinition } from '../games/types';
import { BOT_LEVELS, isBotLevel } from '../games/types';

const EMOJI: Record<string, string> = { chess: '♟️', checkers: '🔴' };
const STAGE: Record<string, number> = { checkers: 5 };

export function GamePage({ game }: { game: GameDefinition }) {
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
        The {game.name.toLowerCase()} board is still being built
        {STAGE[game.id] ? ` (step ${STAGE[game.id]} of the plan)` : ''}. Check back soon.
      </p>
    </ComingSoon>
  );
}
