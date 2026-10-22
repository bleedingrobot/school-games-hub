import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendlyError } from '../data/profile';
import * as skillMap from '../data/skillMap';
import { FocusResults } from './FocusResults';

vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchFocusResults: vi.fn(),
}));

const results = (over: Partial<skillMap.FocusResults> = {}): skillMap.FocusResults => ({
  since: new Date('2026-10-01T00:00:00Z'),
  students: [
    { id: 's1', name: 'Speedy Otter 27', realName: 'ana', answers: 12, correct: 9, quick: 4 },
    { id: 's2', name: 'Brave Kiwi 7', realName: 'ben', answers: 0, correct: 0, quick: 0 },
    { id: 's3', name: 'Calm Fern 3', realName: 'cam', answers: 3, correct: 3, quick: 3 },
  ],
  total: { answers: 15, correct: 12, quick: 7 },
  ...over,
});

const show = (props: Partial<React.ComponentProps<typeof FocusResults>> = {}) =>
  render(<FocusResults batch="b1" startsAt="2026-10-12T00:00:00Z" endsAt="2026-10-16T11:00:00Z" running={false} {...props} />);

beforeEach(() => {
  vi.mocked(skillMap.fetchFocusResults).mockReset();
  vi.mocked(skillMap.fetchFocusResults).mockResolvedValue(results());
});

describe('how a focus went', () => {
  it('asks nothing until it is opened', () => {
    show();
    expect(skillMap.fetchFocusResults).not.toHaveBeenCalled();
  });

  it('shows each student\'s answers, right and quick, and a class total', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    const table = await screen.findByRole('table');
    expect(skillMap.fetchFocusResults).toHaveBeenCalledWith('b1');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Student', 'Answers', 'Right', 'Quick']);
    const row = within(table).getByRole('row', { name: /Speedy Otter 27/ });
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['12', '9', '4']);
    const total = within(table).getByRole('row', { name: /Class total/ });
    expect(within(total).getAllByRole('cell').map((c) => c.textContent)).toEqual(['15', '12', '7']);
  });

  it('lists a student who did none as "none", not hidden', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Brave Kiwi 7/ });
    expect(row).toHaveTextContent('none');
    expect(within(row).queryByText('0')).toBeNull();
  });

  it('says "so far" while the focus is running', () => {
    show({ running: true });
    expect(screen.getByText('How they are doing so far')).toBeInTheDocument();
  });

  it('says a focus that ended before counting began has nothing to show, instead of showing zeros', async () => {
    vi.mocked(skillMap.fetchFocusResults).mockResolvedValue(results({ since: new Date('2026-10-20T00:00:00Z') }));
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    expect(await screen.findByText(/ended before results were counted/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says so when counting began part-way through the focus', async () => {
    vi.mocked(skillMap.fetchFocusResults).mockResolvedValue(results({ since: new Date('2026-10-14T00:00:00Z') }));
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    expect(await screen.findByText(/Results are counted from .*so answers before then are not in this table/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('says so when there are no students', async () => {
    vi.mocked(skillMap.fetchFocusResults).mockResolvedValue(results({ students: [] }));
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    expect(await screen.findByText('No students to show.')).toBeInTheDocument();
  });

  it('shows the database\'s message when it cannot be read', async () => {
    vi.mocked(skillMap.fetchFocusResults).mockRejectedValue(new FriendlyError('That isn’t one of your classes.'));
    const user = userEvent.setup();
    show();
    await user.click(screen.getByText('How they did'));
    expect(await screen.findByRole('alert')).toHaveTextContent('That isn’t one of your classes.');
  });

  it('looks again each time it is opened, so a running focus stays up to date', async () => {
    const user = userEvent.setup();
    show({ running: true });
    await user.click(screen.getByText('How they are doing so far'));
    await screen.findByRole('table');
    await user.click(screen.getByText('How they are doing so far'));
    await user.click(screen.getByText('How they are doing so far'));
    expect(skillMap.fetchFocusResults).toHaveBeenCalledTimes(2);
  });
});
