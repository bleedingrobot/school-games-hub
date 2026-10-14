/**
 * Asks the checkers bot for a move. In the browser it thinks in a Web Worker, so the board
 * stays responsive. If workers aren't available (or one breaks), it thinks on the page
 * instead, which still works, just with a short pause.
 */
import type { BotLevel } from '../../../shared/botGame';
import { findMove, type CheckersMove, type Position } from '../../../shared/checkers/rules';
import { chooseCheckersMove } from './bot';

export interface CheckersBot {
  bestMove(position: Position, level: BotLevel): Promise<CheckersMove>;
  close(): void;
}

function onThePage(position: Position, level: BotLevel): Promise<CheckersMove> {
  // Wait a moment first, so the page can show "thinking" before the bot gets busy.
  return new Promise((resolve) => setTimeout(() => resolve(chooseCheckersMove(position, level)), 30));
}

export function startCheckersBot(): CheckersBot {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  let nextId = 0;
  const waiting = new Map<number, (notation: string | null) => void>();
  if (worker) {
    worker.onmessage = (event: MessageEvent<{ id: number; notation: string | null }>) => {
      waiting.get(event.data.id)?.(event.data.notation);
      waiting.delete(event.data.id);
    };
    worker.onerror = () => {
      // The worker broke: answer anything waiting on the page, and stop using it.
      worker?.terminate();
      worker = null;
      for (const answer of waiting.values()) answer(null);
      waiting.clear();
    };
  }

  return {
    async bestMove(position, level) {
      if (!worker) return onThePage(position, level);
      const id = nextId++;
      const notation = await new Promise<string | null>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, position, level });
      });
      // Whatever comes back is checked against the rules before it's played.
      return (notation && findMove(position, notation)) || onThePage(position, level);
    },
    close() {
      worker?.terminate();
      worker = null;
    },
  };
}
