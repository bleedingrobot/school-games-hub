import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { Y78_GROUPS } from '../../shared/maths/skillPacks/y78';
import { Year78Taught } from './Year78';

const data = vi.hoisted(() => ({ fetchLadderTaught: vi.fn(), setLadderTaught: vi.fn() }));
vi.mock('../data/years', async (original) => ({
  ...(await original<typeof import('../data/years')>()),
  fetchLadderTaught: data.fetchLadderTaught,
  setLadderTaught: data.setLadderTaught,
}));
vi.mock('./TeacherClass', () => ({ useTeacherClass: () => ({ classId: 'class-1', ready: true }) }));

it('shows a Taught switch for every Year 7-8 skill, off unless the class has it, and saves each change and each group', async () => {
  data.fetchLadderTaught.mockResolvedValue(new Set(['int-compare']));
  data.setLadderTaught.mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <Year78Taught />
    </MemoryRouter>,
  );
  const compare = await screen.findByRole('checkbox', { name: 'Negative numbers in order taught' });
  expect(compare).toBeChecked();
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes).toHaveLength(Y78_GROUPS.flatMap((g) => g.skills).length);
  expect(boxes.filter((b) => (b as HTMLInputElement).checked)).toHaveLength(1);
  expect(data.fetchLadderTaught).toHaveBeenCalledWith('class-1');

  // One skill on.
  await userEvent.click(screen.getByRole('checkbox', { name: 'Adding and taking away across zero taught' }));
  expect(data.setLadderTaught).toHaveBeenLastCalledWith('class-1', ['int-add-sub'], true);
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Adding and taking away across zero taught' })).toBeChecked());

  // A whole group on.
  const algebra = screen.getByRole('region', { name: 'Algebra' });
  await userEvent.click(within(algebra).getByRole('button', { name: 'All on' }));
  const ids = Y78_GROUPS.find((g) => g.name === 'Algebra')!.skills.map((s) => s.id);
  expect(data.setLadderTaught).toHaveBeenLastCalledWith('class-1', ids, true);
  await waitFor(() => within(algebra).getAllByRole('checkbox').forEach((b) => expect(b).toBeChecked()));
  expect(within(algebra).getByRole('button', { name: 'All off' })).toBeInTheDocument();
});
