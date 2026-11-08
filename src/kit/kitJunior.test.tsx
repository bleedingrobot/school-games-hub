import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstTimeTip, HearAgain, PointingHand, WhatsNext, pointedLabel, useGuidedFirstGo, useKindDemo, useSeenKinds } from '.';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('kit junior bits', () => {
  it('draw the game’s own words and class prefix, with no words of their own', () => {
    expect(renderToStaticMarkup(<HearAgain prefix="zz" label="Again please" onHear={() => {}} />)).toBe('<button type="button" class="zz-button"><span aria-hidden="true">👂</span> Again please</button>');
    expect(renderToStaticMarkup(<PointingHand prefix="zz" className="zz-extra" />)).toBe('<span class="zz-hand zz-extra" aria-hidden="true">👆</span>');
    expect(pointedLabel(4, true, 'look here')).toBe('4, look here');
    expect(pointedLabel(4, false, 'look here')).toBe('4');
  });

  it('the first-go hand waits, then points, and a go that is not the first never points', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useGuidedFirstGo(true, 2600));
    act(() => first.result.current.start());
    act(() => void vi.advanceTimersByTime(2599));
    expect(first.result.current.pointing).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(first.result.current.pointing).toBe(true);
    act(() => first.result.current.stop());
    expect(first.result.current.pointing).toBe(false);
    const later = renderHook(() => useGuidedFirstGo(false, 10));
    act(() => later.result.current.start());
    act(() => void vi.advanceTimersByTime(100));
    expect(later.result.current.pointing).toBe(false);
  });

  it('the what’s-next panel reads once and moves on; the tip steps through and Escape closes it', async () => {
    const say = vi.fn();
    const onNext = vi.fn();
    render(<WhatsNext prefix="zz" title="Well done!" spoken="Well done! Next time: harder." note="Next time: harder." buttonLabel="OK" say={say} onNext={onNext} />);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith('Well done! Next time: harder.');
    expect(document.activeElement?.textContent).toBe('Well done!');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    cleanup();

    const onClose = vi.fn();
    const tip = (n: number) => <FirstTimeTip prefix="zz" who="Pip" say="Tap a card." n={n} of={2} nextLabel="Next" lastLabel="Got it" closeLabel="Close the tip" onNext={() => {}} onClose={onClose} />;
    const view = render(tip(0));
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    view.rerender(tip(1));
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('seen kinds show at once, and a failed save is kept and sent with the next mark', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSeenKinds(['swap'], save));
    expect(result.current.has('swap')).toBe(true);
    expect(result.current.has('zoom')).toBe(false);
    await act(async () => void (await result.current.mark(['zoom'])));
    expect(result.current.has('zoom')).toBe(true);
    await act(async () => void (await result.current.mark(['pairs'])));
    expect(save).toHaveBeenNthCalledWith(1, ['zoom']);
    expect(save).toHaveBeenNthCalledWith(2, ['zoom', 'pairs']);
    await act(async () => void (await result.current.mark(['zoom'])));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('a kind demo says its steps, offers Skip after 3 seconds, marks the kind once, and never starts for a seen kind', () => {
    vi.useFakeTimers();
    const say = vi.fn((_t: string, end?: () => void) => end?.());
    const slowSay = vi.fn();
    const mark = vi.fn();
    const steps = [{ line: 'Watch.' }, { line: 'Now you try.', holdMs: 100 }];
    const demo = renderHook(() => useKindDemo({ kind: 'zoom', seen: { has: () => false }, mark, steps, say: slowSay }));
    expect(demo.result.current.playing).toBe(true);
    expect(slowSay).toHaveBeenCalledWith('Watch.', expect.any(Function));
    act(() => void vi.advanceTimersByTime(2999));
    expect(demo.result.current.canSkip).toBe(false);
    expect(mark).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(demo.result.current.canSkip).toBe(true);
    act(() => demo.result.current.skip());
    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith(['zoom']);
    expect(demo.result.current.playing).toBe(false);
    act(() => void vi.advanceTimersByTime(30000));
    expect(mark).toHaveBeenCalledTimes(1);
    const ends = renderHook(() => useKindDemo({ kind: 'swap', seen: { has: () => false }, mark, steps, say }));
    act(() => void vi.advanceTimersByTime(900 + 100));
    expect(ends.result.current.playing).toBe(false);
    expect(mark).toHaveBeenLastCalledWith(['swap']);
    expect(mark).toHaveBeenCalledTimes(2);
    const old = renderHook(() => useKindDemo({ kind: 'zoom', seen: { has: () => true }, mark, steps, say }));
    expect(old.result.current.playing).toBe(false);
  });
});
