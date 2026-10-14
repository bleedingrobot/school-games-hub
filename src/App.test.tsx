import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './App';
import { SoundProvider } from './sound';

function renderAt(path: string) {
  return render(
    <SoundProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SoundProvider>,
  );
}

describe('dashboard', () => {
  it('shows the student, a Play button and both game cards', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Speedy Otter 27' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Play$/ })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Chess' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Checkers' })).toBeInTheDocument();
  });

  it('labels the made-up data as sample data', () => {
    renderAt('/');
    expect(screen.getAllByText('Sample data').length).toBeGreaterThanOrEqual(3);
  });

  it('links to the lobby and leaderboard', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /Play a friend/ })).toHaveAttribute('href', '/lobby');
    expect(screen.getByRole('link', { name: /See the top players/ })).toHaveAttribute('href', '/leaderboard');
  });

  it('carries the chosen bot level into the game link and the big Play button', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const checkers = screen.getByRole('article', { name: 'Checkers' });
    expect(within(checkers).getByRole('radio', { name: 'Easy' })).toBeChecked();

    await user.click(within(checkers).getByRole('radio', { name: 'Medium' }));

    expect(within(checkers).getByRole('link')).toHaveAttribute('href', '/checkers?bot=medium');
    expect(screen.getByRole('link', { name: /^Play$/ })).toHaveAttribute('href', '/checkers?bot=medium');
    expect(within(screen.getByRole('region', { name: 'Speedy Otter 27' })).getByText('Checkers vs Medium bot')).toBeInTheDocument();
  });
});

describe('pages', () => {
  it.each([
    ['/chess?bot=very-easy', 'Chess'],
    ['/checkers', 'Checkers'],
    ['/lobby', 'Lobby'],
    ['/leaderboard', 'Leaderboard'],
    ['/profile', 'My profile'],
  ])('%s shows a friendly coming-soon page', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText('Coming soon!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('shows the bot level picked on the dashboard', () => {
    renderAt('/chess?bot=very-easy');
    expect(screen.getByText('Very Easy')).toBeInTheDocument();
  });

  it('falls back to Easy for a made-up bot level', () => {
    renderAt('/chess?bot=impossible');
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });

  it('has a sign-in placeholder whose button is switched off', () => {
    renderAt('/sign-in');
    expect(screen.getByRole('button', { name: /Sign in/ })).toBeDisabled();
  });

  it('shows a friendly page for unknown addresses', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: /wrong square/ })).toBeInTheDocument();
  });
});

describe('mute button', () => {
  it('starts with sound off and remembers when it is turned on', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const button = screen.getByRole('button', { name: /Sound off/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);

    expect(screen.getByRole('button', { name: /Sound on/ })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('sgh-sound-on')).toBe('true');
  });
});
