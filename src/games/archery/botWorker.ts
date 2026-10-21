// Runs the Archery Challenge bots in a Web Worker, so the page never freezes while they think.
import { chooseBotShot, type BotTurn } from '../../../shared/archery/bot';

self.onmessage = (event: MessageEvent<{ id: number; turn: BotTurn }>) => {
  const { id, turn } = event.data;
  try {
    self.postMessage({ id, shot: chooseBotShot(turn) });
  } catch {
    self.postMessage({ id, shot: null });
  }
};
