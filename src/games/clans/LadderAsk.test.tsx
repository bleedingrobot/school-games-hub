/**
 * The shop, quest and siege questions in the browser: LadderAsk asks the server (here the real rules, `applyAction`,
 * kept in memory), shows each question in the hub's question box, and the server's marks decide the prize.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAction, type Action, type Context, type ServerState } from '../../../shared/clans/actions';
import { startingDrafts } from '../../../shared/clans/create';
import { parseFocus } from '../../../shared/maths/focus';
import { markQuestion, type MathsContext } from '../../../shared/maths/serverQuestions';
import { LadderAsk } from './LadderAsk';
import type { ServerReply } from './remote';

afterEach(cleanup);

const MATHS: MathsContext = { facts: [], settings: { enabledTables: [2, 5, 10], multipleChoice: false }, focus: parseFocus(null) };
const ctx: Context = { seed: 4242, today: 20000, maths: MATHS };

/** A server in memory: the real rules, and the state they keep (with the answers the browser never sees). */
function fakeServer() {
  const made = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(4242) }, ctx);
  if (!made.ok || !made.state) throw new Error('create failed');
  let state: ServerState = made.state;
  const send = async (action: Action): Promise<ServerReply> => {
    const out = applyAction(state, action, ctx);
    if (!out.ok) return { ok: false, why: out.why, say: out.say, seed: 4242, state: null };
    if (out.state) state = out.state;
    return { ok: true, replayed: false, seed: 4242, state: null, result: out.result };
  };
  return { send, get: () => state };
}

describe('LadderAsk', () => {
  it('asks the quest’s two questions, marks each on the server, and says both were right', async () => {
    const server = fakeServer();
    const done = vi.fn();
    render(<LadderAsk kind="quest" title="The quest" ask={server.send} onDone={done} onSkip={() => {}} />);
    for (const slot of [0, 1]) {
      await screen.findByText(new RegExp(`The quest \\(${slot + 1} of 2\\)`));
      const q = server.get().ask!.questions[slot];
      const right = markQuestion(q)!.answer;
      if (q.choices) {
        const buttons = screen.getByRole('group', { name: 'Choose an answer' }).querySelectorAll('button');
        await userEvent.click(buttons[q.choices.indexOf(right)]);
      } else {
        await userEvent.keyboard(`${right}{Enter}`);
      }
      await waitFor(() => expect(server.get().ask!.marks?.[slot]?.correct).toBe(true));
    }
    await waitFor(() => expect(done).toHaveBeenCalledWith([true, true]), { timeout: 4000 });
  });

  it('carries on without questions when the server cannot make them', async () => {
    const skip = vi.fn();
    const send = async (): Promise<ServerReply> => ({ ok: false, why: 'no-maths', say: "We couldn't get your maths questions just now.", seed: 1, state: null });
    render(<LadderAsk kind="shop" title="10% off" ask={send} onDone={() => {}} onSkip={skip} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Carry on without it' }));
    expect(skip).toHaveBeenCalled();
  });
});
