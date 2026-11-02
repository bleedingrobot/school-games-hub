import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classSettings from '../data/classSettings';
import { NonMathsGate } from './NonMathsGate';

vi.mock('../data/classSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classSettings')>()),
  readSettings: vi.fn(),
}));

const as = (role: string) =>
  ({ status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role }, message: null }) as unknown as AuthState;

function show(role: string, on?: boolean) {
  render(
    <AuthContext.Provider value={as(role)}>
      <MemoryRouter>
        <NonMathsGate on={on}>
          <p>The chess board</p>
        </NonMathsGate>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => vi.mocked(classSettings.readSettings).mockReset());

describe('the non-maths games gate', () => {
  it('shows the off screen to a pupil whose class has the switch off', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: false });
    show('student');
    expect(await screen.findByRole('heading', { name: 'Maths games only for now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('The chess board')).not.toBeInTheDocument();
  });

  it('shows the game while the setting loads, and closes it once the setting says off', async () => {
    let answer: (row: Record<string, unknown>) => void = () => {};
    vi.mocked(classSettings.readSettings).mockReturnValue(new Promise((ok) => (answer = ok)));
    show('student');
    expect(screen.getByText('The chess board')).toBeInTheDocument();
    answer({ non_maths_games: false });
    expect(await screen.findByRole('heading', { name: 'Maths games only for now' })).toBeInTheDocument();
  });

  it('shows the game when the switch is on', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: true });
    show('student');
    expect(await screen.findByText('The chess board')).toBeInTheDocument();
  });

  it('shows the game when the row has no value for it', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({});
    show('student');
    expect(await screen.findByText('The chess board')).toBeInTheDocument();
  });

  it('never locks a class out when the settings cannot be read', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue(null);
    show('student');
    expect(await screen.findByText('The chess board')).toBeInTheDocument();
  });

  it('lets a teacher in even when the switch is off', async () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: false });
    show('teacher');
    expect(await screen.findByText('The chess board')).toBeInTheDocument();
    expect(screen.queryByText('Maths games only for now')).not.toBeInTheDocument();
  });

  it('does not check anything for a maths game (on=false)', () => {
    vi.mocked(classSettings.readSettings).mockResolvedValue({ non_maths_games: false });
    show('student', false);
    expect(screen.getByText('The chess board')).toBeInTheDocument();
  });
});
