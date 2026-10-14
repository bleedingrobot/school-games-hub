/**
 * Talks to Stockfish using UCI, the plain-text language chess engines speak.
 * In the browser, Stockfish runs in a Web Worker so the page never freezes while it thinks.
 * Its files live in public/stockfish/ and are served from this website, not another one.
 */
import type { ChessEngine, EngineSettings } from './bot';

/** Something we can send UCI commands to, which calls `onLine` with each reply. */
export interface UciChannel {
  send(command: string): void;
  onLine: ((line: string) => void) | null;
  close(): void;
}

export class UciEngine implements ChessEngine {
  private queue: Promise<unknown> = Promise.resolve();
  private waiting: ((line: string) => void) | null = null;
  private ready: Promise<void>;

  constructor(private channel: UciChannel) {
    channel.onLine = (line) => this.waiting?.(line);
    this.ready = this.request('uci', (line) => line === 'uciok').then(() => undefined);
  }

  /** Sends a command and resolves with the first reply line that `done` accepts. */
  private request(command: string, done: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      this.waiting = (line) => {
        if (done(line)) {
          this.waiting = null;
          resolve(line);
        }
      };
      this.channel.send(command);
    });
  }

  /** One search at a time: later calls wait their turn. */
  bestMove(fen: string, settings: EngineSettings): Promise<string | null> {
    const run = async () => {
      await this.ready;
      this.channel.send(`setoption name Skill Level value ${settings.skill}`);
      this.channel.send(`position fen ${fen}`);
      const line = await this.request(`go depth ${settings.depth}`, (l) => l.startsWith('bestmove'));
      const move = line.split(/\s+/)[1];
      return move && move !== '(none)' ? move : null;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  newGame() {
    this.channel.send('ucinewgame');
  }

  close() {
    this.channel.close();
  }
}

/** Starts Stockfish in a Web Worker. Returns null if this browser can't run it. */
export function startBrowserStockfish(): UciEngine | null {
  try {
    const url = new URL('stockfish/stockfish-19-lite-single.js', document.baseURI);
    const worker = new Worker(url);
    const channel: UciChannel = {
      send: (command) => worker.postMessage(command),
      onLine: null,
      close: () => worker.terminate(),
    };
    worker.onmessage = (event: MessageEvent) => channel.onLine?.(String(event.data));
    return new UciEngine(channel);
  } catch {
    return null;
  }
}
