import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { itemByName, shopPrice } from '../../../shared/clans/character';
import { CONFIG } from '../../../shared/clans/config';
import { marketTotal } from '../../../shared/clans/moments';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalQuestion } from '../../../shared/maths/practical';
import { ClanQuest } from './ClanQuest';
import { makeClan, newSession, startingDrafts } from './session';

const SEED = 12345;
const S = DEFAULT_PRACTICAL_SETTINGS;
const user = () => userEvent.setup();
const item = (name: string) => itemByName(name)!;

async function answer(u: ReturnType<typeof user>, q: PracticalQuestion, value: number) {
  const choice = q.choices?.find((c) => c.value === value);
  if (choice) return u.click(screen.getByRole('button', { name: choice.label }));
  await u.keyboard(String(value));
  await u.keyboard('{Enter}');
}
const wrongFor = (q: PracticalQuestion) => (q.choices ? q.choices.find((c) => c.value !== q.answer)!.value : q.answer + 7);

describe('the Market', () => {
  it('a wrong answer still charges the right price, and the member gets the item', async () => {
    const u = user();
    render(<ClanQuest seed={SEED} initial={newSession(makeClan('Test Clan', startingDrafts(SEED)), SEED)} />);
    await u.click(screen.getByRole('button', { name: 'The Market' }));
    await u.click(screen.getByRole('button', { name: /^Dagger/ }));
    await u.click(screen.getByRole('button', { name: /^Buy for/ }));
    const q = marketTotal(S, item('Dagger').price, CONFIG.shopTax, 'Dagger')!;
    expect(screen.getByText(q.text)).toBeInTheDocument();
    expect(q.text).toMatch(/^The Dagger costs 20 gold/);
    await answer(u, q, wrongFor(q));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(q.working[0])).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: `Pay ${shopPrice(item('Dagger'))} gold` }));
    expect(screen.getByText(new RegExp(`You paid 22 gold, and have ${CONFIG.startGold - 22} left`))).toBeInTheDocument();
    expect(shopPrice(item('Dagger'))).toBe(22);
  });
});
