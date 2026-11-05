import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyPupil, sent, setWorld } from './homePageFake';

/** Each person's home layout (James, 4 Nov 2026): sections fold away and stay folded, and games pin to the top. */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';

const signedIn = (id: string) =>
  ({ status: 'signed-in', profile: { id, display_name: 'Speedy Otter 27', avatar: {}, role: 'student' }, message: null }) as unknown as AuthState;

async function settle() {
  for (let i = 0; i < 30; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function show(id: string, serverLayout?: unknown) {
  const world = busyPupil();
  if (serverLayout) world.jobs.my_home_layout = serverLayout;
  setWorld(world);
  const page = render(
    <AuthContext.Provider value={signedIn(id)}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await settle();
  return page;
}

const toggle = (name: RegExp) => screen.getByRole('button', { name });

describe('the home page layout', () => {
  it('folds a section away and keeps it folded next time, saving it to the server', async () => {
    const page = await show('ana');
    const easy = toggle(/^Easy maths games/);
    expect(easy).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(easy);
    expect(toggle(/^Easy maths games/)).toHaveAttribute('aria-expanded', 'false');
    expect(toggle(/^Easy maths games/).textContent).toMatch(/\d+ games?/);
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(sent).toContain('rpc save_my_home_layout');
    page.unmount();

    await show('ana');
    expect(toggle(/^Easy maths games/)).toHaveAttribute('aria-expanded', 'false');
    expect(toggle(/^Complex maths games/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('pins a game to a Pinned section at the top, and unpins it', async () => {
    await show('ben');
    expect(screen.queryByRole('button', { name: /^📌 Pinned/ })).not.toBeInTheDocument();
    const box = screen.getAllByRole('checkbox', { name: /^Pin .* to top$/ })[0];
    const name = box.getAttribute('aria-label')!.replace(/^Pin (.*) to top$/, '$1');
    fireEvent.click(box);
    const pinned = toggle(/Pinned/).closest('.game-group') as HTMLElement;
    expect(within(pinned).getByRole('heading', { name })).toBeInTheDocument();
    // Only once on the page: it moved.
    expect(screen.getAllByRole('heading', { name })).toHaveLength(1);
    fireEvent.click(within(pinned).getByRole('checkbox', { name: `Pin ${name} to top` }));
    expect(screen.queryByRole('button', { name: /Pinned/ })).not.toBeInTheDocument();
  });

  it('takes the layout saved on the server (from another Chromebook)', async () => {
    await show('cai', { collapsed: ['complex-maths'], pinned: [] });
    expect(toggle(/^Complex maths games/)).toHaveAttribute('aria-expanded', 'false');
  });
});
