/**
 * Asks a Wormholes & Black Holes bot what to do. In the browser it thinks in a Web Worker;
 * if workers aren't available (or one breaks), it thinks on the page instead. Both give
 * exactly the same answer, because the decision only depends on the question.
 */
import { decideBot, type BotAnswer, type BotQuestion } from './soloRun';

export interface SpaceBot {
  decide(question: BotQuestion): Promise<BotAnswer>;
  close(): void;
}

function onThePage(question: BotQuestion): Promise<BotAnswer> {
  return new Promise((resolve) => setTimeout(() => resolve(decideBot(question)), 0));
}

export function startSpaceBot(): SpaceBot {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./botWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  let nextId = 0;
  const waiting = new Map<number, (answer: BotAnswer | null) => void>();
  if (worker) {
    worker.onmessage = (event: MessageEvent<{ id: number; answer: BotAnswer | null }>) => {
      waiting.get(event.data.id)?.(event.data.answer);
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
    async decide(question) {
      if (!worker) return onThePage(question);
      const id = nextId++;
      const answer = await new Promise<BotAnswer | null>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, question });
      });
      return answer ?? onThePage(question);
    },
    close() {
      worker?.terminate();
      worker = null;
    },
  };
}
