import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchStudent = vi.hoisted(() => vi.fn());
vi.mock('../data/bondMatch', () => ({ fetchStudentBondMatch: fetchStudent }));

import { BondMatchStudentPanel } from './TeacherBondMatch';

beforeEach(() => {
  fetchStudent.mockReset();
});

describe('the teacher\'s Bond Match panel', () => {
  it('shows stars per bond set and board size', async () => {
    fetchStudent.mockResolvedValue({
      games: 5, lastPlayed: '2026-10-19T00:00:00Z',
      bests: [
        { bondId: 'whole-10', size: 'small', flips: 6, seconds: 40, stars: 3, plays: 2 },
        { bondId: 'whole-10', size: 'large', flips: 20, seconds: 99, stars: 1, plays: 1 },
        { bondId: 'fraction-halves', size: 'medium', flips: 9, seconds: 50, stars: 2, plays: 2 },
      ],
    });
    render(<BondMatchStudentPanel student="s1" />);
    expect(await screen.findByText(/Bond Match: 5 games played, 6 stars across 3 boards/)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Bond Match stars' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByLabelText('small 3 stars, 6 flips')).toHaveTextContent('S ★★★');
    expect(screen.getByLabelText('medium not played')).toHaveTextContent('M –');
    expect(screen.getByLabelText('large 1 stars, 20 flips')).toBeInTheDocument();
    expect(fetchStudent).toHaveBeenCalledWith('s1');
  });

  it('shows nothing for a student who has not played, so nothing appears while the game is off', async () => {
    fetchStudent.mockResolvedValue({ games: 0, lastPlayed: null, bests: [] });
    const { container } = render(<BondMatchStudentPanel student="s1" />);
    await waitFor(() => expect(fetchStudent).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing if it cannot load', async () => {
    fetchStudent.mockImplementation(() => Promise.reject(new Error('no')));
    const { container } = render(<BondMatchStudentPanel student="s1" />);
    await waitFor(() => expect(fetchStudent).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
