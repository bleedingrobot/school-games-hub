import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ladderData from '../data/ladder';
import { AUTO_FOCUS, type MathsFocus } from '../../shared/maths/focus';
import { LADDER } from '../../shared/maths/ladder';
import { newStats, type FactStats } from '../../shared/maths/leitner';
import MathsPathCard from './MathsPathCard';

vi.mock('../data/ladder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/ladder')>()),
  fetchMyLadder: vi.fn(),
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-1', role: 'student' } }) }));

const built = LADDER.filter((s) => s.built);
const secure = (ids: string[]): FactStats[] => built.filter((s) => ids.includes(s.id)).flatMap((s) => s.keys.map((k) => ({ ...newStats(k), attempts: 3, correct: 3, box: 3 })));
const on = (over: Partial<NonNullable<MathsFocus['ladder']>> = {}): MathsFocus => ({
  ...AUTO_FOCUS,
  ladder: { on: true, placed: 'done', placement: 'facts-10', furthest: null, ...over },
});
const show = (focus: MathsFocus, facts: FactStats[] = []) => {
  vi.mocked(ladderData.fetchMyLadder).mockResolvedValue({ facts, settings: {}, focus });
  return render(
    <MemoryRouter>
      <MathsPathCard />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.mocked(ladderData.fetchMyLadder).mockReset();
  localStorage.clear();
});

describe('My maths path on the home page', () => {
  it('shows how many skills are secure, where they are, and no year levels', async () => {
    show(on(), secure(['facts-10', 'dbl-half-10', 'ten-and']));
    expect(await screen.findByRole('heading', { name: /My maths path/ })).toBeInTheDocument();
    expect(screen.getByText(`3 of ${built.length}`)).toBeInTheDocument();
    expect(screen.getByText(/skills secure/)).toBeInTheDocument();
    expect(screen.getByText(/You are here:/).parentElement).toHaveTextContent('Number facts to 20');
    expect(document.body.textContent).not.toMatch(/Year \d/);
  });
});
