import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFocus } from '../../../shared/maths/focus';
import { SoundProvider } from '../../sound';
import { BondMatchHub } from './BondMatchHub';

// A plain function, not vi.fn(): with vi.fn() the rejected promise was reported as unhandled here.
let ladderAnswer: () => Promise<unknown> = async () => null;
let ladderCalls = 0;
vi.mock('../../data/ladder', () => ({ fetchMyLadder: () => { ladderCalls++; return ladderAnswer(); } }));
vi.mock('../../data/bondMatch', () => ({ makeSaver: () => ({ loadBests: async () => [], save: async () => null }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-1' } }) }));

const show = () => render(<SoundProvider><BondMatchHub /></SoundProvider>);

beforeEach(() => { ladderCalls = 0; });

describe('Bond Match in the hub reads the maths focus (read only)', () => {
  it("asks for the student's ladder once and shows the teacher's bond", async () => {
    ladderAnswer = async () => ({
      facts: [],
      settings: {},
      focus: parseFocus({ source: 'teacher-class', skills: ['bonds-1000'], onlyThese: false, endsAt: '2099-01-01T00:00:00Z', canChoose: true, own: null }),
    });
    show();
    expect(await screen.findByTestId('bond-suggested')).toHaveTextContent('Teacher’s pick');
    expect(screen.getByRole('button', { name: /^Your teacher picked this: To 1000 \(hundreds\)/ })).toBeInTheDocument();
    expect(ladderCalls).toBe(1);
  });

  it('works exactly as before when the ladder cannot be read', async () => {
    ladderAnswer = () => Promise.reject(new Error('offline'));
    show();
    await waitFor(() => expect(ladderCalls).toBe(1));
    expect(screen.getByRole('heading', { name: 'What are you practising?' })).toBeInTheDocument();
    expect(screen.queryByTestId('bond-suggested')).toBeNull();
  });
});
