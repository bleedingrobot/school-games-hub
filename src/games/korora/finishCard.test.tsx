import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRound, showRound, type Round } from '../../../shared/korora/round';
import type { KororaFinish } from './backend';
import { Goes } from './Goes';
import { Finish } from './KororaGame';
import { finishLine } from './voiceLines';
import { WORDS } from './words';

const weka = vi.hoisted(() => ({ on: vi.fn() }));
vi.mock('../../data/weka', () => ({ fetchWekaEnabled: () => weka.on() }));

afterEach(cleanup);
beforeEach(() => weka.on.mockReset());

const result = (over: Partial<KororaFinish> = {}): KororaFinish => ({
  daysDone: 4, lastPebbleDay: '2026-11-07', pebbleChanged: 3, goldenFish: false, shoesWon: null, level: 5, levelBefore: 5, topSecure: true, ...over,
});
const main = WORDS.pebbleTurned('bronze');

describe('the finish screen’s what’s next card (R8)', () => {
  it('shows the card once near doubles are secure and Weka is on, reads it after the finish line, and opens Weka', async () => {
    weka.on.mockResolvedValue(true);
    const say = vi.fn((_text: string, onEnd?: () => void) => onEnd?.());
    const onOpenWeka = vi.fn();
    render(<Finish result={result()} say={say} onOpenWeka={onOpenWeka} onNext={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: WORDS.tryWeka }));
    expect(screen.getByText(WORDS.whatsNext)).toBeTruthy();
    expect(say.mock.calls.map((c) => c[0])).toEqual([finishLine(main, null), WORDS.whatsNext]);
    expect(onOpenWeka).toHaveBeenCalledTimes(1);
  });

  it('shows no card until near doubles are secure, and none when Weka is off for the class', async () => {
    const say = vi.fn();
    render(<Finish result={result({ topSecure: false })} say={say} onOpenWeka={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByRole('button', { name: WORDS.tryWeka })).toBeNull();
    expect(weka.on).not.toHaveBeenCalled();
    cleanup();
    weka.on.mockResolvedValue(false);
    render(<Finish result={result()} say={say} onOpenWeka={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByRole('button', { name: WORDS.tryWeka })).toBeNull();
  });
});

describe('a near double on screen', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('shows the double with one extra fish, teaches a slip with its own line, and still lets the right tap through', () => {
    const base = makeRound(5, [], { gold: false });
    const keys = ['add:5+6', 'add:6+7', 'add:7+8', 'add:8+9'];
    const round: Round = { ...base, level: 5, goes: base.goes.map((_g, i) => ({ key: keys[i % 4], v: 0, h: 'full' })) };
    const go = showRound(round)[0];
    render(<Goes round={round} help="full" say={vi.fn()} scenery="bronze" friend="korora" sound={false} onDone={vi.fn()} />);
    expect(document.querySelectorAll('.kr-fish--extra')).toHaveLength(1);
    expect(document.querySelectorAll('.kr-rock .kr-fish')).toHaveLength(go.n);
    const choices = within(screen.getByRole('group', { name: WORDS.pickNumber }));
    const noExtra = go.wrongs.find((w) => w.kind === 'noExtra')!;
    fireEvent.click(choices.getByRole('button', { name: String(noExtra.n) }));
    expect(screen.getByText(WORDS.why.noExtra)).toBeTruthy();
    fireEvent.click(choices.getByRole('button', { name: String(go.answer) }));
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.getByText(/6 \+ 7/)).toBeTruthy();
  });
});
