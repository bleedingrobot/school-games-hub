import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameDefinition, HardestRow } from '../games/types';

const picked = vi.hoisted(() => ({ classId: 'c1' as string | null }));
vi.mock('./TeacherClass', () => ({
  useTeacherClass: () => ({ classId: picked.classId, current: picked.classId ? { id: picked.classId, name: 'Room 12' } : null, ready: true }),
}));

import { HardestQuestions, mergeHardest, percentRight } from './Hardest';

const row = (question: string, correct: number, attempts: number, extra: Partial<HardestRow> = {}): HardestRow => ({
  question,
  topic: 'Times tables',
  attempts,
  correct,
  students: 3,
  ...extra,
});
const fake = (id: string, name: string, hardest?: () => Promise<HardestRow[]>) =>
  ({ id, name, teacher: hardest ? { hardest } : {} }) as unknown as GameDefinition;

beforeEach(() => {
  picked.classId = 'c1';
});

describe('mergeHardest', () => {
  it('puts the lowest share right first, and the most asked first on a tie', () => {
    const a = fake('a', 'A');
    const b = fake('b', 'B');
    const out = mergeHardest([
      { game: a, rows: [row('easy', 9, 10), row('tie few', 1, 4)] },
      { game: b, rows: [row('hardest', 0, 2), row('tie many', 5, 20)] },
    ]);
    expect(out.map((r) => r.question)).toEqual(['hardest', 'tie many', 'tie few', 'easy']);
    expect(out[0]).toMatchObject({ game: 'b', gameName: 'B' });
  });

  it('treats no attempts as fully right (last)', () => {
    const out = mergeHardest([{ game: fake('a', 'A'), rows: [row('none', 0, 0), row('some', 5, 10)] }]);
    expect(out.map((r) => r.question)).toEqual(['some', 'none']);
  });
});

describe('percentRight', () => {
  it('rounds, and shows a dash for no attempts', () => {
    expect(percentRight(row('q', 1, 3))).toBe('33%');
    expect(percentRight(row('q', 0, 0))).toBe('–');
  });
});

describe('HardestQuestions', () => {
  const games = () => [
    fake('monsters', 'Maths Monsters', async () => [row('7 × 8', 2, 10)]),
    fake('gem-keep', 'Gem Keep', async () => [row('6 × 6', 6, 10, { topic: null })]),
    fake('none', 'No Hardest'),
  ];

  it('shows rows with their game names, hardest first', async () => {
    const list = games();
    render(<HardestQuestions games={list} />);
    expect(await screen.findByRole('heading', { name: 'Hardest questions in Room 12' })).toBeInTheDocument();
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('7 × 8Maths MonstersTimes tables20%103');
    expect(rows[1]).toHaveTextContent('6 × 6Gem Keep–60%103');
  });

  it('narrows rows with the game filter', async () => {
    const user = userEvent.setup();
    const list = games();
    render(<HardestQuestions games={list} />);
    await screen.findByText('7 × 8');
    await user.selectOptions(screen.getByRole('combobox', { name: /Game/ }), 'gem-keep');
    const table = screen.getByRole('table');
    expect(within(table).queryByText('7 × 8')).not.toBeInTheDocument();
    expect(within(table).getByText('6 × 6')).toBeInTheDocument();
  });

  it('says which game could not load, and still shows the others', async () => {
    const list = [fake('monsters', 'Maths Monsters', async () => { throw new Error('x'); }), games()[1]];
    render(<HardestQuestions games={list} />);
    expect(await screen.findByText(/Couldn’t load Maths Monsters/)).toBeInTheDocument();
    expect(screen.getByText('6 × 6')).toBeInTheDocument();
  });

  it('says there is not enough when no game has rows', async () => {
    const list = [fake('monsters', 'Maths Monsters', async () => [])];
    render(<HardestQuestions games={list} />);
    expect(await screen.findByText('Not enough answers yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders nothing without a class', () => {
    picked.classId = null;
    const { container } = render(<HardestQuestions games={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
