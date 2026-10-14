// Runs the checkers bot in a Web Worker, so the page never freezes while it thinks.
import type { BotLevel } from '../../../shared/botGame';
import type { Position } from '../../../shared/checkers/rules';
import { chooseCheckersMove } from './bot';

self.onmessage = (event: MessageEvent<{ id: number; position: Position; level: BotLevel }>) => {
  const { id, position, level } = event.data;
  try {
    self.postMessage({ id, notation: chooseCheckersMove(position, level).notation });
  } catch {
    self.postMessage({ id, notation: null });
  }
};
