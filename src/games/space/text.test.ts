import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, newGame } from '../../../shared/space/engine';
import { DESIGNED_BOARDS } from '../../../shared/space/boards';
import { bannerFor, nextCosmicRound, squareInfo } from './text';

describe('words for the space game', () => {
  it('gives every cosmic event a banner that says what it does', () => {
    expect(bannerFor({ kind: 'cosmic', event: 'solar-wind' })).toMatchObject({ title: 'Solar wind!', text: /\+1/ });
    expect(bannerFor({ kind: 'cosmic', event: 'meteor-shower', squares: [12, 40] })?.text).toMatch(/costs an item/);
    expect(bannerFor({ kind: 'cosmic', event: 'meteor-shower', squares: [] })?.text).toMatch(/missed/);
    expect(bannerFor({ kind: 'cosmic', event: 'wormhole-shift', wormhole: 8, from: 30, to: 33 })?.text).toBe(
      'The wormhole on 8 now goes to 33.',
    );
    expect(bannerFor({ kind: 'cosmic', event: 'wormhole-shift', wormhole: 8, from: 30, to: 30 })?.text).toMatch(/held steady/);
    expect(bannerFor({ kind: 'fuel-warning', roundsLeft: 5 })?.title).toBe('5 rounds of fuel left!');
    expect(bannerFor({ kind: 'dice', seat: 0, dice: [3] })).toBeNull();
  });

  it('counts down to the next cosmic event (rounds 6, 11, 16…)', () => {
    const { state } = newGame(DESIGNED_BOARDS['deep-space'], { ...DEFAULT_SETTINGS, cosmicEvents: true }, 4);
    expect(state.settings.cosmicEvents).toBe(true);
    const at = (round: number) => nextCosmicRound({ ...state, round });
    expect([1, 5, 6, 7, 10, 11].map(at)).toEqual([6, 6, 11, 11, 11, 16]);
    expect(nextCosmicRound({ ...state, settings: { ...state.settings, cosmicEvents: false } })).toBeNull();
  });

  it('adds a space fact to squares that have one', () => {
    const { state } = newGame(DESIGNED_BOARDS.nebula, DEFAULT_SETTINGS, 2);
    expect(squareInfo(state, 1, []).fact).toMatch(/third planet/);
    const star = Object.entries(state.board.squares).find(([, sq]) => sq.kind === 'star')!;
    expect(squareInfo(state, Number(star[0]), []).fact).toBeTruthy();
    const gate = Object.entries(state.board.squares).find(([, sq]) => sq.kind === 'gate')!;
    expect(squareInfo(state, Number(gate[0]), []).fact).toBeUndefined();
  });
});
