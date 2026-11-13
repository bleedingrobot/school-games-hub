import { expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AwayPanel, usualAway } from './AwayPanel';
import type { AwayPupil } from '../../data/pageAway';

const pupil = (id: string, times: number): AwayPupil => ({
  id, name: `Name ${id}`, realName: id, times, duringQuestion: 0, awaySecs: times * 20, longBreaks: 0, questions: 40, days: 2, topGame: 'marble', lastAt: null,
});

it('shows only pupils who left a lot, everyone on request, and says so when nobody did', async () => {
  render(<AwayPanel classId="c1" load={async () => [pupil('often', 20), pupil('few', 3)]} />);
  expect(await screen.findByText('Name often')).toBeTruthy();
  expect(screen.queryByText('Name few')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show everyone (2)' }));
  expect(screen.getByText('Name few')).toBeTruthy();
  cleanup();

  render(<AwayPanel classId="c1" load={async () => [pupil('few', 3)]} />);
  expect(await screen.findByText(/Nobody left a lot\. 1 pupil left a few times/)).toBeTruthy();
  expect(usualAway({ awaySecs: 120, times: 3 })).toBe('40 s');
  expect(usualAway({ awaySecs: 600, times: 3 })).toBe('3 min');
});
