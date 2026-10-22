/**
 * Asks an Archery Challenge bot for its shot. In the browser it thinks in a Web Worker; if workers
 * aren't available (or one breaks), it thinks on the page instead. Both give exactly the same shot,
 * because the choice only depends on the fight so far (seed, setup, shots) and the level.
 */
import { chooseBotShot, type BotTurn } from '../../../shared/archery/bot';
import type { Shot } from '../../../shared/archery/types';

export interface ArcheryBot {
  decide(turn: BotTurn): Promise<Shot>;
  close(): void;
}

function onThePage(turn: BotTurn): Promise<Shot> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(chooseBotShot(turn));
      } catch (e) {
        reject(e);
      }
    }, 0),
  );
}

export function startArcheryBot(): ArcheryBot {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  let nextId = 0;
  const waiting = new Map<number, (shot: Shot | null) => void>();
  if (worker) {
    worker.onmessage = (event: MessageEvent<{ id: number; shot: Shot | null }>) => {
      waiting.get(event.data.id)?.(event.data.shot);
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
    async decide(turn) {
      if (!worker) return onThePage(turn);
      const id = nextId++;
      const shot = await new Promise<Shot | null>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, turn });
      });
      return shot ?? onThePage(turn);
    },
    close() {
      worker?.terminate();
      worker = null;
    },
  };
}
