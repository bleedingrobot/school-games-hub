import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstTimeTip, HearAgain, PointingHand, WhatsNext, pointedLabel, useGuidedFirstGo } from '.';

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
});
