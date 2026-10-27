/**
 * The round plan: each round starts with the bot's orders for every member, Enter fights with them, and the player can
 * change any one member's order first. The orders sent are plain orders, so the server replays them as before.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, type OpenFight, type ServerState } from '../../../shared/clans/actions';
import { botOrders } from '../../../shared/clans/bot';
import { startingDrafts } from '../../../shared/clans/create';
import { newFight, type Order } from '../../../shared/clans/fight';
import type { RecordedRound } from '../../../shared/clans/battleCry';
import { publicFight } from '../../../supabase/functions/clans/handler';
import { Fight } from './Fight';
import { choosingOrder, orderText } from './fightView';
import { newSession } from './session';

const SEED = 4242;

function started(): ServerState {
  const made = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: 20_000 });
  if (!made.ok || !made.state) throw new Error('create failed');
  const go = applyAction(made.state, { type: 'fightStart', depth: 2, boss: false }, { seed: SEED, today: 20_000 });
  if (!go.ok || !go.state) throw new Error('fightStart failed');
  return go.state;
}

/** Render the fight, skip the Battle Cry, and land on the plan. Returns the rounds sent and the fight as it starts. */
async function toPlan() {
  const state = started();
  const open = publicFight(state.fight as OpenFight);
  const sent: RecordedRound[] = [];
  const u = userEvent.setup();
  render(<Fight session={newSession(state.clan, SEED)} open={open} onRound={(_r, played) => sent.push(played)} onFinish={() => {}} />);
  const no = screen.queryByRole('button', { name: 'No thanks' });
  if (no) {
    await u.click(no);
    await u.keyboard('{Enter}'); // "Carry on" has focus
  }
  await screen.findByRole('group', { name: 'The plan for this round' });
  return { u, sent, fight: newFight(state.clan.members, open.depth, open.seed, open.boss) };
}

afterEach(cleanup);

describe('the round plan', () => {
  it("lists every standing member with the bot's order, and Enter fights with exactly those orders", async () => {
    const { u, sent, fight } = await toPlan();
    const expected = botOrders(fight);
    for (const i of choosingOrder(fight)) {
      expect(screen.getByRole('button', { name: `Change ${fight.clan[i].name}: ${orderText(expected[i], fight)}` })).toBeInTheDocument();
    }
    await u.keyboard('{Enter}');
    expect(sent).toHaveLength(1);
    expect(sent[0].orders).toEqual(expected);
  });

  it("changes one member's order with the number key, keeps everyone else on the plan", async () => {
    const { u, sent, fight } = await toPlan();
    const first = choosingOrder(fight)[0];
    await u.keyboard('1');
    expect(screen.getByRole('group', { name: `Orders for ${fight.clan[first].name}` })).toHaveFocus();
    await u.keyboard('g');
    expect(screen.getByRole('button', { name: `Change ${fight.clan[first].name}: Guard` })).toBeInTheDocument();
    await u.keyboard('{Enter}');
    const expected: Order[] = botOrders(fight);
    expected[first] = { action: 'guard' };
    expect(sent[0].orders).toEqual(expected);
  });

  it('Esc leaves an order as it was', async () => {
    const { u, sent, fight } = await toPlan();
    await u.keyboard('2');
    await u.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: 'The plan for this round' })).toHaveFocus();
    await u.click(screen.getByRole('button', { name: /Fight with this plan/ }));
    expect(sent[0].orders).toEqual(botOrders(fight));
  });
});
