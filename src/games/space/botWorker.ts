// Runs the Wormholes & Black Holes bots in a Web Worker, so the page never freezes while they think.
import { decideBot, type BotQuestion } from './soloRun';

self.onmessage = (event: MessageEvent<{ id: number; question: BotQuestion }>) => {
  const { id, question } = event.data;
  try {
    self.postMessage({ id, answer: decideBot(question) });
  } catch {
    self.postMessage({ id, answer: null });
  }
};
