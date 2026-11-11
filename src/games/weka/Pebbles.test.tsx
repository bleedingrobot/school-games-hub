import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Go } from '../../../shared/weka/round';
import { allVoiceLines } from './voiceLines';
import { Pebbles } from './Pebbles';

/** 8 + 5: two pebbles make ten, three stay. */
const go = { kind: 'add', small: 5, big: 8, total: 13, toTen: 2, rest: 3, from: 8, answer: 13 } as unknown as Go;

function setup() {
  const say = vi.fn();
  const onFirstWrong = vi.fn();
  const onNext = vi.fn();
  render(<Pebbles go={go} sound={false} last={false} say={say} onFirstWrong={onFirstWrong} onNext={onNext} />);
  const move = (n: number) => { for (let i = 0; i < n; i++) fireEvent.click(document.querySelector('.wk-pebble--move')!, { detail: 0 }); };
  const check = () => userEvent.click(screen.getByRole('button', { name: 'Check' }));
  return { say, onFirstWrong, move, check };
}

describe('Weka pebbles: the child decides', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('says too few, then too many, tells the game it was not right first time once, and after two wrong checks moves the right number across', async () => {
    const { say, onFirstWrong, move, check } = setup();
    move(1);
    await check();
    expect(say).toHaveBeenLastCalledWith('Not full yet. 1 more space.');
    expect(onFirstWrong).toHaveBeenCalledTimes(1);
    expect(lines().has('Not full yet. 1 more space.')).toBe(true);
    move(2);
    expect(document.querySelectorAll('.wk-pebble--move')).toHaveLength(2);
    // Three across is too many, and it is the second wrong check, so the right number is shown.
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(say).toHaveBeenLastCalledWith('Let me show you. 10 is full. 2 gone, 3 left. 8 and 2 make 10. 10 and 3 make 13.');
    expect(document.querySelectorAll('.wk-pebble--move')).toHaveLength(3);
    expect(onFirstWrong).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
  });

});

const lines = () => new Set(allVoiceLines());
