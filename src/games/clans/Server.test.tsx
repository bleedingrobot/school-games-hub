import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type ServerState } from '../../../shared/clans/actions';
import { publicState } from '../../../supabase/functions/clans/handler';
import { startingDrafts } from '../../../shared/clans/create';
import { DEFAULT_PRACTICAL_SETTINGS } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import type { ClanServer, ServerReply } from './remote';

const SEED = 4242;
const DAY0 = 20_000;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

function madeState(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: DAY0 });
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}

/** A server in a box: the real rules (applyAction), saved in memory, remembering what it was sent. */
function fakeServer(start: ServerState | null) {
  const box = { saved: start, sent: [] as Action[] };
  const server: ClanServer = {
    async send(action): Promise<ServerReply> {
      box.sent.push(action);
      const out = applyAction(box.saved, action, { seed: SEED, today: DAY0 });
      if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: SEED, state: box.saved && publicOf(box.saved) };
      if (out.changed) box.saved = out.state;
      return { ok: true, replayed: false, seed: SEED, state: out.state && publicOf(out.state), result: out.result };
    },
  };
  return { box, server };
}
const publicOf = (s: ServerState) => structuredClone(publicState(s, S, { news: ['One fight was won in the Mines yesterday.'] }));

describe('Clan Quest with a server', () => {
  it('opens the clan the server has, without the test strip, and the Mines are open', async () => {
    const { server, box } = fakeServer(madeState());
    render(<ClanQuest server={server} />);
    expect(screen.getByText(/Opening your clan/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Red Banner' })).toBeInTheDocument();
    expect(box.sent).toEqual([{ type: 'load' }]);
    expect(screen.queryByText(/Test settings/)).toBeNull();
    expect(screen.getByText('One fight was won in the Mines yesterday.')).toBeInTheDocument();
    await user().click(btn('Go to the Mines'));
    expect(screen.queryByText(/not saved on the server/)).toBeNull();
    expect(btn('Into the Mines!')).toBeEnabled();
  });

  it('asks the server to start a fight, shows it, and uses one of the day\'s fights', async () => {
    const { server, box } = fakeServer(madeState());
    const u = user();
    render(<ClanQuest server={server} />);
    await screen.findByRole('heading', { name: 'Red Banner' });
    await u.click(btn('Go to the Mines'));
    await u.click(btn('Into the Mines!'));
    await waitFor(() => expect(box.saved!.fight).not.toBeNull());
    expect(box.saved!.fightsLeft).toBe(7);
    expect(box.sent.filter((a) => a.type === 'fightStart')).toHaveLength(1);
    expect(await screen.findByRole('group', { name: 'Battle Cry question' })).toBeInTheDocument();
  });
});
