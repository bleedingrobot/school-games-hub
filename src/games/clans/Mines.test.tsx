/**
 * The Mines screen: it opens at the recommended depth, the depth box can be cleared and typed into (no stuck 0), and
 * Enter goes in.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeClan, startingDrafts } from '../../../shared/clans/create';
import { CONFIG } from '../../../shared/clans/config';
import { Mines, recommendedDepth } from './Mines';
import { newSession } from './session';

afterEach(cleanup);

const clanAt = (level: number) => {
  const clan = makeClan('Red Banner', startingDrafts(4242));
  return { ...clan, members: clan.members.map((m) => ({ ...m, level })) };
};

describe('the Mines', () => {
  it('recommends the deepest "just right" depth, and the bottom once every depth is too easy', () => {
    expect(recommendedDepth(clanAt(1))).toBe(2);
    expect(recommendedDepth(clanAt(10))).toBe(11);
    expect(recommendedDepth(clanAt(40))).toBe(CONFIG.maxLevel);
  });

  it('opens at the recommended depth, lets the box be cleared and typed into, and goes in on Enter', () => {
    const onDepth = vi.fn();
    const onGo = vi.fn();
    const session = { ...newSession(clanAt(10), 1), depth: 0 };
    render(<Mines session={session} onDepth={onDepth} onGo={onGo} onBack={() => {}} />);
    // Depth 0 is too easy for a level 10 clan: it moves to the recommended depth.
    expect(onDepth).toHaveBeenCalledWith(11);
    const box = screen.getByRole('textbox', { name: /Depth/ }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: '' } });
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: '15' } });
    expect(box.value).toBe('15');
    expect(onDepth).toHaveBeenLastCalledWith(15);
    fireEvent.change(box, { target: { value: '99' } });
    expect(onDepth).toHaveBeenLastCalledWith(CONFIG.maxLevel);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onGo).toHaveBeenCalledWith(false);
  });
});
