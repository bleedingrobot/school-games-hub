/**
 * The Mines screen: it opens at the recommended depth, the depth box can be cleared and typed into (no stuck 0), and
 * Enter goes in.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeClan, startingDrafts } from '../../../shared/clans/create';
import { CONFIG } from '../../../shared/clans/config';
import { Mines, Results, recommendedDepth } from './Mines';
import { newSession, type FightSummary } from './session';

afterEach(() => { cleanup(); localStorage.clear(); });

const clanAt = (level: number) => {
  const clan = makeClan('Red Banner', startingDrafts(4242));
  return { ...clan, members: clan.members.map((m) => ({ ...m, level })) };
};

describe('the Mines', () => {
  it('recommends the deepest "just right" depth, opens there, lets the box be cleared and typed into, goes in on Enter, keeps the last chosen depth; after the fight M and C go back', () => {
    expect(recommendedDepth(clanAt(1))).toBe(2);
    expect(recommendedDepth(clanAt(10))).toBe(11);
    expect(recommendedDepth(clanAt(40))).toBe(CONFIG.maxLevel);
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
    cleanup();
    localStorage.clear();
    // It stays at the depth the pupil last chose, even after a fight when that is no longer the recommended one.
    onDepth.mockClear();
    const later = { ...newSession(clanAt(10), 1), depth: 11 };
    render(<Mines session={later} onDepth={onDepth} onGo={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go deeper' }));
    expect(onDepth).toHaveBeenLastCalledWith(12);
    cleanup();
    // Back from the fight the session may say any depth (and 12 may now be "too hard"): the saved 12 wins.
    const back = vi.fn();
    render(<Mines session={{ ...later, depth: 0 }} onDepth={back} onGo={() => {}} onBack={() => {}} />);
    expect(back).toHaveBeenCalledWith(12);
    expect(screen.getByRole('button', { name: /Recommended: 11/ })).toBeTruthy();
    cleanup();
    // After the fight: M goes back to the Mines, C back to the clan.
    const onMines = vi.fn();
    const onDone = vi.fn();
    const summary = { result: 'won', gold: 10, followers: 0, xp: [1, 1, 1, 1], levels: [0, 0, 0, 0] } as unknown as FightSummary;
    render(<Results summary={summary} members={session.clan.members} onDone={onDone} onMines={onMines} />);
    fireEvent.keyDown(window, { key: 'm' });
    expect(onMines).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'C' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
