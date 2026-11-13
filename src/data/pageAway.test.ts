import { expect, it } from 'vitest';
import { createAwayWatcher, isOften, type AwayNote } from './pageAway';

it('notes times away of 3 s or more on play pages only (tab or window, question showing), and marks pupils who leave a lot', () => {
  let t = 0;
  let game = 'marble';
  const notes: AwayNote[] = [];
  const w = createAwayWatcher({ now: () => t, wallClock: () => 1_000_000 + t, game: () => game, spot: () => 'Pit stop', onNote: (n) => notes.push(n) });
  // A blip is not noted.
  w.left(false);
  t += 1500;
  w.back();
  expect(notes).toEqual([]);
  // A blur then a hide is one tab switch, from when they left.
  w.left(false);
  w.left(true);
  t += 8000;
  w.back();
  w.back();
  expect(notes).toEqual([{ game: 'marble', spot: 'Pit stop', kind: 'tab', ms: 8000, at: 1_001_500 }]);
  // Another window clicked is a window; one that never came back is forgotten.
  w.left(false);
  t += 5000;
  w.back();
  expect(notes[1].kind).toBe('window');
  w.left(true);
  w.forget();
  t += 60_000;
  w.back();
  // A teacher page is not watched.
  game = 'teacher';
  w.left(true);
  t += 9000;
  w.back();
  expect(notes).toHaveLength(2);

  expect(isOften({ times: 14, duringQuestion: 5 })).toBe(false);
  expect(isOften({ times: 15, duringQuestion: 0 })).toBe(true);
  expect(isOften({ times: 6, duringQuestion: 6 })).toBe(true);
});
