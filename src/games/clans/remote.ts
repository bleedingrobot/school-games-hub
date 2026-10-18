/**
 * The thin layer between the screens and the `clans` server function. The screens still work out each change in
 * the browser (so the test page works with no server at all); when there is a server, every change is also sent
 * to it as an action, and whatever it answers replaces the browser's copy. The server is the boss.
 */
import type { Action, OpenFight, Result } from '../../../shared/clans/actions';
import type { Clan } from '../../../shared/clans/types';
import type { VillageView } from '../../../shared/clans/village';
import type { PracticalSettings } from '../../../shared/maths/practical';
import type { Session } from './session';

/** The clan as the server describes it (the same as `publicState` in the server function). */
export interface ServerClan {
  clan: Clan;
  seed: number;
  day: number;
  fightsLeft: number;
  fightNo: number;
  raidNo: number;
  examined: string[];
  /** The mine fight in progress, if any (a refresh shows it again). */
  fight: OpenFight | null;
  settings: PracticalSettings;
  /** The latest village news lines, written by the computer. */
  news: string[];
  /** The class village: chest, building levels, this week's votes. */
  village: VillageView | null;
  /** The teacher's switch for raids on classmates. */
  raidsOn: boolean;
  /** What raiders did to this clan lately. */
  notes: string[];
}

export type ServerReply =
  | { ok: true; replayed: boolean; seed: number; state: ServerClan | null; result: Result }
  | { ok: false; why: string; say: string; seed: number; state: ServerClan | null };

/** Sends one action and gives the server's answer. Rejects if the server cannot be reached. */
export interface ClanServer {
  send(action: Action): Promise<ServerReply>;
}

/** The session the screens use, made from what the server says. What only the browser knows (the mine depth) is kept. */
export function sessionFrom(state: ServerClan, previous?: Session | null): Session {
  return {
    clan: state.clan, baseSeed: state.seed, day: state.day, fightsLeft: state.fightsLeft, fightNo: state.fightNo, raidNo: state.raidNo,
    examined: state.examined, settings: state.settings, depth: previous?.depth ?? 0, fight: state.fight, news: state.news,
    village: state.village, notes: state.notes, raidsOn: state.raidsOn,
  };
}

export interface ServerOptions {
  url: string;
  /** The signed-in student's token, or null if they are signed out. */
  token(): Promise<string | null>;
  apikey: string;
  fetch?: typeof fetch;
  /** How many times a request is sent again (with the same id, so it can never be paid twice) if the connection drops. */
  retries?: number;
  newId?(): string;
}

/** Talks to the live `clans` function. Each action gets its own request id, kept across retries. */
export function makeClanServer(options: ServerOptions): ClanServer {
  const doFetch = options.fetch ?? fetch;
  const retries = options.retries ?? 2;
  const newId = options.newId ?? (() => crypto.randomUUID());
  return {
    async send(action) {
      const requestId = newId();
      let lastError: unknown = new Error('The clan server could not be reached.');
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const token = await options.token();
          if (!token) throw new Error('Please sign in again.');
          const response = await doFetch(options.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, apikey: options.apikey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, action }),
          });
          // A busy or broken server (5xx) or a busy clan (409) is worth another go; a bad request or being signed out is not.
          if (response.status >= 500 || response.status === 409) throw new Error(`The clan server said ${response.status}.`);
          // The teacher has Clan Quest switched off.
          if (response.status === 403) throw Object.assign(new Error('Clan Quest is not switched on yet.'), { final: true, off: true });
          if (!response.ok) throw Object.assign(new Error(`The clan server said ${response.status}.`), { final: true });
          return (await response.json()) as ServerReply;
        } catch (error) {
          lastError = error;
          if ((error as { final?: boolean }).final) break;
        }
      }
      throw lastError;
    },
  };
}
