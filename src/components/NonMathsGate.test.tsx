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

});
