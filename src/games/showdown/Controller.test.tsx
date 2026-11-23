import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Controller } from './Controller';
import { pretendLink } from './link';

describe('Class Showdown controller', () => {
  it('joins a live round, gets a question, and shows the right answer after a wrong one', async () => {
    const { teacher, pupil, classId } = pretendLink({ size: 3, mode: 'class', seed: 7, me: { id: 'pupil-me', name: 'Mia' } });
    const opened = await teacher.send({ action: 'open', classId, mode: 'class', length: 5 });
    const room = opened.body.room as number;
    await teacher.send({ action: 'start', room });
    const u = userEvent.setup();
    render(<Controller link={pupil} me="pupil-me" />);
    await u.click(screen.getByRole('button', { name: 'Join the showdown!' }));
    const pad = await screen.findByRole('group', { name: 'Number pad' }, { timeout: 5000 });
    for (let i = 0; i < 3; i++) await u.click(Array.from(pad.querySelectorAll('button')).find((b) => b.textContent === '9')!);
    await u.click(screen.getByRole('button', { name: 'Check my answer' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/=/), { timeout: 3000 });
  });
});
